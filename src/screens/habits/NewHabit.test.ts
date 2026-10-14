// @vitest-environment jsdom
// 116: New habit explains Nudge and Make it stick behind an (i) (U16). The rows themselves still open as before.
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import NewHabit from './NewHabit.svelte';
import { wipeDbForTests } from '../../data/db';

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
