// Answers (done / skipped) and the habits Today reads. History is append-only (§4 data model):
// changing an answer adds a line; only an Undo within the toast's few seconds removes a fresh answer.
import { db } from './db';
import type { Answer, CalendarEvent } from './schema';
import type { IsoDay } from '../domain/day';
import { isEditable } from '../domain/day';
import type { AnswerStatus, SkipReason } from '../domain/states';
import type { HabitSource } from '../domain/today';

const keyOf = (eventId: string, occurrence: string) => `${eventId}|${occurrence}`;

/** Every habit: events in calendars tracked as habits (003, 023). */
export async function habitEvents(): Promise<CalendarEvent[]> {
  const database = await db();
  const tracked = new Set((await database.getAll('calendars')).filter((c) => c.trackAsHabits).map((c) => c.id));
  return (await database.getAll('events')).filter((e) => tracked.has(e.calendarId));
}

export const toSource = (e: CalendarEvent): HabitSource => ({
  id: e.id, title: e.title, icon: e.icon, start: e.start, end: e.end, allDay: e.allDay,
  rrule: e.rrule, exdates: e.exdates, overrides: e.overrides, archivedOn: e.archivedOn,
  after: e.after, smallest: e.smallest, identity: e.identity,
});

export async function answersOn(day: IsoDay): Promise<Answer[]> {
  return (await db()).getAllFromIndex('answers', 'occurrence', day);
}

export async function answersFor(eventId: string): Promise<Answer[]> {
  return (await db()).getAllFromIndex('answers', 'eventId', eventId);
}

export class ReadOnlyAnswerError extends Error {
  constructor() { super('Answers can be changed for 7 days, then they become read-only.'); }
}

/**
 * Saves an answer and returns what was there before, so the caller can undo.
 * R2 / E4: only occurrences from the last 7 days can be answered or changed.
 */
export async function answer(eventId: string, occurrence: IsoDay, status: AnswerStatus, today: IsoDay, reason?: SkipReason, small = false): Promise<Answer | null> {
  if (!isEditable(occurrence, today)) throw new ReadOnlyAnswerError();
  const database = await db();
  const key = keyOf(eventId, occurrence);
  const before = (await database.get('answers', key)) ?? null;
  const ts = new Date().toISOString();
  const next: Answer = {
    key, eventId, occurrence, status, answeredAt: ts,
    ...(status === 'skipped' && reason ? { reason } : {}),
    ...(status === 'done' && small ? { small: true } : {}), // 086
    history: [...(before?.history ?? []), { ts, from: before?.status ?? null, to: status }],
  };
  await database.put('answers', next);
  return before;
}

/** Undo (H12): puts back exactly what was there before the last answer. */
export async function undoAnswer(eventId: string, occurrence: IsoDay, before: Answer | null): Promise<void> {
  const database = await db();
  if (before) await database.put('answers', before);
  else await database.delete('answers', keyOf(eventId, occurrence));
}

/**
 * 087 (P5): plan B. Moves one occurrence to a later time the same day, without answering it.
 * Stored as a single-occurrence override, so the series, past answers and the push queue follow the usual rules.
 * Returns what was there before, for Undo.
 */
export async function moveOccurrence(eventId: string, occurrence: IsoDay, start: string, end: string): Promise<CalendarEvent['overrides']> {
  const database = await db();
  const event = await database.get('events', eventId);
  if (!event) return undefined;
  const before = event.overrides;
  await database.put('events', { ...event, overrides: { ...(before ?? {}), [occurrence]: { start, end } } });
  return before;
}

export async function restoreOverrides(eventId: string, overrides: CalendarEvent['overrides']): Promise<void> {
  const database = await db();
  const event = await database.get('events', eventId);
  if (!event) return;
  const next = { ...event };
  if (overrides && Object.keys(overrides).length) next.overrides = overrides; else delete next.overrides;
  await database.put('events', next);
}
