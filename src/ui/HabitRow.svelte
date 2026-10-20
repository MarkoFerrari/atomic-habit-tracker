<script lang="ts">
  // Habit row (Figma 34:213, style B 122): the habit's own field with its 3D object. Tap = habit sheet; swipe right =
  // Done; swipe left = Skip (reason sheet). Only the habit due now shows "Mark as done" (040); every row stays
  // tappable and swipeable. Done is the green check (008); a skip or a miss is the orange minus, whatever the reason (126).
  import HabitObject from './HabitObject.svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  import { fieldColor } from './objects';
  import type { HabitState } from '../domain/states';

  interface Props {
    name: string;
    meta: string; // "08:00 · 30 min"
    status: HabitState;
    icon: IconName;
    trailing?: string; // answer time, or "2-min"; reasons are not shown on the row (126)
    showMarkDone?: boolean;
    /** A text action in place of "Mark as done", e.g. "Change icon" on the Habits found list (H09). */
    actionLabel?: string;
    onaction?: () => void;
    /** Swipe to answer (040). Off where a row isn't an answerable occurrence. */
    swipeable?: boolean;
    justDone?: boolean;
    onopen?: () => void;
    ondone?: () => void;
    onskip?: () => void;
    /** T1: the habit due now as the big tile (only with showMarkDone). */
    featured?: boolean;
    eyebrow?: string; // "NEXT · 17:30"
  }
  let { name, meta, status, icon, trailing, showMarkDone = false, actionLabel, onaction, swipeable = true, justDone = false, onopen, ondone, onskip, featured = false, eyebrow }: Props = $props();

  const crossed = $derived(status === 'skipped' || status === 'missed');
  const stateLabel = $derived({ open: 'upcoming', running: 'running now', done: 'done', skipped: 'skipped', missed: 'missed' }[status]);

  // Swipe: the row follows the finger; release past a quarter of its width answers, otherwise it settles back.
  let el = $state<HTMLElement>() as HTMLElement;
  let dx = $state(0);
  let dragging = $state(false);
  let start: { x: number; y: number; id: number } | null = null;
  let horizontal: boolean | null = null;

  function down(e: PointerEvent) { if (!swipeable) return; start = { x: e.clientX, y: e.clientY, id: e.pointerId }; horizontal = null; }
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

{#if featured && showMarkDone}
<!-- T1: the habit due now leads Today as the big tile, with the one action at full width (040) -->
<div class="row featured {status}" role="group" aria-label={name} class:dragging style:--field={fieldColor(icon)} style:transform={dx ? `translateX(${dx}px)` : undefined}
  bind:this={el} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
  <button class="main" onclick={click} aria-label="{name}, {meta}, {stateLabel}">
    <span class="text">
      {#if eyebrow}<span class="eyebrow t-label-section">{eyebrow}</span>{/if}
      <span class="name big t-heading-small">{name}</span>
      <span class="meta t-label-small">{meta}</span>
    </span>
    <HabitObject {icon} size="xl" />
  </button>
  <button class="wide t-body-strong" onclick={() => ondone?.()}>Mark as done</button>
</div>
{:else}
<div class="row {status}" role="group" aria-label={name} class:dragging style:--field={fieldColor(icon)} style:transform={dx ? `translateX(${dx}px)` : undefined}
  bind:this={el} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
  <button class="main" onclick={click} aria-label="{name}, {meta}, {stateLabel}">
    <HabitObject {icon} size="md" />
    <span class="text">
      <span class="name t-body-strong" class:muted={crossed}>{name}</span>
      <span class="meta t-label-small">{meta}</span>
    </span>
  </button>
  {#if status === 'done'}
    {#if trailing}<span class="trailing t-number-small">{trailing}</span>{/if}
    <span class="mark-state done" class:animate={justDone}><Icon name="check" size="small" /></span>
  {:else if crossed}
    <span class="mark-state crossed" aria-hidden="true"><span class="minus"></span></span>
  {:else if actionLabel}
    <button class="pill t-body-small" onclick={() => onaction?.()}>{actionLabel}</button>
  {:else if showMarkDone}
    <button class="pill t-body-small" onclick={() => ondone?.()}>Mark as done</button>
  {/if}
</div>
{/if}

<style>
  .row {
    display: flex; align-items: center; gap: var(--space-12);
    padding: var(--space-12) var(--space-16) var(--space-12) var(--space-12);
    background: var(--field); border-radius: var(--radius-card);
    touch-action: pan-y; user-select: none; -webkit-user-select: none;
    transition: transform var(--motion-duration-base) var(--motion-easing-standard);
  }
  .row.dragging { transition: none; }
  .main { flex: 1; min-width: 0; display: flex; align-items: center; gap: var(--space-12); text-align: left; }
  .text { flex: 1; min-width: 0; display: grid; gap: var(--space-4); grid-template-columns: minmax(0, 1fr); }
  .name { color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } /* E21 */
  .name.muted { color: var(--text-secondary); }
  .meta { color: var(--text-secondary); overflow-wrap: anywhere; } /* wraps, so the next rank (098) is never cut and Mark as done stays on screen (U12) */
  .trailing { flex-shrink: 0; color: var(--text-secondary); white-space: nowrap; }
  .mark-state {
    flex: none; display: grid; place-items: center; width: var(--space-32); height: var(--space-32);
    border-radius: var(--radius-round); color: var(--icon-inverse);
  }
  .mark-state.done { background: var(--state-done); }
  .mark-state.crossed { background: var(--state-missed); }
  .minus { width: var(--space-12); height: calc(var(--stroke-hairline) * 2); border-radius: var(--radius-round); background: var(--icon-inverse); }
  .pill {
    flex-shrink: 0; min-height: var(--space-32); padding: 0 var(--space-16); white-space: nowrap;
    border-radius: var(--radius-round); background: var(--action-primary); color: var(--action-on-primary);
    margin-block: calc((var(--space-32) - var(--size-touch)) / 2); /* 041: the visual is 32, the hit area stays 44 */
    box-sizing: content-box; border: calc((var(--size-touch) - var(--space-32)) / 2) solid transparent; background-clip: padding-box;
  }
  .featured { flex-direction: column; align-items: stretch; gap: var(--space-12); padding: var(--space-16); }
  .featured .main { gap: var(--space-16); }
  .eyebrow, .featured .meta { color: var(--text-secondary); }
  .big { white-space: normal; }
  .wide {
    min-height: var(--size-control); border-radius: var(--radius-round);
    background: var(--action-primary); color: var(--action-on-primary);
  }
  .wide:active { background: var(--action-primary-pressed); }
  .animate { animation: pop var(--motion-duration-base) var(--motion-easing-spring); }
  @keyframes pop { from { transform: scale(0.88); } to { transform: scale(1); } }
</style>
