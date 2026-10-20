<script lang="ts" module>
  export type DayState = 'done' | 'partial' | 'missed' | 'today' | 'ahead' | 'before' | 'none';
  export interface CalendarDay { day: string; state: DayState; label: string }
</script>

<script lang="ts">
  // The month, week by week, Monday first (decision 129, Figma components "Month calendar" and "Calendar day"). The
  // same card on the habit detail, Habits month and Stats month, so a day always looks the same: done green, some done
  // light green, missed or skipped orange outline, today ink ring, ahead dashed, before tracking dimmed (033).
  interface Props { title: string; count?: string; days: CalendarDay[]; leading: number; showPartial?: boolean; onday?: (day: string) => void }
  let { title, count, days, leading, showPartial = true, onday }: Props = $props();
  const LEGEND: { state: DayState; label: string }[] = [
    { state: 'done', label: 'Done' }, { state: 'partial', label: 'Some done' }, { state: 'missed', label: 'Missed' },
    { state: 'today', label: 'Today' }, { state: 'ahead', label: 'Ahead' },
  ];
</script>

<section class="calendar card" aria-label={title}>
  <header>
    <h2 class="t-body-strong">{title}</h2>
    {#if count}<span class="t-number-default count">{count}</span>{/if}
  </header>
  <div class="grid" role="grid">
    {#each ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as l, i (i)}<span class="t-label-small wd" aria-hidden="true">{l}</span>{/each}
    {#each Array.from({ length: leading }) as _, i (i)}<span></span>{/each}
    {#each days as d (d.day)}
      {#if onday}
        <button class="day {d.state}" role="gridcell" aria-label={d.label} onclick={() => onday?.(d.day)}><span class="t-number-small">{Number(d.day.slice(8, 10))}</span></button>
      {:else}
        <span class="day {d.state}" role="gridcell" aria-label={d.label}><span class="t-number-small">{Number(d.day.slice(8, 10))}</span></span>
      {/if}
    {/each}
  </div>
  <ul class="legend">
    {#each LEGEND.filter((l) => showPartial || l.state !== 'partial') as l (l.state)}
      <li class="t-label-small"><span class="swatch {l.state}"></span>{l.label}</li>
    {/each}
  </ul>
</section>

<style>
  .calendar { display: grid; gap: var(--space-12); }
  header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-8); }
  .count { color: var(--text-done); }
  .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--space-8); }
  .wd { text-align: center; color: var(--text-secondary); }
  .day {
    aspect-ratio: 1; display: grid; place-items: center; border-radius: var(--radius-tile);
    color: var(--text-primary); box-shadow: inset 0 0 0 0 transparent;
  }
  .done { background: var(--state-done); color: var(--text-inverse); }
  .partial { background: var(--heat-2); }
  .missed { background: var(--bg-card); box-shadow: inset 0 0 0 var(--stroke-illustration) var(--state-missed); }
  .today { box-shadow: inset 0 0 0 var(--stroke-illustration) var(--border-strong); }
  .ahead { color: var(--text-secondary); outline: var(--stroke-hairline) dashed var(--border-control); outline-offset: calc(var(--stroke-hairline) * -1); }
  .before, .none { color: var(--text-disabled); }
  .legend { display: flex; flex-wrap: wrap; gap: var(--space-8) var(--space-12); color: var(--text-secondary); }
  .legend li { display: flex; align-items: center; gap: var(--space-4); }
  .swatch { width: var(--space-12); height: var(--space-12); border-radius: var(--space-4); }
  .swatch.done { background: var(--state-done); }
  .swatch.partial { background: var(--heat-2); }
  .swatch.missed { box-shadow: inset 0 0 0 var(--stroke-illustration) var(--state-missed); }
  .swatch.today { box-shadow: inset 0 0 0 var(--stroke-illustration) var(--border-strong); }
  .swatch.ahead { outline: var(--stroke-hairline) dashed var(--border-control); outline-offset: calc(var(--stroke-hairline) * -1); }
</style>
