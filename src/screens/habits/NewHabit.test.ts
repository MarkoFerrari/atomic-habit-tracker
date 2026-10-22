// @vitest-environment jsdom
// 116: New habit explains Nudge and Make it stick behind an (i) (U16). The rows themselves still open as before.
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import NewHabit from './NewHabit.svelte';
import { wipeDbForTests } from '../../data/db';

// 121: the iPhone's question and the sign-up are stubbed; the test checks when New habit asks.
const push = vi.hoisted(() => ({ canAsk: vi.fn(() => true), enablePush: vi.fn(async () => 'granted'), askPermission: vi.fn(async () => 'granted') }));
vi.mock('../../push/enable', () => ({ canAsk: push.canAsk, enablePush: push.enablePush }));
vi.mock('../../push/notifications', async (orig) => ({ ...(await orig<object>()), askPermission: push.askPermission }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
});
beforeEach(async () => { await wipeDbForTests(); });
afterEach(async () => { await new Promise((r) => setTimeout(r, 50)); cleanup(); });

describe('New habit (i) help (116)', () => {
  it('explains the nudge', async () => {
    render(NewHabit, { oncancel: () => {}, onsaved: () => {} });
    await fireEvent.click(screen.getByRole('button', { name: 'What is Nudge at the start?' }));
    expect(await screen.findByText(/One notification when the habit starts/)).toBeTruthy();
  });

  it('explains make it stick, and the row still opens its own sheet', async () => {
    render(NewHabit, { oncancel: () => {}, onsaved: () => {} });
    await fireEvent.click(screen.getByRole('button', { name: 'What is Make it stick?' }));
    expect(await screen.findByText(/Tie the habit to one you already do/)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Make it stick, Optional' }));
    expect(await screen.findByText('After (a habit you already do)')).toBeTruthy();
  });
});

describe('New habit asks to allow notifications (121)', () => {
  beforeEach(() => { push.canAsk.mockReturnValue(true); push.enablePush.mockClear(); push.askPermission.mockClear(); });
  const fill = async () => fireEvent.input(screen.getByLabelText('Habit'), { target: { value: 'Sample read 20 min' } });

  it('asks on Save when Nudge is on and the phone was never asked, then opens Today', async () => {
    const onsaved = vi.fn();
    render(NewHabit, { oncancel: () => {}, onsaved });
    await fill();
    await fireEvent.click(screen.getByRole('button', { name: 'Save habit' }));
    await vi.waitFor(() => expect(onsaved).toHaveBeenCalled());
    expect(push.askPermission).toHaveBeenCalledTimes(1);
    expect(push.enablePush).toHaveBeenCalledTimes(1);
  });

  it('doesn’t ask when the phone was already asked', async () => {
    push.canAsk.mockReturnValue(false);
    const onsaved = vi.fn();
    render(NewHabit, { oncancel: () => {}, onsaved });
    await fill();
    await fireEvent.click(screen.getByRole('button', { name: 'Save habit' }));
    await vi.waitFor(() => expect(onsaved).toHaveBeenCalled());
    expect(push.askPermission).not.toHaveBeenCalled();
  });

  it('doesn’t ask when Nudge is off', async () => {
    const onsaved = vi.fn();
    render(NewHabit, { oncancel: () => {}, onsaved });
    await fill();
    await fireEvent.click(screen.getByRole('switch', { name: 'Nudge at the start' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Save habit' }));
    await vi.waitFor(() => expect(onsaved).toHaveBeenCalled());
    expect(push.askPermission).not.toHaveBeenCalled();
  });
});

describe('Count it as a habit off saves a reminder, not a habit (130)', () => {
  it('suggests times every 2 hours, saves them, and makes no habit', async () => {
    const { db } = await import('../../data/db');
    const { listTimed } = await import('../../data/timed');
    const onsaved = vi.fn();
    render(NewHabit, { oncancel: () => {}, onsaved });
    await fireEvent.click(screen.getByRole('switch', { name: 'Count it as a habit' }));
    expect(screen.getByText(/Never counted in your day, runs or ranks/)).toBeTruthy();
    expect(screen.queryByText('Lasts')).toBeNull();
    expect(screen.queryByText('Make it stick')).toBeNull();
    await fireEvent.input(screen.getByLabelText('Reminder'), { target: { value: 'Drink water' } });
    await fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByText(/Every 2 hours from the start/)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Save reminder' }));
    await vi.waitFor(() => expect(onsaved).toHaveBeenCalled());
    const [r] = await listTimed();
    expect(r).toMatchObject({ title: 'Drink water', times: ['07:30', '09:30', '11:30', '13:30', '15:30', '17:30', '19:30'] });
    expect(await (await db()).getAll('events')).toHaveLength(0);
  });
});
