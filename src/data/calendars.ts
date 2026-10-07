// Calendars (H42, H43, H49): name, marker colour (034), Track as habits, default reminder (R5), delete.
import { db } from './db';
import type { Calendar, CalendarEvent, CalendarToken } from './schema';
import { instantOf, wallOf, type Wall } from '../domain/zone';
import { guessHabitIcon } from '../ui/habit-icon-guess';

// 046, 081: twelve marker hues, so up to twelve calendars each keep their own.
export const TOKENS: CalendarToken[] = ['marko', 'work', 'family', 'habits', 'violet', 'orange', 'teal', 'brown', 'slate', 'plum', 'gold', 'sky'];
/** The spoken name of each hue (the first four tokens are historic names, not colours). */
export const COLOUR_NAME: Record<CalendarToken, string> = {
  marko: 'Green', work: 'Crimson', family: 'Blue', habits: 'Olive', violet: 'Violet', orange: 'Orange',
  teal: 'Teal', brown: 'Brown', slate: 'Slate', plum: 'Plum', gold: 'Gold', sky: 'Sky',
};

/** How many events each calendar holds. */
export async function eventCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const e of await (await db()).getAll('events')) counts.set(e.calendarId, (counts.get(e.calendarId) ?? 0) + 1);
  return counts;
}

/** The first marker colour no calendar uses yet; when all twelve are taken (E13), the least used one. */
export function nextColour(cals: readonly Calendar[]): CalendarToken {
  const used = TOKENS.map((t) => cals.filter((c) => c.color === t).length);
  return TOKENS[used.indexOf(Math.min(...used))]!;
}

/** 079: New habit on an empty Today. Uses the calendar already tracked as habits, or makes the HABITS one. */
export async function ensureHabitCalendar(): Promise<Calendar> {
  const database = await db();
  const all = await database.getAll('calendars');
  const found = all.find((c) => c.trackAsHabits);
  if (found) return found;
  const made: Calendar = { id: crypto.randomUUID(), name: 'HABITS', color: 'habits', trackAsHabits: true, createdAt: new Date().toISOString() };
  await database.put('calendars', made);
  return made;
}

export async function saveCalendar(c: Calendar): Promise<void> {
  const database = await db();
  const before = await database.get('calendars', c.id);
  if (before && before.trackAsHabits !== c.trackAsHabits) await setTrackAsHabits(before, c.trackAsHabits);
  await database.put('calendars', { ...c });
}

/**
 * Track as habits on or off (003, 028): habits keep clock time, other events keep real time, so every
 * event in the calendar changes how it stores its times. Moved occurrences convert too.
 */
export async function setTrackAsHabits(c: Calendar, on: boolean, zone = Intl.DateTimeFormat().resolvedOptions().timeZone): Promise<void> {
  const database = await db();
  const events = await database.getAllFromIndex('events', 'calendarId', c.id);
  const toClock = (iso: string, tz: string) => wallOf(new Date(iso), tz);
  const toZoned = (wall: string) => instantOf(wall.slice(0, 16) as Wall, zone).toISOString();
  const tx = database.transaction(['events', 'calendars'], 'readwrite');
  for (const e of events) {
    if (e.allDay) { await tx.objectStore('events').put({ ...e, ...(on ? { icon: e.icon ?? guessHabitIcon(e.title) } : {}) }); continue; }
    let next: CalendarEvent;
    if (on && e.timeMode === 'zoned') {
      const tz = e.tz ?? zone;
      next = {
        ...e, timeMode: 'clock', start: toClock(e.start, tz), end: toClock(e.end, tz), icon: e.icon ?? guessHabitIcon(e.title),
        ...(e.overrides ? { overrides: Object.fromEntries(Object.entries(e.overrides).map(([d, o]) => [d, { ...o, ...(o.start ? { start: toClock(o.start, tz), end: toClock(o.end, tz) } : {}) }])) } : {}),
      };
      delete next.tz;
    } else if (!on && e.timeMode === 'clock') {
      next = {
        ...e, timeMode: 'zoned', tz: zone, start: toZoned(e.start), end: toZoned(e.end),
        ...(e.overrides ? { overrides: Object.fromEntries(Object.entries(e.overrides).map(([d, o]) => [d, { ...o, ...(o.start ? { start: toZoned(o.start), end: toZoned(o.end) } : {}) }])) } : {}),
      };
      delete next.icon;
    } else continue;
    await tx.objectStore('events').put(next);
  }
  await tx.objectStore('calendars').put({ ...c, trackAsHabits: on });
  await tx.done;
}

/** Sets the calendar's default reminder; `existing` also applies it to every event already in it. */
export async function setDefaultReminders(c: Calendar, minutes: number[], existing: boolean): Promise<void> {
  const database = await db();
  const tx = database.transaction(['events', 'calendars'], 'readwrite');
  await tx.objectStore('calendars').put({ ...c, defaultReminders: [...minutes] });
  if (existing) {
    for (const e of await tx.objectStore('events').index('calendarId').getAll(c.id)) {
      await tx.objectStore('events').put({ ...e, reminders: [...minutes] });
    }
  }
  await tx.done;
}

/** H49: the calendar, its events and their answers go. Cannot be undone (the sheet offers a backup first). */
export async function deleteCalendar(c: Calendar): Promise<number> {
  const database = await db();
  const tx = database.transaction(['events', 'calendars', 'answers'], 'readwrite');
  const ids = await tx.objectStore('events').index('calendarId').getAllKeys(c.id);
  for (const id of ids) {
    await tx.objectStore('events').delete(id);
    for (const key of await tx.objectStore('answers').index('eventId').getAllKeys(id)) await tx.objectStore('answers').delete(key);
  }
  await tx.objectStore('calendars').delete(c.id);
  await tx.done;
  return ids.length;
}
