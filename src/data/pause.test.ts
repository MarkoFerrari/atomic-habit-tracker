// 117: a pause is stored on the habit and travels with backups. Sample data only (045).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, wipeDbForTests } from './db';
import { pauseHabit, resumeHabit } from './habits';
import type { CalendarEvent } from './schema';

const walk: CalendarEvent = { id: 'walk', calendarId: 'hab', title: 'Sample walk', start: '2026-10-01T08:00', end: '2026-10-01T08:30', allDay: false, timeMode: 'clock', rrule: 'FREQ=DAILY', exdates: [], reminders: [0] };
beforeEach(async () => { await wipeDbForTests(); await (await db()).put('events', walk); });

describe('pauseHabit and resumeHabit (117)', () => {
  it('stores the pause with its reason, and brings the habit back today', async () => {
    await pauseHabit('walk', { from: '2026-10-14', until: '2026-10-20', reason: 'ill' }, '2026-10-14');
    expect((await (await db()).get('events', 'walk'))!.pauses).toEqual([{ from: '2026-10-14', until: '2026-10-20', reason: 'ill', setOn: '2026-10-14' }]);
    await resumeHabit('walk', '2026-10-16');
    expect((await (await db()).get('events', 'walk'))!.pauses![0]!.endedOn).toBe('2026-10-16');
  });

  it('refuses a pause that starts in the past', async () => {
    await expect(pauseHabit('walk', { from: '2026-10-10', until: '2026-10-12', reason: 'travel' }, '2026-10-14')).rejects.toThrow('A pause starts today or later.');
  });
});

describe('a new per-week habit (119)', () => {
  it('repeats every day and keeps its times a week', async () => {
    const { createHabit, blankHabit } = await import('./newHabit');
    const e = await createHabit({ ...blankHabit(), title: 'Sample gym 45 min', often: 'week', times: 3 }, '2026-10-14', 'Europe/Athens');
    expect(e).toMatchObject({ rrule: 'FREQ=DAILY', perWeek: 3 });
  });
});
