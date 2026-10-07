// M4 data: restore (R6, 026), calendars (H42, H43, H49) and re-import (H44, E8), with sample data (045).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, wipeDbForTests } from './db';
import { buildBackup } from './backup';
import { BackupError, readBackup, restoreBackup } from './restore';
import { TOKENS, deleteCalendar, ensureHabitCalendar, eventCounts, nextColour, setDefaultReminders, setTrackAsHabits } from './calendars';
import { commitReimport, planReimport } from './reimport';
import { parseIcs } from './ics';
import type { Calendar, CalendarEvent } from './schema';

const ZONE = 'Europe/Athens';
const work: Calendar = { id: 'wrk', name: 'SAMPLE WORK', color: 'work', trackAsHabits: false, createdAt: '1' };
const sync: CalendarEvent = {
  id: 'sync', icsUid: 'uid-sync', calendarId: 'wrk', title: 'Sample sync', start: '2026-10-06T07:00:00.000Z', end: '2026-10-06T08:00:00.000Z',
  allDay: false, timeMode: 'zoned', tz: ZONE, rrule: 'FREQ=WEEKLY', exdates: [], reminders: [15],
};

beforeEach(async () => {
  await wipeDbForTests();
  const database = await db();
  await database.put('calendars', work);
  await database.put('events', sync);
  await database.put('answers', { key: 'sync|2026-10-06', eventId: 'sync', occurrence: '2026-10-06', status: 'done', answeredAt: '', history: [] });
  await database.put('settings', { key: 'push-device', token: 'x'.repeat(43), subscribedAt: '2026-10-01' });
});

describe('restore (H48, R6, 026)', () => {
  it('previews, then replaces everything, keeping this phone’s push identity', async () => {
    const backup = await buildBackup(new Date('2026-10-05T10:00:00Z'));
    const preview = readBackup(JSON.stringify(backup));
    expect(preview).toMatchObject({ events: 1, answers: 1, calendars: 1 });
    const database = await db();
    await database.put('events', { ...sync, id: 'added-later', title: 'Sample added after the backup' });
    await restoreBackup(preview);
    expect((await database.getAll('events')).map((e) => e.id)).toEqual(['sync']); // replaced, not merged
    expect(await database.get('settings', 'push-device')).toBeTruthy();
  });

  it('refuses files that aren’t backups, and backups from a newer app', () => {
    expect(() => readBackup('not json')).toThrow(BackupError);
    expect(() => readBackup(JSON.stringify({ app: 'other' }))).toThrow(BackupError);
    expect(() => readBackup(JSON.stringify({ app: 'atomic', schemaVersion: 99 }))).toThrow(/newer ATOMIC/);
  });
});

describe('calendars (H42, H43, H49)', () => {
  it('counts events, picks a free colour, and sets default reminders', async () => {
    expect((await eventCounts()).get('wrk')).toBe(1);
    expect(nextColour([work])).toBe('marko');
    await setDefaultReminders(work, [10], true);
    expect((await (await db()).get('events', 'sync'))!.reminders).toEqual([10]);
  });

  it('offers twelve colours and always picks an unused one first (081)', () => {
    expect(TOKENS).toHaveLength(12);
    expect(new Set(TOKENS).size).toBe(12);
    const used = TOKENS.slice(0, 11).map((color, i): Calendar => ({ ...work, id: `c${i}`, color }));
    expect(nextColour(used)).toBe('sky');
    expect(nextColour([...used, { ...work, id: 'x', color: 'sky' }])).toBe('marko'); // all taken: least used
  });

  it('New habit makes the HABITS calendar once, then reuses it (079)', async () => {
    const first = await ensureHabitCalendar();
    expect(first).toMatchObject({ name: 'HABITS', color: 'habits', trackAsHabits: true });
    expect((await ensureHabitCalendar()).id).toBe(first.id);
    expect((await (await db()).getAll('calendars')).filter((c) => c.trackAsHabits)).toHaveLength(1);
  });

  it('Track as habits turns real times into clock times, and back (028)', async () => {
    await setTrackAsHabits(work, true, ZONE);
    const habit = (await (await db()).get('events', 'sync'))!;
    expect(habit).toMatchObject({ timeMode: 'clock', start: '2026-10-06T10:00', end: '2026-10-06T11:00' });
    expect(habit).not.toHaveProperty('tz');
    await setTrackAsHabits({ ...work, trackAsHabits: true }, false, ZONE);
    expect((await (await db()).get('events', 'sync'))!).toMatchObject({ timeMode: 'zoned', start: '2026-10-06T07:00:00.000Z' });
  });

  it('deletes a calendar with its events and their answers', async () => {
    expect(await deleteCalendar(work)).toBe(1);
    expect(await (await db()).getAll('answers')).toEqual([]);
  });
});

describe('re-import (H44, E8)', () => {
  const file = (title: string) => [
    'BEGIN:VCALENDAR', 'X-WR-CALNAME:SAMPLE WORK',
    'BEGIN:VEVENT', 'UID:uid-sync', 'DTSTART;TZID=Europe/Athens:20261006T100000', 'DTEND;TZID=Europe/Athens:20261006T110000', 'RRULE:FREQ=WEEKLY', `SUMMARY:${title}`, 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:uid-new', 'DTSTART;TZID=Europe/Athens:20261008T090000', 'DTEND;TZID=Europe/Athens:20261008T093000', 'SUMMARY:Sample new', 'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n');

  it('skips what is already here, adds what is new, and answers stay on their events', async () => {
    const plan = planReimport(parseIcs(file('Sample sync'), ZONE), [sync], work, ZONE);
    expect([plan.fresh.length, plan.same, plan.changed.length]).toEqual([1, 1, 0]);
    await commitReimport(plan, work, true);
    expect((await (await db()).getAll('events')).map((e) => e.title).sort()).toEqual(['Sample new', 'Sample sync']);
  });

  it('lists changed events and updates them only on approval', async () => {
    const plan = planReimport(parseIcs(file('Sample sync, renamed'), ZONE), [sync], work, ZONE);
    expect(plan.changed.map((c) => c.after.title)).toEqual(['Sample sync, renamed']);
    await commitReimport(plan, work, false);
    expect((await (await db()).get('events', 'sync'))!.title).toBe('Sample sync');
    await commitReimport({ ...plan, fresh: [] }, work, true);
    const updated = (await (await db()).get('events', 'sync'))!;
    expect(updated).toMatchObject({ id: 'sync', title: 'Sample sync, renamed', reminders: [15] });
    expect(await (await db()).get('answers', 'sync|2026-10-06')).toBeTruthy();
  });

  it('can import into a new calendar named after the file', async () => {
    const plan = planReimport(parseIcs(file('Sample sync'), ZONE), [], null, ZONE);
    const result = await commitReimport(plan, { newName: 'SAMPLE TRIPS' }, true);
    const cal = await (await db()).get('calendars', result.calendarId);
    expect(cal).toMatchObject({ name: 'SAMPLE TRIPS', color: 'marko', trackAsHabits: false });
  });
});
