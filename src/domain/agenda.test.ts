import { describe, expect, it } from 'vitest';
import { agenda, dotsOn, expand, freeBands, layoutDay, meetingLink, monthGrid, onDay, timeRange, weekOf, type EventSource } from './agenda';
import type { IsoDay } from './day';

const ATHENS = 'Europe/Athens';
const ev = (over: Partial<EventSource>): EventSource => ({
  id: 'e', calendarId: 'c', title: 'Sample', start: '2026-10-05T08:00', end: '2026-10-05T08:30',
  allDay: false, timeMode: 'clock', exdates: [], ...over,
});

describe('expand (M3)', () => {
  it('repeats a clock-time habit on its days, with its clock time', () => {
    const items = expand(ev({ rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR' }), '2026-10-05', '2026-10-11', ATHENS);
    expect(items.map((i) => i.start)).toEqual(['2026-10-05T08:00', '2026-10-07T08:00', '2026-10-09T08:00']);
    expect(items[0]!.startAt).toBe(Date.parse('2026-10-05T05:00:00Z'));
  });

  it('shows a zoned meeting in the phone’s zone, keeping its real time (028, E6)', () => {
    // 10:00 in Rome is 11:00 in Athens.
    const meeting = ev({ timeMode: 'zoned', tz: 'Europe/Rome', start: '2026-10-06T08:00:00.000Z', end: '2026-10-06T09:00:00.000Z', rrule: 'FREQ=WEEKLY' });
    const [first, second] = expand(meeting, '2026-10-06', '2026-10-13', ATHENS);
    expect(first).toMatchObject({ occurrence: '2026-10-06', start: '2026-10-06T11:00', end: '2026-10-06T12:00' });
    expect(second).toMatchObject({ occurrence: '2026-10-13', start: '2026-10-13T11:00' });
  });

  it('keeps a weekly meeting at 10:00 local across the October clock change (E5)', () => {
    const meeting = ev({ timeMode: 'zoned', tz: ATHENS, start: '2026-10-20T07:00:00.000Z', end: '2026-10-20T08:00:00.000Z', rrule: 'FREQ=WEEKLY' });
    const items = expand(meeting, '2026-10-20', '2026-10-27', ATHENS);
    expect(items.map((i) => i.start)).toEqual(['2026-10-20T10:00', '2026-10-27T10:00']);
    expect(items[1]!.startAt).toBe(Date.parse('2026-10-27T08:00:00Z')); // winter time
  });

  it('applies exceptions, moved and cancelled occurrences', () => {
    const e = ev({
      rrule: 'FREQ=DAILY', exdates: ['2026-10-06'],
      overrides: { '2026-10-07': { start: '2026-10-07T09:00', end: '2026-10-07T09:30', title: 'Moved' }, '2026-10-08': { start: '', end: '', cancelled: true } },
    });
    const items = expand(e, '2026-10-05', '2026-10-09', ATHENS);
    expect(items.map((i) => `${i.occurrence} ${i.start.slice(11)} ${i.title}`)).toEqual([
      '2026-10-05 08:00 Sample', '2026-10-09 08:00 Sample', '2026-10-07 09:00 Moved',
    ]);
  });

  it('shows a multi-day event on every day it touches, and stops an archived habit (E9)', () => {
    const trip = ev({ allDay: true, start: '2026-04-30T00:00', end: '2026-05-03T00:00' });
    expect(onDay(agenda([trip], '2026-04-28', '2026-05-05', ATHENS), '2026-05-02')).toHaveLength(1);
    expect(onDay(agenda([trip], '2026-04-28', '2026-05-05', ATHENS), '2026-05-03')).toHaveLength(0);
    const archived = ev({ rrule: 'FREQ=DAILY', archivedOn: '2026-10-07' });
    expect(expand(archived, '2026-10-05', '2026-10-09', ATHENS).map((i) => i.occurrence)).toEqual(['2026-10-05', '2026-10-06']);
  });
});

describe('Day view layout (H26, E23)', () => {
  const day = '2026-10-06' as IsoDay;
  const at = (id: string, s: string, e: string) => ev({ id, start: `${day}T${s}`, end: `${day}T${e}` });

  it('puts overlapping events side by side, and lone ones full width', () => {
    const items = agenda([at('a', '09:00', '10:00'), at('b', '09:30', '10:30'), at('c', '11:00', '12:00')], day, day, ATHENS);
    const placed = Object.fromEntries(layoutDay(items, day).map((p) => [p.item.eventId, `${p.column}/${p.columns}`]));
    expect(placed).toEqual({ a: '0/2', b: '1/2', c: '0/1' });
  });

  it('marks gaps of an hour or more between 08:00 and 20:00 as free (070)', () => {
    const items = agenda([at('a', '05:30', '06:30'), at('b', '08:00', '09:00'), at('c', '10:00', '11:00'), at('d', '12:30', '13:30')], day, day, ATHENS);
    expect(freeBands(layoutDay(items, day))).toEqual([{ top: 540, bottom: 600 }, { top: 660, bottom: 750 }]);
  });

  it('labels times, including events that cross midnight', () => {
    expect(timeRange({ start: '2026-10-06T10:00', end: '2026-10-06T11:00', allDay: false }, day)).toBe('10:00–11:00');
    expect(timeRange({ start: '2026-10-06T22:00', end: '2026-10-07T01:00', allDay: false }, day)).toBe('From 22:00');
    expect(timeRange({ start: '2026-10-06T22:00', end: '2026-10-07T01:00', allDay: false }, '2026-10-07')).toBe('Until 01:00');
  });
});

describe('Week and month (H27, H28)', () => {
  it('builds Monday-first weeks and month grids', () => {
    expect(weekOf('2026-10-07')[0]).toBe('2026-10-05');
    const grid = monthGrid('2026-10-15');
    expect(grid[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']); // 1 October is a Thursday
    expect(grid.at(-1)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
  });

  it('gives at most three dots a day, one per calendar, in calendar order', () => {
    const items = agenda(['a', 'b', 'c', 'd'].map((c) => ev({ id: c, calendarId: c, start: '2026-10-06T08:00', end: '2026-10-06T09:00' })), '2026-10-06', '2026-10-06', ATHENS);
    expect(dotsOn(items, '2026-10-06', ['d', 'c', 'b', 'a'])).toEqual(['d', 'c', 'b']);
  });
});

describe('meetingLink (H29)', () => {
  it('finds a meeting link in the place or the notes', () => {
    expect(meetingLink(undefined, 'Join: https://meet.proton.me/u/abc-def.')).toBe('https://meet.proton.me/u/abc-def');
    expect(meetingLink('Nea Smirni', 'https://www.airbnb.co.uk/rooms/1')).toBeNull();
  });
});
