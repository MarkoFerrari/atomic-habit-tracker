import { describe, expect, it } from 'vitest';
import { planReminders } from './reminders';
import type { HabitSource } from './today';
import type { IsoDay } from './day';

const ZONE = 'Europe/Athens';
const habit = (id: string, start: string, end: string, extra: Partial<HabitSource> = {}): HabitSource =>
  ({ id, title: `Sample ${id} 30 min`, start, end, allDay: false, rrule: 'FREQ=DAILY', exdates: [], ...extra });
const DAY = '2026-10-07' as IsoDay;

describe('planReminders (069)', () => {
  const habits = [
    habit('breakfast', '2026-10-01T08:00', '2026-10-01T08:30'),
    habit('read', '2026-10-01T22:00', '2026-10-01T22:15'),
    habit('journal', '2026-10-01T00:00', '2026-10-02T00:00', { allDay: true }),
  ];

  it('fires at each habit’s clock time in the phone’s zone, from now on (028)', () => {
    const now = new Date('2026-10-07T12:00:00+03:00');
    const plan = planReminders(habits, new Set(), DAY, now, ZONE, 2);
    expect(plan.map((r) => r.fireAt)).toEqual([
      '2026-10-07T19:00:00.000Z', // read, 22:00 today
      '2026-10-08T05:00:00.000Z', // breakfast, 08:00 tomorrow
      '2026-10-08T19:00:00.000Z',
    ]);
    expect(plan[0]).toMatchObject({ title: 'Sample read 30 min', body: '22:00 · 15 min', tag: 'read|2026-10-07' });
  });

  it('skips answered occurrences and all-day habits (E7)', () => {
    const now = new Date('2026-10-07T06:00:00+03:00');
    const plan = planReminders(habits, new Set(['breakfast|2026-10-07']), DAY, now, ZONE, 1);
    expect(plan.map((r) => r.tag)).toEqual(['read|2026-10-07']);
  });

  it('keeps ids inside the function’s rule and stays under its queue limit', () => {
    const many = Array.from({ length: 50 }, (_, i) => habit(`h${i}`, '2026-10-01T23:00', '2026-10-01T23:30'));
    const plan = planReminders(many, new Set(), DAY, new Date('2026-10-07T06:00:00+03:00'), ZONE);
    expect(plan).toHaveLength(500);
    expect(plan.every((r) => /^[A-Za-z0-9_.:-]{1,128}$/.test(r.id))).toBe(true);
    expect(new Set(plan.map((r) => r.id)).size).toBe(500);
  });
});
