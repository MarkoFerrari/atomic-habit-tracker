import { describe, expect, it } from 'vitest';
import { clockLabel, percent, progress, rateLabel, repeatLabel, shortName } from './format';
import { parseRRule } from './recurrence';

describe('number formatting (061)', () => {
  it('never pads with zeros', () => {
    expect(percent(0.82)).toBe('82%');
    expect(percent(0.075)).toBe('8%');
    expect(percent(0)).toBe('0%');
    expect(percent(1)).toBe('100%');
    expect(progress(10, 30)).toBe('10/30');
  });
  it('shows no rate, not 0%, when nothing was due (033)', () => {
    expect(percent(null)).toBe('–');
  });
  it('keeps the number due next to the rate (006)', () => {
    expect(rateLabel({ done: 3, due: 4, rate: 0.75 })).toBe('75% · 4 due');
  });
});


describe('schedule labels (H09)', () => {
  const label = (r: string) => repeatLabel(parseRRule(r));
  it('says it the way the design does', () => {
    expect(label('FREQ=WEEKLY;BYDAY=TU,TH,SA')).toBe('Tue, Thu, Sat');
    expect(label('FREQ=DAILY')).toBe('Every day');
    expect(label('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')).toBe('Weekdays');
    expect(label('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO')).toBe('Every 2 weeks · Mon');
    expect(label('FREQ=MONTHLY;BYDAY=-1FR')).toBe('Monthly, last Fri');
    expect(repeatLabel(null)).toBe('Once');
    expect(repeatLabel(parseRRule('FREQ=WEEKLY'), '2026-10-08' as never)).toBe('Thu'); // the start's weekday
  });
  it('shows clock time, or All day', () => {
    expect(clockLabel('2026-10-05T05:30', false)).toBe('05:30');
    expect(clockLabel('2026-10-05T00:00', true)).toBe('All day');
  });
});

describe('shortName (004)', () => {
  it('drops the end point for sentences', () => {
    expect(shortName('Breakfast 30 min')).toBe('Breakfast');
    expect(shortName('Diorama - 45 min')).toBe('Diorama');
    expect(shortName('Train 1 h')).toBe('Train');
    expect(shortName('30 min')).toBe('30 min');
    expect(shortName('Stretch')).toBe('Stretch');
  });
});
