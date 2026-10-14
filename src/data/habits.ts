// The habits list (H45): one row per habit series in a calendar tracked as habits.
// Active: still repeating and not archived. Archived (E9): stopped, history and ranks kept.
// Series that simply ended (Proton splits a series at every edit) are history, not habits.
import { db } from './db';
import type { Answer, CalendarEvent, RankRecord, Settings } from './schema';
import type { IsoDay } from '../domain/day';
import { wallOf } from '../domain/zone';
import { snapshot, splitChains } from '../domain/versions';
import { endPause, PauseError, withPause, type Pause } from '../domain/pause';

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

/**
 * 115, a one-time repair: before 0.8.2, changing a habit's time or repeat split it into a new habit with a
 * new id, so its run started again (U15). This joins each such chain back into its first habit: the earlier
 * schedules become past versions, answers and rank records move to the first id, and settings that name a
 * later id (ranks seen, quotes, trials) are pointed at it. Runs once per phone, and again after restoring a
 * backup made before it (the flag lives in the settings record). Returns how many habits were joined.
 */
export async function joinSplitHabits(): Promise<number> {
  const database = await db();
  const tx = database.transaction(['calendars', 'events', 'answers', 'ranks', 'settings'], 'readwrite');
  const settings = (await tx.objectStore('settings').get('settings')) as Settings | undefined;
  if (!settings || settings.seriesJoined) { await tx.done; return 0; }
  const tracked = new Set((await tx.objectStore('calendars').getAll()).filter((c) => c.trackAsHabits).map((c) => c.id));
  const events = (await tx.objectStore('events').getAll()).filter((e) => tracked.has(e.calendarId) && e.rrule);
  const answers = await tx.objectStore('answers').getAll();
  const days = new Map<string, IsoDay[]>();
  for (const a of answers) days.set(a.eventId, [...(days.get(a.eventId) ?? []), a.occurrence]);
  const chains = splitChains(events, days);
  const byId = new Map(events.map((e) => [e.id, e]));
  let text = JSON.stringify(settings);
  let joined = 0;
  for (const chain of chains) {
    const parts = chain.map((id) => byId.get(id)!);
    const head = parts[0]!;
    const last = parts.at(-1)!;
    const past = parts.slice(0, -1).flatMap((p) => [...(p.past ?? []), snapshot(p)]);
    const merged: CalendarEvent = {
      ...last, id: head.id, icon: head.icon ?? last.icon, past,
      ...(head.icsUid ? { icsUid: head.icsUid } : {}),
    };
    if (!head.icsUid) delete merged.icsUid;
    await tx.objectStore('events').put(merged);
    const ranks = await tx.objectStore('ranks').getAll();
    for (const tail of parts.slice(1)) {
      for (const a of answers.filter((x) => x.eventId === tail.id)) {
        await tx.objectStore('answers').delete(a.key);
        await tx.objectStore('answers').put({ ...a, eventId: head.id, key: `${head.id}|${a.occurrence}` });
      }
      for (const r of ranks.filter((x) => x.seriesId === tail.id)) {
        await tx.objectStore('ranks').delete(r.key);
        const key = `${head.id}|${r.rank}`;
        const kept = ranks.find((x) => x.key === key);
        if (!kept || kept.reachedOn > r.reachedOn) {
          const moved = { ...r, key, seriesId: head.id };
          await tx.objectStore('ranks').put(moved);
          ranks.splice(kept ? ranks.indexOf(kept) : ranks.length, kept ? 1 : 0, moved);
        }
      }
      await tx.objectStore('events').delete(tail.id);
      text = text.split(tail.id).join(head.id); // ids are UUIDs: they appear nowhere else
      joined += 1;
    }
  }
  await tx.objectStore('settings').put({ ...(JSON.parse(text) as Settings), seriesJoined: true });
  await tx.done;
  return joined;
}

/** 117: pause a habit ahead of time, with a reason. Throws PauseError when the rules say no. */
export async function pauseHabit(eventId: string, p: Omit<Pause, 'setOn'>, today: IsoDay): Promise<CalendarEvent> {
  const database = await db();
  const event = await database.get('events', eventId);
  if (!event) throw new PauseError('This habit isn’t here any more.');
  const next = { ...event, pauses: withPause(event.pauses, { ...p, setOn: today }, today) };
  await database.put('events', next);
  return next;
}

/** 117: bring a paused habit back today (or drop a pause set ahead). */
export async function resumeHabit(eventId: string, today: IsoDay): Promise<void> {
  const database = await db();
  const event = await database.get('events', eventId);
  if (!event) return;
  await database.put('events', { ...event, pauses: endPause(event.pauses, today) });
}
