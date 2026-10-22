// @vitest-environment jsdom
// 134–136: the card opened from a reminder push, the suggestions picker and its prefilled form, the banner's x.
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Suggestions from './Suggestions.svelte';
import NewHabit from './NewHabit.svelte';
import ReminderCard from './ReminderCard.svelte';
import Banner from '../../ui/Banner.svelte';
import { draftFrom, SUGGESTED } from '../../data/suggestions';
import { createTimed } from '../../data/timed';
import { wipeDbForTests } from '../../data/db';

vi.mock('../../push/enable', () => ({ canAsk: () => false, enablePush: async () => 'granted' }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
});
beforeEach(async () => { await wipeDbForTests(); });
afterEach(async () => { await new Promise((r) => setTimeout(r, 50)); cleanup(); });

describe('136 suggested habits', () => {
  it('lists eight and ends with Create new habit', async () => {
    const onblank = vi.fn();
    render(Suggestions, { onback: () => {}, onpick: () => {}, onblank });
    expect(SUGGESTED).toHaveLength(8);
    expect(screen.getByText('Pick one to start from. You can change everything.')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Create new habit' }));
    expect(onblank).toHaveBeenCalled();
  });
  it('hands the tapped suggestion on', async () => {
    const onpick = vi.fn();
    render(Suggestions, { onback: () => {}, onpick, onblank: () => {} });
    await fireEvent.click(screen.getByRole('button', { name: /^Workout 30 min/ }));
    expect(onpick.mock.calls[0]![0].id).toBe('workout');
  });
  it('fills the form: Workout on Mon Wed Fri at 18:00, 30 min, its object kept', () => {
    const d = draftFrom(SUGGESTED.find((s) => s.id === 'workout')!);
    expect(d).toMatchObject({ title: 'Workout 30 min', icon: 'dumbbell', often: 'days', days: [0, 2, 4], start: '18:00', minutes: 30, count: true });
  });
  it('makes the water suggestion a reminder, not a habit', () => {
    const d = draftFrom(SUGGESTED.find((s) => s.id === 'water')!);
    expect(d).toMatchObject({ count: false, icon: 'glass-water', perDay: 6 });
    expect(d.remindTimes).toHaveLength(6);
  });
  it('opens the form with the habit filled in and editable, and keeps the object', async () => {
    render(NewHabit, { prefill: draftFrom(SUGGESTED[0]!), oncancel: () => {}, onsaved: () => {} });
    const field = screen.getByLabelText('Habit') as HTMLInputElement;
    expect(field.value).toBe('Read 20 min');
    await fireEvent.input(field, { target: { value: 'Read 30 min' } });
    expect(field.value).toBe('Read 30 min');
  });
});

describe('134 the card opened from a reminder push', () => {
  it('shows the reminder and a Close button', async () => {
    const r = await createTimed({ title: 'Drink water', icon: 'glass-water', times: ['00:00', '00:01', '23:59'] });
    const onclose = vi.fn();
    render(ReminderCard, { id: r.id, onclose });
    expect(await screen.findByText('Drink water')).toBeTruthy();
    expect(screen.getByText('Reminder · not counted')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onclose).toHaveBeenCalled();
  });
  it('goes straight to Today when the reminder is gone', async () => {
    const onclose = vi.fn();
    render(ReminderCard, { id: 'nope', onclose });
    await vi.waitFor(() => expect(onclose).toHaveBeenCalled());
  });
});

describe('135 the banner x', () => {
  it('closes only when given a handler', async () => {
    const { unmount } = render(Banner, { message: 'Last backup 9 days ago.' });
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    unmount();
    const onclose = vi.fn();
    render(Banner, { message: 'Last backup 9 days ago.', onclose });
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onclose).toHaveBeenCalled();
  });
});
