<script lang="ts">
  // 06 Stats (Figma 65:3828), flow F6: H34 Week, H35 Month, H36 Year, H40 first days. Completion rate by week,
  // month and year (006); the due count always travels with the rate. Shape carries the state, colour confirms it (038).
  // Days before tracking and days ahead are never drawn as zero (033). Real data only, no sample numbers.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import TabBar from '../../ui/TabBar.svelte';
  import Banner from '../../ui/Banner.svelte';
  import SegmentedControl from '../../ui/SegmentedControl.svelte';
  import Stat from '../../ui/Stat.svelte';
  import WeekCell from '../../ui/WeekCell.svelte';
  import HeatCell from '../../ui/HeatCell.svelte';
  import YearBar from '../../ui/YearBar.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import EmptyState from '../../ui/EmptyState.svelte';
  import type { Tab } from '../../ui/tabs';
  import { READY_TABS } from '../../ui/tabs';
  import { RANKS } from '../../domain/ranks';
  import { reviewIsDue, activeAdjustment } from '../../domain/adjust';
  import { fullDate, monthName, percent, shortName, weekdayLetter } from '../../domain/format';
  import { monthView, recapWeekStart, sortMedals, weekView, weeklyRecap, yearView, type Medal } from '../../domain/stats';
  import type { IsoDay } from '../../domain/day';
  import { loadStats, medals, type StatsData } from '../../data/stats';

  export type Mode = 'week' | 'month' | 'year';
  interface Props {
    ontab?: (tab: Tab) => void;
    initialMode?: Mode;
    initialMonth?: IsoDay;
    onview?: (mode: Mode, month: IsoDay | undefined) => void;
    onhabit: (eventId: string) => void;
    onbadges: () => void;
    onrecap: (weekStart: IsoDay) => void;
  }
  let { ontab, initialMode = 'week', initialMonth, onview, onhabit, onbadges, onrecap }: Props = $props();

  let data = $state.raw<StatsData | null>(null);
  let list = $state.raw<Medal[]>([]);
  // svelte-ignore state_referenced_locally
  let mode = $state<Mode>(initialMode);
  // svelte-ignore state_referenced_locally
  let month = $state<IsoDay | undefined>(initialMonth);

  async function load() {
    const d = await loadStats();
    data = d;
    list = await medals(d);
  }
  onMount(() => {
    load();
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });
  function pick(next: Mode, m?: IsoDay) { mode = next; month = m; onview?.(next, m); }

  const ctx = $derived(data?.ctx ?? null);
  const today = $derived(ctx?.today ?? null);
  const hasData = $derived(!!ctx && !!ctx.trackingStart && ctx.habits.length > 0);
  const week = $derived(ctx && hasData ? weekView(ctx, ctx.today) : null);
  const monthly = $derived(ctx && hasData ? monthView(ctx, month ?? ctx.today) : null);
  const yearly = $derived(ctx && hasData ? yearView(ctx, ctx.today) : null);

  // H34: the recap banner stays until it is opened. A trial due for review asks to be opened too (080).
  const recapStart = $derived(today ? recapWeekStart(today) : null);
  const recap = $derived(ctx && hasData && recapStart ? weeklyRecap(ctx, recapStart) : null);
  const recapUnseen = $derived(!!recap && !!recapStart && (!data?.recapSeen || data.recapSeen < recapStart));
  const trial = $derived(data ? activeAdjustment(data.adjustments) : null);
  const reviewDue = $derived(!!trial && !!today && reviewIsDue(trial, today));
  const banner = $derived(reviewDue && trial ? `Time to review: ${trial.text}` : recapUnseen && recap ? `${recap.title.replace(' recap', '')} recap is ready` : '');

  const top = $derived(sortMedals(list).find((m) => m.rank));
  const topLine = $derived(top ? `${shortName(top.title)} · ${RANKS.find((r) => r.id === top.rank)!.label}` : 'No medal yet');
  const eyebrow = $derived(today ? `${monthName(today)} ${today.slice(0, 4)}` : '');
  const pct = (r: number | null) => percent(r);
  const OPTIONS: { id: Mode; label: string }[] = [{ id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }];
  const monthLabel = (first: IsoDay) => `${monthName(first)} ${first.slice(0, 4)}`;
</script>

