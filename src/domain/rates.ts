import type { IsoDay } from './day';
import type { HabitState } from './states';

// 006: completion rate = done ÷ due, always shown with the number due.
// 033: days before tracking started and days ahead are excluded, never counted as zero.

export interface Occurrence { day: IsoDay; state: HabitState }
export interface Rate { done: number; due: number; rate: number | null }

export function completionRate(
  occurrences: readonly Occurrence[],
  range: { from: IsoDay; to: IsoDay },
  trackingStart: IsoDay,
  today: IsoDay,
): Rate {
  const start = range.from > trackingStart ? range.from : trackingStart;
  const end = range.to < today ? range.to : today;
  let done = 0;
  let due = 0;
  for (const o of occurrences) {
    if (o.day < start || o.day > end) continue;
    if (o.state === 'open' || o.state === 'running') continue; // not decided yet
    due += 1;
    if (o.state === 'done') done += 1;
  }
  return { done, due, rate: due === 0 ? null : done / due };
}

/** Perfect Day: every due habit of the day done. A day with nothing due is not perfect, just empty. */
export function isPerfectDay(states: readonly HabitState[]): boolean {
  return states.length > 0 && states.every((s) => s === 'done');
}
