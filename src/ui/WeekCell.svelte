<script lang="ts">
  // Chart/Week cell (Figma 38:410, style B): shape carries the state, colour confirms it (038). Done is the green check
  // (008); a skip or a miss is the orange minus, whatever the reason (126); today an ink ring; ahead dashed.
  import type { CellState } from '../domain/stats';
  let { state, label }: { state: CellState; label?: string } = $props();
  const NAME: Record<CellState, string> = { done: 'Done', skipped: 'Skipped', missed: 'Missed', open: 'Open', ahead: 'Not yet', before: 'Before tracking' };
</script>

<svg class="cell {state}" viewBox="0 0 24 24" role="img" aria-label={label ?? NAME[state]}>
  <circle cx="12" cy="12" r="11" />
  {#if state === 'done'}<path d="M7.5 12.5l3 3 6-6.5" />{/if}
  {#if state === 'skipped' || state === 'missed'}<line x1="8" y1="12" x2="16" y2="12" />{/if}
</svg>

<style>
  .cell { width: var(--space-32); height: var(--space-32); flex: none; display: block; }
  circle { fill: none; stroke: var(--border-control); stroke-width: var(--stroke-hairline); }
  path, line { fill: none; stroke: var(--icon-inverse); stroke-width: var(--stroke-illustration); stroke-linecap: round; stroke-linejoin: round; }
  .done circle { fill: var(--state-done); stroke: none; }
  .skipped circle, .missed circle { fill: var(--state-missed); stroke: none; }
  .ahead circle, .before circle { stroke-dasharray: 2 2; }
  .open circle { stroke: var(--border-strong); stroke-width: var(--stroke-illustration); }
</style>
