// Events on the phone (015, 020): create, change and delete, for every calendar.
// Habits are stored in clock time and other events as real instants (028); the draft the editor
// works with is always in wall time in the phone's zone.
import { db } from './db';
import type { Answer, Calendar, CalendarEvent } from './schema';
import { addDays, daysBetween, type IsoDay } from '../domain/day';
import { expand, type AgendaItem } from '../domain/agenda';
import { endBefore, excludeOne, overrideOne, repeatFromRule, restFrom, ruleFromRepeat, type RepeatDraft, type Scope } from '../domain/series';
import { addMinutes, instantOf, wallOf, type Wall } from '../domain/zone';
import { guessHabitIcon } from '../ui/habit-icon-guess';

export async function calendars(): Promise<Calendar[]> {
  return (await (await db()).getAll('calendars')).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
}

export async function allEvents(): Promise<CalendarEvent[]> {
  return (await db()).getAll('events');
}

export async function getEvent(id: string): Promise<CalendarEvent | undefined> {
  return (await db()).get('events', id);
}

/** R5: a new event's reminder follows its calendar (069: habits get a push at their start). */
export function defaultReminders(c: Calendar | undefined): number[] {
  if (c?.defaultReminders) return c.defaultReminders;
  return c?.trackAsHabits ? [0] : [15];
}

export interface EventDraft {
  title: string;
  calendarId: string;
  allDay: boolean;
  start: Wall; // wall time in the phone's zone; all day: the first day at 00:00
  end: Wall; // all day: the day after the last day, at 00:00
  repeat: RepeatDraft;
  repeatChanged: boolean;
  reminders: number[];
  place: string;
  notes: string;
}

