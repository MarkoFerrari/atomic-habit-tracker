<script lang="ts">
  // Chart/Week cell (Figma 38:410): shape carries the state, colour confirms it (038). 24 px glyph in a 32 px cell.
  import type { CellState } from '../domain/stats';
  let { state, label }: { state: CellState; label?: string } = $props();
  const NAME: Record<CellState, string> = { done: 'Done', skipped: 'Skipped', missed: 'Missed', open: 'Open', ahead: 'Not yet', before: 'Before tracking' };
</script>

<svg class="cell {state}" viewBox="0 0 24 24" role="img" aria-label={label ?? NAME[state]}>
  <circle cx="12" cy="12" r="9" />
  {#if state === 'skipped' || state === 'missed'}<line x1="5.6" y1="18.4" x2="18.4" y2="5.6" />{/if}
</svg>

<style>
  .cell { width: var(--size-icon); height: var(--size-icon); flex: none; display: block; }
  circle { fill: none; stroke: var(--border-control); stroke-width: var(--stroke-icon); }
  line { stroke: var(--icon-muted); stroke-width: var(--stroke-icon); stroke-linecap: round; }
  .done circle { fill: var(--state-done); stroke: none; }
  .missed circle { stroke-dasharray: 3 3; }
  .ahead circle, .before circle { stroke: var(--icon-muted); stroke-dasharray: 1 3; stroke-linecap: round; }
  .open circle { stroke: var(--border-strong); }
</style>
