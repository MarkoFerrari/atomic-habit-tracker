// Create, change and delete events (H30–H32, E16), against a fake IndexedDB with sample data (045).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, wipeDbForTests } from './db';
import { answer } from './answers';
import { allEvents, archiveHabit, createEvent, deleteEvent, deleteHabitEverything, draftOf, durationFromTitle, newDraft, saveEdit } from './events';
import { agenda, expand } from '../domain/agenda';
import type { Calendar, CalendarEvent } from './schema';
import type { IsoDay } from '../domain/day';
import { toSource } from './answers';
import { daysHeldFor } from '../domain/stats';

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

  it('keeps a habit’s cue, smallest version and identity, and drops them from a meeting (085)', async () => {
    const draft = { ...newDraft('2026-10-08', [habits, work], new Date(), ZONE), title: 'Sample read - 20 min', after: 'Sample breakfast', smallest: ' Read one page ', identity: 'A reader' };
    const habit = await createEvent(draft, ZONE);
    expect(habit).toMatchObject({ after: 'Sample breakfast', smallest: 'Read one page', identity: 'A reader' });
    const meeting = await createEvent({ ...draft, calendarId: 'wrk' }, ZONE);
    expect(meeting.after).toBeUndefined();
    expect(meeting.identity).toBeUndefined();
  });
});

describe('changing a repeating event (H31, E16)', () => {
  it('only this event moves one occurrence', async () => {
    const item = occ(train, '2026-10-12');
    await saveEdit(train, item, { ...draftOf(train, item), start: '2026-10-12T19:00', end: '2026-10-12T19:30' }, 'this', ZONE, '2026-10-07');
    const days = agenda([await stored('train')], '2026-10-12', '2026-10-14', ZONE).map((i) => i.start);
    expect(days).toEqual(['2026-10-12T19:00', '2026-10-14T17:30']);
  });

  it('this and following keeps a habit as one habit: the old schedule becomes a past version (115)', async () => {
    await answer('train', '2026-10-05', 'done', '2026-10-07');
    await answer('train', '2026-10-07', 'done', '2026-10-07');
    const item = occ(train, '2026-10-07');
    await saveEdit(train, item, { ...draftOf(train, item), start: '2026-10-07T07:00', end: '2026-10-07T07:30' }, 'following', ZONE, '2026-10-07');
    const events = await allEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: 'train', start: '2026-10-07T07:00', rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR' });
    expect(events[0]!.past).toHaveLength(1);
    expect(events[0]!.past![0]!.rrule).toContain('UNTIL=20261006');
    const answers = await (await db()).getAll('answers');
    expect(answers.map((a) => `${a.eventId} ${a.occurrence}`).sort()).toEqual(['train 2026-10-05', 'train 2026-10-07']);
    const items = agenda(events, '2026-10-05', '2026-10-09', ZONE).map((i) => `${i.occurrence} ${i.start.slice(11)}`);
    expect(items).toEqual(['2026-10-05 17:30', '2026-10-07 07:00', '2026-10-09 07:00']);
  });

  it('this and following still splits a meeting into two series, answers following', async () => {
    const sync: CalendarEvent = { ...train, id: 'sync', calendarId: 'wrk', title: 'Sample sync', timeMode: 'zoned', tz: ZONE, start: '2026-09-14T07:00:00.000Z', end: '2026-09-14T07:30:00.000Z' };
    await (await db()).put('events', sync);
    const item = occ(sync, '2026-10-07');
    await saveEdit(sync, item, { ...draftOf(sync, item), start: '2026-10-07T12:00', end: '2026-10-07T12:30' }, 'following', ZONE, '2026-10-07');
    const mine = (await allEvents()).filter((e) => e.calendarId === 'wrk');
    expect(mine).toHaveLength(2);
    expect(mine.every((e) => !e.past)).toBe(true);
  });

  it('moving a habit to another time keeps its run going (U15, 115)', async () => {
    const daily: CalendarEvent = { ...train, id: 'walk', title: 'Sample walk - 30 min', start: '2026-09-28T08:00', end: '2026-09-28T08:30', rrule: 'FREQ=DAILY' };
    await (await db()).put('events', daily);
    for (let d = 28; d <= 37; d++) {
      const day = (d <= 30 ? `2026-09-${d}` : `2026-10-${String(d - 30).padStart(2, '0')}`) as IsoDay;
      await (await db()).put('answers', { key: `walk|${day}`, eventId: 'walk', occurrence: day, status: 'done', answeredAt: `${day}T09:00:00Z`, history: [] });
    }
    const before = daysHeldFor(toSource(await stored('walk')), await (await db()).getAll('answers'), '2026-09-28', '2026-10-07');
    const item = occ(daily, '2026-10-08');
    await saveEdit(daily, item, { ...draftOf(daily, item), start: '2026-10-08T19:00', end: '2026-10-08T19:30' }, 'all', ZONE, '2026-10-08');
    const after = await stored('walk');
    expect((await allEvents()).filter((e) => e.title.startsWith('Sample walk'))).toHaveLength(1);
    expect(daysHeldFor(toSource(after), await (await db()).getAll('answers'), '2026-09-28', '2026-10-08')).toBe(before + 1);
    expect(expand(after, '2026-10-07', '2026-10-08', ZONE).map((i) => i.start)).toEqual(['2026-10-07T08:00', '2026-10-08T19:00']);
  });

  it('a habit’s object can be changed while editing it, whatever the scope, and stays when it is not touched (133)', async () => {
    await (await db()).put('events', { ...train, icon: 'dumbbell' });
    const item = occ(train, '2026-10-07');
    // untouched: a rename keeps the chosen object instead of guessing a new one from the name
    await saveEdit(await stored('train'), item, { ...draftOf(await stored('train'), item), title: 'Sample read - 20 min' }, 'all', ZONE, '2026-10-07');
    expect((await stored('train')).icon).toBe('dumbbell');
    // chosen: the new object wins over the guess
    await saveEdit(await stored('train'), item, { ...draftOf(await stored('train'), item), icon: 'book-open' }, 'all', ZONE, '2026-10-07');
    expect((await stored('train')).icon).toBe('book-open');
    // even "only this event" changes the object of the whole habit: it never belongs to one day
    const again = await stored('train');
    await saveEdit(again, item, { ...draftOf(again, item), icon: 'footprints', start: '2026-10-07T19:00', end: '2026-10-07T19:30' }, 'this', ZONE, '2026-10-07');
    expect((await stored('train')).icon).toBe('footprints');
  });

  it('only this event on a day before the change edits the past version (115)', async () => {
    await answer('train', '2026-10-05', 'done', '2026-10-07');
    const item = occ(train, '2026-10-09');
    await saveEdit(train, item, { ...draftOf(train, item), start: '2026-10-09T18:00', end: '2026-10-09T18:30' }, 'all', ZONE, '2026-10-07');
    const moved = await stored('train');
    const old = occ(moved, '2026-10-05');
    await saveEdit(moved, old, { ...draftOf(moved, old), start: '2026-10-05T09:00', end: '2026-10-05T09:30' }, 'this', ZONE, '2026-10-07');
    expect(occ(await stored('train'), '2026-10-05').start).toBe('2026-10-05T09:00');
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
