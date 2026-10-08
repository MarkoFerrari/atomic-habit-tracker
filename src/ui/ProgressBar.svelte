<script lang="ts">
  // Progress bar (Figma page 14, 098): toward the next rank, or a habit's done share. Always green: progress is
  // good news (008). The track is decorative (019); the count beside it carries the meaning.
  // 107: `ticks` marks the milestones on the way (Playground Q3): green once passed, ink while ahead.
  interface Props { value: number; of: number; label: string; count?: boolean; ticks?: readonly number[] }
  let { value, of, label, count = true, ticks = [] }: Props = $props();
  const pct = $derived(of > 0 ? Math.min(100, Math.round((Math.min(value, of) / of) * 100)) : 0);
  const at = (t: number) => (of > 0 ? Math.min(100, (t / of) * 100) : 0);
</script>

<span class="row">
  <span class="bar">
    <span class="track" role="progressbar" aria-valuemin="0" aria-valuemax={of} aria-valuenow={Math.min(value, of)} aria-label={label}>
      <span class="fill" style:width="{pct}%"></span>
    </span>
    {#each ticks as t (t)}<span class="tick" class:passed={t <= value} style:left="{at(t)}%" aria-hidden="true"></span>{/each}
  </span>
  {#if count}<span class="t-number-small n">{value}/{of}</span>{/if}
</span>

<style>
  .row { display: flex; align-items: center; gap: var(--space-8); width: 100%; }
  .bar { position: relative; flex: 1; display: flex; align-items: center; height: var(--space-12); }
  .track { flex: 1; height: var(--space-4); background: var(--border-divider); border-radius: var(--radius-round); overflow: hidden; }
  .fill { display: block; height: 100%; min-width: var(--space-4); background: var(--state-done); border-radius: var(--radius-round);
    transition: width var(--motion-duration-slow) var(--motion-easing-standard); }
  .tick { position: absolute; top: 0; width: var(--stroke-illustration); height: var(--space-12); translate: -50% 0;
    border-radius: var(--radius-round); background: var(--border-strong); }
  .tick.passed { background: var(--state-done); }
  .n { color: var(--text-tertiary); }
</style>
