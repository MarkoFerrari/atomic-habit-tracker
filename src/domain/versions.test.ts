// 115: a habit keeps one identity across schedule changes. Sample data only (045).
import { describe, expect, it } from 'vitest';
import { firstDayOf, onVersionOf, splitChains, versionsOf } from './versions';
import { daysHeldFor, occurrencesOn, type HabitSource } from './today';
import type { IsoDay } from './day';

const moved: HabitSource = {
  id: 'walk', title: 'Sample walk', icon: 'footprints', start: '2026-10-08T19:00', end: '2026-10-08T19:30', allDay: false,
  rrule: 'FREQ=DAILY', exdates: [],
  past: [{ title: 'Sample walk', start: '2026-10-01T08:00', end: '2026-10-01T08:30', allDay: false, rrule: 'FREQ=DAILY;UNTIL=20261007', exdates: [] }],
};

describe('versions (115)', () => {
  it('lists the past schedules first, with the habit’s id, and the current one last', () => {
    const all = versionsOf(moved);
    expect(all.map((v) => [v.id, v.start])).toEqual([['walk', '2026-10-01T08:00'], ['walk', '2026-10-08T19:00']]);
    expect(all[0]!.icon).toBe('footprints');
    expect(firstDayOf(moved)).toBe('2026-10-01');
  });

  it('shows each day at the time it had then (E16)', () => {
    expect(occurrencesOn([moved], '2026-10-07').map((o) => o.start)).toEqual(['2026-10-07T08:00']);
    expect(occurrencesOn([moved], '2026-10-08').map((o) => o.start)).toEqual(['2026-10-08T19:00']);
  });

  it('counts the run across the change', () => {
    const answers = Array.from({ length: 8 }, (_, i) => ({ eventId: 'walk', occurrence: `2026-10-0${i + 1}`, status: 'done' as const, answeredAt: '' }));
    expect(daysHeldFor(moved, answers, '2026-10-01', '2026-10-08')).toBe(8);
  });

  it('edits an occurrence in the version that holds it', () => {
    const next = onVersionOf(moved, '2026-10-03', (v) => ({ ...v, exdates: ['2026-10-03'] }));
    expect(next.past![0]!.exdates).toEqual(['2026-10-03']);
    expect(next.exdates).toEqual([]);
  });
});

describe('joining habits split before 115', () => {
  const a = { id: 'a', calendarId: 'hab', title: 'Sample training', icon: 'dumbbell', start: '2026-10-01T08:00', rrule: 'FREQ=DAILY;UNTIL=20261009' };
  const b = { id: 'b', calendarId: 'hab', title: 'Sample training', icon: 'dumbbell', start: '2026-10-10T19:00', rrule: 'FREQ=DAILY;UNTIL=20261012' };
  const c = { id: 'c', calendarId: 'hab', title: 'Sample training', icon: 'dumbbell', start: '2026-10-13T07:00', rrule: 'FREQ=DAILY' };
  const days = (m: Record<string, string[]>) => new Map(Object.entries(m).map(([k, v]) => [k, v as IsoDay[]]));

  it('finds a chain of splits, oldest first', () => {
    expect(splitChains([c, a, b], days({ a: ['2026-10-01'], b: ['2026-10-10'], c: ['2026-10-13'] }))).toEqual([['a', 'b', 'c']]);
  });

  it('leaves different habits alone: another name, icon or calendar, or answers on the wrong side', () => {
    expect(splitChains([a, { ...b, title: 'Sample run' }], days({}))).toEqual([]);
    expect(splitChains([a, { ...b, icon: 'book-open' }], days({}))).toEqual([]);
    expect(splitChains([a, { ...b, calendarId: 'other' }], days({}))).toEqual([]);
    expect(splitChains([a, b], days({ a: ['2026-10-11'] }))).toEqual([]);
    expect(splitChains([a, { ...b, start: '2026-11-01T19:00' }], days({}))).toEqual([]);
  });

  it('joins nothing when two habits could follow the same one', () => {
    expect(splitChains([a, b, { ...b, id: 'b2' }], days({}))).toEqual([]);
  });
});
