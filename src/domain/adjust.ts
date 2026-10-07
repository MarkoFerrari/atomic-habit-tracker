// 080, Kaizen: one adjustment at a time, tried for two weeks, then reviewed against the weeks before.
// One variable, so the review can say whether it worked. The app proposes from the week's pattern; the
// person can write their own. Plain words, no streak drama (E14).
import { addDays, type IsoDay } from './day';
import { shortName } from './format';
import type { SkipReason } from './states';

export const TRIAL_DAYS = 14;

export interface Adjustment {
  id: string;
  habitId: string;
  habitTitle: string;
  text: string;
  startedOn: IsoDay;
  reviewOn: IsoDay;
  /** The habit's done ÷ due in the 14 days before it started: what the review compares against. */
  baseline: { done: number; due: number };
  status: 'active' | 'kept' | 'dropped';
  endedOn?: IsoDay;
  after?: { done: number; due: number };
}

export interface Pattern { title: string; minutes: number; reason: SkipReason | null }

/** The smallest first step: a third of the time, never under 2 minutes or over 10 (Fogg's two-minute rule). */
export function smallVersion(minutes: number): number {
  return Math.max(2, Math.min(10, Math.round(minutes / 3)));
}

/**
 * One concrete change for the habit that slipped most, by why it slipped. `after` is a habit that held
 * well, a cue to stack on (Gollwitzer); without one the cue is waking up.
 */
export function proposeAdjustment(p: Pattern, after: string | null): string {
  const name = shortName(p.title);
  const anchor = after ? shortName(after) : 'waking up';
  switch (p.reason) {
    case 'no-time': return `Do only the first ${smallVersion(p.minutes)} minutes of ${name}, for ${TRIAL_DAYS / 7} weeks.`;
    case 'forgot': return `Do ${name} right after ${anchor}, for ${TRIAL_DAYS / 7} weeks.`;
    case 'low-energy': return `Do a lighter ${name}, ${smallVersion(p.minutes) * 2} minutes, for ${TRIAL_DAYS / 7} weeks.`;
    case 'not-relevant-today': return `Decide if ${name} still fits: keep it for ${TRIAL_DAYS / 7} weeks, then keep or archive it.`;
    default: return `Do ${name} right after ${anchor}, for ${TRIAL_DAYS / 7} weeks.`;
  }
}

export function startAdjustment(
  input: { id: string; habitId: string; habitTitle: string; text: string; baseline: { done: number; due: number } },
  today: IsoDay,
): Adjustment {
  return { ...input, text: input.text.trim(), startedOn: today, reviewOn: addDays(today, TRIAL_DAYS), status: 'active' };
}

export const activeAdjustment = (all: readonly Adjustment[]): Adjustment | null => all.find((a) => a.status === 'active') ?? null;
export const reviewIsDue = (a: Adjustment, today: IsoDay): boolean => a.status === 'active' && today >= a.reviewOn;

/** "Before 43% · now 71%": the review's one line. Null when either side has nothing due (033). */
export function reviewLine(a: Adjustment, now: { done: number; due: number }): string | null {
  if (!a.baseline.due || !now.due) return null;
  const pct = (r: { done: number; due: number }) => `${Math.round((r.done / r.due) * 100)}%`;
  return `Before ${pct(a.baseline)} · now ${pct(now)}`;
}

/** Keep starts the next two weeks; Drop ends it. Either way the old one stays in the history. */
export function review(all: readonly Adjustment[], id: string, choice: 'keep' | 'drop', now: { done: number; due: number }, today: IsoDay): Adjustment[] {
  return all.map((a) => {
    if (a.id !== id) return a;
    if (choice === 'drop') return { ...a, status: 'dropped' as const, endedOn: today, after: now };
    return { ...a, startedOn: today, reviewOn: addDays(today, TRIAL_DAYS), baseline: now };
  });
}
