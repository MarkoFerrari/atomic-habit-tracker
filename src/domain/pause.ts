// 117: pausing a habit ahead of time (Playground 08, owner approved 14 Oct 2026 with a reason).
// A paused day is not a day for that habit: not due, never a miss, left out of done ÷ due, no nudge (033, 069).
// The run waits: it neither breaks nor grows, so days held skip the paused days (060). Pure rules.
import { addDays, daysBetween, type IsoDay } from './day';

export type PauseReason = 'travel' | 'ill' | 'busy' | 'other';
export const PAUSE_REASONS: readonly PauseReason[] = ['travel', 'ill', 'busy', 'other'];

export interface Pause {
  from: IsoDay;
  until: IsoDay; // the last paused day, as set
  reason: PauseReason;
  note?: string; // "other": a few words
  setOn: IsoDay;
  endedOn?: IsoDay; // brought back early: due again from this day
}

/** Up to two weeks: past that the habit really needs rebuilding, and Archive is the honest choice. */
export const PAUSE_MAX_DAYS = 14;
export const PAUSE_LENGTHS = [3, 7, 14] as const;

/** The last day a pause actually covers (null: brought back before it began). */
export function lastPausedDay(p: Pause): IsoDay | null {
  const last = p.endedOn ? addDays(p.endedOn, -1) : p.until;
  return last < p.from ? null : last;
}

export function isPaused(pauses: readonly Pause[] | undefined, day: IsoDay): boolean {
  if (!pauses?.length) return false;
  return pauses.some((p) => { const last = lastPausedDay(p); return !!last && day >= p.from && day <= last; });
}

/** Paused days between `from` and `to`, both included. */
export function pausedDaysIn(pauses: readonly Pause[] | undefined, from: IsoDay, to: IsoDay): number {
  if (!pauses?.length || to < from) return 0;
  let n = 0;
  for (const p of pauses) {
    const last = lastPausedDay(p);
    if (!last) continue;
    const a = p.from > from ? p.from : from;
    const b = last < to ? last : to;
    if (b >= a) n += daysBetween(a, b) + 1;
  }
  return n;
}

/** The pause in force today, or the next one set ahead. */
export function currentPause(pauses: readonly Pause[] | undefined, today: IsoDay): Pause | null {
  return (pauses ?? []).filter((p) => { const last = lastPausedDay(p); return !!last && last >= today; })
    .sort((a, b) => a.from.localeCompare(b.from))[0] ?? null;
}

/** A pause that ended yesterday: today the habit is back, and Today says so once. */
export function backToday(pauses: readonly Pause[] | undefined, today: IsoDay): Pause | null {
  return (pauses ?? []).find((p) => lastPausedDay(p) === addDays(today, -1) && !p.endedOn) ?? null;
}

export class PauseError extends Error {}

/**
 * Adds a pause. Only ahead (from today on), so a pause can never erase a miss; 1 to 14 days; one at a time.
 */
export function withPause(pauses: readonly Pause[] | undefined, p: Pause, today: IsoDay): Pause[] {
  if (p.from < today) throw new PauseError('A pause starts today or later.');
  if (p.until < p.from) throw new PauseError('A pause ends after it starts.');
  if (daysBetween(p.from, p.until) + 1 > PAUSE_MAX_DAYS) throw new PauseError(`A pause lasts ${PAUSE_MAX_DAYS} days at most.`);
  if (currentPause(pauses, today)) throw new PauseError('This habit already has a pause.');
  const note = p.note?.trim();
  return [...(pauses ?? []), { from: p.from, until: p.until, reason: p.reason, setOn: today, ...(p.reason === 'other' && note ? { note } : {}) }];
}

/** Bring it back today: a pause in force ends now; one set ahead is dropped, as if it never was. */
export function endPause(pauses: readonly Pause[] | undefined, today: IsoDay): Pause[] {
  const cur = currentPause(pauses, today);
  if (!cur) return [...(pauses ?? [])];
  if (cur.from > today) return (pauses ?? []).filter((p) => p !== cur);
  return (pauses ?? []).map((p) => (p === cur ? { ...p, endedOn: today } : p));
}
