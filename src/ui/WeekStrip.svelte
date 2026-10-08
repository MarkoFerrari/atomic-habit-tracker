<script lang="ts">
  // Week strip (Figma 219:91, 096): Monday to Sunday under the Today ring, and the header of the Habits week grid.
  // Perfect = the award star; partial = the green share done; missed = outlined at 3:1; open = today (or a day still
  // answerable), ink; future = dashed and never counted (033). The perfect-day star lands in today's cell (093).
  // 108: a day a run was saved carries the comeback mark, a small green badge on the cell.
  import AwardStar from './AwardStar.svelte';
  import Icon from './Icon.svelte';
  import type { StripDay } from '../domain/award';
  import { fullDate } from '../domain/format';

  interface Props { days: readonly StripDay[]; hideToday?: boolean; onday?: (day: StripDay) => void }
  let { days, hideToday = false, onday }: Props = $props();
  const R = 15; // drawn on a 32 grid with a 2 stroke
  const C = 2 * Math.PI * R;
  const said = (d: StripDay) => {
    const what = { perfect: 'perfect day', partial: `${d.done} of ${d.due} done`, missed: `none of ${d.due} done`, open: `${d.done} of ${d.due} done so far`, future: 'ahead', empty: 'nothing due' }[d.state];
    return `${fullDate(d.day)}${d.today ? ', today' : ''}: ${what}${d.comeback ? ', a run saved' : ''}`;
  };
</script>

<ol class="strip" aria-label="This week">
  {#each days as d (d.day)}
    {@const state = hideToday && d.today && d.state === 'perfect' ? 'open' : d.state}
    <li>
      <button class="day" class:today={d.today} disabled={!onday} onclick={() => onday?.(d)} aria-label={said(d)}>
        <span class="t-label-small letter">{d.letter}</span>
        <span class="cell {state}" data-strip-cell={d.today ? 'today' : undefined} data-strip-day={d.day}>
          {#if state === 'perfect'}
            <AwardStar size="cell" />
          {:else}
            <svg viewBox="0 0 32 32" aria-hidden="true">
              {#if state === 'partial'}
                <circle class="track" cx="16" cy="16" r={R} />
                <circle class="share" cx="16" cy="16" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - d.share)} transform="rotate(-90 16 16)" />
              {:else}
                <circle class="ring" cx="16" cy="16" r={R} />
              {/if}
            </svg>
          {/if}
          {#if d.comeback}<span class="mark" aria-hidden="true"><Icon name="refresh" size="small" /></span>{/if}
        </span>
        <span class="dot" aria-hidden="true"></span>
      </button>
    </li>
  {/each}
</ol>

<style>
  .strip { display: flex; justify-content: space-between; }
  .day { width: var(--space-40); display: grid; justify-items: center; gap: var(--space-8); }
  .day:disabled { cursor: default; }
  .letter { color: var(--text-tertiary); }
  .today .letter { color: var(--text-primary); }
  .cell { position: relative; width: var(--space-32); height: var(--space-32); display: grid; place-items: center; }
  .cell svg { width: 100%; height: 100%; overflow: visible; }
  circle { fill: none; stroke-width: var(--stroke-illustration); }
  .track { stroke: var(--border-divider); }
  .share { stroke: var(--state-done); }
  .missed .ring { stroke: var(--border-control); stroke-width: var(--stroke-icon); }
  .open .ring { stroke: var(--border-strong); }
  .future .ring, .empty .ring { stroke: var(--border-control); stroke-width: var(--stroke-hairline); stroke-dasharray: 3 3; }
  .dot { width: var(--space-4); height: var(--space-4); border-radius: var(--radius-round); background: transparent; }
  .today .dot { background: var(--text-primary); }
  .mark { position: absolute; top: calc(var(--space-4) * -1); right: calc(var(--space-4) * -1); width: var(--space-16); height: var(--space-16);
    display: grid; place-items: center; border-radius: var(--radius-round); background: var(--state-done); color: var(--icon-inverse);
    outline: var(--stroke-illustration) solid var(--bg-default); animation: mark-in var(--motion-duration-base) var(--motion-easing-enter) both; }
  .mark :global(svg) { width: var(--space-12); height: var(--space-12); }
  @keyframes mark-in { from { opacity: 0; transform: scale(0.4); } }
  /* The star landing (093): the cell bumps once, 1 → 1.12 → 1. */
  :global(.bump) { animation: bump calc(var(--motion-duration-fast) * 2) var(--motion-easing-spring); }
  @keyframes bump { 50% { transform: scale(1.12); } }
</style>
