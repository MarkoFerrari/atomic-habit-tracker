// @vitest-environment jsdom
// Settings screens (H42–H49) in a simulated page, with sample data (045).
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ImportPreview from './ImportPreview.svelte';
import RestorePreview from './RestorePreview.svelte';
import Habits from './Habits.svelte';
import CalendarEditor from './CalendarEditor.svelte';
import Notifications from './Notifications.svelte';
import Settings from './Settings.svelte';
import { db, wipeDbForTests } from '../../data/db';
import { parseIcs } from '../../data/ics';
import { readBackup } from '../../data/restore';
import type { CalendarEvent } from '../../data/schema';

const ZONE = 'Europe/Athens';
const train: CalendarEvent = {
  id: 'train', calendarId: 'hab', title: 'Sample train - 30 min', start: '2026-09-14T17:30', end: '2026-09-14T18:00',
  allDay: false, timeMode: 'clock', rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR', exdates: [], reminders: [0], icon: 'dumbbell',
};

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
});
beforeEach(async () => {
  await wipeDbForTests();
  const database = await db();
  await database.put('calendars', { id: 'hab', name: 'SAMPLE HABITS', color: 'habits', trackAsHabits: true, createdAt: '1' });
  await database.put('calendars', { id: 'wrk', name: 'SAMPLE WORK', color: 'work', trackAsHabits: false, createdAt: '2' });
  await database.put('events', train);
});
afterEach(async () => {
  cleanup();
  await new Promise((r) => setTimeout(r, 50)); // let reloads started by the last tap finish before the next wipe
});

describe('Import preview (H44)', () => {
  it('imports a file into the calendar with its name', async () => {
    const ics = parseIcs(['BEGIN:VCALENDAR', 'X-WR-CALNAME:SAMPLE WORK', 'BEGIN:VEVENT', 'UID:u1', 'DTSTART;TZID=Europe/Athens:20261009T100000',
      'DTEND;TZID=Europe/Athens:20261009T110000', 'SUMMARY:Sample planning', 'END:VEVENT', 'END:VCALENDAR'].join('\n'), ZONE);
    const ondone = vi.fn();
    render(ImportPreview, { ics, fileName: 'sample.ics', oncancel: () => {}, ondone });
    const button = await screen.findByRole('button', { name: 'Import 1 event' });
    await vi.waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    await fireEvent.click(button);
    await vi.waitFor(() => expect(ondone).toHaveBeenCalledWith('Imported: 1 added.'));
    const added = (await (await db()).getAll('events')).find((e) => e.icsUid === 'u1');
    expect(added).toMatchObject({ calendarId: 'wrk', timeMode: 'zoned' });
  });
});

describe('Restore (H48)', () => {
  it('replaces everything with the backup', async () => {
    const preview = readBackup(JSON.stringify({ app: 'atomic', schemaVersion: 3, exportedAt: '2026-10-05T10:00:00Z',
      calendars: [{ id: 'c', name: 'SAMPLE ONLY', color: 'marko', trackAsHabits: false, createdAt: '' }], events: [], answers: [], ranks: [], pushLog: [], settings: [] }));
    const ondone = vi.fn();
    render(RestorePreview, { preview, fileName: 'atomic-backup-2026-10-05.json', oncancel: () => {}, ondone });
    expect(screen.getByText('5 October 2026')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Replace with this backup' }));
    await vi.waitFor(() => expect(ondone).toHaveBeenCalled());
    expect((await (await db()).getAll('calendars')).map((c) => c.name)).toEqual(['SAMPLE ONLY']);
  });
});

describe('Habits (H45, H45b)', () => {
  it('renames a habit and archives it', async () => {
    render(Habits, { onback: () => {} });
    await fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const field = await screen.findByDisplayValue('Sample train - 30 min');
    await fireEvent.input(field, { target: { value: 'Sample run - 30 min' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(async () => expect((await (await db()).get('events', 'train'))!.title).toBe('Sample run - 30 min'));
    await fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Archive habit' }));
    await vi.waitFor(async () => expect((await (await db()).get('events', 'train'))!.archivedOn).toBeTruthy());
    expect(await screen.findByText('Archived · 1')).toBeTruthy(); // the list reloads before the test ends
  });
});

describe('New calendar (H43)', () => {
  it('saves a calendar with a free colour and its default reminder', async () => {
    const ondone = vi.fn();
    render(CalendarEditor, { calendar: null, oncancel: () => {}, ondone });
    const name = await screen.findByPlaceholderText('Name');
    await fireEvent.input(name, { target: { value: 'SAMPLE TRIPS' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(ondone).toHaveBeenCalled());
    const saved = (await (await db()).getAll('calendars')).find((c) => c.name === 'SAMPLE TRIPS');
    expect(saved).toMatchObject({ color: 'marko', trackAsHabits: false, defaultReminders: [15] });
  });
});

describe('Settings (E2)', () => {
  it('has no Calendar and no import, even with events from another calendar on the phone (104)', async () => {
    await (await db()).put('events', { ...train, id: 'meet', calendarId: 'wrk', title: 'Sample meeting' });
    render(Settings, { onopen: () => {} });
    expect(await screen.findByText('Your data')).toBeTruthy();
    expect(screen.queryByText('Show my events')).toBeNull();
    expect(screen.queryByText('Calendars and import')).toBeNull();
  });
});

describe('Notifications (H46)', () => {
  it('has no per-calendar defaults any more: only habits remind (104)', async () => {
    render(Notifications, { onback: () => {} });
    expect(await screen.findByText(/Habits remind you when they start/)).toBeTruthy();
    expect(screen.queryByText('Event reminders by default')).toBeNull();
    expect(screen.queryByRole('button', { name: /SAMPLE HABITS/ })).toBeNull();
  });
});
