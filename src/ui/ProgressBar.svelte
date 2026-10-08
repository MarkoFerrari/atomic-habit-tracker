<script lang="ts">
  // Progress bar (Figma page 14, 098): toward the next rank, or a habit's done share. Always green: progress is
  // good news (008). The track is decorative (019); the count beside it carries the meaning.
  interface Props { value: number; of: number; label: string; count?: boolean }
  let { value, of, label, count = true }: Props = $props();
  const pct = $derived(of > 0 ? Math.min(100, Math.round((Math.min(value, of) / of) * 100)) : 0);
</script>

<span class="row">
  <span class="track" role="progressbar" aria-valuemin="0" aria-valuemax={of} aria-valuenow={Math.min(value, of)} aria-label={label}>
    <span class="fill" style:width="{pct}%"></span>
  </span>
  {#if count}<span class="t-number-small n">{value}/{of}</span>{/if}
</span>

<style>
  .row { display: flex; align-items: center; gap: var(--space-8); width: 100%; }
  .track { flex: 1; height: var(--space-4); background: var(--border-divider); border-radius: var(--radius-round); overflow: hidden; }
  .fill { display: block; height: 100%; min-width: var(--space-4); background: var(--state-done); border-radius: var(--radius-round);
    transition: width var(--motion-duration-slow) var(--motion-easing-standard); }
  .n { color: var(--text-tertiary); }
</style>
