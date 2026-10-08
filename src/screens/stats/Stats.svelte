<script lang="ts">
  // H6 Stats (Figma page 14, section 04; was H34–H36, H40). New on top: perfect days, counted with stars (093). Then
  // each habit as a green bar with done of due beside it (006); the big rate line left (102: a number without a picture
  // didn't help). The week grid and
  // the month grid moved to the Habits tab (097), so the app has one of each. Year keeps its bars. Days before
  // tracking and days ahead are never drawn as zero (033). Real data only, no sample numbers.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import TabBar from '../../ui/TabBar.svelte';
  import Banner from '../../ui/Banner.svelte';
  import SegmentedControl from '../../ui/SegmentedControl.svelte';
  import Stat from '../../ui/Stat.svelte';
  import WeekStrip from '../../ui/WeekStrip.svelte';
  import AwardStar from '../../ui/AwardStar.svelte';
  import ProgressBar from '../../ui/ProgressBar.svelte';
  import { perfectDays, weekStrip } from '../../domain/award';
  import { addDays } from '../../domain/day';
  import YearBar from '../../ui/YearBar.svelte';
  import Sky from '../../ui/Sky.svelte';
  import { sky as skyOf } from '../../domain/moments';
  import ListRow from '../../ui/ListRow.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import EmptyState from '../../ui/EmptyState.svelte';
  import type { Tab } from '../../ui/tabs';
  import { READY_TABS } from '../../ui/tabs';
  import { RANKS } from '../../domain/ranks';
  import { reviewIsDue, activeAdjustment } from '../../domain/adjust';
  import { fullDate, monthName, percent, shortName, weekdayLetter } from '../../domain/format';
  import { monthView, rateOf, recapWeekStart, sortMedals, weekView, weeklyRecap, yearView, type HabitDay, type Medal } from '../../domain/stats';
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
  const yearSky = $derived(ctx && hasData && mode === 'year' ? skyOf(ctx, Number(ctx.today.slice(0, 4))) : null); // 109 (W3)

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
  const strip = $derived(ctx && hasData ? weekStrip(ctx) : []);
  const weekPerfect = $derived(strip.filter((d) => d.state === 'perfect').length);
  const weekTracked = $derived(strip.filter((d) => !d.today ? d.state !== 'future' && d.state !== 'empty' : d.due > 0).length);
  const monthPerfect = $derived(ctx && monthly ? perfectDays(ctx, monthly.first, addDays(monthly.first, monthly.cells.length - 1)).length : 0);
  const yearPerfect = $derived(ctx && yearly ? perfectDays(ctx, `${yearly.year}-01-01` as IsoDay, `${yearly.year}-12-31` as IsoDay).length : 0);
  const weekByHabit = $derived(week ? week.rows.map((r) => ({ eventId: r.eventId, title: r.title, rate: rateOf(r.cells.filter((c): c is HabitDay => !!c)) })).filter((r) => r.rate.due > 0) : []);
</script>

{#snippet byHabit(rows: { eventId: string; title: string; rate: { done: number; due: number; rate: number | null } }[])}
  {#if rows.length}
    <section class="by">
      <SectionLabel text="By habit · done of due" />
      {#each rows as h (h.eventId)}
        <button class="habit" onclick={() => onhabit(h.eventId)}>
          <span class="line"><span class="t-body-default name">{h.title}</span><span class="t-number-small secondary">{pct(h.rate.rate)} · {h.rate.done} of {h.rate.due}</span></span>
          <ProgressBar value={h.rate.done} of={h.rate.due} label="{h.title}, done of due" count={false} />
        </button>
      {/each}
    </section>
  {/if}
{/snippet}

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
        <section class="perfect">
          <div class="count"><AwardStar size="icon" />
            <span><span class="t-heading-small block">{weekPerfect} perfect {weekPerfect === 1 ? 'day' : 'days'}</span>
            <span class="t-body-small secondary">Out of {weekTracked} {weekTracked === 1 ? 'day' : 'days'} tracked this week</span></span>
          </div>
          <WeekStrip days={strip} />
        </section>
        {#if week.rate.due === 0}
          <p class="t-body-small tertiary">Nothing has been decided yet this week. Days before the start stay empty, never missed (033).</p>
        {/if}
        {@render byHabit(weekByHabit)}
        <ListRow icon="award" label="Badges" value={topLine} onclick={onbadges} />
      {:else if mode === 'month' && monthly && today}
        <section class="perfect">
          <div class="count"><AwardStar size="icon" />
            <span><span class="t-heading-small block">{monthPerfect} perfect {monthPerfect === 1 ? 'day' : 'days'}</span>
            <span class="t-body-small secondary">In {monthLabel(monthly.first)} so far</span></span>
          </div>
        </section>
        {@render byHabit(monthly.byHabit)}
        <ListRow icon="award" label="Badges" value={topLine} onclick={onbadges} />
      {:else if mode === 'year' && yearly}
        <section class="perfect">
          <div class="count"><AwardStar size="icon" />
            <span><span class="t-heading-small block">{yearPerfect} perfect {yearPerfect === 1 ? 'day' : 'days'}</span>
            <span class="t-body-small secondary">In {yearly.year} so far</span></span>
          </div>
        </section>
        {#if yearSky}
          <section class="weeks">
            <SectionLabel text="Perfect weeks · {yearSky.perfect}" />
            <Sky sky={yearSky} />
          </section>
        {/if}
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
  .stats { flex: 1; display: flex; flex-direction: column; gap: var(--layout-block-gap); padding-bottom: var(--space-24); }
  .perfect { display: grid; gap: var(--space-16); }
  .count { display: flex; align-items: center; gap: var(--space-12); }
  .block { display: block; }
  .by { display: grid; gap: var(--space-16); }
  .habit { display: grid; gap: var(--space-8); width: 100%; text-align: left; }
  .line { display: flex; justify-content: space-between; gap: var(--space-8); }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .spacer { flex: 1; }
  .page :global(nav) { position: sticky; bottom: 0; }
  .tertiary { color: var(--text-tertiary); }
  .secondary { color: var(--text-secondary); }



  .weeks { display: grid; }
  .year { display: flex; gap: var(--space-4); justify-content: space-between; }
</style>
