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
    expect(screen.getByText('3 due today')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'This week' })).toBeTruthy(); // the week strip (096)
    expect(screen.getByText(/08:00 · Apprentice in 10 days/)).toBeTruthy(); // the next rank on the row (098)
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

  it('shows the cue and the identity, and counts the 2-min version as done, apart in the data (085, 086)', async () => {
    const database = await db();
    const read = (await database.get('events', 'read'))!;
    await database.put('events', { ...read, after: 'Sample breakfast 30 min', smallest: 'Read one page', identity: 'A reader' });
    render(Today, {});
    expect(await screen.findByText(/08:30 · after Sample breakfast 30 min/)).toBeTruthy();
    expect(screen.getByText('Voting for: A reader')).toBeTruthy();
    await fireEvent.click(within(await screen.findByRole('group', { name: 'Sample read 30 min' })).getByRole('button', { name: /Sample read 30 min, 08:30/ }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Did the 2-min version' }));
    expect(await screen.findByText('1 of 3')).toBeTruthy();
    expect(within(row('Sample read 30 min')).getByText('2-min')).toBeTruthy();
    expect((await database.getAll('answers'))[0]).toMatchObject({ eventId: 'read', status: 'done', small: true });
  });

  it('plan B: moves a habit to a later time today without answering it, with Undo (P5, 087)', async () => {
    render(Today, {});
    await fireEvent.click(within(await screen.findByRole('group', { name: 'Sample read 30 min' })).getByRole('button', { name: /Sample read 30 min, 08:30/ }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));
    expect(await screen.findByText(/Plan B first/)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: '18 hours' }));
    await fireEvent.click(screen.getByRole('button', { name: '30 minutes' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Move to 18:30 today' }));
    expect(await screen.findByText('Sample read moved to 18:30')).toBeTruthy();
    const database = await db();
    expect((await database.get('events', 'read'))!.overrides).toEqual({ '2026-10-06': { start: '2026-10-06T18:30', end: '2026-10-06T19:00' } });
    expect(await database.getAll('answers')).toEqual([]); // moved, not answered: nothing counts as a miss
    expect(await screen.findByText(/^18:30 · /)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await vi.waitFor(async () => expect((await database.get('events', 'read'))!.overrides).toBeUndefined());
  });

  it('shows the Kaizen adjustment being tried until its review (080)', async () => {
    await updateSettings({ adjustments: [{ id: 'a', habitId: 'read', habitTitle: 'Sample read 30 min', text: 'Read the first 10 minutes only.', startedOn: '2026-10-05', reviewOn: '2026-10-19', baseline: { done: 3, due: 7 }, status: 'active' }] });
    render(Today, {});
    expect(await screen.findByText(/Trying until .*19 October · Sample read: Read the first 10 minutes only\./)).toBeTruthy();
  });

  it('with no habit calendar, shows the empty state (H14, E17)', async () => {
    const database = await db();
    await database.clear('events');
    render(Today, { onnewhabit: () => {} });
    expect(await screen.findByText('Start with one habit')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'New habit' }).length).toBeGreaterThan(0); // the top bar's + and the big button (079)
    expect(screen.queryByRole('button', { name: 'Import from Proton (.ics)' })).toBeNull(); // habits first (097); the import left the app (104)
  });

  it('the last habit of the day plays the award once; the ring stays green with the star (093)', async () => {
    const database = await db();
    await database.delete('events', 'train');
    for (const id of ['breakfast']) await database.put('answers', { key: `${id}|2026-10-06`, eventId: id, occurrence: '2026-10-06', status: 'done', answeredAt: '2026-10-06T04:50:00Z', history: [] });
    render(Today, {});
    expect(await screen.findByText('1 of 2')).toBeTruthy();
    expect(screen.getByText('One more for a perfect day')).toBeTruthy();
    await fireEvent.click(await within(row('Sample read 30 min')).findByRole('button', { name: 'Mark as done' }));
    expect(await screen.findByText('2 of 2')).toBeTruthy();
    expect(await screen.findByRole('status')).toBeTruthy(); // the award announces "Perfect day. 2 of 2 done…"
    const { getSettings } = await import('../../data/settings');
    await vi.waitFor(async () => expect((await getSettings()).awardShownOn).toBe('2026-10-06')); // once a day
  });

  it('the morning after a miss, one line says today keeps the run (099)', async () => {
    const database = await db();
    // Breakfast held 3 days (2–4 Oct), then slipped on 5 Oct: one miss is forgiven, today decides.
    await updateSettings({ trackingStart: '2026-10-02' });
    await database.put('events', habit('breakfast', 'Sample breakfast 30 min', '2026-10-02T08:00', '2026-10-02T08:30', 'FREQ=DAILY', 'coffee'));
    for (const d of ['2026-10-02', '2026-10-03', '2026-10-04']) await database.put('answers', { key: `breakfast|${d}`, eventId: 'breakfast', occurrence: d as `${number}-${number}-${number}`, status: 'done', answeredAt: `${d}T05:10:00Z`, history: [] });
    render(Today, {});
    expect(await screen.findByText('Sample breakfast slipped yesterday. Do it today and your 5-day run holds.')).toBeTruthy();
  });
});
