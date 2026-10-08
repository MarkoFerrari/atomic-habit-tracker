// @vitest-environment jsdom
// The Habits tab (Figma page 14, H1–H3; 097) at a fixed time with labelled sample habits (045):
// the list with star medals and green bars (098, 100), the week grid under the strip, and the one month grid.
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import HabitsTab from './HabitsTab.svelte';
import { db, wipeDbForTests } from '../../data/db';
import { updateSettings } from '../../data/settings';
import type { Answer, CalendarEvent } from '../../data/schema';

const habit = (id: string, title: string, start: string, end: string, icon: string): CalendarEvent =>
  ({ id, calendarId: 'cal-habits', title, icon, start, end, allDay: false, timeMode: 'clock', rrule: 'FREQ=DAILY', exdates: [], reminders: [] });
const done = (eventId: string, occurrence: string): Answer =>
  ({ key: `${eventId}|${occurrence}`, eventId, occurrence: occurrence as Answer['occurrence'], status: 'done', answeredAt: `${occurrence}T05:10:00Z`, history: [] });

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2027-11-25T21:00:00+02:00')); // Thursday
  const real = Intl.DateTimeFormat;
  vi.stubGlobal('Intl', { ...Intl, DateTimeFormat: function (l?: string, o?: Intl.DateTimeFormatOptions) { return new real(l, { timeZone: 'Europe/Athens', ...o }); } });
});
afterAll(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
beforeEach(async () => {
  await wipeDbForTests();
  const database = await db();
  await database.put('calendars', { id: 'cal-habits', name: 'SAMPLE HABITS', color: 'habits', trackAsHabits: true, createdAt: '' });
  await database.put('events', habit('b', 'Sample breakfast 30 min', '2027-11-01T08:00', '2027-11-01T08:30', 'coffee'));
  await database.put('events', habit('r', 'Sample read 15 min', '2027-11-01T22:00', '2027-11-01T22:15', 'moon'));
  for (let d = 1; d <= 24; d++) {
    const day = `2027-11-${String(d).padStart(2, '0')}`;
    await database.put('answers', done('b', day));
    if (d !== 23) await database.put('answers', done('r', day)); // one slip on the 23rd
  }
  await updateSettings({ onboardingDone: true, trackingStart: '2027-11-01', timezone: 'Europe/Athens' });
});
afterEach(() => cleanup());

describe('Habits tab (097)', () => {
  it('list: each habit with its star medal, schedule and next rank, in green toward it (H1, 098, 100)', async () => {
    render(HabitsTab, { onhabit: () => {} });
    expect(await screen.findByText('Sample breakfast 30 min')).toBeTruthy();
    expect(screen.getByText('2 habits')).toBeTruthy();
    expect(screen.getByText(/Every day · 08:00 · Builder in 5 days/)).toBeTruthy(); // 25 days held (1–25 Nov), Starter reached
    expect(screen.getAllByRole('progressbar').length).toBe(2);
  });

  it('week: the strip heads the grid; month: one heatmap with a star on perfect days (H2, H3, 033)', async () => {
    render(HabitsTab, { onhabit: () => {} });
    await screen.findByText('Sample breakfast 30 min');
    await fireEvent.click(screen.getByRole('radio', { name: 'Week' }));
    expect(await screen.findByText('This week')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'This week' })).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /: done$/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText('perfect days so far')).toBeNull(); // no summary under the grid (owner, 8 Oct 2026)
    await fireEvent.click(screen.getByRole('radio', { name: 'Month' }));
    expect(await screen.findByText('This month')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Monday 22 November: 100%, 2 of 2 done, perfect day/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tuesday 23 November: 50%/ })).toBeTruthy();
  });
});
