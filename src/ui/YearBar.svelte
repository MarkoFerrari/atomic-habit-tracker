<script lang="ts">
  // Chart/Year bar (Figma 38:462): bars start at zero and the due count sits under every bar (033).
  // BEST and LOW are in words, not only in colour. A month ahead is outlined, not drawn as zero.
  interface Props { letter: string; rate: number | null; due: number; ahead?: boolean; mark?: 'BEST' | 'LOW' | null; label: string; onclick?: () => void }
  let { letter, rate, due, ahead = false, mark = null, label, onclick }: Props = $props();
</script>

<button class="col" aria-label={label} {onclick}>
  <span class="plot">
    {#if mark}<span class="t-label-small mark" style:bottom="calc({Math.round((rate ?? 0) * 100)}% + var(--space-4))">{mark}</span>{/if}
    {#if ahead}
      <span class="bar ahead" style:height="100%"></span>
    {:else if rate !== null}
      <span class="bar" style:height="{Math.max(1, Math.round(rate * 100))}%"></span>
    {/if}
  </span>
  <span class="t-label-small letter">{letter}</span>
  <span class="t-number-small due">{ahead || !due ? '' : due}</span>
</button>

<style>
  .col { flex: 1; min-width: var(--size-touch); max-width: var(--size-touch); display: grid; justify-items: center; gap: var(--space-8); }
  .plot { position: relative; width: 100%; height: calc(var(--size-control) * 4); display: flex; align-items: flex-end; justify-content: center; }
  .bar { width: calc(var(--space-24) + var(--space-4)); background: var(--state-done); border-radius: var(--radius-chip) var(--radius-chip) 0 0; }
  .bar.ahead { background: none; border: var(--stroke-hairline) dashed var(--icon-muted); }
  .mark { position: absolute; left: 0; right: 0; text-align: center; color: var(--text-primary); }
  .letter { color: var(--text-secondary); }
  .due { color: var(--text-tertiary); min-height: var(--space-16); }
</style>
