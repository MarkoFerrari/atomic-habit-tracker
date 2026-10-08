// The habits-first rewards (Figma page 14): week strip (096), perfect days (093), next rank (098), never miss twice (099).
import { describe, expect, it } from 'vitest';
import { bestRun, nextRankLine, perfectDays, runAtRisk, twelveWeeks, weekStrip } from './award';
import { STARS, starsFor } from './ranks';
import type { Context } from './stats';
import type { AnswerLike, HabitSource } from './today';

const h = (id: string, start: string): HabitSource => ({ id, title: `Sample ${id} 20 min`, start, end: start.replace(/T(\d\d)/, (_, x) => `T${x}`), allDay: false, rrule: 'FREQ=DAILY', exdates: [] });
const done = (eventId: string, occurrence: string): AnswerLike => ({ eventId, occurrence, status: 'done', answeredAt: `${occurrence}T08:00:00Z` });
const skip = (eventId: string, occurrence: string): AnswerLike => ({ eventId, occurrence, status: 'skipped', answeredAt: `${occurrence}T08:00:00Z` });

// Thursday 8 Oct 2026; tracking from Monday 5 Oct; two daily habits.
const habits = [h('read', '2026-10-05T07:30'), h('walk', '2026-10-05T17:30')];
const ctx = (answers: AnswerLike[], today = '2026-10-08'): Context => ({ habits, answers, trackingStart: '2026-10-05', today: today as Context['today'] });

describe('week strip (096)', () => {
  it('Mon perfect, Tue partial, Wed missed, Thu open, the rest ahead', () => {
    const s = weekStrip(ctx([done('read', '2026-10-05'), done('walk', '2026-10-05'), done('read', '2026-10-06'), done('read', '2026-10-08')]));
    expect(s.map((d) => d.state)).toEqual(['perfect', 'partial', 'missed', 'open', 'future', 'future', 'future']);
    expect(s[1]!.share).toBe(0.5);
    expect(s[3]!.today).toBe(true);
    expect(s.map((d) => d.letter).join('')).toBe('MTWTFSS');
  });
  it('today turns perfect once every due habit is done', () => {
    expect(weekStrip(ctx([done('read', '2026-10-08'), done('walk', '2026-10-08')]))[3]!.state).toBe('perfect');
  });
  it('days before tracking are empty, never missed (033)', () => {
    expect(weekStrip({ ...ctx([]), trackingStart: '2026-10-07' }).slice(0, 2).map((d) => d.state)).toEqual(['empty', 'empty']);
  });
});

describe('perfect days (093)', () => {
  it('counts days with every due habit done, never past today', () => {
    const c = ctx([done('read', '2026-10-05'), done('walk', '2026-10-05'), done('read', '2026-10-07'), done('walk', '2026-10-07'), skip('read', '2026-10-06')]);
    expect(perfectDays(c, '2026-10-01', '2026-10-31')).toEqual(['2026-10-05', '2026-10-07']);
  });
});

describe('star medal (100)', () => {
  it('fills 1, 3, 6, 9 and all 12 stars', () => {
    expect(Object.values(STARS)).toEqual([1, 3, 6, 9, 12]);
    expect(starsFor(null)).toBe(0);
  });
  it('names the next rank in days, or Mastered (098)', () => {
    expect(nextRankLine({ rank: 'starter', next: { rank: 'builder', daysLeft: 6, days: 30 } })).toBe('Builder in 6 days');
    expect(nextRankLine({ rank: null, next: { rank: 'starter', daysLeft: 1, days: 10 } })).toBe('Starter in 1 day');
    expect(nextRankLine({ rank: 'master', next: null })).toBe('Mastered');
  });
});

describe('never miss twice, made visible (099)', () => {
  it('a run with one miss and today still open is at risk', () => {
    const r = runAtRisk(ctx([done('read', '2026-10-05'), done('read', '2026-10-06'), skip('read', '2026-10-07'), done('walk', '2026-10-05'), done('walk', '2026-10-06'), done('walk', '2026-10-07')]));
    expect(r).toMatchObject({ eventId: 'read', held: 4, missedOn: '2026-10-07' });
  });
  it('nothing at risk once today is answered, or when no run is alive', () => {
    expect(runAtRisk(ctx([done('read', '2026-10-05'), skip('read', '2026-10-07'), done('read', '2026-10-08'), done('walk', '2026-10-07')]))).toBeNull();
    expect(runAtRisk(ctx([]))).toBeNull();
  });
});

describe('habit detail numbers (H4)', () => {
  it('twelve weeks, the ones before tracking outlined (null)', () => {
    const w = twelveWeeks(ctx([done('read', '2026-10-05'), done('read', '2026-10-06')]), habits[0]!);
    expect(w).toHaveLength(12);
    expect(w.slice(0, 11).every((x) => x.share === null)).toBe(true);
    expect(w[11]).toMatchObject({ done: 2, due: 3 });
  });
  it('the best run in days held (060)', () => {
    expect(bestRun(ctx([done('read', '2026-10-05'), done('read', '2026-10-06'), done('read', '2026-10-07')]), habits[0]!)).toBe(3);
  });
});
