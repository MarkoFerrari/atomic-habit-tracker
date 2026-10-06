<script lang="ts">
  // Chip (Figma 33:160). Filter: calendar legend + filter, the dot takes the calendar token.
  // Reason: skip reasons, one tap selects. A 36 px chip inside a 44 px hit area (041).
  import type { CalendarToken } from '../data/schema';
  interface Props { kind?: 'filter' | 'reason'; label: string; selected?: boolean; calendar?: CalendarToken; onclick?: () => void }
  let { kind = 'reason', label, selected = false, calendar = 'habits', onclick }: Props = $props();
</script>

<button class="hit" aria-pressed={selected} {onclick}>
  <span class="chip {kind}" class:selected style:--dot="var(--calendar-{calendar})">
    {#if kind === 'filter'}<span class="dot" aria-hidden="true"></span>{/if}
    <span class="t-body-small">{label}</span>
  </span>
</button>

<style>
  .hit { display: flex; align-items: center; min-height: var(--size-touch); }
  .chip {
    display: flex; align-items: center; gap: var(--space-8);
    height: calc(var(--space-32) + var(--space-4)); padding: 0 var(--space-12);
    border-radius: var(--radius-chip); background: var(--bg-subtle); color: var(--text-primary); white-space: nowrap;
    transition: background-color var(--motion-duration-fast) var(--motion-easing-standard);
  }
  .reason.selected { background: var(--action-primary); color: var(--action-on-primary); }
  .filter:not(.selected) { background: none; color: var(--text-tertiary); box-shadow: inset 0 0 0 var(--stroke-hairline) var(--border-control); }
  .dot { width: var(--space-8); height: var(--space-8); border-radius: var(--radius-round); background: var(--dot); }
  .filter:not(.selected) .dot { background: none; box-shadow: inset 0 0 0 var(--stroke-icon) var(--dot); }
</style>
