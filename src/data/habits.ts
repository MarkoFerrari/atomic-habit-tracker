// The habits list (H45): one row per habit series in a calendar tracked as habits.
// Active: still repeating and not archived. Archived (E9): stopped, history and ranks kept.
// Series that simply ended (Proton splits a series at every edit) are history, not habits.
import { db } from './db';
import type { CalendarEvent } from './schema';
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
