<script lang="ts">
  // H37 Habit detail (Figma 52:2922): one habit in depth, from a Stats row or the recap. Where "why" is answered (C4):
  // skip reasons counted, and done times against the habit's own slot. Kaizen (080): the trial in progress shows here.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import Stat from '../../ui/Stat.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import StateIcon from '../../ui/StateIcon.svelte';
  import { SKIP_REASON_LABEL } from '../../ui/copy';
  import type { IconName } from '../../ui/icons';
  import { RANKS, ringSegments } from '../../domain/ranks';
  import { SKIP_REASONS } from '../../domain/states';
  import { parseRRule } from '../../domain/recurrence';
  import { fullDate, percent, plural, repeatLabel } from '../../domain/format';
  import { habitDetail, WHY_NONE, type HabitDetail } from '../../domain/stats';
  import type { IsoDay } from '../../domain/day';
  import { activeAdjustment } from '../../domain/adjust';
  import { loadStats, type StatsData } from '../../data/stats';

  interface Props { eventId: string; backLabel?: string; onback: () => void }
  let { eventId, backLabel = 'Stats', onback }: Props = $props();

  let data = $state.raw<StatsData | null>(null);
  onMount(async () => { data = await loadStats(); });

  const habit = $derived(data?.ctx.habits.find((h) => h.id === eventId) ?? null);
  const detail = $derived<HabitDetail | null>(data && habit ? habitDetail(data.ctx, habit, data.stored.get(habit.id) ?? null, data.zone) : null);
  const trial = $derived(data ? activeAdjustment(data.adjustments) : null);
  const mine = $derived(trial && trial.habitId === eventId ? trial : null);

  // 086: done with the 2-min version counts as done; here it is shown apart from full answers
  const smallCount = $derived(data ? data.ctx.answers.filter((a) => a.eventId === eventId && a.status === 'done' && a.small).length : 0);
  const doneCount = $derived(data ? data.ctx.answers.filter((a) => a.eventId === eventId && a.status === 'done').length : 0);
  const rankLabel = $derived(detail?.medal.rank ? RANKS.find((r) => r.id === detail.medal.rank)!.label : 'No rank yet');
  const runLine = $derived(detail ? (detail.medal.held > 0 ? `${rankLabel} · run of ${plural(detail.medal.held, 'day')}` : `${rankLabel} · no run now`) : '');
  const nextLine = $derived(detail?.medal.next ? `${RANKS.find((r) => r.id === detail.medal.next!.rank)!.label} at ${detail.medal.next.days} days` : 'Master');
  const schedule = $derived(habit ? `${repeatLabel(habit.rrule ? parseRRule(habit.rrule) : null, habit.start.slice(0, 10) as IsoDay)} · ${detail?.slot} · ${nextLine}` : '');
  const maxTime = $derived(Math.max(1, ...(detail?.times ?? []).map((t) => t.count)));
  const rows = $derived(detail ? [...SKIP_REASONS.map((k) => ({ key: k as string, label: SKIP_REASON_LABEL[k], n: detail.why[k] })), { key: WHY_NONE, label: 'No reason given', n: detail.why[WHY_NONE] }] : []);
</script>

<main class="screen detail">
  <TopBar type="navigation" title="" leftLabel={backLabel} onleft={onback} />
  {#if habit && detail}
    <h1 class="t-heading-large title">{habit.title}</h1>
    <div class="meta">
      <StateIcon status="open" icon={(habit.icon ?? 'sprout') as IconName} level={ringSegments(detail.medal.rank)} />
      <div class="text">
        <p class="t-body-strong">{runLine}</p>
        <p class="t-body-small secondary">{schedule}</p>
      </div>
    </div>
    <Stat value={percent(detail.rate.rate)} caption="{detail.rate.done} of {detail.rate.due} due · last {detail.windowDays} days" />

    {#if smallCount > 0}
      <p class="t-body-small secondary">Done {doneCount}: {doneCount - smallCount} in full, {smallCount} as the 2-min version.</p>
    {/if}

    {#if mine}
      <section class="trial">
        <p class="t-body-strong">Trying until {fullDate(mine.reviewOn)}</p>
        <p class="t-body-small secondary">{mine.text}</p>
      </section>
    {/if}

    {#if detail.whyTotal > 0}
      <SectionLabel text="Why it wasn’t done · {detail.whyTotal}" />
      <ul class="why">
        {#each rows as r (r.key)}
          <li><span class="t-body-default">{r.label}</span><span class="t-number-small count">{r.n}</span></li>
        {/each}
      </ul>
    {:else}
      <p class="t-body-small secondary">Nothing was missed or skipped in this time.</p>
    {/if}

    {#if detail.times && detail.times.some((t) => t.count > 0)}
      <SectionLabel text="When it gets done · last 30 days" />
      <ul class="times">
        {#each detail.times as t (t.label)}
          <li>
            <span class="t-body-small label">{t.label}</span>
            <span class="track"><span class="bar" style:width="{Math.round((t.count / maxTime) * 100)}%"></span></span>
            <span class="t-number-small count">{t.count}</span>
          </li>
        {/each}
      </ul>
    {/if}
  {:else if data}
    <p class="t-body-default secondary">This habit isn’t in the calendar any more.</p>
  {/if}
</main>

<style>
  .detail { display: flex; flex-direction: column; gap: var(--space-16); padding-bottom: var(--space-40); }
  .title { overflow-wrap: anywhere; }
  .meta { display: flex; align-items: center; gap: var(--space-12); }
  .text { display: grid; min-width: 0; }
  .secondary { color: var(--text-secondary); }
  .trial { display: grid; gap: var(--space-4); padding: var(--space-12) var(--space-16); background: var(--bg-subtle); border-radius: var(--radius-control); }
  .why li { display: flex; justify-content: space-between; align-items: center; min-height: var(--size-control); border-bottom: var(--stroke-hairline) solid var(--border-divider); }
  .why li:last-child { border-bottom: none; }
  .count { color: var(--text-tertiary); min-width: var(--space-16); text-align: right; }
  .times { display: grid; gap: var(--space-8); }
  .times li { display: grid; grid-template-columns: calc(var(--space-64) + var(--space-24) + var(--space-16)) 1fr var(--space-24); align-items: center; gap: var(--space-12); }
  .label { color: var(--text-secondary); white-space: nowrap; }
  .track { height: var(--space-8); background: var(--bg-subtle); border-radius: var(--radius-round); overflow: hidden; }
  .bar { display: block; height: 100%; min-width: var(--space-4); background: var(--state-done); border-radius: var(--radius-round); }
</style>
