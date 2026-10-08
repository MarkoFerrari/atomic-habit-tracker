<script lang="ts">
  // Chart/Heat cell (Figma 38:441): five steps from white to done green, every cell outlined and labelled (038).
  // Days ahead are dotted, never drawn as zero (033). Today has the strong outline.
  interface Props {
    day: number;
    level?: 0 | 1 | 2 | 3 | 4 | null;
    kind?: 'rate' | 'today' | 'ahead' | 'empty';
    label: string;
    size?: 'large' | 'small';
    onclick?: () => void;
  }
  let { day, level = null, kind = 'rate', label, size = 'large', onclick }: Props = $props();
</script>

{#if size === 'small'}
  <span class="cell small l{level ?? 0}" role="img" aria-label={label}></span>
{:else}
  <!-- Today keeps the strong outline only while it has no colour yet: green already says "today has answers". -->
  <button class="cell {kind === 'today' && (level ?? 0) > 0 ? 'rate' : kind} l{level ?? 'none'}" aria-label={label} {onclick}>
    <span class="t-number-small">{day}</span>
  </button>
{/if}

<style>
  .cell {
    display: block; width: 100%; aspect-ratio: 1; min-height: var(--size-touch); border-radius: var(--radius-control);
    box-shadow: inset 0 0 0 var(--stroke-hairline) var(--border-control); text-align: left; padding: var(--space-4);
    color: var(--text-primary); background: var(--heat-0);
  }
  .cell.small { width: var(--space-16); height: var(--space-16); min-height: 0; padding: 0; border-radius: var(--radius-chip); flex: none; }
  .l1 { background: var(--heat-1); }
  .l2 { background: var(--heat-2); }
  .l3 { background: var(--heat-3); }
  .l4 { background: var(--heat-4); color: var(--text-inverse); }
  .ahead, .empty { box-shadow: none; border: var(--stroke-hairline) dashed var(--icon-muted); color: var(--text-tertiary); background: none; }
  .empty { border-style: solid; border-color: var(--border-divider); }
  .today { box-shadow: inset 0 0 0 var(--stroke-illustration) var(--border-strong); }
</style>
