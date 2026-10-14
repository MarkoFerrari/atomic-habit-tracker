// 117: pausing a habit ahead of time. Sample data only (045).
import { describe, expect, it } from 'vitest';
import { backToday, currentPause, endPause, isPaused, pausedDaysIn, PauseError, withPause, type Pause } from './pause';
import { daysHeldFor } from './stats';
import { occurrencesOn, type HabitSource } from './today';
import { expand } from './agenda';
import type { IsoDay } from './day';

const p = (from: string, until: string, extra: Partial<Pause> = {}): Pause => ({ from: from as IsoDay, until: until as IsoDay, reason: 'travel', setOn: from as IsoDay, ...extra });
const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}` as IsoDay;

describe('pause rules (117)', () => {
  it('only ahead, up to 14 days, one at a time', () => {
    expect(() => withPause([], p('2026-10-13', '2026-10-15'), day(14))).toThrow(PauseError);
    expect(() => withPause([], p('2026-10-14', '2026-10-28'), day(14))).toThrow(/14 days/);
    const one = withPause([], p('2026-10-20', '2026-10-26'), day(14));
    expect(one).toHaveLength(1);
    expect(() => withPause(one, p('2026-10-27', '2026-10-28'), day(14))).toThrow(/already/);
  });

  it('keeps the note only for Other', () => {
    expect(withPause([], p('2026-10-14', '2026-10-15', { note: 'x' }), day(14))[0]).not.toHaveProperty('note');
    expect(withPause([], p('2026-10-14', '2026-10-15', { reason: 'other', note: ' Moving house ' }), day(14))[0]!.note).toBe('Moving house');
  });

  it('counts paused days, and bringing it back ends the pause today', () => {
    const list = [p('2026-10-10', '2026-10-16')];
    expect(isPaused(list, day(12))).toBe(true);
    expect(pausedDaysIn(list, day(1), day(31))).toBe(7);
    const ended = endPause(list, day(13));
    expect(isPaused(ended, day(13))).toBe(false);
    expect(pausedDaysIn(ended, day(1), day(31))).toBe(3);
    expect(currentPause(ended, day(13))).toBeNull();
  });

  it('drops a pause set ahead when it is cancelled', () => {
    expect(endPause([p('2026-10-20', '2026-10-22')], day(14))).toEqual([]);
  });

  it('greets the habit the day after a pause ends on its own', () => {
    expect(backToday([p('2026-10-10', '2026-10-16')], day(17))?.from).toBe('2026-10-10');
    expect(backToday([p('2026-10-10', '2026-10-16', { endedOn: day(13) })], day(13))).toBeNull();
  });
});

describe('a paused habit (117)', () => {
  const walk: HabitSource = { id: 'walk', title: 'Sample walk', start: '2026-10-01T08:00', end: '2026-10-01T08:30', allDay: false, rrule: 'FREQ=DAILY', exdates: [],
    pauses: [p('2026-10-06', '2026-10-10')] };
  const done = (n: number) => ({ eventId: 'walk', occurrence: day(n), status: 'done' as const, answeredAt: '' });

  it('is not due on paused days', () => {
    expect(occurrencesOn([walk], day(8))).toEqual([]);
    expect(occurrencesOn([walk], day(11))).toHaveLength(1);
  });

  it('keeps its run: it neither breaks nor grows', () => {
    const answers = [1, 2, 3, 4, 5, 11, 12].map(done);
    // 12 calendar days, 5 of them paused
    expect(daysHeldFor(walk, answers, day(1), day(12))).toBe(7);
  });

  it('gets no reminder on a paused day', () => {
    const e = { ...walk, calendarId: 'hab', timeMode: 'clock' as const };
    expect(expand(e, day(5), day(11), 'Europe/Athens').map((i) => i.occurrence)).toEqual([day(5), day(11)]);
  });
});
