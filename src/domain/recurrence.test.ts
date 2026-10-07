import { describe, expect, it } from 'vitest';
import type { IsoDay } from './day';
import { occurrences, occursOn, parseRRule } from './recurrence';

const d = (s: string) => s as IsoDay;
const list = (start: string, rule: string, to: string, ex: string[] = []) =>
  occurrences(d(start), parseRRule(rule), ex.map(d), d(to));

describe('parseRRule', () => {
  it('reads the common rules', () => {
    expect(parseRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231')).toEqual({
      freq: 'WEEKLY', interval: 2, byDay: [{ weekday: 0 }, { weekday: 2 }], until: '2026-12-31',
    });
    expect(parseRRule('RRULE:FREQ=MONTHLY;BYDAY=-1FR')?.byDay).toEqual([{ weekday: 4, nth: -1 }]);
  });
  it('refuses what it can’t do, rather than guessing', () => {
    expect(parseRRule('FREQ=WEEKLY;BYSETPOS=1;BYDAY=MO')).toBeNull();
    expect(parseRRule('FREQ=HOURLY')).toBeNull();
    expect(parseRRule('FREQ=WEEKLY;BYDAY=2MO')).toBeNull();
    expect(parseRRule('FREQ=DAILY;INTERVAL=0')).toBeNull();
  });
});

describe('occurrences', () => {
  it('daily, every other day, with an exception', () => {
    expect(list('2026-10-05', 'FREQ=DAILY', '2026-10-08', ['2026-10-07'])).toEqual(['2026-10-05', '2026-10-06', '2026-10-08']);
    expect(list('2026-10-05', 'FREQ=DAILY;INTERVAL=2', '2026-10-10')).toEqual(['2026-10-05', '2026-10-07', '2026-10-09']);
  });
  it('weekly on several days, across a month and the clock change', () => {
    expect(list('2026-10-19', 'FREQ=WEEKLY;BYDAY=MO,WE,FR', '2026-10-30')).toEqual(
      ['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26', '2026-10-28', '2026-10-30']);
  });
  it('every two weeks keeps to its own weeks', () => {
    expect(list('2026-10-06', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU', '2026-11-03')).toEqual(['2026-10-06', '2026-10-20', '2026-11-03']);
  });
  it('stops at COUNT (exceptions still count) and at UNTIL', () => {
    expect(list('2026-10-05', 'FREQ=DAILY;COUNT=3', '2026-12-31', ['2026-10-06'])).toEqual(['2026-10-05', '2026-10-07']);
    expect(list('2026-10-05', 'FREQ=DAILY;UNTIL=20261007', '2026-12-31')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
  });
  it('monthly by date skips short months, and by weekday ordinal', () => {
    expect(list('2026-01-31', 'FREQ=MONTHLY', '2026-05-31')).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
    expect(list('2026-10-30', 'FREQ=MONTHLY;BYDAY=-1FR', '2027-01-31')).toEqual(['2026-10-30', '2026-11-27', '2026-12-25', '2027-01-29']);
  });
  it('yearly, including 29 February', () => {
    expect(list('2024-02-29', 'FREQ=YEARLY', '2032-12-31')).toEqual(['2024-02-29', '2028-02-29', '2032-02-29']);
  });
  it('a rule that never matches stops instead of looping', () => {
    expect(list('2026-01-01', 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30', '2030-01-01')).toEqual(['2026-01-01']);
  });
  it('a single event, and days before the start', () => {
    expect(occurrences(d('2026-10-05'), null, [], d('2026-10-30'))).toEqual(['2026-10-05']);
    expect(occursOn(d('2026-10-05'), parseRRule('FREQ=DAILY'), [], d('2026-10-04'))).toBe(false);
  });
  it('occursOn answers for one day', () => {
    const rule = parseRRule('FREQ=WEEKLY;BYDAY=TU,TH');
    expect(occursOn(d('2026-10-06'), rule, [], d('2026-10-08'))).toBe(true);
    expect(occursOn(d('2026-10-06'), rule, [], d('2026-10-09'))).toBe(false);
  });
});
