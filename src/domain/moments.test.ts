// 107 milestones, 108 comebacks, 109 perfect weeks, 110 quotes (Figma Playground 02, 04, 05). Sample data only (045).
import { describe, expect, it } from 'vitest';
import { comebackDays, comebacksToday, milestoneDays, milestoneLine, milestoneOf, runsSaved, sky, weekCloses, weekLine, weekState, weeksOf } from './moments';
import { EMPTY_QUOTES, QUOTES, pruneQuotes, quoteFor } from './quotes';
import { weekStrip } from './award';
import type { Context, Medal } from './stats';
import type { AnswerLike, HabitSource } from './today';
import type { IsoDay } from './day';

const h = (id: string, start: string, rrule = 'FREQ=DAILY'): HabitSource => ({ id, title: `Sample ${id} 20 min`, start, end: start, allDay: false, rrule, exdates: [] });
const a = (eventId: string, occurrence: string, status: AnswerLike['status'] = 'done'): AnswerLike => ({ eventId, occurrence, status, answeredAt: `${occurrence}T08:00:00Z` });
const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));
const medal = (held: number, next: Medal['next']): Medal => ({ eventId: 'read', title: 'Sample read 20 min', icon: 'book-open', rank: null, held, next });

describe('milestones (107)', () => {
  it('halfway on the first two ranks, every quarter on the long ones', () => {
    expect(milestoneDays('starter')).toEqual([5]);
    expect(milestoneDays('builder')).toEqual([20]);
    expect(milestoneDays('keeper')).toEqual([45, 60, 75]);
    expect(milestoneDays('artisan')).toEqual([113, 136, 159]);
    expect(milestoneDays('master')).toEqual([228, 274, 319]);
  });
  it('is reached once done today, at or past the stop, for a week', () => {
    const toBuilder = (held: number) => medal(held, { rank: 'builder', daysLeft: 30 - held, days: 30 });
    expect(milestoneOf(toBuilder(19), true)).toBeNull();
    expect(milestoneOf(toBuilder(20), false)).toBeNull(); // not done yet today
    expect(milestoneOf(toBuilder(20), true)).toMatchObject({ rank: 'builder', day: 20, part: 1, parts: 2, of: 30 });
    expect(milestoneOf(toBuilder(26), true)?.day).toBe(20); // a habit that isn't daily meets it on its next done
    expect(milestoneOf(toBuilder(27), true)).toBeNull(); // stale after a week
  });
  it('names halfway and quarters plainly (E14: no exclamation marks)', () => {
    const toKeeper = (held: number) => milestoneOf(medal(held, { rank: 'keeper', daysLeft: 90 - held, days: 90 }), true)!;
    expect(milestoneLine(milestoneOf(medal(20, { rank: 'builder', daysLeft: 10, days: 30 }), true)!)).toBe('Sample read: halfway to Builder. Keep going.');
    expect(milestoneLine(toKeeper(45))).toBe('Sample read: a quarter of the way to Keeper. Keep going.');
    expect(milestoneLine(toKeeper(60))).toBe('Sample read: halfway to Keeper. Keep going.');
    expect(milestoneLine(toKeeper(75))).toBe('Sample read: three quarters of the way to Keeper. Keep going.');
  });
});

describe('comebacks (108)', () => {
  it('a done right after one miss saves the run; two misses end it, so the next done saves nothing', () => {
    const d = (day: string, status: 'done' | 'missed' | 'skipped') => ({ day: day as IsoDay, status });
    expect(comebackDays([d('2026-10-01', 'done'), d('2026-10-02', 'missed'), d('2026-10-03', 'done')])).toEqual(['2026-10-03']);
    expect(comebackDays([d('2026-10-01', 'done'), d('2026-10-02', 'skipped'), d('2026-10-03', 'missed'), d('2026-10-04', 'done')])).toEqual([]);
    expect(comebackDays([d('2026-10-01', 'missed'), d('2026-10-02', 'done')])).toEqual([]); // no run was alive
  });
  it('finds today’s comeback and counts runs saved on the habit', () => {
    const answers = [...days('2026-10-01', 4).map((x) => a('read', x)), a('read', '2026-10-06'), a('read', '2026-10-07'), a('read', '2026-10-09')];
    const ctx: Context = { habits: [h('read', '2026-10-01T07:30')], answers, trackingStart: '2026-10-01', today: '2026-10-09' };
    expect(comebacksToday(ctx)).toEqual([{ eventId: 'read', title: 'Sample read 20 min', held: 9, day: '2026-10-09' }]);
    const saved = runsSaved(ctx, ctx.habits[0]!);
    expect(saved.total).toBe(2); // back on 6 Oct after 5 Oct, back on 9 Oct after 8 Oct
    expect(saved.recent).toEqual([{ missedOn: '2026-10-05', backOn: '2026-10-06' }, { missedOn: '2026-10-08', backOn: '2026-10-09' }]);
    expect(saved.cells.filter((c) => c.comeback).map((c) => c.day)).toEqual(['2026-10-06', '2026-10-09']);
    expect(weekStrip(ctx, new Set(['2026-10-06', '2026-10-09'] as IsoDay[])).filter((d) => d.comeback).map((d) => d.day)).toEqual(['2026-10-06', '2026-10-09']);
  });
});

