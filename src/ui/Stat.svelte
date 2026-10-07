<script lang="ts">
  // Chart/Stat (Figma 38:464): the big number with the number due beside it (006), never alone.
  let { value, caption }: { value: string; caption: string } = $props();
</script>

<div class="stat">
  <span class="t-number-display">{value}</span>
  <span class="t-body-small caption">{caption}</span>
</div>

<style>
  .stat { display: flex; align-items: baseline; gap: var(--space-12); flex-wrap: wrap; }
  .caption { color: var(--text-tertiary); }
</style>
