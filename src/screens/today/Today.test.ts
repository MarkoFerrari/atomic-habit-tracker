// @vitest-environment jsdom
// Today in a simulated page at a fixed time, with sample habits (045): check-off, Undo, skip with a reason.
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Today from './Today.svelte';
import { db, wipeDbForTests } from '../../data/db';
import { updateSettings } from '../../data/settings';
import type { CalendarEvent } from '../../data/schema';

const habit = (id: string, title: string, start: string, end: string, rrule: string, icon: string): CalendarEvent =>
  ({ id, calendarId: 'cal-habits', title, icon, start, end, allDay: false, timeMode: 'clock', rrule, exdates: [], reminders: [] });

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
  // The token stylesheet isn't loaded here; the toast reads its hold time from this token (053).
  document.documentElement.style.setProperty('--motion-duration-toast-hold', '5000ms');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-06T07:55:00+03:00')); // Tuesday, 07:55 in Athens (H11)
  // The rows read times in the phone's zone; make the test phone Athens wherever it runs.
  const real = Intl.DateTimeFormat;
  vi.stubGlobal('Intl', { ...Intl, DateTimeFormat: function (l?: string, o?: Intl.DateTimeFormatOptions) {
    return new real(l, { timeZone: 'Europe/Athens', ...o });
  } });
});
afterAll(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
beforeEach(async () => {
  await wipeDbForTests();
  const database = await db();
  await database.put('calendars', { id: 'cal-habits', name: 'SAMPLE HABITS', color: 'habits', trackAsHabits: true, createdAt: '' });
  await database.put('events', habit('train', 'Sample train 60 min', '2026-10-06T05:30', '2026-10-06T06:30', 'FREQ=WEEKLY;BYDAY=TU,TH,SA', 'dumbbell'));
  await database.put('events', habit('breakfast', 'Sample breakfast 30 min', '2026-10-05T08:00', '2026-10-05T08:30', 'FREQ=DAILY', 'coffee'));
  await database.put('events', habit('read', 'Sample read 30 min', '2026-10-05T08:30', '2026-10-05T09:00', 'FREQ=DAILY', 'book-open'));
  await updateSettings({ onboardingDone: true, trackingStart: '2026-10-05', timezone: 'Europe/Athens' });
});
afterEach(() => cleanup());

const row = (name: string) => screen.getByRole('group', { name });

describe('Today (F4)', () => {
  it('shows the morning: the next habit carries Mark as done (H11, 040)', async () => {
    render(Today, {});
    expect(await screen.findByText('Good morning')).toBeTruthy();
    expect(screen.getByText('Tuesday 6 October')).toBeTruthy();
    expect(await screen.findByText('0 of 3')).toBeTruthy();
    expect(screen.getByText('3 due today · 0%')).toBeTruthy();
    expect(within(row('Sample breakfast 30 min')).getByRole('button', { name: 'Mark as done' })).toBeTruthy();
    expect(within(row('Sample read 30 min')).queryByRole('button', { name: 'Mark as done' })).toBeNull();
  });

  it('marks done with Undo (H12)', async () => {
    render(Today, {});
    await fireEvent.click(await within(await screen.findByRole('group', { name: 'Sample breakfast 30 min' })).findByRole('button', { name: 'Mark as done' }));
    expect(await screen.findByText('Sample breakfast done')).toBeTruthy();
    expect(await screen.findByText('1 of 3')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy(); // the answered group
    await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('0 of 3')).toBeTruthy();
    expect((await (await db()).getAll('answers'))).toEqual([]);
  });

  it('skips with a reason from the habit sheet (H16, H17, 007)', async () => {
    render(Today, {});
    await fireEvent.click(await within(await screen.findByRole('group', { name: 'Sample read 30 min' })).findByRole('button', { name: /Sample read 30 min, 08:30/ }));
    expect(await screen.findByText('08:30–09:00 · SAMPLE HABITS')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(await screen.findByText('Why skip Sample read?')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Low energy' }));
    expect(await screen.findByText('Answered')).toBeTruthy();
    expect(within(row('Sample read 30 min')).getByText('Low energy')).toBeTruthy();
    const [a] = await (await db()).getAll('answers');
    expect(a).toMatchObject({ eventId: 'read', occurrence: '2026-10-06', status: 'skipped', reason: 'low-energy' });
  });

  it('with no habit calendar, shows the empty state (H14, E17)', async () => {
    const database = await db();
    await database.clear('events');
    render(Today, { onnewhabit: () => {}, onimport: () => {} });
    expect(await screen.findByText('No habits yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New habit' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import from Proton (.ics)' })).toBeTruthy();
  });
});
