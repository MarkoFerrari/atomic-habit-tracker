import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, wipeDbForTests } from './db';
import { parseIcs } from './ics';
import { commitImport, habitsFound, planImport, storedUids, toggleHabits } from './import';

// SAMPLE DATA (045): invented calendars, not anyone's real schedule.
const ics = (name: string, events: string[]) =>
  ['BEGIN:VCALENDAR', `X-WR-CALNAME:${name}`, ...events, 'END:VCALENDAR'].join('\n');
const ev = (uid: string, title: string, start: string, end: string, rrule?: string) =>
  ['BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${title}`, `DTSTART;TZID=Europe/Athens:${start}`, `DTEND;TZID=Europe/Athens:${end}`,
    ...(rrule ? [`RRULE:${rrule}`] : []), 'END:VEVENT'].join('\n');

const ZONE = 'Europe/Athens';
const files = () => [
  { fileName: 'personal.ics', calendar: parseIcs(ics('SAMPLE PERSONAL', [ev('p1', 'Sample dinner', '20261009T200000', '20261009T220000')]), ZONE) },
  { fileName: 'habits.ics', calendar: parseIcs(ics('SAMPLE HABITS', [
    ev('h1', 'Sample run - 45 min', '20261005T073000', '20261005T081500', 'FREQ=WEEKLY;BYDAY=MO,WE,FR'),
    ev('h2', 'Sample reading - 20 min', '20261005T220000', '20261005T222000', 'FREQ=DAILY'),
    ev('p1', 'Sample dinner (duplicate)', '20261009T200000', '20261009T220000'),
  ]), ZONE) },
  { fileName: 'sport.ics', calendar: parseIcs(ics('SAMPLE SPORT', [ev('s1', 'Sample swim', '20261006T180000', '20261006T190000', 'FREQ=WEEKLY;BYDAY=TU')]), ZONE) },
];

beforeEach(() => wipeDbForTests());

describe('planImport (H07, H08)', () => {
  it('counts events and repeats, skips duplicate IDs, and guesses the habit calendar by name', () => {
    const plan = planImport(files(), new Set());
    expect(plan.duplicates).toBe(1);
    expect(plan.calendars.map((c) => [c.name, c.events.length, c.repeating, c.role, c.color])).toEqual([
      ['SAMPLE PERSONAL', 1, 0, 'calendar', 'marko'],
      ['SAMPLE HABITS', 2, 2, 'habits', 'habits'],
      ['SAMPLE SPORT', 1, 1, 'calendar', 'work'],
    ]);
  });
  it('skips events already on the phone (E8)', () => {
    expect(planImport(files(), new Set(['h1'])).duplicates).toBe(2);
  });
  it('a second habits toggle merges into the habit calendar (023, 066)', () => {
    const plan = toggleHabits(planImport(files(), new Set()), 'file-2');
    expect(plan.calendars[2]).toMatchObject({ role: 'merge', color: 'habits' });
    expect(habitsFound(plan).map((h) => h.title)).toEqual(['Sample run - 45 min', 'Sample reading - 20 min', 'Sample swim']);
    const off = toggleHabits(plan, 'file-1');
    expect(off.calendars.every((c) => c.role === 'calendar')).toBe(true);
  });
  it('lists only series that still repeat, not ones that already ended (U01)', () => {
    const plan = planImport(files(), new Set());
    const ended = { ...plan, calendars: plan.calendars.map((c) => ({ ...c, events: c.events.map((e, i) =>
      (i === 0 && e.rrule ? { ...e, rrule: `${e.rrule};UNTIL=20260830T205959Z` } : e)) })) };
    expect(habitsFound(ended, '2026-10-07').map((h) => h.title)).toEqual(['Sample reading - 20 min']);
    expect(habitsFound(ended, '2026-08-30').map((h) => h.title)).toEqual(['Sample run - 45 min', 'Sample reading - 20 min']);
  });
});

describe('commitImport', () => {
  it('saves habits in clock time and other events as real instants, with merged calendars folded in', async () => {
    const plan = toggleHabits(planImport(files(), new Set()), 'file-2');
    const result = await commitImport(plan, { h1: 'footprints', s1: 'waves' }, ZONE);
    expect(result).toEqual({ calendars: 2, events: 4, habits: 3 });

    const database = await db();
    const calendars = await database.getAll('calendars');
    const habits = calendars.find((c) => c.trackAsHabits)!;
    expect(calendars.map((c) => c.name).sort()).toEqual(['SAMPLE HABITS', 'SAMPLE PERSONAL']);
    const events = await database.getAll('events');
    const run = events.find((e) => e.icsUid === 'h1')!;
    expect(run).toMatchObject({ calendarId: habits.id, timeMode: 'clock', start: '2026-10-05T07:30', icon: 'footprints', rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR' });
    expect(events.find((e) => e.icsUid === 's1')).toMatchObject({ calendarId: habits.id, timeMode: 'clock', icon: 'waves' });
    const dinner = events.find((e) => e.icsUid === 'p1')!;
    expect(dinner).toMatchObject({ timeMode: 'zoned', start: '2026-10-09T17:00:00.000Z', tz: ZONE });
    expect(dinner.icon).toBeUndefined();
    expect(await storedUids()).toEqual(new Set(['p1', 'h1', 'h2', 's1']));
  });
});
