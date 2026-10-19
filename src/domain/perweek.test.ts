// 119: Per week. Sample data only (045). 2026-10-12 is a Monday.
import { describe, expect, it } from 'vitest';
import { isHeld, isMustDo, weekProgress, weeklyHistory } from './perweek';
import { daysHeldFor, habitDays, weekRate } from './stats';
import { todayView, type AnswerLike, type HabitSource } from './today';
import { planReminders } from './reminders';
import { addDays, type IsoDay } from './day';

const gym: HabitSource = { id: 'g', title: 'Sample gym 45 min', start: '2026-09-28T18:00', end: '2026-09-28T18:45', allDay: false, rrule: 'FREQ=DAILY', exdates: [], perWeek: 3 };
const day = (s: string) => s as IsoDay;
const done = (d: string): AnswerLike => ({ eventId: 'g', occurrence: d, status: 'done', answeredAt: `${d}T16:00:00Z` });
const ctx = (answers: AnswerLike[], today: string) => ({ habits: [gym], answers, trackingStart: day('2026-09-28'), today: day(today) });
const ZONE = 'Europe/Athens';

describe('a week (119)', () => {
  it('needs the target; the last days become must-do', () => {
    const w = weekProgress(gym, [done('2026-10-13')], day('2026-10-12'));
    expect(w.target).toBe(3);
    expect(isMustDo(w, day('2026-10-14'))).toBe(false); // 2 to do, 5 days left
    expect(isMustDo(w, day('2026-10-17'))).toBe(true); // 2 to do, Saturday and Sunday left
    expect(isHeld(weekProgress(gym, ['2026-10-12', '2026-10-13', '2026-10-15'].map(done), day('2026-10-12')))).toBe(true);
  });

  it('is never due on an ordinary day, so it doesn’t spoil the day', () => {
    const cells = habitDays(ctx([done('2026-10-13')], '2026-10-16'), day('2026-10-12'), day('2026-10-16'));
    expect(cells.map((c) => `${c.day} ${c.state}`)).toEqual(['2026-10-13 done']);
  });

  it('a must-do day not done is a miss', () => {
    const cells = habitDays(ctx([], '2026-10-19'), day('2026-10-12'), day('2026-10-18'));
    expect(cells.map((c) => c.state)).toEqual(['missed', 'missed', 'missed']); // Friday to Sunday
  });
});

describe('Today with a per-week habit (119)', () => {
  it('sits under This week, outside the count, until the last days', () => {
    const v = todayView([gym], [], day('2026-10-14'), new Date('2026-10-14T08:00:00Z'), ZONE, false, [done('2026-10-13')]);
    expect(v.due).toBe(0);
    expect(v.thisWeek[0]!.week).toEqual({ done: 1, target: 3, daysLeft: 5, mustDo: false });
    const sat = todayView([gym], [], day('2026-10-17'), new Date('2026-10-17T08:00:00Z'), ZONE, false, [done('2026-10-13')]);
    expect(sat.due).toBe(1);
    expect(sat.thisWeek).toEqual([]);
  });

  it('leaves Today once the target is met', () => {
    const v = todayView([gym], [], day('2026-10-16'), new Date('2026-10-16T08:00:00Z'), ZONE, false, ['2026-10-12', '2026-10-13', '2026-10-15'].map(done));
    expect(v.due + v.thisWeek.length).toBe(0);
  });
});

describe('runs in weeks (119)', () => {
  const held = (monday: string) => [0, 2, 4].map((i) => done(addDays(day(monday), i)));

  it('a held week carries the run; days held are calendar days', () => {
    const answers = [...held('2026-09-28'), ...held('2026-10-05')];
    expect(daysHeldFor(gym, answers, day('2026-09-28'), day('2026-10-12'))).toBe(15);
  });

  it('one week not held is forgiven; two in a row end the run', () => {
    const answers = [...held('2026-09-28'), done('2026-10-06')];
    // 120: the run holds, but the week not held (5–11 Oct) adds none of its 7 days: 16 calendar days, 9 held
    expect(daysHeldFor(gym, answers, day('2026-09-28'), day('2026-10-13'))).toBe(9);
    expect(daysHeldFor(gym, answers, day('2026-09-28'), day('2026-10-19'))).toBe(0);
    expect(weeklyHistory(gym, answers, day('2026-09-28'), day('2026-10-19')).filter((d) => d.status === 'missed').map((d) => d.day)).toEqual(['2026-10-11', '2026-10-18']);
  });

  it('counts weeks held ÷ weeks on the habit detail', () => {
    expect(weekRate(ctx([...held('2026-09-28'), done('2026-10-06')], '2026-10-14'), gym)).toEqual({ done: 1, due: 2, rate: 0.5 });
  });
});

describe('nudges for a per-week habit (119)', () => {
  it('stop once the week’s target is met', () => {
    const e = { ...gym, calendarId: 'hab', timeMode: 'clock' as const, reminders: [0] };
    const answered = new Set(['g|2026-10-12', 'g|2026-10-13', 'g|2026-10-14']);
    const plan = planReminders([e], new Set(['hab']), answered, day('2026-10-15'), new Date('2026-10-15T00:00:00Z'), ZONE, 7);
    expect(plan.map((p) => p.tag)).toEqual(['g|2026-10-19', 'g|2026-10-20', 'g|2026-10-21']);
  });
});
