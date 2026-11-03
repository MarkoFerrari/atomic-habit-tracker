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
    expect(screen.getByText(/Every day · 08:00 · Keeper in 5 days/)).toBeTruthy(); // 25 days held (1–25 Nov), Builder reached (139)
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
    expect(screen.getByRole('gridcell', { name: /Monday 22 November: 100%, 2 of 2 done, perfect day/ })).toBeTruthy();
    expect(screen.getByRole('gridcell', { name: /Tuesday 23 November: 50%/ })).toBeTruthy();
  });

  it('month: step back to see how a past month held, stopping at the month tracking started, never ahead (033)', async () => {
    const database = await db();
    await database.put('events', habit('b', 'Sample breakfast 30 min', '2027-10-01T08:00', '2027-10-01T08:30', 'coffee')); // begun a month earlier
    for (let d = 1; d <= 20; d++) await database.put('answers', done('b', `2027-10-${String(d).padStart(2, '0')}`)); // 20 of 31 held
    await updateSettings({ trackingStart: '2027-10-01' });
    render(HabitsTab, { onhabit: () => {} });
    await screen.findByText('Sample breakfast 30 min');
    await fireEvent.click(screen.getByRole('radio', { name: 'Month' }));
    expect(await screen.findByText('This month')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Next month' }) as HTMLButtonElement).disabled).toBe(true); // nothing ahead

    await fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(await screen.findByRole('heading', { name: 'October 2027' })).toBeTruthy();
    expect(screen.queryByText('This month')).toBeNull();
    expect(screen.getByText('20 of 31 · 65%')).toBeTruthy(); // done ÷ due, the number due beside the rate (006)
    expect(screen.getByRole('gridcell', { name: /Wednesday 20 October: 100%, 1 of 1 done/ })).toBeTruthy();
    expect(screen.getByRole('gridcell', { name: /Thursday 21 October: 0%, 0 of 1 done/ })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Previous month' }) as HTMLButtonElement).disabled).toBe(true); // tracking began in October

    await fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(await screen.findByText('This month')).toBeTruthy();
  });

  it('week: step back through earlier weeks with their percentage, stopping at the week tracking started, never ahead (143, 033)', async () => {
    const database = await db();
    await database.delete('answers', 'b|2027-11-16'); // one slip, Tuesday of 15–21 November
    render(HabitsTab, { onhabit: () => {} });
    await screen.findByText('Sample breakfast 30 min');
    await fireEvent.click(screen.getByRole('radio', { name: 'Week' }));
    expect(await screen.findByText('This week')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Next week' }) as HTMLButtonElement).disabled).toBe(true); // nothing ahead

    await fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(await screen.findByText('Last week')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '15–21 November' })).toBeTruthy();
    expect(screen.getByText('13 of 14 · 93%')).toBeTruthy(); // done ÷ due, the number due beside the rate (006)
    expect(screen.getByRole('list', { name: 'Last week' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tuesday 16 November: 1 of 2 done/ })).toBeTruthy(); // the strip follows the week

    await fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(screen.getByRole('heading', { name: '8–14 November' })).toBeTruthy();
    expect(screen.getByText('14 of 14 · 100%')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(screen.getByRole('heading', { name: '1–7 November' })).toBeTruthy(); // tracking began on 1 November
    expect((screen.getByRole('button', { name: 'Previous week' }) as HTMLButtonElement).disabled).toBe(true);

    for (let i = 0; i < 3; i++) await fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(await screen.findByText('This week')).toBeTruthy();
  });
});