<div class="page">
  <main class="screen stats">
    <TopBar eyebrow={eyebrow} title="Stats" />

    {#if !data}
      <!-- first read from IndexedDB: a frame or two -->
    {:else if !hasData}
      <div class="spacer"></div>
      <EmptyState title="Nothing to show yet" body="Stats appear after the first habit days. Days before the start are never counted as missed." />
      <div class="spacer"></div>
    {:else}
      {#if banner}
        <Banner tone="info" message={banner} action="Open" onaction={() => onrecap(recapStart!)} />
      {/if}
      <SegmentedControl options={OPTIONS} selected={mode} label="Period" onselect={(id) => pick(id)} />

      {#if mode === 'week' && week && today}
        <Stat value={pct(week.rate.rate)} caption="{week.rate.done} of {week.rate.due} due · Week {week.number} so far" />
        {#if week.rate.due === 0}
          <p class="t-body-small tertiary">Nothing has been decided yet this week. Days before the start stay empty, never missed (033).</p>
        {/if}
        <div class="grid" role="table" aria-label="Week {week.number}">
          <div class="days" role="row">
            <span></span>
            {#each week.days as d (d)}
              <span class="day t-label-small" class:today={d === today} role="columnheader">{weekdayLetter(d)}<span class="t-number-small">{Number(d.slice(8, 10))}</span></span>
            {/each}
          </div>
          {#each week.rows as row (row.eventId)}
            <div class="row" role="row">
              <button class="name t-body-default" onclick={() => onhabit(row.eventId)}>{row.title}</button>
              {#each row.cells as cell, i (i)}
                <span class="cell" role="cell">{#if cell && cell.state !== 'before'}<WeekCell state={cell.state} label="{row.title}, {fullDate(cell.day)}: {cell.state === 'ahead' ? 'not yet' : cell.state}" />{/if}</span>
              {/each}
            </div>
          {/each}
        </div>
        <div class="legend" aria-label="Legend">
          {#each [['done', 'Done'], ['skipped', 'Skipped'], ['missed', 'Missed'], ['open', 'Open'], ['ahead', 'Not yet']] as const as [s, l] (s)}
            <span class="key t-label-small"><WeekCell state={s} label={l} />{l}</span>
          {/each}
          <span class="t-label-small tertiary">Blank: not scheduled</span>
        </div>
        <ListRow icon="award" label="Badges" value={topLine} onclick={onbadges} />
      {:else if mode === 'month' && monthly && today}
        <Stat value={pct(monthly.rate.rate)} caption="{monthly.rate.done} of {monthly.rate.due} due · {monthly.label} so far" />
        <div class="month" role="group" aria-label={monthLabel(monthly.first)}>
          {#each ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as l, i (i)}<span class="t-label-small wd">{l}</span>{/each}
          {#each Array.from({ length: monthly.leading }) as _, i (i)}<span></span>{/each}
          {#each monthly.cells as c (c.day)}
            <HeatCell day={Number(c.day.slice(8, 10))} level={c.level} kind={c.kind}
              label="{fullDate(c.day)}: {c.kind === 'ahead' ? 'ahead' : c.rate.due ? `${pct(c.rate.rate)}, ${c.rate.done} of ${c.rate.due} done` : 'nothing due'}" />
          {/each}
        </div>
        <div class="legend scale">
          <span class="t-number-small tertiary">0%</span>
          {#each [0, 1, 2, 3, 4] as const as l (l)}<HeatCell size="small" day={0} level={l} label="Step {l + 1} of 5" />{/each}
          <span class="t-number-small tertiary">100%</span>
          <span class="grow"></span>
          <span class="t-label-small tertiary">Dotted: days ahead</span>
        </div>
        {#if monthly.byHabit.length}
          <SectionLabel text="By habit" />
          {#each monthly.byHabit as h (h.eventId)}
            <ListRow label={h.title} value="{pct(h.rate.rate)} · {h.rate.due} due" onclick={() => onhabit(h.eventId)} />
          {/each}
        {/if}
      {:else if mode === 'year' && yearly}
        <Stat value={pct(yearly.rate.rate)} caption="{yearly.rate.done} of {yearly.rate.due} due · {yearly.year} so far" />
        <div class="year" role="group" aria-label="Year {yearly.year}">
          {#each yearly.bars as b (b.month)}
            <YearBar letter={b.letter} rate={b.rate.rate} due={b.rate.due} ahead={b.ahead}
              mark={yearly.best?.month === b.month ? 'BEST' : yearly.low?.month === b.month ? 'LOW' : null}
              label="{monthName(b.first)}: {b.ahead ? 'ahead' : b.rate.due ? `${pct(b.rate.rate)}, ${b.rate.due} due` : 'nothing due'}"
              onclick={() => pick('month', b.first)} />
          {/each}
        </div>
        <p class="t-body-small secondary">{yearly.sentence} Tap a month to open it.</p>
        <ListRow icon="award" label="Badges" value={topLine} onclick={onbadges} />
      {/if}
    {/if}
  </main>
  <TabBar active="stats" ready={READY_TABS} onselect={ontab} />
</div>

<style>
  .page { min-height: 100dvh; display: flex; flex-direction: column; }
  .stats { flex: 1; display: flex; flex-direction: column; gap: var(--space-16); padding-bottom: var(--space-16); }
  .spacer { flex: 1; }
  .page :global(nav) { position: sticky; bottom: 0; }
  .tertiary { color: var(--text-tertiary); }
  .secondary { color: var(--text-secondary); }
  .grow { flex: 1; }

  .grid { display: grid; gap: var(--space-8); }
  .days, .row { display: grid; grid-template-columns: 1fr repeat(7, var(--space-32)); align-items: center; }
  .day { display: grid; justify-items: center; color: var(--text-tertiary); }
  .day.today { color: var(--text-accent); }
  .name { text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-height: var(--space-32); }
  .cell { display: grid; place-items: center; height: var(--space-32); }

  .legend { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-8) var(--space-16); }
  .key { display: flex; align-items: center; gap: var(--space-4); }
  .scale { gap: var(--space-4); }
  .scale .grow { margin-left: var(--space-4); }

  .month { display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--space-8); }
  .wd { text-align: center; color: var(--text-tertiary); }
  .year { display: flex; gap: var(--space-4); justify-content: space-between; }
</style>
