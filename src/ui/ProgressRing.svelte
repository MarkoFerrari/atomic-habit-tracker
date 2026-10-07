<script lang="ts">
  // Progress ring (Figma 38:378): done ÷ due for the day, always shown with the number due (006).
  // Small (72) on Today; Large (160, label inside) on the day result. Perfect: the ring closes in the
  // accent (H21). Fills with motion; reduced motion: motion.css turns it into a fade.
  import type { Snippet } from 'svelte';
  interface Props { done: number; due: number; size?: 'small' | 'large'; perfect?: boolean; children?: Snippet }
  let { done, due, size = 'small', perfect = false, children }: Props = $props();

  const BOX = 72; // drawn on the small ring's grid; the large ring scales it
  const STROKE = 8; // stroke/ring
  const r = (BOX - STROKE) / 2;
  const length = 2 * Math.PI * r;
  const fraction = $derived(due === 0 ? 0 : Math.min(1, done / due));
</script>

<div class="wrap {size}">
  <svg viewBox="0 0 {BOX} {BOX}" aria-hidden="true">
    <circle class="track" cx={BOX / 2} cy={BOX / 2} {r} />
    <circle class="fill" class:perfect cx={BOX / 2} cy={BOX / 2} {r}
      stroke-dasharray={length} stroke-dashoffset={length * (1 - fraction)} transform="rotate(-90 {BOX / 2} {BOX / 2})" />
  </svg>
  {#if children}<div class="label">{@render children()}</div>{/if}
</div>

<style>
  .wrap { position: relative; flex: none; display: grid; place-items: center; }
  .small { width: calc(var(--space-64) + var(--space-8)); height: calc(var(--space-64) + var(--space-8)); }
  .large { width: calc(var(--space-64) * 2 + var(--space-32)); height: calc(var(--space-64) * 2 + var(--space-32)); }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  circle { fill: none; stroke-width: var(--stroke-ring); }
  .track { stroke: var(--border-divider); } /* decorative track (019) */
  .fill {
    stroke: var(--state-done); /* 008: done is green */
    transition: stroke-dashoffset var(--motion-duration-slow) var(--motion-easing-standard), stroke var(--motion-duration-slow) var(--motion-easing-standard);
  }
  .fill.perfect { stroke: var(--state-perfect); } /* the perfect day closes in the accent (H21) */
  .label { position: relative; display: grid; justify-items: center; text-align: center; }
</style>
