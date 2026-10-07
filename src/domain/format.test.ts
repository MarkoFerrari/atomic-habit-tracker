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

describe('dates (H26–H28)', () => {
  it('names days, weeks and months as the design writes them', async () => {
    const f = await import('./format');
    expect(f.fullDate('2026-10-06')).toBe('Tuesday 6 October');
    expect(f.isoWeek('2026-10-05')).toBe(41);
    expect(f.isoWeek('2027-01-01')).toBe(53);
    expect(f.isoWeek('2026-01-01')).toBe(1);
    expect(f.weekRange('2026-10-05', '2026-10-11')).toBe('5–11 October');
    expect(f.weekRange('2026-09-28', '2026-10-04')).toBe('28 September – 4 October');
    expect(f.dayAndNumber('2026-10-11')).toBe('Sunday 11');
    expect([f.hoursLabel(60), f.hoursLabel(90), f.hoursLabel(45)]).toEqual(['1h', '1h 30m', '45m']);
  });
});
