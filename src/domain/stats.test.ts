// M5 rules, with labelled sample data (045). The sample week mirrors Figma H34: 2027-11-22, a Thursday.
import { describe, expect, it } from 'vitest';
import { bestHeld, habitDays, habitDetail, heatLevel, medalOf, mondayOf, monthView, nextUp, rateOf, recapWeekStart, sortMedals, weekView, weeklyRecap, yearView, patternSentence, type Context } from './stats';
import { proposeAdjustment, review, reviewIsDue, reviewLine, smallVersion, startAdjustment, TRIAL_DAYS } from './adjust';
import type { HabitSource, AnswerLike } from './today';
import type { IsoDay } from './day';

const daily = (id: string, title: string, time: string, minutes = 30): HabitSource => ({
  id, title, start: `2027-09-01T${time}`, end: `2027-09-01T${String(Number(time.slice(0, 2)) + Math.floor(minutes / 60)).padStart(2, '0')}:${String(Number(time.slice(3)) + (minutes % 60)).padStart(2, '0')}`,
  allDay: false, rrule: 'FREQ=DAILY', exdates: [],
});
const breakfast = daily('b', 'Sample breakfast 30 min', '08:00');
const read = daily('r', 'Sample read 15 min', '22:00', 15);
const ans = (eventId: string, occurrence: string, status: AnswerLike['status'], extra: Partial<AnswerLike> = {}): AnswerLike =>
  ({ eventId, occurrence, status, answeredAt: `${occurrence}T08:05:00Z`, ...extra });
const ctx = (answers: AnswerLike[], today = '2027-11-25', habits = [breakfast, read]): Context =>
  ({ habits, answers, trackingStart: '2027-09-01' as IsoDay, today: today as IsoDay });

