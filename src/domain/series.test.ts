import { describe, expect, it } from 'vitest';
import { endBefore, excludeOne, overrideOne, repeatFromRule, restFrom, ruleFromRepeat, withUntil, type SeriesEvent } from './series';
import { expand } from './agenda';
import type { IsoDay } from './day';

const zoneDay = (iso: string) => iso.slice(0, 10) as IsoDay;
const habit: SeriesEvent = {
  id: 'h', calendarId: 'c', title: 'Sample train - 30 min', start: '2026-09-14T17:30', end: '2026-09-14T18:00',
  allDay: false, timeMode: 'clock', rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR', exdates: ['2026-09-16', '2026-10-09'],
  overrides: { '2026-09-18': { start: '2026-09-18T16:00', end: '2026-09-18T16:30' }, '2026-10-12': { start: '2026-10-12T18:00', end: '2026-10-12T18:30' } },
  reminders: [0], icsUid: 'uid-1',
};

describe('repeat picker (H30)', () => {
  it('reads and writes the common rules', () => {
    expect(repeatFromRule('FREQ=WEEKLY;BYDAY=MO,WE,FR', '2026-09-14')).toEqual({ kind: 'weekly', days: [0, 2, 4], until: null });
    expect(repeatFromRule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261231', '2026-09-14')).toMatchObject({ kind: 'weekdays', until: '2026-12-31' });
    expect(repeatFromRule('FREQ=MONTHLY;BYDAY=-1FR', '2026-09-25')).toMatchObject({ kind: 'custom' });
    expect(repeatFromRule(undefined, '2026-09-14')).toMatchObject({ kind: 'none', days: [0] });
    expect(ruleFromRepeat({ kind: 'biweekly', days: [3, 1], until: '2027-01-31' })).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;UNTIL=20270131');
    expect(ruleFromRepeat({ kind: 'none', days: [], until: null })).toBeUndefined();
  });
  it('drops COUNT when it sets UNTIL', () => {
    expect(withUntil('FREQ=DAILY;COUNT=10', '2026-10-01')).toBe('FREQ=DAILY;UNTIL=20261001');
  });
});

describe('Custom repeat (077)', () => {
  it('builds a rule from days and an interval, and reads it back', () => {
    const rule = ruleFromRepeat({ kind: 'days', days: [4, 0, 2], until: null, every: 3 });
    expect(rule).toBe('FREQ=WEEKLY;INTERVAL=3;BYDAY=MO,WE,FR');
    expect(repeatFromRule(rule, '2026-10-05' as IsoDay)).toMatchObject({ kind: 'days', days: [0, 2, 4], every: 3 });
  });
  it('every week on chosen days is the plain weekly rule, with an end date when set', () => {
    expect(ruleFromRepeat({ kind: 'days', days: [1, 3], until: '2026-12-31' as IsoDay, every: 1 })).toBe('FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261231');
  });
});

describe('scoped changes (H31, E16)', () => {
  it('only this event: an exception, or a moved occurrence', () => {
    expect(excludeOne(habit, '2026-10-12').exdates).toContain('2026-10-12');
    expect(excludeOne(habit, '2026-10-12').overrides).not.toHaveProperty('2026-10-12');
    const moved = overrideOne(habit, '2026-10-14', { start: '2026-10-14T07:00', end: '2026-10-14T07:30', title: habit.title });
    expect(moved.overrides!['2026-10-14']).toEqual({ start: '2026-10-14T07:00', end: '2026-10-14T07:30' });
  });

  it('this and following: the old series ends the day before, the rest becomes a new event', () => {
    const before = endBefore(habit, '2026-10-07', zoneDay)!;
    expect(before.rrule).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261006');
    expect(before.exdates).toEqual(['2026-09-16']);
    expect(Object.keys(before.overrides!)).toEqual(['2026-09-18']);
    const after = restFrom(habit, '2026-10-07', 'h2', zoneDay);
    expect(after).toMatchObject({ id: 'h2', exdates: ['2026-10-09'] });
    expect(after).not.toHaveProperty('icsUid');
    expect(Object.keys(after.overrides!)).toEqual(['2026-10-12']);
    const days = expand(before, '2026-10-01', '2026-10-31', 'Europe/Athens').map((i) => i.occurrence);
    expect(days.at(-1)).toBe('2026-10-05');
  });

  it('nothing is left before the first occurrence', () => {
    expect(endBefore(habit, '2026-09-14', zoneDay)).toBeNull();
  });

  it('a COUNT rule keeps the number still to come', () => {
    const counted = { ...habit, rrule: 'FREQ=DAILY;COUNT=10', start: '2026-10-01T08:00', end: '2026-10-01T08:30', exdates: [], overrides: {} };
    expect(restFrom(counted, '2026-10-05', 'n', zoneDay).rrule).toBe('FREQ=DAILY;COUNT=6');
  });
});