describe('perfect weeks (109)', () => {
  const read = h('read', '2026-09-28T07:30');
  const week = (until: string) => days('2026-10-05', 7).filter((x) => x <= until).map((x) => a('read', x));
  const ctx = (answers: AnswerLike[], today: string, start = '2026-09-28'): Context => ({ habits: [read], answers, trackingStart: start as IsoDay, today: today as IsoDay });
  it('every due habit, every day, Monday to Sunday', () => {
    expect(weekState(ctx(week('2026-10-11'), '2026-10-11'), '2026-10-05')).toBe('perfect');
    expect(weekState(ctx(week('2026-10-10'), '2026-10-11'), '2026-10-05')).toBe('current'); // Sunday still open
    expect(weekState(ctx(week('2026-10-08').filter((x) => x.occurrence !== '2026-10-06'), '2026-10-08'), '2026-10-05')).toBe('held');
    expect(weekState(ctx(week('2026-10-11'), '2026-10-11', '2026-10-06'), '2026-10-05')).toBe('before'); // begun before tracking
    expect(weekState(ctx([], '2026-10-11'), '2026-10-12')).toBe('ahead');
  });
  it('a weekday habit closes its week on Friday', () => {
    const work = h('work', '2026-10-05T09:00', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    const c: Context = { habits: [work], answers: days('2026-10-05', 5).map((x) => a('work', x)), trackingStart: '2026-10-05', today: '2026-10-09' };
    expect(weekState(c, '2026-10-05')).toBe('perfect');
  });
  it('W1: the last due day of a perfect-so-far week says what closes it', () => {
    expect(weekCloses(ctx(week('2026-10-10'), '2026-10-11'))).toBe(1);
    expect(weekCloses(ctx(week('2026-10-09'), '2026-10-10'))).toBeNull(); // Sunday still to come
    expect(weekCloses(ctx(week('2026-10-11'), '2026-10-11'))).toBeNull(); // already closed
    expect(weekLine(1)).toBe('One more habit closes a perfect week.');
    expect(weekLine(2)).toBe('2 more habits close a perfect week.');
  });
  it('the sky: ISO weeks of the year, and the longest constellation', () => {
    expect(weeksOf(2026)).toHaveLength(53);
    expect(weeksOf(2026)[0]).toBe('2025-12-29');
    expect(weeksOf(2027)).toHaveLength(52);
    const answers = days('2026-09-28', 14).map((x) => a('read', x));
    const s = sky(ctx(answers, '2026-10-11'), 2026);
    expect(s.perfect).toBe(2);
    expect(s.longest).toEqual({ weeks: 2, from: '2026-09-28', to: '2026-10-11' });
    expect(s.weeks.find((w) => w.monday === '2026-10-12')!.state).toBe('ahead');
  });
});

describe('quotes (110)', () => {
  it('a moment keeps its quote; a new one takes the next, and none repeats until the pool goes round', () => {
    let st = EMPTY_QUOTES;
    const seen: string[] = [];
    for (let i = 0; i < QUOTES.comeback.length; i += 1) { const r = quoteFor(st, `comeback|read|2026-10-0${i + 1}`, '2026-10-09'); st = r.state; seen.push(r.quote.id); }
    expect(new Set(seen).size).toBe(QUOTES.comeback.length);
    expect(quoteFor(st, 'comeback|read|2026-10-01', '2026-10-09').quote.id).toBe(seen[0]);
    expect(quoteFor(st, 'comeback|walk|2026-10-09', '2026-10-09').quote.id).toBe(seen[0]); // round two starts over
  });
  it('day-bound moments leave after 30 days; milestones stay as a record', () => {
    let st = quoteFor(EMPTY_QUOTES, 'risk|read|2026-09-01', '2026-09-01').state;
    st = quoteFor(st, 'milestone|read|builder|20', '2026-09-01').state;
    expect(Object.keys(pruneQuotes(st, '2026-10-09').given)).toEqual(['milestone|read|builder|20']);
  });
  it('no exclamation marks, and every quote has a source', () => {
    for (const q of Object.values(QUOTES).flat()) { expect(q.text).not.toContain('!'); expect(q.source.length).toBeGreaterThan(0); }
  });
});
