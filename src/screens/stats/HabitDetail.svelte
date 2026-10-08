<script lang="ts">
  // H4 Habit detail (Figma page 14, section 04; was H37): the star medal leads, then the next rank in plain numbers,
  // done of due, the best run and twelve weeks of bars. Below: why it wasn't done (C4) and when it gets done.
  // Kaizen (080): the trial in progress shows here. A pushed screen: no tab bar (044).
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import Stat from '../../ui/Stat.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import RankMedal from '../../ui/RankMedal.svelte';
  import ProgressBar from '../../ui/ProgressBar.svelte';
  import { bestRun, nextRankLine, twelveWeeks } from '../../domain/award';
  import { SKIP_REASON_LABEL } from '../../ui/copy';
  import type { IconName } from '../../ui/icons';
  import { RANKS } from '../../domain/ranks';
  import { SKIP_REASONS } from '../../domain/states';
  import { parseRRule } from '../../domain/recurrence';
  import { fullDate, percent, plural, repeatLabel } from '../../domain/format';
  import { habitDetail, WHY_NONE, type HabitDetail } from '../../domain/stats';
  import type { IsoDay } from '../../domain/day';
  import { activeAdjustment } from '../../domain/adjust';
  import { loadStats, type StatsData } from '../../data/stats';

  interface Props { eventId: string; backLabel?: string; onback: () => void; onedit?: (eventId: string) => void }
  let { eventId, backLabel = 'Stats', onback, onedit }: Props = $props();

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
  const weeks = $derived(data && habit ? twelveWeeks(data.ctx, habit) : []);
  const best = $derived(data && habit ? bestRun(data.ctx, habit) : 0);
  const nextLabel = $derived(detail?.medal.next ? RANKS.find((r) => r.id === detail.medal.next!.rank)!.label : '');
  const starsToGo = $derived(detail?.medal.next ? ({ starter: 1, builder: 2, keeper: 3, artisan: 3, master: 3 } as const)[detail.medal.next.rank] : 0);
  const maxTime = $derived(Math.max(1, ...(detail?.times ?? []).map((t) => t.count)));
  const rows = $derived(detail ? [...SKIP_REASONS.map((k) => ({ key: k as string, label: SKIP_REASON_LABEL[k], n: detail.why[k] })), { key: WHY_NONE, label: 'No reason given', n: detail.why[WHY_NONE] }] : []);
</script>

<main class="screen detail">
  <TopBar type="navigation" title="" leftLabel={backLabel} onleft={onback} rightLabel={onedit ? 'Edit' : undefined} onright={() => onedit?.(eventId)} />
  {#if habit && detail}
    <section class="head">
      <RankMedal rank={detail.medal.rank} icon={(habit.icon ?? 'sprout') as IconName} size="medium" label="{rankLabel} medal" />
      <div class="text">
        <h1 class="t-heading-medium title">{habit.title}</h1>
        <p class="t-body-small secondary">{runLine}</p>
        <p class="t-label-small tertiary">{schedule}</p>
      </div>
    </section>

    {#if detail.medal.next}
      <section class="next">
        <p class="line"><span class="t-body-strong">{nextRankLine(detail.medal)}</span><span class="t-number-default secondary">{detail.medal.held}/{detail.medal.next.days}</span></p>
        <ProgressBar value={detail.medal.held} of={detail.medal.next.days} label="Toward {nextLabel}" count={false} />
        <p class="t-body-small secondary">Don’t miss it twice in a row and {starsToGo === 1 ? 'the first star joins' : `${starsToGo} more stars join`} the ring.</p>
      </section>
    {/if}

    <section class="numbers">
      <Stat value={percent(detail.rate.rate)} caption="{detail.rate.done} of {detail.rate.due} due · last {detail.windowDays} days" />
      <Stat value={String(best)} caption="days, best run" />
    </section>

    <section class="weeks">
      <SectionLabel text="Last 12 weeks" />
      <div class="bars" role="img" aria-label="Done share by week, last 12 weeks">
        {#each weeks as w (w.from)}
          <span class="bar-col">{#if w.share === null}<span class="bar before"></span>{:else}<span class="bar" class:full={w.share >= 1} style:height="{Math.max(4, Math.round(w.share * 100))}%"></span>{/if}</span>
        {/each}
      </div>
      <p class="t-label-small tertiary">Outlined weeks are before you started. Full green: every due day done.</p>
    </section>

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
  .detail { display: flex; flex-direction: column; gap: var(--layout-block-gap); padding-bottom: var(--space-40); }
  .title { overflow-wrap: anywhere; }
  .head { display: flex; align-items: center; gap: var(--space-16); }
  .text { display: grid; gap: var(--space-4); min-width: 0; }
  .next { display: grid; gap: var(--space-8); }
  .line { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-8); }
  .numbers { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-16); }
  .weeks { display: grid; gap: var(--space-8); }
  .bars { display: flex; justify-content: space-between; align-items: flex-end; height: calc(var(--space-64) + var(--space-24)); }
  .bar-col { width: var(--space-20); height: 100%; display: flex; align-items: flex-end; }
  .bar { width: 100%; background: var(--heat-3); border-radius: var(--radius-chip) var(--radius-chip) 0 0; }
  .bar.full { background: var(--state-done); }
  .bar.before { height: 100%; background: none; border: var(--stroke-hairline) dashed var(--border-control); }
  .tertiary { color: var(--text-tertiary); }
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
