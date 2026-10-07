// @vitest-environment jsdom
// The calendar (F3) in a simulated page, with sample events (045).
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Calendar from './Calendar.svelte';
import EventEditor from './EventEditor.svelte';
import EventDetail from './EventDetail.svelte';
import { db, wipeDbForTests } from '../../data/db';
import { allEvents } from '../../data/events';
import { expand } from '../../domain/agenda';
import type { CalendarEvent } from '../../data/schema';

const ZONE = 'Europe/Athens';
const sync: CalendarEvent = {
  id: 'sync', calendarId: 'wrk', title: 'Sample weekly sync', start: '2026-10-06T07:00:00.000Z', end: '2026-10-06T08:00:00.000Z',
  allDay: false, timeMode: 'zoned', tz: ZONE, rrule: 'FREQ=WEEKLY', exdates: [], reminders: [10], place: 'https://meet.proton.me/u/sample',
};

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
  const real = Intl.DateTimeFormat;
  vi.stubGlobal('Intl', { ...Intl, DateTimeFormat: function (l?: string, o?: Intl.DateTimeFormatOptions) {
    return new real(l, { timeZone: ZONE, ...o });
  } });
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterAll(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
beforeEach(async () => {
  vi.setSystemTime(new Date('2026-10-06T10:20:00+03:00'));
  await wipeDbForTests();
  const database = await db();
  await database.put('calendars', { id: 'hab', name: 'SAMPLE HABITS', color: 'habits', trackAsHabits: true, createdAt: '1' });
  await database.put('calendars', { id: 'wrk', name: 'SAMPLE WORK', color: 'work', trackAsHabits: false, createdAt: '2' });
  await database.put('events', sync);
});
afterEach(() => cleanup());

describe('Calendar (H26–H28)', () => {
  it('shows the day with its events, and opens one', async () => {
    const onopen = vi.fn();
    render(Calendar, { onopen });
    expect(await screen.findByText('Tuesday 6 October')).toBeTruthy();
    await fireEvent.click(await screen.findByRole('button', { name: /Sample weekly sync/ }));
    expect(onopen.mock.calls[0]![0]).toMatchObject({ eventId: 'sync', occurrence: '2026-10-06', start: '2026-10-06T10:00' });
  });

  it('switches to week and month, and hides a calendar from its chip', async () => {
    render(Calendar, {});
    await fireEvent.click(await screen.findByRole('radio', { name: 'Week' }));
    expect(screen.getByText('Week 41')).toBeTruthy();
    await fireEvent.click(screen.getByRole('radio', { name: 'Month' }));
    expect(screen.getByText('2026')).toBeTruthy();
    expect(await screen.findByRole('button', { name: /Sample weekly sync/ })).toBeTruthy();
    await fireEvent.click(screen.getByRole('radio', { name: 'Day' }));
    await fireEvent.click(screen.getByRole('button', { name: 'SAMPLE WORK' }));
    expect(await screen.findByText('Nothing on Tuesday 6')).toBeTruthy(); // H33
  });
});

describe('New event (H30)', () => {
  it('reads the end from the title and saves a habit in clock time', async () => {
    const onsaved = vi.fn();
    render(EventEditor, { mode: { kind: 'new', day: '2026-10-08' }, oncancel: () => {}, onsaved });
    const title = await screen.findByPlaceholderText(/Title/);
    await fireEvent.input(title, { target: { value: 'Sample diorama - 45 min' } });
    expect(await screen.findByText('45 min later')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(onsaved).toHaveBeenCalledWith('2026-10-08'));
    const [saved] = (await allEvents()).filter((e) => e.id !== 'sync');
    expect(saved).toMatchObject({ calendarId: 'hab', timeMode: 'clock', start: '2026-10-08T09:00', end: '2026-10-08T09:45', reminders: [0] });
  });

  it('asks for a name before saving', async () => {
    render(EventEditor, { mode: { kind: 'new', day: '2026-10-08' }, oncancel: () => {}, onsaved: () => {} });
    await screen.findByPlaceholderText(/Title/);
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Give it a name, like “Read - 20 min”.')).toBeTruthy();
  });
});

describe('Event detail (H29)', () => {
  it('shows when, repeats, reminder and the link, with Join', async () => {
    const item = expand(sync, '2026-10-06', '2026-10-06', ZONE)[0]!;
    render(EventDetail, { item, onback: () => {}, onedit: () => {}, onchanged: () => {} });
    expect(await screen.findByText('Tuesday 6 October · 10:00–11:00')).toBeTruthy();
    expect(screen.getByText('Every Tuesday')).toBeTruthy();
    expect(screen.getByText('10 min before')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Join' })).toBeTruthy();
  });

  it('deletes only one occurrence of a repeating event', async () => {
    const onchanged = vi.fn();
    const item = expand(sync, '2026-10-06', '2026-10-06', ZONE)[0]!;
    render(EventDetail, { item, onback: () => {}, onedit: () => {}, onchanged });
    await fireEvent.click(await screen.findByRole('button', { name: 'Delete event' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Only this event' }));
    await vi.waitFor(() => expect(onchanged).toHaveBeenCalled());
    expect((await allEvents())[0]!.exdates).toEqual(['2026-10-06']);
  });
});
