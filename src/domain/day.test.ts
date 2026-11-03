import { describe, expect, it } from 'vitest';
import { habitDayOf, shiftMonth, type IsoDay } from './day';

const ATHENS = 'Europe/Athens';

describe('habitDayOf (R1: the day closes at 04:00)', () => {
  it('keeps the evening on the same day', () => {
    expect(habitDayOf(new Date('2026-10-06T22:30:00+03:00'), ATHENS)).toBe('2026-10-06');
  });
  it('gives the hours after midnight to yesterday', () => {
    expect(habitDayOf(new Date('2026-10-07T00:30:00+03:00'), ATHENS)).toBe('2026-10-06');
    expect(habitDayOf(new Date('2026-10-07T03:59:00+03:00'), ATHENS)).toBe('2026-10-06');
  });
  it('starts the new day at 04:00 exactly', () => {
    expect(habitDayOf(new Date('2026-10-07T04:00:00+03:00'), ATHENS)).toBe('2026-10-07');
  });
  it('survives the October daylight-saving change (E5)', () => {
    // Athens falls back at 04:00 EEST to 03:00 EET on Sunday 25 October 2026.
    expect(habitDayOf(new Date('2026-10-25T00:30:00Z'), ATHENS)).toBe('2026-10-24'); // 03:30 EEST
    expect(habitDayOf(new Date('2026-10-25T01:30:00Z'), ATHENS)).toBe('2026-10-24'); // 03:30 EET, again
    expect(habitDayOf(new Date('2026-10-25T02:00:00Z'), ATHENS)).toBe('2026-10-25'); // 04:00 EET
  });
  it('survives the March change and month ends', () => {
    expect(habitDayOf(new Date('2027-03-28T01:30:00Z'), ATHENS)).toBe('2027-03-28'); // 04:30 EEST
    expect(habitDayOf(new Date('2026-11-01T01:00:00+02:00'), ATHENS)).toBe('2026-10-31');
  });
  it('follows the phone into another time zone (E6)', () => {
    const instant = new Date('2026-10-07T02:00:00Z'); // 05:00 in Athens, 22:00 in New York
    expect(habitDayOf(instant, ATHENS)).toBe('2026-10-07');
    expect(habitDayOf(instant, 'America/New_York')).toBe('2026-10-06');
  });
});

describe('shiftMonth (the Habits month navigation)', () => {
  const d = (s: string) => s as IsoDay;
  it('goes back and forward by whole months, always to the 1st', () => {
    expect(shiftMonth(d('2026-11-25'), -1)).toBe('2026-10-01');
    expect(shiftMonth(d('2026-10-01'), 1)).toBe('2026-11-01');
    expect(shiftMonth(d('2026-10-31'), 0)).toBe('2026-10-01');
  });
  it('crosses a year in both directions', () => {
    expect(shiftMonth(d('2027-01-15'), -1)).toBe('2026-12-01');
    expect(shiftMonth(d('2026-12-01'), 1)).toBe('2027-01-01');
  });
  it('never lands on a shorter month by mistake (31 January back or forward)', () => {
    expect(shiftMonth(d('2027-01-31'), 1)).toBe('2027-02-01');
    expect(shiftMonth(d('2027-03-31'), -1)).toBe('2027-02-01');
  });
});
