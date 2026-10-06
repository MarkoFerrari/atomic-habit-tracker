<script lang="ts">
  // Mastery ring (Figma 31:41): rank reached, 0–5. Segments fill in order; the fifth is crimson (state/perfect).
  import { RING, annulusPath } from './geometry';
  let { level = 0 }: { level?: number } = $props();
  const paths = RING.segments.map(([a0, a1]) => annulusPath(RING.size, RING.innerRatio, a0, a1));
</script>

<svg class="ring" viewBox="0 0 {RING.size} {RING.size}" aria-hidden="true">
  {#each paths as d, i (i)}
    <path {d} class:filled={i < level} class:perfect={i === 4} />
  {/each}
</svg>

<style>
  .ring { position: absolute; inset: 0; width: 100%; height: 100%; }
  path { fill: var(--border-divider); transition: fill var(--motion-duration-slow) var(--motion-easing-standard); }
  .filled { fill: var(--state-done); }
  .filled.perfect { fill: var(--state-perfect); }
</style>
