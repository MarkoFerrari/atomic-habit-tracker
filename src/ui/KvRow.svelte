<script lang="ts">
  type Tone = 'default' | 'done' | 'warn' | 'muted';
  let { label, value, tone = 'default' }: { label: string; value: string; tone?: Tone } = $props();
</script>

<div class="row">
  <span class="label t-body-default">{label}</span>
  <span class="value t-body-strong {tone}">{value}</span>
</div>

<style>
  .row {
    display: flex; justify-content: space-between; align-items: center; gap: var(--space-16);
    min-height: var(--size-touch); padding: var(--space-8) 0;
    border-bottom: var(--stroke-hairline) solid var(--border-divider);
  }
  .label { color: var(--text-secondary); }
  .value { text-align: right; overflow-wrap: anywhere; }
  .done { color: var(--text-done); }
  .warn { color: var(--text-accent); }
  .muted { color: var(--text-tertiary); }
</style>