const day = (w: string) => w.slice(0, 10) as IsoDay;
const minutesBetween = (a: string, b: string) => Math.round((Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 60_000);

/** 004: "Diorama - 45 min" ends 45 minutes after it starts. */
export function durationFromTitle(title: string): number | null {
  const m = /(\d+)\s*(min|mins|minutes|h|hr|hrs|hours?)\.?\s*$/i.exec(title.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return /^h/i.test(m[2]!) ? n * 60 : n;
}

/** H30: a new event on `on`, at the next whole hour when that's today, else 09:00. */
export function newDraft(on: IsoDay, cals: Calendar[], now: Date, zone: string): EventDraft {
  const cal = cals.find((c) => c.trackAsHabits) ?? cals[0];
  const nowWall = wallOf(now, zone);
  const hour = day(nowWall) === on ? Math.min(Number(nowWall.slice(11, 13)) + 1, 23) : 9;
  const start = `${on}T${String(hour).padStart(2, '0')}:00` as Wall;
  const weekday = (new Date(`${on}T00:00:00Z`).getUTCDay() + 6) % 7;
  return {
    title: '', calendarId: cal?.id ?? '', allDay: false, start, end: addMinutes(start, 60),
    repeat: { kind: 'none', days: [weekday], until: null }, repeatChanged: false,
    reminders: defaultReminders(cal), place: '', notes: '',
  };
}

/** The editor's draft for one occurrence of a stored event. */
export function draftOf(e: CalendarEvent, item: AgendaItem): EventDraft {
  return {
    title: item.title, calendarId: e.calendarId, allDay: e.allDay, start: item.start, end: item.end,
    repeat: repeatFromRule(e.rrule, item.occurrence), repeatChanged: false,
    reminders: [...e.reminders], place: e.place ?? '', notes: e.notes ?? '',
  };
}

/** Wall time in the phone's zone → how the event stores it (028). */
function stored(w: Wall, clock: boolean, zone: string): string {
  return clock ? w : instantOf(w, zone).toISOString();
}

function base(draft: EventDraft, cal: Calendar | undefined, zone: string, start: Wall, end: Wall): Omit<CalendarEvent, 'id' | 'exdates'> {
  const clock = !!cal?.trackAsHabits || draft.allDay;
  const title = draft.title.trim() || 'Untitled';
  return {
    calendarId: draft.calendarId,
    title,
    start: stored(start, clock, zone),
    end: stored(end, clock, zone),
    allDay: draft.allDay,
    timeMode: cal?.trackAsHabits || draft.allDay ? 'clock' : 'zoned',
    ...(!clock ? { tz: zone } : {}),
    reminders: [...new Set(draft.reminders)].sort((a, b) => a - b),
    ...(draft.place.trim() ? { place: draft.place.trim() } : {}),
    ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
    ...(cal?.trackAsHabits ? { icon: guessHabitIcon(title) } : {}),
  };
}

const ruleOf = (draft: EventDraft) => (draft.repeat.kind === 'none' ? undefined : ruleFromRepeat(draft.repeat));

export async function createEvent(draft: EventDraft, zone: string): Promise<CalendarEvent> {
  const database = await db();
  const cal = await database.get('calendars', draft.calendarId);
  const rrule = ruleOf(draft);
  const event: CalendarEvent = { id: crypto.randomUUID(), ...base(draft, cal, zone, draft.start, draft.end), ...(rrule ? { rrule } : {}), exdates: [] };
  await database.put('events', event);
  return event;
}

const zoneDayOf = (zone: string) => (iso: string) => day(wallOf(new Date(iso), zone));

/** The event's first occurrence on or after `from`, in the phone's zone (null: none left). */
function firstFrom(e: CalendarEvent, from: IsoDay, zone: string): AgendaItem | null {
  return expand(e, from, addDays(from, 400), zone).filter((i) => i.occurrence >= from).sort((a, b) => a.occurrence.localeCompare(b.occurrence))[0] ?? null;
}

/**
 * Saves a change to one occurrence (`item`) of `e`, with the scope chosen in H31.
 * E16: changing "all events" of a habit that already has answers keeps the past as it was: the series
 * is split at today, so past answers keep their original time and title.
 */
export async function saveEdit(e: CalendarEvent, item: AgendaItem, draft: EventDraft, scope: Scope, zone: string, today: IsoDay): Promise<void> {
  const database = await db();
  const cal = await database.get('calendars', draft.calendarId);
  const oldCal = await database.get('calendars', e.calendarId);
  const shift = minutesBetween(item.start, draft.start); // how far the opened occurrence moved
  const length = minutesBetween(draft.start, draft.end);
  const title = draft.title.trim() || 'Untitled';
  const rrule = draft.repeatChanged ? ruleOf(draft) : e.rrule;

  if (scope === 'this' && e.rrule) {
    const clock = e.timeMode === 'clock' || e.allDay;
    await database.put('events', overrideOne(e, item.occurrence, {
      start: stored(draft.start, clock, zone), end: stored(draft.end, clock, zone), title,
    }));
    return;
  }

  let splitDay: IsoDay | null = scope === 'following' && e.rrule ? item.occurrence : null;
  if (scope === 'all' && e.rrule && oldCal?.trackAsHabits) {
    const past = (await database.getAllFromIndex('answers', 'eventId', e.id)).some((a) => a.occurrence < today);
    if (past) splitDay = today;
  }
  const zoneDay = zoneDayOf(zone);

  if (splitDay) {
    const before = endBefore(e, splitDay, zoneDay);
    if (before) {
      const first = splitDay === item.occurrence ? item : firstFrom(e, splitDay, zone);
      if (!first) { await database.put('events', before); return; }
      const start = addMinutes(first.start, shift);
      const rest = restFrom(e, splitDay, crypto.randomUUID(), zoneDay);
      const next = tidy(e, {
        ...rest, ...base(draft, cal, zone, start, addMinutes(start, length)),
        ...(rrule ? { rrule: draft.repeatChanged ? rrule : rest.rrule } : {}),
      }, rrule, !!cal?.trackAsHabits);
      await moveSeries(e.id, next.id, splitDay, before, next);
      return;
    }
  }

  // The series itself (or a single event) changes. Its first occurrence moves as the opened one did.
  const clock = e.timeMode === 'clock' || e.allDay;
  const firstStart = clock ? (e.start.slice(0, 16) as Wall) : wallOf(new Date(e.start), zone);
  const start = e.rrule ? addMinutes(firstStart, shift) : draft.start;
  await database.put('events', tidy(e, { ...e, ...base(draft, cal, zone, start, addMinutes(start, length)), ...(rrule ? { rrule } : {}) }, rrule, !!cal?.trackAsHabits));
}

/** Loose ends after a change: a removed repeat, a zone that no longer applies, a habit's chosen icon. */
function tidy(old: CalendarEvent, next: CalendarEvent, rrule: string | undefined, habit: boolean): CalendarEvent {
  const out = { ...next };
  if (!rrule) delete out.rrule;
  if (out.timeMode === 'clock') delete out.tz;
  if (habit && old.icon) out.icon = old.icon; // keep an icon chosen in the habit editor
  if (!habit) delete out.icon;
  // Moved occurrences are stored in the old time mode; after a change of mode they can't be read back.
  if (old.timeMode !== out.timeMode) delete out.overrides;
  return out;
}

/** "This and following": the old series ends, the new one starts, and answers from `day` on follow it. */
async function moveSeries(oldId: string, newId: string, from: IsoDay, before: CalendarEvent, after: CalendarEvent): Promise<void> {
  const database = await db();
  const tx = database.transaction(['events', 'answers'], 'readwrite');
  const answers = tx.objectStore('answers');
  const moving = (await answers.index('eventId').getAll(oldId)).filter((a) => a.occurrence >= from);
  await Promise.all([
    tx.objectStore('events').put(before),
    tx.objectStore('events').put(after),
    ...moving.flatMap((a) => [answers.delete(a.key), answers.put({ ...a, eventId: newId, key: `${newId}|${a.occurrence}` } satisfies Answer)]),
  ]);
  await tx.done;
}

/** Deletes one occurrence, this and the following ones, or the whole event. */
export async function deleteEvent(e: CalendarEvent, occurrence: IsoDay, scope: Scope, zone: string): Promise<void> {
  const database = await db();
  if (scope === 'this' && e.rrule) { await database.put('events', excludeOne(e, occurrence)); return; }
  if (scope === 'following' && e.rrule) {
    const before = endBefore(e, occurrence, zoneDayOf(zone));
    if (before) { await database.put('events', before); return; }
  }
  await database.delete('events', e.id);
}

/** H32 "Keep history, delete future events": the habit stops from today (E9); answers and ranks stay. */
export async function archiveHabit(e: CalendarEvent, today: IsoDay): Promise<void> {
  await (await db()).put('events', { ...e, archivedOn: today });
}

/** H32 "Delete everything": the habit, its answers and its ranks. Cannot be undone. */
export async function deleteHabitEverything(e: CalendarEvent): Promise<void> {
  const database = await db();
  const tx = database.transaction(['events', 'answers', 'ranks'], 'readwrite');
  const answers = await tx.objectStore('answers').index('eventId').getAllKeys(e.id);
  const ranks = await tx.objectStore('ranks').index('seriesId').getAllKeys(e.id);
  await Promise.all([
    tx.objectStore('events').delete(e.id),
    ...answers.map((k) => tx.objectStore('answers').delete(k)),
    ...ranks.map((k) => tx.objectStore('ranks').delete(k)),
  ]);
  await tx.done;
}

/** Does deleting this habit lose answers (H32)? */
export async function hasAnswers(eventId: string): Promise<boolean> {
  return (await (await db()).countFromIndex('answers', 'eventId', eventId)) > 0;
}

/** Days from today to an occurrence, for labels like "Tomorrow". */
export const daysFrom = (today: IsoDay, d: IsoDay) => daysBetween(today, d);
