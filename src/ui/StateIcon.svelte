<script lang="ts">
  // State icon (Figma 31:117): the habit's own icon inside its state. The mastery ring around it is gone (101): the
  // star medal counts ranks now, and two systems for one idea would confuse; the row says the next rank in words.
  import Icon from './Icon.svelte';
  import { STATE_ICON } from './geometry';
  import type { IconName } from './icons';
  import type { HabitState } from '../domain/states';

  let { status, icon, animate = false }: { status: HabitState; icon: IconName; animate?: boolean } = $props();
  const { base, slash } = STATE_ICON;
  const crossed = $derived(status === 'skipped' || status === 'missed');
</script>

<span class="state-icon {status}" class:animate>
  <svg class="base" viewBox="0 0 44 44" aria-hidden="true">
    <circle cx={base.cx} cy={base.cy} r={base.r} stroke-dasharray={status === 'missed' ? STATE_ICON.missedDash : undefined} />
    {#if crossed}<line x1={slash.x1} y1={slash.y1} x2={slash.x2} y2={slash.y2} />{/if}
  </svg>
  <span class="glyph"><Icon name={icon} /></span>
</span>

<style>
  .state-icon { position: relative; display: block; width: var(--size-touch); height: var(--size-touch); flex: none; }
  .base { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  circle { fill: none; stroke: var(--border-control); stroke-width: var(--stroke-icon); }
  line { stroke: var(--icon-muted); stroke-width: var(--stroke-icon); stroke-linecap: round; }
  .glyph { position: absolute; inset: 0; display: grid; place-items: center; color: var(--icon-muted); }

  .running circle { stroke: var(--border-strong); }
  .running .glyph { color: var(--icon-default); }
  .done circle { fill: var(--state-done); stroke: none; }
  .done .glyph { color: var(--icon-inverse); }

  /* The check-off moment (053), only when it just happened: the filled base springs in. Reduced motion turns it into a fade (motion.css). */
  .animate.done circle { transform-origin: 50% 50%; animation: pop var(--motion-duration-base) var(--motion-easing-spring); }
  /* Motion page 11, 01 Check-off: scale 0.88 → 1.06 → 1; the spring curve supplies the overshoot. */
  @keyframes pop { from { transform: scale(0.88); } to { transform: scale(1); } }
</style>
