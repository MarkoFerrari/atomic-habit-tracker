import { describe, expect, it } from 'vitest';
import { durationMinutes, IcsError, parseIcs } from './ics';
import { instantOf, wallOf, type Wall } from '../domain/zone';

// SAMPLE DATA (045): an invented calendar in the shape Proton exports. Not anyone's real habits.
const SAMPLE = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Sample//Sample Calendar//EN',
  'X-WR-CALNAME:SAMPLE HABITS',
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Athens',
  'END:VTIMEZONE',
  'BEGIN:VEVENT',
  'UID:sample-run@example.test',
  'DTSTART;TZID=Europe/Athens:20261005T073000',
  'DTEND;TZID=Europe/Athens:20261005T081500',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261231T215959Z',
  'EXDATE;TZID=Europe/Athens:20261012T073000,20261014T073000',
  'SUMMARY:Sample run - 45 min',
  'BEGIN:VALARM',
  'TRIGGER:-PT15M',
  'ACTION:DISPLAY',
  'END:VALARM',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:sample-run@example.test',
  'RECURRENCE-ID;TZID=Europe/Athens:20261016T073000',
  'DTSTART;TZID=Europe/Athens:20261016T090000',
  'DTEND;TZID=Europe/Athens:20261016T094500',
  'SUMMARY:Sample run - 45 min',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:sample-read@example.test',
  'DTSTART;VALUE=DATE:20261005',
  'DTEND;VALUE=DATE:20261006',
  'RRULE:FREQ=DAILY',
  'SUMMARY:Sample reading\\, 20 pages',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:sample-call@example.test',
  'DTSTART:20261008T120000Z',
  'DURATION:PT30M',
  'SUMMARY:Sample call with a very long title that wraps onto a second line in the export and conti',
  ' nues here',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:sample-odd@example.test',
  'DTSTART;TZID=Europe/Athens:20261005T200000',
  'RRULE:FREQ=MONTHLY;BYSETPOS=-1;BYDAY=MO,TU,WE,TH,FR',
  'SUMMARY:Sample review',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:sample-gone@example.test',
  'DTSTART;TZID=Europe/Athens:20261005T200000',
  'STATUS:CANCELLED',
  'SUMMARY:Sample cancelled',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('parseIcs', () => {
  const cal = parseIcs(SAMPLE, 'Europe/Athens');
  const byUid = (uid: string) => cal.events.find((e) => e.uid === uid)!;

  it('reads the calendar name and skips cancelled events', () => {
    expect(cal.name).toBe('SAMPLE HABITS');
    expect(cal.events.map((e) => e.uid)).toEqual([
      'sample-run@example.test', 'sample-read@example.test', 'sample-call@example.test', 'sample-odd@example.test',
    ]);
  });
  it('keeps wall time and zone, the repeat rule with a local UNTIL, exceptions and the reminder', () => {
    const run = byUid('sample-run@example.test');
    expect(run.start).toEqual({ wall: '2026-10-05T07:30', allDay: false, tz: 'Europe/Athens' });
    expect(run.end.wall).toBe('2026-10-05T08:15');
    expect(run.rrule).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261231'); // 21:59:59Z on 31 Dec is 23:59 in Athens
    expect(run.exdates).toEqual(['2026-10-12', '2026-10-14']);
    expect(run.reminders).toEqual([15]);
    expect(run.title).toBe('Sample run - 45 min');
  });
  it('collects a moved occurrence as an override', () => {
    expect(cal.overrides).toEqual([expect.objectContaining({ uid: 'sample-run@example.test', occurrence: '2026-10-16', title: 'Sample run - 45 min' })]);
    expect(cal.overrides[0]!.start.wall).toBe('2026-10-16T09:00');
  });
  it('reads all-day events, escaped text, UTC times, durations and folded lines', () => {
    const read = byUid('sample-read@example.test');
    expect(read.start).toEqual({ wall: '2026-10-05', allDay: true, tz: null });
    expect(read.title).toBe('Sample reading, 20 pages');
    const call = byUid('sample-call@example.test');
    expect(call.start.wall).toBe('2026-10-08T15:00'); // 12:00Z in Athens summer time
    expect(call.end.wall).toBe('2026-10-08T15:30');
    expect(call.title.endsWith('continues here')).toBe(true);
  });
  it('keeps an unreadable repeat as a single event and says so', () => {
    expect(byUid('sample-odd@example.test')).toMatchObject({ rrule: null, repeatSupported: false });
    expect(cal.problems.some((p) => p.includes('Sample review'))).toBe(true);
  });
  it('explains a wrong file (E11)', () => {
    expect(() => parseIcs('Name,Date\nRun,2026-10-05', 'Europe/Athens')).toThrow(IcsError);
    expect(() => parseIcs('BEGIN:VCALENDAR\nEND:VCALENDAR', 'Europe/Athens')).toThrow(/no events/);
  });
});

describe('durations and zones', () => {
  it('reads .ics durations', () => {
    expect(durationMinutes('PT45M')).toBe(45);
    expect(durationMinutes('-PT15M')).toBe(-15);
    expect(durationMinutes('P1DT2H')).toBe(1560);
    expect(durationMinutes('P1W')).toBe(10080);
    expect(durationMinutes('nonsense')).toBeNull();
  });
  it('converts wall time to instants in both seasons (E5)', () => {
    expect(instantOf('2026-07-01T22:30' as Wall, 'Europe/Athens').toISOString()).toBe('2026-07-01T19:30:00.000Z');
    expect(instantOf('2026-12-01T22:30' as Wall, 'Europe/Athens').toISOString()).toBe('2026-12-01T20:30:00.000Z');
    // 25 Oct 2026, 03:30 happens twice in Athens: the first (summer) one is used.
    expect(instantOf('2026-10-25T03:30' as Wall, 'Europe/Athens').toISOString()).toBe('2026-10-25T00:30:00.000Z');
    expect(wallOf(new Date('2026-10-25T01:30:00Z'), 'Europe/Athens')).toBe('2026-10-25T03:30');
  });
});
