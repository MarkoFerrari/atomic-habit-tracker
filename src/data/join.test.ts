// 115: habits split by an edit before 0.8.2 are joined back once (U15). Sample data only (045).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, wipeDbForTests } from './db';
import { joinSplitHabits } from './habits';
import { defaultSettings } from './settings';
import { toSource } from './answers';
import { daysHeldFor } from '../domain/stats';
import type { Answer, CalendarEvent } from './schema';
import type { IsoDay } from '../domain/day';

const old: CalendarEvent = {
  id: 'old', calendarId: 'hab', title: 'Sample training', icon: 'dumbbell', start: '2026-10-01T08:00', end: '2026-10-01T09:00',
  allDay: false, timeMode: 'clock', rrule: 'FREQ=DAILY;UNTIL=20261009', exdates: [], reminders: [0],
};
const split: CalendarEvent = { ...old, id: 'new', start: '2026-10-10T19:00', end: '2026-10-10T20:00', rrule: 'FREQ=DAILY' };
const done = (eventId: string, day: IsoDay): Answer => ({ key: `${eventId}|${day}`, eventId, occurrence: day, status: 'done', answeredAt: `${day}T10:00:00Z`, history: [] });
const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}` as IsoDay;

beforeEach(async () => {
  await wipeDbForTests();
  const database = await db();
  await database.put('calendars', { id: 'hab', name: 'SAMPLE HABITS', color: 'habits', trackAsHabits: true, createdAt: '1' });
  await database.put('events', old);
  await database.put('events', split);
  for (let n = 1; n <= 9; n++) await database.put('answers', done('old', day(n)));
  for (let n = 10; n <= 12; n++) await database.put('answers', done('new', day(n)));
  await database.put('ranks', { key: 'new|starter', seriesId: 'new', rank: 'starter', reachedOn: '2026-10-12' });
  await database.put('settings', { ...defaultSettings('Europe/Athens'), onboardingDone: true, trackingStart: '2026-10-01', ranksSeen: ['new|starter'] });
});

describe('joinSplitHabits (115)', () => {
  it('joins the split back into the first habit, with its answers, ranks and seen ranks', async () => {
    expect(await joinSplitHabits()).toBe(1);
    const database = await db();
    const events = await database.getAll('events');
    expect(events.map((e) => e.id)).toEqual(['old']);
    expect(events[0]).toMatchObject({ start: '2026-10-10T19:00', rrule: 'FREQ=DAILY' });
    expect(events[0]!.past).toHaveLength(1);
    const answers = await database.getAll('answers');
    expect(answers.every((a) => a.eventId === 'old')).toBe(true);
    expect(daysHeldFor(toSource(events[0]!), answers, '2026-10-01', '2026-10-12')).toBe(12);
    expect((await database.getAll('ranks')).map((r) => r.key)).toEqual(['old|starter']);
    const settings = await database.get('settings', 'settings');
    expect(settings).toMatchObject({ seriesJoined: true, ranksSeen: ['old|starter'] });
  });

  it('runs once', async () => {
    await joinSplitHabits();
    await (await db()).put('events', { ...split, id: 'again' });
    expect(await joinSplitHabits()).toBe(0);
  });
});