describe('days and rates (006, 033, 052)', () => {
  it('closed unanswered days are missed, today is open, later days are ahead, before the start is excluded', () => {
    const c = { ...ctx([ans('b', '2027-11-23', 'done')]), habits: [breakfast] };
    const d = habitDays(c, '2027-11-22' as IsoDay, '2027-11-26' as IsoDay).map((x) => x.state);
    expect(d).toEqual(['missed', 'done', 'missed', 'open', 'ahead']);
    expect(habitDays({ ...c, trackingStart: '2027-11-24' as IsoDay }, '2027-11-22' as IsoDay, '2027-11-23' as IsoDay).map((x) => x.state)).toEqual(['before', 'before']);
  });
  it('rate counts decided occurrences only and is null with nothing due', () => {
    const c = { ...ctx([ans('b', '2027-11-22', 'done'), ans('b', '2027-11-23', 'skipped')]), habits: [breakfast] };
    expect(rateOf(habitDays(c, '2027-11-22' as IsoDay, '2027-11-27' as IsoDay))).toEqual({ done: 1, due: 3, rate: 1 / 3 }); // 22 done, 23 skipped, 24 missed; today and later not counted
    expect(rateOf([]).rate).toBeNull();
  });
  it('heat levels: five steps, 0 only when something was due and nothing done', () => {
    expect([0, 0.2, 0.5, 0.75, 1].map(heatLevel)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('week, month, year (H34–H36)', () => {
  const answers = ['22', '23', '24'].flatMap((d) => [ans('b', `2027-11-${d}`, 'done'), ans('r', `2027-11-${d}`, 'done')]);
  it('week: Monday to Sunday, a row per habit, ISO week number, rate so far', () => {
    expect(mondayOf('2027-11-25' as IsoDay)).toBe('2027-11-22');
    const w = weekView(ctx(answers), '2027-11-25' as IsoDay);
    expect(w.days[0]).toBe('2027-11-22');
    expect(w.number).toBe(47);
    expect(w.rows.map((r) => r.title)).toEqual(['Sample breakfast 30 min', 'Sample read 15 min']);
    expect(w.rate).toEqual({ done: 6, due: 6, rate: 1 });
    expect(w.rows[0]!.cells.map((c) => c?.state)).toEqual(['done', 'done', 'done', 'open', 'ahead', 'ahead', 'ahead']);
  });
  it('month: leading blanks, today and ahead cells, per-habit list sorted by rate', () => {
    const m = monthView(ctx(answers), '2027-11-25' as IsoDay);
    expect(m.leading).toBe(0); // 1 Nov 2027 is a Monday
    expect(m.cells).toHaveLength(30);
    expect(m.cells[24]!.kind).toBe('today');
    expect(m.cells[25]!.kind).toBe('ahead');
    expect(m.cells[21]!.level).toBe(4);
    expect(m.byHabit.length).toBe(2);
  });
  it('year: twelve bars, months ahead outlined, best and low in words', () => {
    const y = yearView(ctx(answers), '2027-11-25' as IsoDay);
    expect(y.bars).toHaveLength(12);
    expect(y.bars[11]!.ahead).toBe(true);
    expect(y.best).not.toBeNull();
    expect(y.low).not.toBeNull();
    expect(y.sentence).toMatch(/most consistent month/);
    expect(yearView({ ...ctx([]), trackingStart: '2027-11-24' as IsoDay }, '2027-11-25' as IsoDay).sentence).toMatch(/More months/);
  });
});

describe('medals (047, 051, 060)', () => {
  const doneRun = (from: string, n: number) => Array.from({ length: n }, (_, i) => {
    const d = new Date(`${from}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + i);
    return ans('b', d.toISOString().slice(0, 10), 'done');
  });
  it('a 12-day run is Builder-bound: Apprentice reached, days held 12', () => {
    const c = { ...ctx(doneRun('2027-11-14', 12)), habits: [breakfast] };
    const m = medalOf(c, breakfast, null);
    expect(m).toMatchObject({ rank: 'starter', held: 12, next: { rank: 'builder', days: 30, daysLeft: 18 } });
  });
  it('two misses in a row end the run, but the rank stays (E14)', () => {
    const answers = [...doneRun('2027-10-01', 12), ans('b', '2027-10-13', 'skipped'), ans('b', '2027-10-14', 'skipped')];
    const c = { ...ctx(answers, '2027-10-20'), habits: [breakfast] };
    const m = medalOf(c, breakfast, null);
    expect(m.rank).toBe('starter');
    expect(m.held).toBe(0);
  });
  it('bestHeld remembers the longest run, one forgiven miss included', () => {
    expect(bestHeld([{ day: '2027-10-01' as IsoDay, status: 'done' }, { day: '2027-10-02' as IsoDay, status: 'missed' }, { day: '2027-10-03' as IsoDay, status: 'done' }])).toBe(3);
  });
  it('sorts the highest rank first and picks the nearest next medal', () => {
    const a = { eventId: 'a', title: 'A', icon: 'sprout', rank: 'builder' as const, held: 40, next: { rank: 'keeper' as const, daysLeft: 50, days: 90 } };
    const b = { eventId: 'b', title: 'B', icon: 'sprout', rank: 'keeper' as const, held: 100, next: { rank: 'artisan' as const, daysLeft: 82, days: 182 } };
    const c = { eventId: 'c', title: 'C', icon: 'sprout', rank: null, held: 3, next: { rank: 'starter' as const, daysLeft: 7, days: 10 } };
    expect(sortMedals([c, a, b]).map((m) => m.eventId)).toEqual(['b', 'a', 'c']);
    expect(nextUp([a, b, c])!.eventId).toBe('c');
  });
});

describe('habit detail (H37)', () => {
  it('counts why it was not done, with misses as no reason, and buckets done times against the slot', () => {
    const answers = [
      ans('b', '2027-11-22', 'skipped', { reason: 'no-time' }), ans('b', '2027-11-23', 'skipped', { reason: 'no-time' }),
      ans('b', '2027-11-24', 'done', { answeredAt: '2027-11-24T05:55:00Z' }), // 07:55 in Athens: before 08:00
      ans('b', '2027-11-21', 'done', { answeredAt: '2027-11-21T06:05:00Z' }), // 08:05: first third
    ];
    const d = habitDetail({ ...ctx(answers), habits: [breakfast] }, breakfast, null, 'Europe/Athens');
    expect(d.why['no-time']).toBe(2);
    expect(d.why.none).toBeGreaterThan(0);
    expect(d.times!.map((t) => t.label)).toEqual(['Before 08:00', '08:00–08:10', '08:10–08:20', '08:20–08:30', 'After 08:30']);
    expect(d.times![0]!.count).toBe(1);
    expect(d.times![1]!.count).toBe(1);
    expect(d.slot).toBe('08:00–08:30');
  });
});

describe('weekly recap (H39) and Kaizen (080)', () => {
  const week = ['22', '23', '24', '25', '26', '27', '28'];
  const answers = week.flatMap((d, i) => [
    ans('r', `2027-11-${d}`, 'done'),
    i < 2 ? ans('b', `2027-11-${d}`, 'done') : ans('b', `2027-11-${d}`, 'skipped', { reason: 'no-time' }),
  ]);
  it('names the week, the best and weakest habit, and one pattern', () => {
    const r = weeklyRecap(ctx(answers, '2027-11-29'), '2027-11-22' as IsoDay)!;
    expect(r.title).toBe('Week 47 recap');
    expect(r.label).toBe('22–28 November');
    expect(r.best!.title).toContain('read');
    expect(r.weakest!.title).toContain('breakfast');
    expect(r.parts!.evening.rate).toBe(1);
    expect(patternSentence(r.pattern!, () => 'No time')).toBe('Sample breakfast was skipped for “No time” on 5 of 7 days.');
  });
  it('says nothing when too little was due (E19) and picks the right week', () => {
    expect(weeklyRecap({ ...ctx([]), trackingStart: '2027-11-28' as IsoDay }, '2027-11-22' as IsoDay)).toBeNull();
    expect(recapWeekStart('2027-11-28' as IsoDay)).toBe('2027-11-22'); // Sunday: this week
    expect(recapWeekStart('2027-11-29' as IsoDay)).toBe('2027-11-22'); // Monday: the week before
  });
  it('proposes one change by reason, and runs a two-week trial with a review', () => {
    expect(smallVersion(30)).toBe(10);
    expect(smallVersion(6)).toBe(2);
    expect(proposeAdjustment({ title: 'Breakfast 30 min', minutes: 30, reason: 'no-time' }, null)).toBe('Do only the first 10 minutes of Breakfast, for 2 weeks.');
    expect(proposeAdjustment({ title: 'Breakfast 30 min', minutes: 30, reason: 'forgot' }, 'Train 60 min')).toBe('Do Breakfast right after Train, for 2 weeks.');
    const a = startAdjustment({ id: '1', habitId: 'b', habitTitle: 'Breakfast', text: ' Try it ', baseline: { done: 3, due: 7 } }, '2027-11-29' as IsoDay);
    expect(a).toMatchObject({ text: 'Try it', startedOn: '2027-11-29', reviewOn: '2027-12-13', status: 'active' });
    expect(TRIAL_DAYS).toBe(14);
    expect(reviewIsDue(a, '2027-12-12' as IsoDay)).toBe(false);
    expect(reviewIsDue(a, '2027-12-13' as IsoDay)).toBe(true);
    expect(reviewLine(a, { done: 10, due: 14 })).toBe('Before 43% · now 71%');
    expect(reviewLine(a, { done: 0, due: 0 })).toBeNull();
    const dropped = review([a], '1', 'drop', { done: 5, due: 14 }, '2027-12-13' as IsoDay)[0]!;
    expect(dropped).toMatchObject({ status: 'dropped', endedOn: '2027-12-13', after: { done: 5, due: 14 } });
    const kept = review([a], '1', 'keep', { done: 10, due: 14 }, '2027-12-13' as IsoDay)[0]!;
    expect(kept).toMatchObject({ status: 'active', startedOn: '2027-12-13', reviewOn: '2027-12-27', baseline: { done: 10, due: 14 } });
  });
});
