// 119: Per week (Playground 10, owner approved 14 Oct 2026): "Gym 3 times a week", any days.
// A per-week habit can be done on any day of its week (Monday to Sunday) but is not due on a single day, so it never
// spoils a perfect day and is never missed by itself. It becomes due on its must-do days: when the days left in the
// week equal the times still to do. A week is held when the target is met. For runs, a week not held is one miss,
// and two in a row end the run (051, in weeks); days held stay calendar days (060). Pure rules.
import { addDays, type IsoDay } from './day';
import type { AnswerLike, HabitSource } from './today';
import type { DueDay } from './runs';
import { isPaused } from './pause';
import { firstDayOf } from './versions';

export const PER_WEEK_MIN = 1;
export const PER_WEEK_MAX = 6;

export const mondayOf = (d: IsoDay): IsoDay => addDays(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));

export interface WeekProgress {
  monday: IsoDay;
  available: IsoDay[]; // days of this week the habit can be done (its start, pauses and archive allowing)
  done: IsoDay[];
  target: number; // the times a week, never more than the days available
}

const isPerWeek = (h: Pick<HabitSource, 'perWeek'>) => !!h.perWeek && h.perWeek > 0;
export { isPerWeek };

/** One habit's week: which days it can be done, which are done, and the target that week. */
export function weekProgress(h: HabitSource, answers: readonly AnswerLike[], monday: IsoDay, notBefore?: IsoDay): WeekProgress {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  // a per-week habit repeats every day (FREQ=DAILY); its start, an archive and a pause take days away
  const first = firstDayOf(h);
  const available = days.filter((d) => d >= first && (!notBefore || d >= notBefore) && !(h.archivedOn && d >= h.archivedOn) && !isPaused(h.pauses, d));
  const done = available.filter((d) => answers.some((a) => a.eventId === h.id && a.occurrence === d && a.status === 'done'));
  return { monday, available, done, target: Math.min(h.perWeek ?? 0, available.length) };
}

/** Times still to do before `day`, and the days left from `day` to the end of the week. */
export function leftOn(w: WeekProgress, day: IsoDay): { left: number; daysLeft: number } {
  const doneBefore = w.done.filter((d) => d < day).length;
  return { left: Math.max(0, w.target - doneBefore), daysLeft: w.available.filter((d) => d >= day).length };
}

/** A must-do day: as many times still to do as days left. Due that day, with the usual rules. */
export function isMustDo(w: WeekProgress, day: IsoDay): boolean {
  if (!w.available.includes(day)) return false;
  const { left, daysLeft } = leftOn(w, day);
  return left > 0 && left >= daysLeft;
}

export const isHeld = (w: WeekProgress) => w.target > 0 && w.done.length >= w.target;

/**
 * The run history of a per-week habit (051 in weeks): each finished week held gives its done days; a finished week
 * not held gives one miss, on its last day; the week in progress gives its done days so far.
 */
export function weeklyHistory(h: HabitSource, answers: readonly AnswerLike[], from: IsoDay, to: IsoDay): DueDay[] {
  const out: DueDay[] = [];
  for (let monday = mondayOf(from); monday <= to; monday = addDays(monday, 7)) {
    const w = weekProgress(h, answers, monday, from);
    if (!w.available.length) continue;
    const finished = addDays(monday, 6) < to; // a week ending today can still be held
    const doneSoFar = w.done.filter((d) => d <= to);
    if (!finished) { out.push(...doneSoFar.map((day) => ({ day, status: 'done' as const }))); continue; }
    if (isHeld(w)) out.push(...w.done.map((day) => ({ day, status: 'done' as const })));
    else out.push({ day: w.available.at(-1)!, status: 'missed' });
  }
  return out;
}
