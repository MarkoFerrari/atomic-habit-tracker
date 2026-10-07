// Create, change and delete events (H30–H32, E16), against a fake IndexedDB with sample data (045).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, wipeDbForTests } from './db';
import { answer } from './answers';
import { allEvents, archiveHabit, createEvent, deleteEvent, deleteHabitEverything, draftOf, durationFromTitle, newDraft, saveEdit } from './events';
import { agenda, expand } from '../domain/agenda';
import type { Calendar, CalendarEvent } from './schema';
import type { IsoDay } from '../domain/day';

const ZONE = 'Europe/Athens';
const habits: Calendar = { id: 'hab', name: 'SAMPLE HABITS', color: 'habits', trackAsHabits: true, createdAt: '1' };
const work: Calendar = { id: 'wrk', name: 'SAMPLE WORK', color: 'work', trackAsHabits: false, createdAt: '2' };
const train: CalendarEvent = {
  id: 'train', calendarId: 'hab', title: 'Sample train - 30 min', start: '2026-09-14T17:30', end: '2026-09-14T18:00',
  allDay: false, timeMode: 'clock', rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR', exdates: [], reminders: [0],
};
const occ = (e: CalendarEvent, d: IsoDay) => expand(e, d, d, ZONE).find((i) => i.occurrence === d)!;
const stored = async (id: string) => (await (await db()).get('events', id))!;

beforeEach(async () => {
  await wipeDbForTests();
  const database = await db();
  await database.put('calendars', habits);
  await database.put('calendars', work);
  await database.put('events', train);
});

describe('new event (H30)', () => {
  it('reads the length from the title (004) and takes the calendar’s reminder (R5, 069)', async () => {
    expect(durationFromTitle('Sample diorama - 45 min')).toBe(45);
    expect(durationFromTitle('Sample walk 1 h')).toBe(60);
    const draft = newDraft('2026-10-08', [habits, work], new Date('2026-10-07T09:00:00Z'), ZONE);
    expect(draft).toMatchObject({ calendarId: 'hab', start: '2026-10-08T09:00', reminders: [0] });
  });

  it('stores a meeting as a real instant with its zone, and a habit in clock time (028)', async () => {
    const draft = { ...newDraft('2026-10-08', [habits, work], new Date(), ZONE), title: 'Sample sync', calendarId: 'wrk', reminders: [10] };
    const meeting = await createEvent({ ...draft, start: '2026-10-08T10:00', end: '2026-10-08T11:00' }, ZONE);
    expect(meeting).toMatchObject({ timeMode: 'zoned', tz: ZONE, start: '2026-10-08T07:00:00.000Z', reminders: [10] });
    const habit = await createEvent({ ...draft, title: 'Sample read - 20 min', calendarId: 'hab', start: '2026-10-08T21:00', end: '2026-10-08T21:20', repeat: { kind: 'daily', days: [], until: null }, repeatChanged: true }, ZONE);
    expect(habit).toMatchObject({ timeMode: 'clock', start: '2026-10-08T21:00', rrule: 'FREQ=DAILY', icon: 'book-open' });
    expect(habit).not.toHaveProperty('tz');
  });
});

describe('changing a repeating event (H31, E16)', () => {
  it('only this event moves one occurrence', async () => {
    const item = occ(train, '2026-10-12');
    await saveEdit(train, item, { ...draftOf(train, item), start: '2026-10-12T19:00', end: '2026-10-12T19:30' }, 'this', ZONE, '2026-10-07');
    const days = agenda([await stored('train')], '2026-10-12', '2026-10-14', ZONE).map((i) => i.start);
    expect(days).toEqual(['2026-10-12T19:00', '2026-10-14T17:30']);
  });

  it('this and following splits the series and moves future answers with it', async () => {
    await answer('train', '2026-10-05', 'done', '2026-10-07');
    await answer('train', '2026-10-07', 'done', '2026-10-07');
    const item = occ(train, '2026-10-07');
    await saveEdit(train, item, { ...draftOf(train, item), start: '2026-10-07T07:00', end: '2026-10-07T07:30' }, 'following', ZONE, '2026-10-07');
    const events = await allEvents();
    expect(events).toHaveLength(2);
    const next = events.find((e) => e.id !== 'train')!;
    expect(next).toMatchObject({ start: '2026-10-07T07:00', rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR' });
    expect((await stored('train')).rrule).toContain('UNTIL=20261006');
    const answers = await (await db()).getAll('answers');
    expect(answers.map((a) => `${a.eventId === 'train' ? 'old' : 'new'} ${a.occurrence}`).sort()).toEqual(['new 2026-10-07', 'old 2026-10-05']);
  });

  it('all events of a habit with past answers keeps the past as it was (E16)', async () => {
    await answer('train', '2026-10-05', 'done', '2026-10-07');
    const item = occ(train, '2026-10-09');
    await saveEdit(train, item, { ...draftOf(train, item), title: 'Sample run - 30 min', start: '2026-10-09T18:00', end: '2026-10-09T18:30' }, 'all', ZONE, '2026-10-07');
    const items = agenda(await allEvents(), '2026-10-05', '2026-10-09', ZONE).map((i) => `${i.occurrence} ${i.start.slice(11)} ${i.title}`);
    expect(items).toEqual(['2026-10-05 17:30 Sample train - 30 min', '2026-10-07 18:00 Sample run - 30 min', '2026-10-09 18:00 Sample run - 30 min']);
  });

  it('all events without answers changes the series in place', async () => {
    const item = occ(train, '2026-10-09');
    await saveEdit(train, item, { ...draftOf(train, item), start: '2026-10-09T06:00', end: '2026-10-09T06:30' }, 'all', ZONE, '2026-10-07');
    const events = await allEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: 'train', start: '2026-09-14T06:00', end: '2026-09-14T06:30' });
  });
});

describe('deleting (H32)', () => {
  it('deletes one occurrence, or this and the following ones', async () => {
    await deleteEvent(train, '2026-10-09', 'this', ZONE);
    expect((await stored('train')).exdates).toEqual(['2026-10-09']);
    await deleteEvent(await stored('train'), '2026-10-12', 'following', ZONE);
    expect(agenda(await allEvents(), '2026-10-05', '2026-10-31', ZONE).map((i) => i.occurrence)).toEqual(['2026-10-05', '2026-10-07']);
  });

  it('keeps the history when a habit is archived, and removes everything on request', async () => {
    await answer('train', '2026-10-05', 'done', '2026-10-07');
    await archiveHabit(train, '2026-10-07');
    expect(agenda(await allEvents(), '2026-10-05', '2026-10-12', ZONE).map((i) => i.occurrence)).toEqual(['2026-10-05']);
    await deleteHabitEverything(await stored('train'));
    expect(await allEvents()).toEqual([]);
    expect(await (await db()).getAll('answers')).toEqual([]);
  });
});
