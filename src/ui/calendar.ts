// Turns the month views of the domain (stats.ts) into the days of the one Month calendar (129).
import type { MonthView } from '../domain/stats';
import { fullDate, percent } from '../domain/format';
import type { CalendarDay } from './MonthCalendar.svelte';

/** All habits: a day is done when every due habit was, some done when part of them, missed when none. */
export function allHabitDays(month: MonthView, perfect: Set<string> = new Set()): CalendarDay[] {
  return month.cells.map((c) => {
    const { done, due } = c.rate;
    const state = c.kind === 'today' ? 'today' : c.kind === 'ahead' ? 'ahead' : c.kind === 'empty' || !due ? 'none' : done >= due ? 'done' : done > 0 ? 'partial' : 'missed';
    const what = c.kind === 'ahead' ? 'ahead' : due ? `${percent(c.rate.rate)}, ${done} of ${due} done` : 'nothing due';
    return { day: c.day, state, label: `${fullDate(c.day)}: ${what}${perfect.has(c.day) ? ', perfect day' : ''}` };
  });
}

/** One habit (D1): done, missed (a skip too, 051), today, ahead; days it wasn't due stay plain. Today turns green once done. */
export function habitMonthDays(month: MonthView): CalendarDay[] {
  return month.cells.map((c) => {
    const { done, due } = c.rate;
    const state = c.kind === 'today' ? (due && done >= due ? 'done' : 'today') : c.kind === 'ahead' ? 'ahead' : c.kind === 'empty' || !due ? 'none' : done >= due ? 'done' : 'missed';
    const what = state === 'done' ? 'done' : state === 'missed' ? 'not done' : state === 'today' ? 'today, open' : state === 'ahead' ? 'ahead' : 'not due';
    return { day: c.day, state, label: `${fullDate(c.day)}: ${what}` };
  });
}

/** "16 of 19 · 84%" for the decided days of a month, or nothing when none was due yet. */
export function monthCount(month: MonthView): string | undefined {
  const r = month.cells.reduce((a, c) => (c.kind === 'ahead' ? a : { done: a.done + c.rate.done, due: a.due + c.rate.due }), { done: 0, due: 0 });
  return r.due ? `${r.done} of ${r.due} · ${percent(r.done / r.due)}` : undefined;
}
