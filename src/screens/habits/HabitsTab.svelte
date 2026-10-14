<script lang="ts">
  // The Habits tab (Figma page 14, section 04: H1 list, H2 week, H3 month; 097). It takes the Calendar's place in the
  // tab bar: three views of the same habits. The list shows each habit's star medal and how close its next rank is,
  // in green (098). Week puts the week strip over the grid; Month is the one month grid of the app (it absorbs H35),
  // where a perfect day is simply the full green cell (111: the corner star left). Days before the start and days
  // ahead are never zero (033).
  import { currentPause, lastPausedDay } from '../../domain/pause';
  import { routinesOf } from '../../domain/routines';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import { dayAndNumber } from '../../domain/format';
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import TabBar from '../../ui/TabBar.svelte';
  import SegmentedControl from '../../ui/SegmentedControl.svelte';
  import RankMedal from '../../ui/RankMedal.svelte';
  import ProgressBar from '../../ui/ProgressBar.svelte';
  import WeekStrip from '../../ui/WeekStrip.svelte';
  import WeekCell from '../../ui/WeekCell.svelte';
  import HeatCell from '../../ui/HeatCell.svelte';
  import Icon from '../../ui/Icon.svelte';
  import EmptyState from '../../ui/EmptyState.svelte';
  import type { IconName } from '../../ui/icons';
  import { READY_TABS, type Tab } from '../../ui/tabs';
  import { RANKS } from '../../domain/ranks';
  import { parseRRule } from '../../domain/recurrence';
  import { fullDate, monthName, percent, plural, repeatLabel, shortName, timesAWeek, weekRange } from '../../domain/format';
  import { monthView, weekView, type Medal } from '../../domain/stats';
  import { nextRankLine, perfectDays, weekStrip } from '../../domain/award';
  import { addDays, type IsoDay } from '../../domain/day';
  import { activeIds, loadStats, medals, type StatsData } from '../../data/stats';
  import { activeHabits } from '../../data/habits';

  export type HabitsMode = 'list' | 'week' | 'month';
  interface Props { ontab?: (tab: Tab) => void; initialMode?: HabitsMode; onview?: (m: HabitsMode) => void; onhabit: (eventId: string) => void; onnew?: () => void }
  let { ontab, initialMode = 'list', onview, onhabit, onnew }: Props = $props();

  let data = $state.raw<StatsData | null>(null);
  let list = $state.raw<Medal[]>([]);
  // svelte-ignore state_referenced_locally
  let mode = $state<HabitsMode>(initialMode);
  let series = $state.raw<Set<string>>(new Set()); // H45: running series only; Proton splits a series at every edit
  async function load() { const d = await loadStats(); list = await medals(d); series = new Set((await activeHabits(d.ctx.today)).active.map((e) => e.id)); data = d; }
  onMount(() => {
    load();
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });
  function pick(m: HabitsMode) { mode = m; onview?.(m); }

  const ctx = $derived(data?.ctx ?? null);
  const active = $derived(data ? activeIds(data) : new Set<string>());
  const habits = $derived(ctx ? ctx.habits.filter((h) => series.has(h.id)).sort((a, b) => a.start.slice(11).localeCompare(b.start.slice(11)) || a.title.localeCompare(b.title)) : []);
  const medalOf = $derived(new Map(list.map((m) => [m.eventId, m])));
  const tracked = $derived(!!ctx?.trackingStart);
  const week = $derived(ctx && tracked ? weekView(ctx, ctx.today) : null);
  const strip = $derived(ctx && tracked ? weekStrip(ctx) : []);
  const month = $derived(ctx && tracked ? monthView(ctx, ctx.today) : null);
  const monthStars = $derived(ctx && month ? new Set(perfectDays(ctx, month.first, addDays(month.first, month.cells.length - 1))) : new Set<string>());

  const OPTIONS: { id: HabitsMode; label: string }[] = [{ id: 'list', label: 'List' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }];
  const title = $derived(mode === 'list' ? 'Habits' : mode === 'week' ? 'This week' : 'This month');
  const eyebrow = $derived(mode === 'list' ? plural(habits.length, 'habit') : mode === 'week' && week ? weekRange(week.from, week.to) : ctx ? `${monthName(ctx.today)} ${ctx.today.slice(0, 4)}` : '');
  const sched = (h: (typeof habits)[number]) => {
    const rule = h.perWeek ? timesAWeek(h.perWeek) : repeatLabel(h.rrule ? parseRRule(h.rrule) : null, h.start.slice(0, 10) as IsoDay);
    const m = medalOf.get(h.id);
    const next = m ? nextRankLine(m) : '';
    // 117: a paused habit says until when instead of its next rank
    const p = ctx ? currentPause(h.pauses, ctx.today) : null;
    const last = p ? lastPausedDay(p) : null;
    if (p && last && ctx && p.from <= ctx.today) return `${rule} · Paused until ${dayAndNumber(last)}`;
    return `${rule} · ${h.allDay ? 'All day' : h.start.slice(11, 16)}${next ? ` · ${next}` : ''}`;
  };
  // 118: routines from After, as groups in the order they follow each other; the rest stand on their own
  const groups = $derived(routinesOf(habits.filter((h) => active.has(h.id))));
  const grouped = $derived(new Set(groups.flatMap((g) => g.members.slice(1).map((m) => m.id))));
  const firsts = $derived(new Set(groups.map((g) => g.members[0]!.id)));
  const alone = $derived(habits.filter((h) => !grouped.has(h.id) && !firsts.has(h.id)));
  const line = (h: (typeof habits)[number]) => (grouped.has(h.id) && h.after ? sched(h).replace(/ · (\d\d:\d\d|All day)/, ` · After ${shortName(h.after)}`) : sched(h));
  const rankName = (m: Medal | undefined) => (m?.rank ? RANKS.find((r) => r.id === m.rank)!.label : 'No medal yet');
