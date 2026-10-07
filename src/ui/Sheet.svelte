<script lang="ts">
  // Bottom sheet + sheet header (Figma 38:471, 37:414). Habit sheet, skip reasons, repeating-event choice,
  // delete confirmations, ranks reached, backup nudge.
  // Motion (page 11, 03 Sheets): scrim 0 → 40% in 250 ms, sheet rises in 400 ms (enter), closes in 150 ms (exit).
  // A swipe down follows the finger; past 30% of the height or faster than 500 px/s closes, otherwise it settles back.
  import type { Snippet } from 'svelte';
  import IconButton from './IconButton.svelte';

  interface Props { open: boolean; title: string; showClose?: boolean; onclose: () => void; children: Snippet }
  let { open, title, showClose = false, onclose, children }: Props = $props();

  const CLOSE_RATIO = 0.3;
  const CLOSE_VELOCITY = 0.5; // px per ms (500 px/s)

  let dialog: HTMLDialogElement;
  let panel: HTMLElement;
  let dy = $state(0);
  let dragging = $state(false);
  let closing = $state(false);
  let drag: { y: number; t: number; id: number } | null = null;

  $effect(() => {
    if (open && !dialog.open) { closing = false; dialog.showModal(); }
    if (!open && dialog.open) close();
  });

  function close() {
    closing = true;
    const done = () => { dialog?.close(); closing = false; dy = 0; }; // the sheet may be gone by then
    const ms = parseFloat(getComputedStyle(dialog).getPropertyValue('--motion-duration-fast')) || 0;
    setTimeout(done, ms);
  }
  function requestClose() { onclose(); }

  function down(e: PointerEvent) {
    // A press on Close is a tap, not a drag: capturing it would steal its click.
    if ((e.target as Element).closest('button')) return;
    drag = { y: e.clientY, t: e.timeStamp, id: e.pointerId }; dragging = true; panel.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) { if (drag && e.pointerId === drag.id) dy = Math.max(0, e.clientY - drag.y); }
  function up(e: PointerEvent) {
    if (!drag) return;
    const velocity = dy / Math.max(1, e.timeStamp - drag.t);
    dragging = false; drag = null;
    if (dy > panel.offsetHeight * CLOSE_RATIO || velocity > CLOSE_VELOCITY) requestClose();
    else dy = 0;
  }
</script>

<dialog bind:this={dialog} class:closing aria-labelledby="sheet-title" oncancel={(e) => { e.preventDefault(); requestClose(); }}
  onclick={(e) => { if (e.target === dialog) requestClose(); }}>
  <section class="panel" class:dragging bind:this={panel} style:transform={dy ? `translateY(${dy}px)` : undefined}>
    <!-- svelte-ignore a11y_no_static_element_interactions (dragging is a shortcut; Close, Esc and the scrim also close) -->
    <header onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
      <div class="grabber" aria-hidden="true"></div>
      <div class="title-row">
        <h2 id="sheet-title" class="t-heading-small">{title}</h2>
        {#if showClose}<IconButton icon="close" label="Close" variant="plain" onclick={requestClose} />{/if}
      </div>
    </header>
    <div class="content">{@render children()}</div>
  </section>
</dialog>

<style>
  dialog {
    position: fixed; inset: 0; margin: 0; padding: 0; border: 0;
    width: 100%; max-width: 100%; height: 100%; max-height: 100%;
    background: transparent; display: flex; align-items: flex-end;
  }
  dialog:not([open]) { display: none; }
  dialog::backdrop { background: var(--bg-scrim); animation: fade-in var(--motion-duration-base) var(--motion-easing-standard); }
  .panel {
    width: 100%; background: var(--bg-default);
    border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
    padding-bottom: max(env(safe-area-inset-bottom), var(--space-32));
    animation: rise var(--motion-duration-slow) var(--motion-easing-enter);
    transition: transform var(--motion-duration-base) var(--motion-easing-standard);
  }
  .panel.dragging { transition: none; }
  .closing .panel { animation: sink var(--motion-duration-fast) var(--motion-easing-exit) forwards; }
  .closing::backdrop { animation: fade-out var(--motion-duration-fast) var(--motion-easing-exit) forwards; }

  header { display: grid; gap: var(--space-12); padding: var(--space-8) var(--layout-gutter); touch-action: none; }
  .grabber { justify-self: center; width: calc(var(--space-32) + var(--space-4)); height: var(--space-4); border-radius: var(--radius-round); background: var(--border-control); }
  .title-row { display: flex; align-items: center; min-height: var(--size-touch); }
  h2 { flex: 1; min-width: 0; color: var(--text-primary); }
  .content { padding: var(--space-8) var(--layout-gutter) 0; }

  @keyframes rise { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes sink { from { transform: translateY(0); } to { transform: translateY(100%); } }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
</style>
