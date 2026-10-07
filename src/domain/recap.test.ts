import { describe, expect, it } from 'vitest';
import { bulkDoneLabel, recapFor, resultSentence, type ResultRow } from './recap';
import { shortName } from './format';

const ZONE = 'Europe/Athens';

describe('recapFor (R1, H24)', () => {
  it('closes today in the evening, and yesterday after midnight, by name', () => {
    expect(recapFor(new Date('2026-10-06T22:30:00+03:00'), ZONE)).toEqual({ day: '2026-10-06', afterMidnight: false, title: 'Close the day' });
    expect(recapFor(new Date('2026-10-07T00:30:00+03:00'), ZONE)).toEqual({ day: '2026-10-06', afterMidnight: true, title: 'Close Tuesday' });
  });
});

describe('resultSentence (H20)', () => {
  const row = (title: string, state: ResultRow['state'], reason?: string): ResultRow => ({ title, state, reason });
  it('matches the design for one slip', () => {
    expect(resultSentence([row('Train 60 min', 'done'), row('Breakfast 30 min', 'skipped', 'No time'), row('Read 30 min', 'done')], shortName))
      .toBe('A good day. Breakfast was the one that slipped, for No time.');
  });
  it('covers the other days plainly', () => {
    expect(resultSentence([row('Train 60 min', 'done')], shortName)).toBe('Every habit done.');
    expect(resultSentence([row('Train 60 min', 'skipped'), row('Read 30 min', 'skipped')], shortName)).toBe('None held today. Tomorrow starts clean.');
    expect(resultSentence([row('A 5 min', 'done'), row('B 5 min', 'skipped'), row('C 5 min', 'skipped'), row('D 5 min', 'missed')], shortName))
      .toBe('1 of 4 held. B, C and D slipped.');
  });
});

describe('bulkDoneLabel (032)', () => {
  it('names its count', () => {
    expect([bulkDoneLabel(1), bulkDoneLabel(2), bulkDoneLabel(3)]).toEqual(['Mark it as done', 'Mark both as done', 'Mark all 3 as done']);
  });
});
