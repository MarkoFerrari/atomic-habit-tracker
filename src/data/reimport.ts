// Importing an .ics file into a calendar after onboarding (H44, E8). Events are matched by their ID
// (UID): the same event already on the phone is skipped, a changed one is listed and updated on approval,
// a new one is added. Answers stay on their events, because an updated event keeps its own id.
import { db } from './db';
import type { Calendar, CalendarEvent } from './schema';
import type { IcsCalendar } from './ics';
import { toCalendarEvent } from './import';
import { nextColour } from './calendars';

export interface ReimportPlan {
  fresh: CalendarEvent[]; // not on the phone yet (ids are placeholders until the target is known)
  same: number; // already here and unchanged: skipped
  changed: { before: CalendarEvent; after: CalendarEvent }[]; // already here, changed in the file
  repeating: number;
  total: number;
}

/** What an import would do, without touching anything. */
export function planReimport(ics: IcsCalendar, existing: readonly CalendarEvent[], target: Calendar | null, zone: string): ReimportPlan {
  const byUid = new Map(existing.filter((e) => e.icsUid).map((e) => [e.icsUid!, e]));
  const clock = !!target?.trackAsHabits;
  const plan: ReimportPlan = { fresh: [], same: 0, changed: [], repeating: ics.events.filter((e) => e.rrule).length, total: ics.events.length };
  for (const e of ics.events) {
    const before = byUid.get(e.uid);
    if (!before) { plan.fresh.push(toCalendarEvent(e, target?.id ?? '', clock, zone, ics.overrides)); continue; }
    // A matched event keeps its calendar and time mode; the file brings its times, title and repeat.
    const read = toCalendarEvent(e, before.calendarId, before.timeMode === 'clock', zone, ics.overrides);
    const after: CalendarEvent = {
      ...before,
      title: read.title, start: read.start, end: read.end, allDay: read.allDay, exdates: read.exdates,
      ...(read.tz ? { tz: read.tz } : {}),
    };
    if (read.rrule) after.rrule = read.rrule; else delete after.rrule;
    if (read.overrides) after.overrides = read.overrides; else delete after.overrides;
    if (read.place) after.place = read.place; else delete after.place;
    if (read.notes) after.notes = read.notes; else delete after.notes;
    const same = JSON.stringify(pick(before)) === JSON.stringify(pick(after));
    if (same) plan.same += 1; else plan.changed.push({ before, after });
  }
  return plan;
}

const pick = (e: CalendarEvent) => ({ t: e.title, s: e.start, e: e.end, a: e.allDay, r: e.rrule ?? null, x: [...e.exdates].sort(), o: e.overrides ?? null, p: e.place ?? null, n: e.notes ?? null });

export interface ReimportResult { added: number; updated: number; calendarId: string }

/**
 * Saves the plan into `target`, or into a new calendar named after the file. `update`: whether changed
 * events take the file's version (H44 "update them?").
 */
export async function commitReimport(plan: ReimportPlan, target: Calendar | { newName: string }, update: boolean): Promise<ReimportResult> {
  const database = await db();
  let calendar: Calendar;
  if ('newName' in target) {
    const cals = await database.getAll('calendars');
    calendar = { id: crypto.randomUUID(), name: target.newName, color: nextColour(cals), trackAsHabits: false, createdAt: new Date().toISOString() };
  } else calendar = target;
  const tx = database.transaction(['calendars', 'events'], 'readwrite');
  if ('newName' in target) await tx.objectStore('calendars').put(calendar);
  for (const e of plan.fresh) {
    // Fresh events were read for the target chosen in the preview (plan again when it changes).
    await tx.objectStore('events').put({ ...e, id: crypto.randomUUID(), calendarId: calendar.id });
  }
  if (update) for (const { after } of plan.changed) await tx.objectStore('events').put(after);
  await tx.done;
  return { added: plan.fresh.length, updated: update ? plan.changed.length : 0, calendarId: calendar.id };
}
