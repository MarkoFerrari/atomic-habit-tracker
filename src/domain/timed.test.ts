import { describe, expect, it } from 'vitest';
import { planTimed, remindsOn, spacingLine, suggestTimes, timedLine, todayOf } from './timed';
import type { IsoDay } from './day';

const water = { id: 'w1', title: 'Drink water', times: ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'] };

describe('130 reminders, not habits', () => {
  it('suggests every 2 hours from the start when it ends by 21:00 (N1b)', () => {
    expect(suggestTimes('09:00', 6)).toEqual(water.times);
    expect(spacingLine(suggestTimes('09:00', 6))).toBe('Every 2 hours from the start');
  });
  it('spreads evenly up to 21:00 in 15-minute steps when 2 hours would run late', () => {
    expect(suggestTimes('09:00', 12)).toEqual(['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']);
    expect(suggestTimes('15:00', 5)).toEqual(['15:00', '16:30', '18:00', '19:30', '21:00']);
  });
  it('keeps the count between 2 and 12', () => {
    expect(suggestTimes('09:00', 1)).toHaveLength(2);
    expect(suggestTimes('08:00', 40)).toHaveLength(12);
  });
  it('has no spacing line when the gaps differ', () => {
    expect(spacingLine(['09:00', '10:00', '13:00'])).toBeNull();
  });
  it('plans a push at each time still ahead, with "n of N today", one tag per reminder', () => {
    const now = new Date('2026-10-20T09:30:00Z'); // 12:30 in Athens
    const plan = planTimed([water], '2026-10-20' as IsoDay, now, 'Europe/Athens', 2);
    expect(plan[0]).toEqual({ fireAt: '2026-10-20T10:00:00.000Z', title: 'Drink water', body: '13:00 · 3 of 6 today', tag: 'nudge.w1' });
    expect(plan).toHaveLength(4 + 6);
  });
  it('skips paused reminders and days not chosen', () => {
    const now = new Date('2026-10-19T00:00:00Z');
    expect(planTimed([{ ...water, paused: true }], '2026-10-19' as IsoDay, now, 'Europe/Athens', 7)).toEqual([]);
    const weekdays = { ...water, days: [0, 1, 2, 3, 4] };
    expect(remindsOn(weekdays, '2026-10-24' as IsoDay)).toBe(false); // Saturday
    expect(planTimed([weekdays], '2026-10-19' as IsoDay, now, 'Europe/Athens', 7)).toHaveLength(5 * 6);
  });
  it('says where today stands (B3)', () => {
    expect(todayOf(water, '2026-10-20' as IsoDay, '12:30')).toEqual({ on: true, passed: 2, next: '13:00', total: 6 });
    expect(todayOf(water, '2026-10-20' as IsoDay, '19:30').next).toBeNull();
  });
  it('names the times in one line (H1)', () => {
    expect(timedLine(water)).toBe('6 times a day · 09:00 to 19:00');
    expect(timedLine({ ...water, times: ['10:00', '15:00'] }, 'Weekdays')).toBe('Weekdays · 2 times a day · 10:00 and 15:00');
  });
});
