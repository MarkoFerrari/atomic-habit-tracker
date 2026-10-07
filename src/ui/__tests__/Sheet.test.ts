// @vitest-environment jsdom
import { render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import SheetHost from './SheetHost.svelte';

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no modal dialog: a minimal stand-in.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Sheet', () => {
  it('slides in: starts unshown, then gets the shown class on the next frame', async () => {
    const { component, container } = render(SheetHost);
    const dialog = container.querySelector('dialog')!;
    component.openIt(); flushSync();
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.classList.contains('shown')).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(dialog.classList.contains('shown')).toBe(true);
  });

  it('keeps its title and a frozen copy of the content while it slides away, then clears', async () => {
    const { component, container } = render(SheetHost);
    const dialog = container.querySelector('dialog')!;
    component.openIt(); flushSync(); await vi.advanceTimersByTimeAsync(1);
    component.closeIt(); flushSync();
    expect(dialog.classList.contains('shown')).toBe(false);
    expect(container.querySelector('h2')!.textContent).toBe('Read a book');
    expect(container.querySelector('.ghost')!.textContent).toContain('Body of Read a book');
    await vi.advanceTimersByTimeAsync(1000);
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(container.querySelector('.ghost')!.childNodes.length).toBe(0);
  });

  it('the header follows a downward drag and closes past 30% of the height', async () => {
    const { component, container } = render(SheetHost);
    component.openIt(); flushSync(); await vi.advanceTimersByTimeAsync(1);
    const header = container.querySelector('header')!;
    const panel = container.querySelector('.panel') as HTMLElement;
    Object.defineProperty(panel, 'offsetHeight', { value: 300 });
    header.setPointerCapture = vi.fn();
    const ev = (type: string, y: number, t: number) => { const e = new Event(type, { bubbles: true }) as any; e.clientY = y; e.pointerId = 1; Object.defineProperty(e, 'timeStamp', { value: t }); return e; };
    header.dispatchEvent(ev('pointerdown', 100, 0));
    expect(header.setPointerCapture).toHaveBeenCalled();
    header.dispatchEvent(ev('pointermove', 140, 400)); flushSync();
    expect(panel.style.transform).toBe('translateY(40px)');
    header.dispatchEvent(ev('pointermove', 60, 800)); flushSync();           // upward: stretches with resistance
    expect(panel.style.transform).toBe('translateY(-10px)');
    header.dispatchEvent(ev('pointermove', 260, 1600)); flushSync();
    header.dispatchEvent(ev('pointerup', 260, 1600)); flushSync();
    expect(container.querySelector('dialog')!.classList.contains('shown')).toBe(false); // 160 px > 30% of 300
  });
});
