// 069: a push when each habit starts, instead of the 22:30 recap push. Pure rules: which occurrences get
// a reminder in the coming days, when it fires (clock time in the phone's zone, 028), and what it says.
import { addDays, type IsoDay } from './day';
import { occurrencesOn, type HabitSource } from './today';
import { instantOf } from './zone';

export const REMINDER_DAYS = 14; // §10: the function holds the next 14 days
export const MAX_REMINDERS = 500; // the function's queue limit

export interface PlannedReminder {
  id: string; // unique in the queue; the function's id rule allows [A-Za-z0-9_.:-]
  fireAt: string; // UTC ISO
  title: string; // shown as the notification title, encrypted before it leaves the phone (021)
  body: string; // "08:00 · 30 min"
  tag: string; // one notification per occurrence
}

const clock = (wall: string) => wall.slice(11, 16);

/**
 * Every timed habit occurrence from `fromDay` for `days` days that starts after `now` and has no answer yet.
 * All-day habits get no reminder: they have no start time (E7).
 */
export function planReminders(
  habits: readonly HabitSource[], answered: ReadonlySet<string>, fromDay: IsoDay, now: Date, zone: string, days = REMINDER_DAYS,
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (let i = 0; i < days && out.length < MAX_REMINDERS; i += 1) {
    const day = addDays(fromDay, i);
    occurrencesOn(habits, day).forEach((o, n) => {
      if (o.allDay || answered.has(`${o.eventId}|${o.occurrence}`)) return;
      const at = instantOf(o.start, zone);
      if (at.getTime() <= now.getTime() || out.length >= MAX_REMINDERS) return;
      out.push({
        id: `${day}.${n}`,
        fireAt: at.toISOString(),
        title: o.title,
        body: `${clock(o.start)} · ${o.minutes} min`,
        tag: `${o.eventId}|${o.occurrence}`,
      });
    });
  }
  return out;
}
