// @vitest-environment jsdom
// The Evening Recap (F5) in a simulated page, with sample habits (045).
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Recap from './Recap.svelte';
import { db, wipeDbForTests } from '../../data/db';
import { answer } from '../../data/answers';
import type { CalendarEvent } from '../../data/schema';
import type { IsoDay } from '../../domain/day';

const habit = (id: string, title: string, start: string, end: string, rrule: string): CalendarEvent =>
  ({ id, calendarId: 'cal', title, icon: 'sprout', start, end, allDay: false, timeMode: 'clock', rrule, exdates: [], reminders: [] });
const DAY = '2026-10-06' as IsoDay;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
  const real = Intl.DateTimeFormat;
  vi.stubGlobal('Intl', { ...Intl, DateTimeFormat: function (l?: string, o?: Intl.DateTimeFormatOptions) {
    return new real(l, { timeZone: 'Europe/Athens', ...o });
  } });
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterAll(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
beforeEach(async () => {
  vi.setSystemTime(new Date('2026-10-06T22:35:00+03:00'));
  await wipeDbForTests();
  const database = await db();
  await database.put('calendars', { id: 'cal', name: 'SAMPLE HABITS', color: 'habits', trackAsHabits: true, createdAt: '' });
  await database.put('events', habit('train', 'Sample train 60 min', '2026-10-06T05:30', '2026-10-06T06:30', 'FREQ=WEEKLY;BYDAY=TU,TH'));
  await database.put('events', habit('breakfast', 'Sample breakfast 30 min', '2026-10-05T08:00', '2026-10-05T08:30', 'FREQ=DAILY'));
  await database.put('events', habit('read', 'Sample read 15 min', '2026-10-05T22:00', '2026-10-05T22:15', 'FREQ=DAILY'));
  await answer('train', DAY, 'done', DAY);
});
afterEach(() => cleanup());

const click = async (name: string | RegExp) => fireEvent.click(await screen.findByRole('button', { name }));

describe('Evening Recap (F5)', () => {
  it('all at once: answer, see the result, see tomorrow (H18, H20, H23)', async () => {
    const onclose = vi.fn();
    render(Recap, { onclose });
    expect(await screen.findByText('Close the day')).toBeTruthy();
    expect(screen.getByText('Open · 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark both as done' })).toBeTruthy();

    const [, readDone] = screen.getAllByRole('button', { name: 'Done' });
    await fireEvent.click(readDone!);
    expect(await screen.findByText('Open · 1')).toBeTruthy();
    await click('Skip');
    await click('No time');

    expect(await screen.findByText('Day result')).toBeTruthy();
    expect(screen.getByText('2 of 3')).toBeTruthy();
    expect(screen.getByText('67% · 3 due')).toBeTruthy();
    expect(screen.getByText('A good day. Sample breakfast was the one that slipped, for No time.')).toBeTruthy();
    await click('See tomorrow');
    expect(await screen.findByText('Tomorrow')).toBeTruthy();
    expect(screen.getByText('Habits · 2')).toBeTruthy(); // Wednesday: no train
    await click('Done for today');
    expect(onclose).toHaveBeenCalled();
  });

  it('one by one, with the reason in place (H19), ending on a perfect day (H21)', async () => {
    render(Recap, { onclose: () => {} });
    await fireEvent.click(await screen.findByRole('radio', { name: 'One by one' }));
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sample breakfast 30 min' })).toBeTruthy();
    await click('Skip');
    expect(screen.getByText('Why skipped? Optional')).toBeTruthy();
    await click('Skip without a reason');
    expect(await screen.findByText('2 of 2')).toBeTruthy();
    await click('Done');
    expect(await screen.findByText('Day result')).toBeTruthy();
    expect(screen.queryByText('Perfect day')).toBeNull(); // breakfast was skipped
  });

  it('a day with every habit done is a perfect day (H21)', async () => {
    render(Recap, { onclose: () => {} });
    await click('Mark both as done');
    expect(await screen.findByText('Perfect day')).toBeTruthy();
    expect(screen.getByText('Every habit done.')).toBeTruthy();
  });

  it('after midnight it closes yesterday by name (H24, R1)', async () => {
    vi.setSystemTime(new Date('2026-10-07T00:30:00+03:00'));
    render(Recap, { onclose: () => {} });
    expect(await screen.findByText('Close Tuesday')).toBeTruthy();
    expect(screen.getByText('Opened at 00:30')).toBeTruthy();
    expect(screen.getByText('It’s past midnight. Tuesday stays open until 04:00.')).toBeTruthy();
  });

  it('a closed day goes straight to the result (H25)', async () => {
    await answer('breakfast', DAY, 'done', DAY);
    await answer('read', DAY, 'skipped', DAY);
    render(Recap, { onclose: () => {} });
    expect(await screen.findByText('Day result')).toBeTruthy();
    expect(screen.getByText('Every habit has an answer. Change one from Today until 04:00.')).toBeTruthy();
  });
});
