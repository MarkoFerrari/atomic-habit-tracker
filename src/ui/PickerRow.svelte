<script lang="ts">
  // A list row (Figma 36:309, Navigation) that opens the iPhone's own date and time wheel.
  // The native input covers the row invisibly, so a tap anywhere on it opens the picker; the row
  // shows the value in words ("Tue 6 Oct, 10:00", "45 min later").
  import Icon from './Icon.svelte';
  interface Props {
    label: string;
    value: string; // shown text
    type: 'datetime-local' | 'date' | 'time';
    input: string; // the input's value
    min?: string;
    onchange: (value: string) => void;
  }
  let { label, value, type, input, min, onchange }: Props = $props();
  const id = `picker-${Math.random().toString(36).slice(2, 8)}`;
</script>

<div class="row">
  <label class="t-body-default" for={id}>{label}</label>
  <span class="value t-body-small">{value}</span>
  <span class="chevron"><Icon name="chevron-right" /></span>
  <input {id} {type} value={input} {min} aria-label={label} onchange={(e) => onchange((e.currentTarget as HTMLInputElement).value)} />
</div>

<style>
  .row {
    position: relative; display: flex; align-items: center; gap: var(--space-12);
    min-height: var(--size-control); padding: var(--space-12) 0;
  }
  label { flex: 1; min-width: 0; color: var(--text-primary); }
  .value { color: var(--text-tertiary); white-space: nowrap; }
  .chevron { color: var(--icon-muted); display: flex; }
  input {
    position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0;
    font: var(--type-body-default); /* 16 px keeps iOS from zooming in */
    -webkit-appearance: none; appearance: none; border: 0; background: none;
  }
  .row:has(input:focus-visible) { outline: var(--stroke-illustration) solid var(--border-strong); outline-offset: var(--space-4); border-radius: var(--radius-control); }
</style>
