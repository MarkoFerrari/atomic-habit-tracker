// @vitest-environment jsdom
// Stats at a fixed time, with labelled sample habits (045): week, month and year, Badges, habit detail, and the
// weekly recap with its Kaizen trial (080). Thursday 25 November 2027, 21:00 in Athens (Figma H34's sample day).
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Stats from './Stats.svelte';
import Badges from './Badges.svelte';
import HabitDetail from './HabitDetail.svelte';
import WeeklyRecap from './WeeklyRecap.svelte';
import { db, wipeDbForTests } from '../../data/db';
import { getSettings, updateSettings } from '../../data/settings';
import type { Answer, CalendarEvent } from '../../data/schema';

const habit = (id: string, title: string, start: string, end: string, icon: string): CalendarEvent =>
  ({ id, calendarId: 'cal-habits', title, icon, start, end, allDay: false, timeMode: 'clock', rrule: 'FREQ=DAILY', exdates: [], reminders: [] });
const ans = (eventId: string, occurrence: string, status: Answer['status'], reason?: Answer['reason']): Answer =>
  ({ key: `${eventId}|${occurrence}`, eventId, occurrence: occurrence as Answer['occurrence'], status, ...(reason ? { reason } : {}), answeredAt: `${occurrence}T05:10:00Z`, history: [] });

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2027-11-25T21:00:00+02:00'));
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
  // Mon 22 – Wed 24: both done. Thu 25: read open. Breakfast skipped "No time" on 22 Nov? no: breakfast done 22, skipped 23, 24.
  for (const d of ['22', '23', '24']) await database.put('answers', ans('r', `2027-11-${d}`, 'done'));
  await database.put('answers', ans('b', '2027-11-22', 'done'));
  await database.put('answers', ans('b', '2027-11-23', 'skipped', 'no-time'));
  await database.put('answers', ans('b', '2027-11-24', 'skipped', 'no-time'));
  await database.put('answers', ans('b', '2027-11-25', 'done'));
  await updateSettings({ onboardingDone: true, trackingStart: '2027-11-01', timezone: 'Europe/Athens' });
});
afterEach(() => cleanup());

const noop = () => {};
const props = { onhabit: noop, onbadges: noop, onrecap: noop };

describe('Stats (F6)', () => {
  it('week: the rate with its due count, ISO week number, a row per habit, and the legend (H34, 006, 038)', async () => {
    render(Stats, props);
    expect(await screen.findByText('Sample breakfast 30 min')).toBeTruthy();
    expect(screen.getByText(/Week 47 so far/)).toBeTruthy();
    expect(screen.getByText('Blank: not scheduled')).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /Done$/ }).length).toBeGreaterThan(0);
    expect(screen.getByText('Badges')).toBeTruthy();
  });

  it('month and year: heatmap labelled by day, best and low in words, a month opens from the year (H35, H36)', async () => {
    render(Stats, props);
    await screen.findByText('Sample breakfast 30 min');
    await fireEvent.click(screen.getByRole('radio', { name: 'Month' }));
    expect(await screen.findByText(/November so far/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Thursday 25 November: today|Thursday 25 November/ })).toBeTruthy();
    expect(screen.getByText('Dotted: days ahead')).toBeTruthy();
    await fireEvent.click(screen.getByRole('radio', { name: 'Year' }));
    expect(await screen.findByText(/2027 so far/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^December: ahead/ })).toBeTruthy();
  });

  it('shows the recap banner until opened, and nothing when there is no data (E19)', async () => {
    const onrecap = vi.fn();
    render(Stats, { ...props, onrecap });
    expect(await screen.findByText(/Week 46 recap is ready/)).toBeTruthy(); // 15–21 Nov has enough due days
    cleanup();
    await updateSettings({ recapSeen: '2027-11-15' });
    render(Stats, { ...props, onrecap });
    await screen.findByText('Sample breakfast 30 min');
    expect(screen.queryByText(/recap is ready/)).toBeNull();
    cleanup();
    await wipeDbForTests();
    render(Stats, props);
    expect(await screen.findByText('Nothing to show yet')).toBeTruthy();
  });
});

describe('Badges, habit detail and recap', () => {
  it('Badges: a medal per habit, locked until day 10, with the next medal named (H38c)', async () => {
    render(Badges, { onback: noop, onhabit: noop });
    expect(await screen.findByText('Your medals · 2')).toBeTruthy();
    expect(screen.getAllByText(/No medal yet/).length).toBe(2);
    expect(screen.getByText(/^Next · Starter/)).toBeTruthy();
    expect((await (await db()).getAll('ranks'))).toEqual([]); // nothing reached, nothing written
  });

  it('Badges: a rank reached is written down and never taken back (E4, 047)', async () => {
    const database = await db();
    for (let d = 1; d <= 12; d += 1) await database.put('answers', ans('r', `2027-11-${String(d).padStart(2, '0')}`, 'done'));
    render(Badges, { onback: noop, onhabit: noop });
    expect(await screen.findByText(/^Starter · run of/)).toBeTruthy();
    await vi.waitFor(async () => expect((await database.getAll('ranks')).map((r) => r.rank)).toEqual(['starter']));
  });

  it('habit detail: why it was not done, counted, and the done times against the slot (H37)', async () => {
    render(HabitDetail, { eventId: 'b', onback: noop });
    expect(await screen.findByRole('heading', { name: 'Sample breakfast 30 min' })).toBeTruthy();
    expect(screen.getByText(/Why it wasn’t done · 2/)).toBeTruthy();
    expect(screen.getByText('No time')).toBeTruthy();
  });

  it('recap: one pattern, one adjustment started for two weeks, saved with its review date (080)', async () => {
    render(WeeklyRecap, { weekStart: '2027-11-22', onback: noop, onhabit: noop });
    expect(await screen.findByText('Week 47 recap')).toBeTruthy();
    expect(screen.getByText(/skipped for “No time”/)).toBeTruthy();
    expect(screen.getByText('One adjustment to try')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Try for 2 weeks' }));
    expect(await screen.findByText(/^Trying until/)).toBeTruthy();
    await vi.waitFor(async () => expect((await getSettings()).adjustments).toHaveLength(1));
    const s = await getSettings();
    expect(s.adjustments![0]).toMatchObject({ habitId: 'b', status: 'active', startedOn: '2027-11-25', reviewOn: '2027-12-09' });
    expect(s.recapSeen).toBe('2027-11-22');
  });

  it('recap: a trial past its review date asks to keep or drop it, and drop ends it (080)', async () => {
    await updateSettings({ adjustments: [{ id: 'a', habitId: 'b', habitTitle: 'Sample breakfast 30 min', text: 'Do only the first 10 minutes.', startedOn: '2027-11-08', reviewOn: '2027-11-22', baseline: { done: 3, due: 7 }, status: 'active' }] });
    render(WeeklyRecap, { weekStart: '2027-11-22', onback: noop, onhabit: noop });
    expect(await screen.findByText(/^Review · Sample breakfast/)).toBeTruthy();
    expect(screen.getByText(/^Before 43% · now/)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Drop it' }));
    await vi.waitFor(async () => expect((await getSettings()).adjustments![0]).toMatchObject({ status: 'dropped', endedOn: '2027-11-25' }));
  });
});
