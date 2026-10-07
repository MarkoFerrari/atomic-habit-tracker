import { describe, expect, it } from 'vitest';
import { beforeLabel, planReminders, type ReminderSource } from './reminders';
import type { IsoDay } from './day';

const ZONE = 'Europe/Athens';
const HABITS = new Set(['hab']);
const habit = (id: string, start: string, end: string, extra: Partial<ReminderSource> = {}): ReminderSource =>
  ({ id, calendarId: 'hab', title: `Sample ${id} 30 min`, start, end, allDay: false, timeMode: 'clock', rrule: 'FREQ=DAILY', exdates: [], reminders: [0], ...extra });
const DAY = '2026-10-07' as IsoDay;

describe('planReminders (069)', () => {
  const habits = [
    habit('breakfast', '2026-10-01T08:00', '2026-10-01T08:30'),
    habit('read', '2026-10-01T22:00', '2026-10-01T22:15'),
    habit('journal', '2026-10-01T00:00', '2026-10-02T00:00', { allDay: true }),
  ];

  it('fires at each habit’s clock time in the phone’s zone, from now on (028)', () => {
    const now = new Date('2026-10-07T12:00:00+03:00');
    const plan = planReminders(habits, HABITS, new Set(), DAY, now, ZONE, 2);
    expect(plan.map((r) => r.fireAt)).toEqual([
      '2026-10-07T19:00:00.000Z', // read, 22:00 today
      '2026-10-08T05:00:00.000Z', // breakfast, 08:00 tomorrow
      '2026-10-08T19:00:00.000Z',
    ]);
    expect(plan[0]).toMatchObject({ title: 'Sample read 30 min', body: '22:00 · 15 min', tag: 'read|2026-10-07' });
  });

  it('skips answered occurrences and all-day habits (E7)', () => {
    const now = new Date('2026-10-07T06:00:00+03:00');
    const plan = planReminders(habits, HABITS, new Set(['breakfast|2026-10-07']), DAY, now, ZONE, 1);
    expect(plan.map((r) => r.tag)).toEqual(['read|2026-10-07']);
  });

  it('reminds other events ahead of time, as their reminders say (021)', () => {
    const meeting: ReminderSource = {
      id: 'sync', calendarId: 'wrk', title: 'Sample sync', start: '2026-10-08T07:00:00.000Z', end: '2026-10-08T08:00:00.000Z',
      allDay: false, timeMode: 'zoned', tz: ZONE, exdates: [], reminders: [15, 15, 60],
    };
    const plan = planReminders([meeting], HABITS, new Set(), DAY, new Date('2026-10-07T12:00:00Z'), ZONE, 3);
    expect(plan.map((r) => [r.fireAt, r.body])).toEqual([
      ['2026-10-08T06:00:00.000Z', 'In 1 h · 10:00–11:00'],
      ['2026-10-08T06:45:00.000Z', 'In 15 min · 10:00–11:00'],
    ]);
  });

  it('keeps ids inside the function’s rule and stays under its queue limit', () => {
    const many = Array.from({ length: 50 }, (_, i) => habit(`h${i}`, '2026-10-01T23:00', '2026-10-01T23:30'));
    const plan = planReminders(many, HABITS, new Set(), DAY, new Date('2026-10-07T06:00:00+03:00'), ZONE);
    expect(plan).toHaveLength(500);
    expect(plan.every((r) => /^[A-Za-z0-9_.:-]{1,128}$/.test(r.id))).toBe(true);
    expect(new Set(plan.map((r) => r.id)).size).toBe(500);
  });

  it('labels the lead time plainly', () => {
    expect([beforeLabel(5), beforeLabel(60), beforeLabel(90), beforeLabel(1440), beforeLabel(900)]).toEqual(['5 min', '1 h', '1 h 30 min', '1 day', '15 h']);
  });
});

describe('reminderLabel (H29)', () => {
  it('says when the push comes', async () => {
    const { reminderLabel } = await import('./reminders');
    expect([reminderLabel([]), reminderLabel([0]), reminderLabel([15, 15]), reminderLabel([60, 15])]).toEqual(['None', 'At the start', '15 min before', '15 min and 1 h before']);
  });
});
