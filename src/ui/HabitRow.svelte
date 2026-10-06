<script lang="ts">
  // Habit row (Figma 34:213). Tap = habit sheet; swipe right = Done; swipe left = Skip (reason sheet).
  // Only the habit due now shows "Mark as done" (040); every row stays tappable and swipeable.
  import StateIcon from './StateIcon.svelte';
  import type { IconName } from './icons';
  import type { HabitState } from '../domain/states';

  interface Props {
    name: string;
    meta: string; // "08:00 · 30 min"
    status: HabitState;
    icon: IconName;
    level?: number; // mastery ring 0–5
    trailing?: string; // answer time, reason or "Missed"; overrides the default
    showMarkDone?: boolean;
    justDone?: boolean;
    onopen?: () => void;
    ondone?: () => void;
    onskip?: () => void;
  }
  let { name, meta, status, icon, level = 0, trailing, showMarkDone = false, justDone = false, onopen, ondone, onskip }: Props = $props();

  const answered = $derived(status === 'done' || status === 'skipped' || status === 'missed');
  const stateLabel = $derived({ open: 'upcoming', running: 'running now', done: 'done', skipped: 'skipped', missed: 'missed' }[status]);

  // Swipe: the row follows the finger; release past a quarter of its width answers, otherwise it settles back.
  let el: HTMLElement;
  let dx = $state(0);
  let dragging = $state(false);
  let start: { x: number; y: number; id: number } | null = null;
  let horizontal: boolean | null = null;

  function down(e: PointerEvent) { start = { x: e.clientX, y: e.clientY, id: e.pointerId }; horizontal = null; }
  function move(e: PointerEvent) {
    if (!start || e.pointerId !== start.id) return;
    const x = e.clientX - start.x;
    const y = e.clientY - start.y;
    if (horizontal === null && Math.hypot(x, y) > 8) {
      horizontal = Math.abs(x) > Math.abs(y);
      if (horizontal) { dragging = true; el.setPointerCapture(e.pointerId); }
    }
    if (horizontal) dx = x;
  }
  function up() {
    if (dragging) {
      const limit = el.clientWidth / 4;
      if (dx > limit) ondone?.();
      else if (dx < -limit) onskip?.();
    }
    dragging = false; dx = 0; start = null;
  }
  function click(e: MouseEvent) {
    if (horizontal) { e.preventDefault(); return; } // a swipe is not a tap
    onopen?.();
  }
</script>

<div class="row" role="group" aria-label={name} class:dragging style:transform={dx ? `translateX(${dx}px)` : undefined}
  bind:this={el} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
  <button class="main" onclick={click} aria-label="{name}, {meta}, {stateLabel}">
    <StateIcon {status} {icon} {level} animate={justDone} />
    <span class="text">
      <span class="name t-body-strong" class:muted={status === 'skipped' || status === 'missed'}>{name}</span>
      <span class="meta t-label-small">{meta}</span>
    </span>
  </button>
  {#if trailing ?? answered}
    <span class="trailing {status === 'done' ? 't-number-small' : 't-label-small'}">{trailing ?? (status === 'missed' ? 'Missed' : '')}</span>
  {:else if showMarkDone}
    <button class="mark t-body-small" onclick={() => ondone?.()}>Mark as done</button>
  {/if}
</div>

<style>
  .row {
    display: flex; align-items: center; gap: var(--space-12);
    padding: var(--space-12) 0; touch-action: pan-y; user-select: none; -webkit-user-select: none;
    transition: transform var(--motion-duration-base) var(--motion-easing-standard);
  }
  .row.dragging { transition: none; }
  .main { flex: 1; min-width: 0; display: flex; align-items: center; gap: var(--space-12); text-align: left; }
  .text { flex: 1; min-width: 0; display: grid; }
  .name { color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } /* E21 */
  .name.muted { color: var(--text-secondary); }
  .meta { color: var(--text-tertiary); white-space: nowrap; }
  .trailing { color: var(--text-tertiary); white-space: nowrap; }
  .mark { min-height: var(--size-touch); padding: 0 var(--space-8); color: var(--text-accent); white-space: nowrap; }
</style>