</script>

<div class="page">
  <main class="screen habits">
    <TopBar {eyebrow} {title} action={onnew ? { icon: 'plus', label: 'New habit' } : undefined} onaction={onnew} />
    {#if !data}
      <!-- first read -->
    {:else if !habits.length}
      <div class="spacer"></div>
      <EmptyState title="No habits yet" body="Pick what you want to do and when. Each day you keep them all lights a star." action={onnew ? 'New habit' : undefined} onaction={onnew} />
      <div class="spacer"></div>
    {:else}
      <SegmentedControl options={OPTIONS} selected={mode} label="View" onselect={pick} />

      {#if mode === 'list'}
        {#snippet habitItem(h: (typeof habits)[number])}
          {@const m = medalOf.get(h.id)}
          <li>
            <button class="habit" onclick={() => onhabit(h.id)} aria-label="{h.title}, {rankName(m)}, {line(h)}">
              <RankMedal rank={m?.rank ?? null} icon={(h.icon ?? 'sprout') as IconName} />
              <span class="text">
                <span class="t-body-strong name">{h.title}</span>
                <span class="t-body-small secondary meta">{line(h)}</span>
                {#if m?.next}<ProgressBar value={m.held} of={m.next.days} label="Toward {RANKS.find((r) => r.id === m.next!.rank)!.label}" />{/if}
              </span>
              <span class="chev"><Icon name="chevron-right" /></span>
            </button>
          </li>
        {/snippet}
        {#if groups.length}
          {#each groups as g (g.members[0]!.id)}
            <div class="group">
              <SectionLabel text="{g.name} · {g.members[0]!.allDay ? 'All day' : g.members[0]!.start.slice(11, 16)}" />
              <ul class="list">{#each g.members as h (h.id)}{@render habitItem(h)}{/each}</ul>
            </div>
          {/each}
          {#if alone.length}
            <div class="group">
              <SectionLabel text="On its own" />
              <ul class="list">{#each alone as h (h.id)}{@render habitItem(h)}{/each}</ul>
            </div>
          {/if}
        {:else}
          <ul class="list">{#each habits as h (h.id)}{@render habitItem(h)}{/each}</ul>
        {/if}

      {:else if mode === 'week' && week}
        <div class="grid" role="table" aria-label="This week">
          <div class="head" role="row"><span></span><WeekStrip days={strip} /></div>
          {#each week.rows.filter((r) => active.has(r.eventId)) as row (row.eventId)}
            <div class="row" role="row">
              <button class="t-body-small rowname" onclick={() => onhabit(row.eventId)}>{row.title}</button>
              <span class="cells">
                {#each row.cells as cell, i (i)}
                  <span class="cell" role="cell">{#if cell && cell.state !== 'before'}<WeekCell state={cell.state} label="{row.title}, {fullDate(cell.day)}: {cell.state === 'ahead' ? 'not yet' : cell.state}" />{/if}</span>
                {/each}
              </span>
            </div>
          {/each}
        </div>

      {:else if mode === 'month' && month}
        <div class="month" role="group" aria-label="{monthName(month.first)} {month.first.slice(0, 4)}">
          {#each ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as l, i (i)}<span class="t-label-small wd">{l}</span>{/each}
          {#each Array.from({ length: month.leading }) as _, i (i)}<span></span>{/each}
          {#each month.cells as c (c.day)}
            <span class="day">
              <HeatCell day={Number(c.day.slice(8, 10))} level={c.level} kind={c.kind}
                label="{fullDate(c.day)}: {c.kind === 'ahead' ? 'ahead' : c.rate.due ? `${percent(c.rate.rate)}, ${c.rate.done} of ${c.rate.due} done` : 'nothing due'}{monthStars.has(c.day) ? ', perfect day' : ''}" />
            </span>
          {/each}
        </div>
      {/if}
    {/if}
  </main>
  <TabBar active="habits" ready={READY_TABS} onselect={ontab} />
</div>

<style>
  .page { min-height: 100dvh; display: flex; flex-direction: column; }
  .habits { flex: 1; display: flex; flex-direction: column; gap: var(--layout-block-gap); padding-bottom: var(--space-24); }
  .page :global(nav) { position: sticky; bottom: 0; }
  .spacer { flex: 1; }
  .secondary { color: var(--text-secondary); }
  .list { display: grid; gap: var(--space-24); }
  .group { display: grid; }
  .habit { display: flex; align-items: center; gap: var(--space-12); width: 100%; text-align: left; }
  .text { flex: 1; min-width: 0; display: grid; gap: var(--space-4); }
  .name, .meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } /* E21 */
  .text :global(.row) { padding-top: var(--space-4); }
  .chev { color: var(--icon-muted); display: flex; }

  .grid { display: grid; }
  .head { padding-bottom: var(--space-8); }
  .row { border-top: var(--stroke-hairline) solid var(--border-divider); padding: var(--space-4) 0; } /* a divider between habits (owner, 8 Oct 2026) */
  .head, .row { display: grid; grid-template-columns: calc(var(--space-64) + var(--space-16)) 1fr; align-items: center; }
  .rowname { text-align: left; color: var(--text-primary); min-height: var(--size-touch); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; padding-right: var(--space-4); }
  .cells { display: flex; justify-content: space-between; }
  .cell { width: var(--space-40); height: var(--space-32); display: grid; place-items: center; }

  .month { display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--space-8); }
  .wd { text-align: center; color: var(--text-tertiary); }
  .day { position: relative; }
</style>
