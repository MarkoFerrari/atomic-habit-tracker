import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isEditable, type IsoDay } from './day';
import { habitState } from './states';
import { daysHeld, runOf, type DueDay } from './runs';
import { newlyReached, nextRank, rankForDays, reachedRank, ringSegments } from './ranks';
import { completionRate, isPerfectDay } from './rates';

const d = (s: string) => s as IsoDay;
const days = (start: string, statuses: string) =>
  [...statuses].map((c, i) => ({ day: addDays(d(start), i), status: c === 'x' ? 'done' : c === 's' ? 'skipped' : 'missed' }) as DueDay);

describe('calendar helpers', () => {
  it('counts days across the October clock change', () => {
    expect(daysBetween(d('2026-10-24'), d('2026-10-26'))).toBe(2);
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
  });
  it('keeps answers editable for 7 days (R2)', () => {
    expect(isEditable(d('2026-10-06'), d('2026-10-06'))).toBe(true);
    expect(isEditable(d('2026-09-30'), d('2026-10-06'))).toBe(true);
    expect(isEditable(d('2026-09-29'), d('2026-10-06'))).toBe(false);
    expect(isEditable(d('2026-10-07'), d('2026-10-06'))).toBe(false);
  });
});

describe('habitState', () => {
  const at = (h: string) => new Date(`2026-10-06T${h}:00+03:00`);
  const slot = { slotStart: at('08:00'), slotEnd: at('08:30') };
  it('moves from open to running inside the slot', () => {
    expect(habitState({ answer: null, ...slot, now: at('07:59'), dayClosed: false })).toBe('open');
    expect(habitState({ answer: null, ...slot, now: at('08:10'), dayClosed: false })).toBe('running');
    expect(habitState({ answer: null, ...slot, now: at('09:00'), dayClosed: false })).toBe('open');
  });
  it('an answer always wins', () => {
    expect(habitState({ answer: 'skipped', ...slot, now: at('08:10'), dayClosed: false })).toBe('skipped');
  });
  it('unanswered becomes missed when the day closes (052)', () => {
    expect(habitState({ answer: null, ...slot, now: at('09:00'), dayClosed: true })).toBe('missed');
  });
});

describe('runs (051: never miss twice; a skip is a miss)', () => {
  it('forgives one miss', () => {
    const run = runOf(days('2026-10-01', 'xxmxx'));
    expect(run.startedOn).toBe('2026-10-01');
    expect(run.missesInARow).toBe(0);
  });
  it('ends on the second miss in a row, skip included', () => {
    const run = runOf(days('2026-10-01', 'xxms'));
    expect(run.startedOn).toBeNull();
    expect(run.endedOn).toBe('2026-10-04');
  });
  it('starts a new run at the next done', () => {
    const run = runOf(days('2026-10-01', 'xxmmmx'));
    expect(run.startedOn).toBe('2026-10-06');
  });
  it('alternating miss and done never breaks the run', () => {
    expect(runOf(days('2026-10-01', 'xmxmxmx')).startedOn).toBe('2026-10-01');
  });
  it('sorts history it receives out of order', () => {
    const h = days('2026-10-01', 'xmm');
    expect(runOf([h[2]!, h[0]!, h[1]!]).startedOn).toBeNull();
  });
  it('counts calendar days held, not occurrences (060)', () => {
    // A Tue/Thu/Sat habit: done on 6, 8, 10, 13 and 15 October.
    const tts: DueDay[] = ['06', '08', '10', '13', '15'].map((x) => ({ day: d(`2026-10-${x}`), status: 'done' }));
    expect(daysHeld(runOf(tts), d('2026-10-15'))).toBe(10);
    expect(daysHeld(runOf([]), d('2026-10-15'))).toBe(0);
  });
});

describe('ranks (047, 055)', () => {
  it('maps days held to ranks', () => {
    expect(rankForDays(9)).toBeNull();
    expect(rankForDays(10)).toBe('starter');
    expect(rankForDays(181)).toBe('keeper');
    expect(rankForDays(182)).toBe('artisan');
    expect(rankForDays(400)).toBe('master');
  });
  it('never takes a rank back', () => {
    expect(reachedRank('keeper', 3)).toBe('keeper');
    expect(reachedRank('starter', 30)).toBe('builder');
  });
  it('reports a rank only on the day it is first reached', () => {
    expect(newlyReached(null, 10)).toBe('starter');
    expect(newlyReached('starter', 11)).toBeNull();
  });
  it('points at the next rank, and nothing after Master (H22b)', () => {
    expect(nextRank(null, 4)).toEqual({ rank: 'starter', daysLeft: 6 });
    expect(nextRank('keeper', 12)).toEqual({ rank: 'artisan', daysLeft: 170 });
    expect(nextRank('master', 500)).toBeNull();
  });
  it('fills one ring segment per rank', () => {
    expect(ringSegments(null)).toBe(0);
    expect(ringSegments('master')).toBe(5);
  });
});

describe('rates (006, 033)', () => {
  const occ = [
    { day: d('2026-10-04'), state: 'done' as const }, // before tracking started
    { day: d('2026-10-06'), state: 'done' as const },
    { day: d('2026-10-06'), state: 'skipped' as const },
    { day: d('2026-10-07'), state: 'missed' as const },
    { day: d('2026-10-08'), state: 'open' as const }, // today, not decided
    { day: d('2026-10-09'), state: 'open' as const }, // ahead
  ];
  it('counts done ÷ due inside tracking, never future or open days', () => {
    expect(completionRate(occ, { from: d('2026-10-01'), to: d('2026-10-31') }, d('2026-10-06'), d('2026-10-08')))
      .toEqual({ done: 1, due: 3, rate: 1 / 3 });
  });
  it('has no rate, not 0%, when nothing was due', () => {
    expect(completionRate([], { from: d('2026-10-01'), to: d('2026-10-07') }, d('2026-10-06'), d('2026-10-08')).rate).toBeNull();
  });
  it('a perfect day needs at least one habit, all done', () => {
    expect(isPerfectDay(['done', 'done'])).toBe(true);
    expect(isPerfectDay(['done', 'skipped'])).toBe(false);
    expect(isPerfectDay([])).toBe(false);
  });
});
