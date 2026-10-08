import { describe, expect, it } from 'vitest';
import type { IsoDay } from './day';
import { greeting, occurrencesOn, runLine, showCloseTheDay, todayView, type AnswerLike, type HabitSource } from './today';

// SAMPLE DATA (045): invented habits in the shape of the design's examples.
const habits: HabitSource[] = [
  { id: 'train', title: 'Sample train 60 min', start: '2026-10-06T05:30', end: '2026-10-06T06:30', allDay: false, rrule: 'FREQ=WEEKLY;BYDAY=TU,TH,SA', exdates: [] },
  { id: 'breakfast', title: 'Sample breakfast 30 min', start: '2026-10-05T08:00', end: '2026-10-05T08:30', allDay: false, rrule: 'FREQ=DAILY', exdates: [] },
  { id: 'read', title: 'Sample morning read 30 min', start: '2026-10-05T08:30', end: '2026-10-05T09:00', allDay: false, rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', exdates: [] },
  { id: 'evening', title: 'Sample evening read 15 min', start: '2026-10-05T22:00', end: '2026-10-05T22:15', allDay: false, rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', exdates: [] },
  { id: 'stretch', title: 'Sample stretch', start: '2026-10-05T00:00', end: '2026-10-06T00:00', allDay: true, rrule: 'FREQ=DAILY', exdates: [] },
];
const ZONE = 'Europe/Athens';
const at = (wall: string) => new Date(`${wall}:00+03:00`);
const d = (s: string) => s as IsoDay;
const ans = (eventId: string, status: AnswerLike['status'], answeredAt: string): AnswerLike =>
  ({ eventId, occurrence: '2026-10-06', status, answeredAt });

describe('occurrencesOn', () => {
  it('lists the day’s habits, all-day first, then by time', () => {
    expect(occurrencesOn(habits, d('2026-10-06')).map((o) => [o.eventId, o.start, o.minutes])).toEqual([
      ['stretch', '2026-10-06T00:00', 1440], ['train', '2026-10-06T05:30', 60], ['breakfast', '2026-10-06T08:00', 30],
      ['read', '2026-10-06T08:30', 30], ['evening', '2026-10-06T22:00', 15],
    ]);
    expect(occurrencesOn(habits, d('2026-10-10')).map((o) => o.eventId)).toEqual(['stretch', 'train', 'breakfast']); // Saturday
  });
  it('follows a moved occurrence to the day it starts, and drops a cancelled one (E7)', () => {
    const moved: HabitSource = { ...habits[1]!, overrides: { '2026-10-06': { start: '2026-10-07T07:00', end: '2026-10-07T07:30' }, '2026-10-08': { start: '2026-10-08T08:00', end: '2026-10-08T08:30', cancelled: true } } };
    expect(occurrencesOn([moved], d('2026-10-06'))).toEqual([]);
    const wed = occurrencesOn([moved], d('2026-10-07'));
    expect(wed.map((o) => [o.occurrence, o.start])).toEqual([['2026-10-07', '2026-10-07T08:00'], ['2026-10-06', '2026-10-07T07:00']].sort((a, b) => a[1]!.localeCompare(b[1]!)));
    expect(occurrencesOn([moved], d('2026-10-08'))).toEqual([]);
  });
  it('an archived habit stops counting from that day (E9)', () => {
    expect(occurrencesOn([{ ...habits[1]!, archivedOn: '2026-10-06' }], d('2026-10-06'))).toEqual([]);
  });
});

describe('todayView', () => {
  const day = d('2026-10-06');
  it('morning: the next habit carries Mark as done (040, H11)', () => {
    const v = todayView(habits, [ans('train', 'done', '2026-10-06T06:31:00Z')], day, at('2026-10-06T07:55'), ZONE);
    expect(v.open.map((r) => [r.eventId, r.state, r.markDone])).toEqual([
      ['stretch', 'open', false], ['breakfast', 'open', true], ['read', 'open', false], ['evening', 'open', false],
    ]);
    expect(v.answered.map((r) => r.eventId)).toEqual(['train']);
    expect([v.done, v.due]).toEqual([1, 5]);
  });
  it('a habit inside its slot is running and carries it', () => {
    const v = todayView(habits, [], day, at('2026-10-06T08:10'), ZONE);
    expect(v.open.find((r) => r.eventId === 'breakfast')).toMatchObject({ state: 'running', markDone: true });
  });
  it('evening: a forgotten morning habit stays open for the recap (H13)', () => {
    const v = todayView(habits, [ans('breakfast', 'skipped', '2026-10-06T09:00:00Z')], day, at('2026-10-06T19:00'), ZONE);
    expect(v.open.map((r) => [r.eventId, r.markDone])).toEqual([['stretch', false], ['train', false], ['read', false], ['evening', true]]);
  });
  it('after the last habit, only the all-day one can be marked', () => {
    const v = todayView(habits, [], day, at('2026-10-06T23:00'), ZONE);
    expect(v.open.filter((r) => r.markDone).map((r) => r.eventId)).toEqual(['stretch']);
  });
  it('a closed day turns every open habit into missed (052)', () => {
    const v = todayView(habits, [], day, at('2026-10-07T04:10'), ZONE, true);
    expect(v.open).toEqual([]);
    expect(v.due).toBe(5);
  });
});

describe('greeting and Close the day', () => {
  it('follows the habit day', () => {
    expect([greeting(7), greeting(13), greeting(20), greeting(2)]).toEqual(['Good morning', 'Good afternoon', 'Good evening', 'Good evening']);
    expect([showCloseTheDay(17), showCloseTheDay(18), showCloseTheDay(3), showCloseTheDay(4)]).toEqual([false, true, true, false]);
  });
});

describe('runLine (H16)', () => {
  const breakfast = habits[1]!;
  const a = (occurrence: string, status: AnswerLike['status']): AnswerLike => ({ eventId: 'breakfast', occurrence, status, answeredAt: '' });
  it('counts calendar days from the run’s first done (060)', () => {
    expect(runLine(breakfast, [], d('2026-10-06'), d('2026-10-06'))).toBe('Apprentice at 10 days');
    expect(runLine(breakfast, [a('2026-10-06', 'done')], d('2026-10-06'), d('2026-10-06'))).toBe('Day 1 · Apprentice at 10 days');
    expect(runLine(breakfast, [a('2026-10-06', 'done'), a('2026-10-08', 'done')], d('2026-10-06'), d('2026-10-09'))).toBe('Day 4 · Apprentice at 10 days'); // one miss is forgiven
  });
  it('two misses in a row end the run (051)', () => {
    expect(runLine(breakfast, [a('2026-10-06', 'done'), a('2026-10-07', 'skipped')], d('2026-10-06'), d('2026-10-09'))).toBe('Apprentice at 10 days');
  });
});
