// @vitest-environment jsdom
// Drives the whole first-run flow (F1) in a simulated page with sample calendars (045).
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import Onboarding from './Onboarding.svelte';
import { db } from '../../data/db';
import { getSettings } from '../../data/settings';

const ics = (name: string, events: string[]) => ['BEGIN:VCALENDAR', `X-WR-CALNAME:${name}`, ...events, 'END:VCALENDAR'].join('\n');
const ev = (uid: string, title: string, start: string, rrule?: string) =>
  ['BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${title}`, `DTSTART;TZID=Europe/Athens:${start}`, 'DURATION:PT30M', ...(rrule ? [`RRULE:${rrule}`] : []), 'END:VEVENT'].join('\n');
const file = (name: string, text: string) => new File([text], name, { type: 'text/calendar' });

beforeAll(() => {
  // jsdom lacks these; the flow only needs them to exist.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
  // jsdom's File has no text(); phones do.
  Blob.prototype.text ??= function (this: Blob) {
    return new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(this); });
  };
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => cleanup());

const click = async (name: string | RegExp) => fireEvent.click(await screen.findByRole('button', { name }));
const choose = async (...files: File[]) => {
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  await fireEvent.change(input);
};

describe('first run (F1)', () => {
  it('a wrong file explains itself (E11, H07b)', async () => {
    render(Onboarding, { ondone: () => {} });
    await click('Get started');
    await click('Not now');
    await choose(file('proton-export.html', '<html></html>'));
    expect(await screen.findByText('Can’t read this file')).toBeTruthy();
    expect(screen.getByDisplayValue('proton-export.html')).toBeTruthy();
  });

  it('imports, merges a second habit calendar, picks icons, saves, and finishes', async () => {
    const ondone = vi.fn();
    render(Onboarding, { ondone });
    await click('Get started');
    await click('Not now');
    await choose(
      file('personal.ics', ics('SAMPLE PERSONAL', [ev('p1', 'Sample dinner', '20261009T200000')])),
      file('habits.ics', ics('SAMPLE HABITS', [ev('h1', 'Sample train 60 min', '20261006T053000', 'FREQ=WEEKLY;BYDAY=TU,TH,SA')])),
      file('sport.ics', ics('SAMPLE SPORT', [ev('s1', 'Sample swim', '20261007T180000', 'FREQ=WEEKLY;BYDAY=WE')])),
    );
    expect(await screen.findByText('3 calendars found')).toBeTruthy();
    expect(screen.getAllByText('1 event · 1 repeating')).toHaveLength(2);
    await click('Continue');

    expect(await screen.findByText('Review your calendars')).toBeTruthy();
    expect(screen.getByText('Tracked as habits')).toBeTruthy(); // guessed from the name
    await fireEvent.click(screen.getByRole('switch', { name: 'Track SAMPLE SPORT as habits' }));
    expect(await screen.findByText('Merges into SAMPLE HABITS')).toBeTruthy();
    await click('Continue');

    expect(await screen.findByText('2 habits in SAMPLE HABITS')).toBeTruthy();
    expect(screen.getByText('Tue, Thu, Sat · 05:30')).toBeTruthy();
    const [first] = await screen.findAllByRole('button', { name: 'Change icon' });
    await fireEvent.click(first!);
    await fireEvent.click(await screen.findByRole('radio', { name: 'bike' }));
    await click('Save');
    await click('Continue');

    expect(await screen.findByText('Your data lives on this phone')).toBeTruthy();
    await click('Later');
    await vi.waitFor(() => expect(ondone).toHaveBeenCalled());

    const database = await db();
    const events = await database.getAll('events');
    expect(events.find((e) => e.icsUid === 'h1')).toMatchObject({ icon: 'bike', timeMode: 'clock', start: '2026-10-06T05:30' });
    expect(events.find((e) => e.icsUid === 's1')).toMatchObject({ icon: 'waves', timeMode: 'clock' });
    expect((await database.getAll('calendars')).map((c) => c.name).sort()).toEqual(['SAMPLE HABITS', 'SAMPLE PERSONAL']);
    expect((await getSettings()).onboardingDone).toBe(true);
  });
});
