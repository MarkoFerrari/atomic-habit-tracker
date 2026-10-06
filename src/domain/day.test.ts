import { describe, expect, it } from 'vitest';
import { habitDayOf } from './day';

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
