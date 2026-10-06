import { daysBetween, type IsoDay } from './day';
import type { AnswerStatus } from './states';

// 047, 051: a run lasts while the habit is never missed twice in a row.
// Skipped and missed are both a miss for runs (051). One miss is forgiven; the second in a row ends the run.

export interface DueDay {
  day: IsoDay;
  status: AnswerStatus; // only closed or answered occurrences; an open habit today is left out
}

export interface Run {
  startedOn: IsoDay | null; // first done of the current run; null when no run is alive
  lastDone: IsoDay | null;
  missesInARow: number;
  endedOn: IsoDay | null; // the day the last run ended, for "Your run ended" (E14), shown once
}

export const EMPTY_RUN: Run = { startedOn: null, lastDone: null, missesInARow: 0, endedOn: null };

/** Fold one answered occurrence into the run. History must be fed in date order. */
export function step(run: Run, due: DueDay): Run {
  if (due.status === 'done') {
    return { startedOn: run.startedOn ?? due.day, lastDone: due.day, missesInARow: 0, endedOn: run.endedOn };
  }
  if (!run.startedOn) return run; // a miss before any run started changes nothing
  const misses = run.missesInARow + 1;
  if (misses >= 2) return { startedOn: null, lastDone: null, missesInARow: 0, endedOn: due.day };
  return { ...run, missesInARow: misses };
}

export function runOf(history: readonly DueDay[]): Run {
  return [...history].sort((a, b) => a.day.localeCompare(b.day)).reduce(step, EMPTY_RUN);
}

/**
 * Days held (060, proposed): calendar days from the run's first done to `asOf`, inclusive.
 * Calendar days, not occurrences, so a 3-times-a-week habit and a daily one reach Starter on the same calendar.
 */
export function daysHeld(run: Run, asOf: IsoDay): number {
  if (!run.startedOn) return 0;
  return Math.max(0, daysBetween(run.startedOn, asOf) + 1);
}
