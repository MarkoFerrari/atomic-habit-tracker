// Reminders as pushes (021, 069). Pure rules: which occurrences in the coming days get a push, when it
// fires, and what it says. Each event carries its reminders as minutes before its start; 0 is "at the
// start", the habits' default (069). A habit answered early gets no push.
import { addDays, type IsoDay } from './day';
import { agenda, itemKey, timeRange, type EventSource } from './agenda';

export const REMINDER_DAYS = 14; // §10: the function holds the next 14 days
export const MAX_REMINDERS = 500; // the function's queue limit

export interface ReminderSource extends EventSource { reminders: number[] }

export interface PlannedReminder {
  id: string; // unique in the queue; the function's id rule allows [A-Za-z0-9_.:-]
  fireAt: string; // UTC ISO
  title: string; // shown as the notification title, encrypted before it leaves the phone (021)
  body: string; // "08:00 · 30 min", "In 15 min · 10:00–11:00"
  tag: string; // `${eventId}|${occurrence}`: one notification per occurrence, and what a tap opens
}

/** "15 min", "1 h", "2 h 30 min", "1 day". */
export function beforeLabel(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} ${minutes === 1440 ? 'day' : 'days'}`;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Every reminder from `now` over the next `days` days, soonest first, capped at the function's limit.
 * Habits (events in `habitCalendars`) skip answered occurrences, and all-day habits get none (E7).
 */
export function planReminders(
  events: readonly ReminderSource[], habitCalendars: ReadonlySet<string>, answered: ReadonlySet<string>,
  fromDay: IsoDay, now: Date, zone: string, days = REMINDER_DAYS,
): PlannedReminder[] {
  const byId = new Map(events.map((e) => [e.id, e]));
  // A day earlier too: an all-day event's "15 h before" fires the evening before.
  const items = agenda(events, addDays(fromDay, -1), addDays(fromDay, days - 1), zone);
  const out: Omit<PlannedReminder, 'id'>[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const habit = habitCalendars.has(item.calendarId);
    const key = itemKey(item);
    if (seen.has(key)) continue; // an event over several days is one occurrence
    seen.add(key);
    if (habit && (item.allDay || answered.has(key))) continue;
    const day = item.start.slice(0, 10) as IsoDay;
    const range = timeRange(item, day);
    const minutes = Math.round((item.endAt - item.startAt) / 60_000);
    for (const before of new Set(byId.get(item.eventId)?.reminders ?? [])) {
      const fireAt = item.startAt - before * 60_000;
      if (fireAt <= now.getTime()) continue;
      const body = habit
        ? `${item.start.slice(11, 16)} · ${minutes} min`
        : before === 0 ? range : `In ${beforeLabel(before)} · ${range}`;
      out.push({ fireAt: new Date(fireAt).toISOString(), title: item.title, body, tag: key });
    }
  }
  return out
    .sort((a, b) => a.fireAt.localeCompare(b.fireAt) || a.tag.localeCompare(b.tag))
    .slice(0, MAX_REMINDERS)
    .map((r, i) => ({ id: `r${i}`, ...r }));
}

/** H29/H30: "At the start", "15 min before", "15 min and 1 h before", "None". */
export function reminderLabel(minutes: readonly number[]): string {
  const list = [...new Set(minutes)].sort((a, b) => a - b);
  if (!list.length) return 'None';
  if (list.length === 1 && list[0] === 0) return 'At the start';
  const words = list.map((m) => (m === 0 ? 'at the start' : beforeLabel(m)));
  const joined = words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0]!;
  const text = list.some((m) => m > 0) ? `${joined} before` : joined;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
