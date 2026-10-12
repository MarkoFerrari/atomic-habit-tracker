// The habits list (H45): one row per habit series in a calendar tracked as habits.
// Active: still repeating and not archived. Archived (E9): stopped, history and ranks kept.
// Series that simply ended (Proton splits a series at every edit) are history, not habits.
import { db } from './db';
import type { Answer, CalendarEvent, RankRecord, Settings } from './schema';
import type { IsoDay } from '../domain/day';
import { wallOf } from '../domain/zone';

const untilOf = (rrule: string) => { const m = /UNTIL=(\d{4})(\d{2})(\d{2})/.exec(rrule); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };

export async function activeHabits(today: IsoDay = wallOf(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone).slice(0, 10) as IsoDay):
  Promise<{ active: CalendarEvent[]; archived: CalendarEvent[] }> {
  const database = await db();
  const tracked = new Set((await database.getAll('calendars')).filter((c) => c.trackAsHabits).map((c) => c.id));
  const series = (await database.getAll('events')).filter((e) => tracked.has(e.calendarId) && e.rrule);
  const byTime = (a: CalendarEvent, b: CalendarEvent) => a.start.slice(11).localeCompare(b.start.slice(11)) || a.title.localeCompare(b.title);
  return {
    active: series.filter((e) => (!e.archivedOn || e.archivedOn > today) && (untilOf(e.rrule!) ?? today) >= today).sort(byTime),
    archived: series.filter((e) => e.archivedOn && e.archivedOn <= today).sort(byTime),
  };
}

export async function saveHabit(e: CalendarEvent, change: { title: string; icon: string }): Promise<void> {
  await (await db()).put('events', { ...e, title: change.title.trim() || e.title, icon: change.icon });
}

/** Brings an archived habit back from today (not designed: logged as 074). */
export async function unarchiveHabit(e: CalendarEvent): Promise<void> {
  const next = { ...e };
  delete next.archivedOn;
  await (await db()).put('events', next);
}

/** What a delete removed, kept in memory so Undo can put it back (112, option B). Never written anywhere. */
export interface DeletedHabit {
  event: CalendarEvent;
  answers: Answer[];
  ranks: RankRecord[];
  adjustments: Settings['adjustments'];
}

/**
 * 112: delete a habit for good: the series, its answers and its rank records (the one exception to 084).
 * An active Kaizen trial on it ends as dropped, so nothing is ever erased from the trial history (083).
 * Perfect days and weeks already celebrated stay as earned. A backup made before still holds it (026).
 */
export async function deleteHabit(e: CalendarEvent, today: IsoDay): Promise<DeletedHabit> {
  const database = await db();
  const tx = database.transaction(['events', 'answers', 'ranks', 'settings'], 'readwrite');
  const answers = await tx.objectStore('answers').index('eventId').getAll(e.id);
  const ranks = await tx.objectStore('ranks').index('seriesId').getAll(e.id);
  const settings = (await tx.objectStore('settings').get('settings')) as Settings | undefined;
  const adjustments = settings?.adjustments;
  await Promise.all([
    tx.objectStore('events').delete(e.id),
    ...answers.map((a) => tx.objectStore('answers').delete(a.key)),
    ...ranks.map((r) => tx.objectStore('ranks').delete(r.key)),
  ]);
  if (settings && adjustments?.some((a) => a.habitId === e.id && a.status === 'active')) {
    const ended = adjustments.map((a) => (a.habitId === e.id && a.status === 'active' ? { ...a, status: 'dropped' as const, endedOn: today } : a));
    await tx.objectStore('settings').put({ ...settings, adjustments: ended });
  }
  await tx.done;
  return { event: e, answers, ranks, adjustments };
}

/** Undo (5 s, toast-hold): everything a delete removed comes back as it was. */
export async function restoreHabit(d: DeletedHabit): Promise<void> {
  const database = await db();
  const tx = database.transaction(['events', 'answers', 'ranks', 'settings'], 'readwrite');
  await tx.objectStore('events').put(d.event);
  for (const a of d.answers) await tx.objectStore('answers').put(a);
  for (const r of d.ranks) await tx.objectStore('ranks').put(r);
  const settings = (await tx.objectStore('settings').get('settings')) as Settings | undefined;
  if (settings && d.adjustments) await tx.objectStore('settings').put({ ...settings, adjustments: d.adjustments });
  await tx.done;
}
