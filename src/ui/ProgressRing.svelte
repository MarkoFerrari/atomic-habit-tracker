<script lang="ts">
  // Progress ring (Figma 38:378): done ÷ due for the day, always shown with the number due (006).
  // Fills with motion; reduced motion: no animation (motion.css turns it into a fade).
  let { done, due }: { done: number; due: number } = $props();

  const SIZE = 72;
  const STROKE = 8; // stroke/ring
  const r = (SIZE - STROKE) / 2;
  const length = 2 * Math.PI * r;
  const fraction = $derived(due === 0 ? 0 : Math.min(1, done / due));
</script>

<svg class="ring" viewBox="0 0 {SIZE} {SIZE}" aria-hidden="true">
  <circle class="track" cx={SIZE / 2} cy={SIZE / 2} {r} />
  <circle class="fill" cx={SIZE / 2} cy={SIZE / 2} {r}
    stroke-dasharray={length} stroke-dashoffset={length * (1 - fraction)} transform="rotate(-90 {SIZE / 2} {SIZE / 2})" />
</svg>

<style>
  .ring { width: calc(var(--space-64) + var(--space-8)); height: calc(var(--space-64) + var(--space-8)); flex: none; }
  circle { fill: none; stroke-width: var(--stroke-ring); }
  .track { stroke: var(--border-divider); } /* decorative track (019) */
  .fill {
    stroke: var(--state-done); /* 008: done is green */
    transition: stroke-dashoffset var(--motion-duration-slow) var(--motion-easing-standard);
  }
</style>
