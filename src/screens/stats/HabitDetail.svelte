<script lang="ts">
  // H4 Habit detail (Figma page 14, section 04; was H37): the star medal leads, then the next rank in plain numbers,
  // done of due, the best run and twelve weeks of bars. Below: why it wasn't done (C4) and when it gets done.
  // Kaizen (080): the trial in progress shows here. A pushed screen: no tab bar (044).
  // 107: the next-rank bar carries its milestone ticks, and the last milestone keeps its quote here.
  // 108: runs saved, the current run drawn occurrence by occurrence with a mark on each comeback.
  // 113 (Playground 05, V2): done of due is a ring, the current run and the best run two bars beside it.
  // 112 (Playground 04): at the bottom, Archive habit and Delete this habit. Delete asks first: a habit with a rank is
  // offered Archive instead (A); one without gets a plain question (B). Either way the toast keeps Undo for 5 s.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import ProgressRing from '../../ui/ProgressRing.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import Button from '../../ui/Button.svelte';
  import { archiveHabit, getEvent } from '../../data/events';
  import { deleteHabit, type DeletedHabit } from '../../data/habits';
  import { syncReminders } from '../../push/reminders';
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
  import { getSettings } from '../../data/settings';
  import { lastMilestone } from '../../data/moments';
  import { milestoneDays, runsSaved } from '../../domain/moments';
  import type { QuoteState } from '../../domain/quotes';
  import Icon from '../../ui/Icon.svelte';
  import { dayAndNumber } from '../../domain/format';

  interface Props {
    eventId: string; backLabel?: string; onback: () => void; onedit?: (eventId: string) => void;
    /** 112: the habit is gone; the owner shows the Undo toast and leaves this screen. */
    ondeleted?: (d: DeletedHabit) => void;
  }
  let { eventId, backLabel = 'Stats', onback, onedit, ondeleted }: Props = $props();

  let data = $state.raw<StatsData | null>(null);
  let quotes = $state.raw<QuoteState | undefined>(undefined);
  onMount(async () => { const [d, settings] = await Promise.all([loadStats(), getSettings()]); quotes = settings.quotes; data = d; });

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
  // bestRun counts answered days; the current run also counts today (060), so the run in progress can be the best.
  const best = $derived(data && habit ? Math.max(bestRun(data.ctx, habit), detail?.medal.held ?? 0) : 0);
  const nextLabel = $derived(detail?.medal.next ? RANKS.find((r) => r.id === detail.medal.next!.rank)!.label : '');
  const starsToGo = $derived(detail?.medal.next ? ({ starter: 1, builder: 2, keeper: 3, artisan: 3, master: 3 } as const)[detail.medal.next.rank] : 0);
  const ticks = $derived(detail?.medal.next ? milestoneDays(detail.medal.next.rank) : []);
  const milestone = $derived(lastMilestone(quotes, eventId));
  const saved = $derived(data && habit ? runsSaved(data.ctx, habit) : null);
  const maxTime = $derived(Math.max(1, ...(detail?.times ?? []).map((t) => t.count)));
  const runMax = $derived(Math.max(1, best, detail?.medal.held ?? 0));
  const answerCount = $derived(data ? data.ctx.answers.filter((a) => a.eventId === eventId).length : 0);
  const archived = $derived(!!habit?.archivedOn && !!data && habit.archivedOn <= data.ctx.today);

  let sheet = $state<'delete' | 'archive' | null>(null);
  let busy = $state(false);
  async function remove() {
    const event = await getEvent(eventId);
    if (!event || !data) return;
    busy = true;
    try { const d = await deleteHabit(event, data.ctx.today); sheet = null; syncReminders().catch(() => {}); ondeleted?.(d); }
    finally { busy = false; }
  }
  async function archive() {
    const event = await getEvent(eventId);
    if (!event || !data) return;
    busy = true;
    try { await archiveHabit(event, data.ctx.today); sheet = null; syncReminders().catch(() => {}); onback(); }
    finally { busy = false; }
  }
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
        <ProgressBar value={detail.medal.held} of={detail.medal.next.days} label="Toward {nextLabel}" count={false} {ticks} />
        <p class="t-body-small secondary">Don’t miss it twice in a row and {starsToGo === 1 ? 'the first star joins' : `${starsToGo} more stars join`} the ring.</p>
      </section>
    {/if}

    {#if milestone}
      <section class="milestone" aria-label="Last milestone">
        <SectionLabel text="Last milestone · day {milestone.day}" />
        <figure>
          <blockquote class="t-heading-small">“{milestone.quote.text}”</blockquote>
          <figcaption class="t-label-small tertiary">{milestone.quote.source}</figcaption>
        </figure>
      </section>
    {/if}

    <section class="numbers">
      <div role="img" aria-label={detail.rate.due ? `${detail.rate.done} of ${detail.rate.due} due done, ${percent(detail.rate.rate)}, last ${plural(detail.windowDays, 'day')}` : 'Nothing due yet'}>
        <ProgressRing done={detail.rate.done} due={detail.rate.due} size="large">
          <p class="t-number-large">{detail.rate.done}/{detail.rate.due}</p>
          <p class="t-label-small tertiary">{detail.rate.due ? `${percent(detail.rate.rate)} · last ${plural(detail.windowDays, 'day')}` : 'Nothing due yet'}</p>
        </ProgressRing>
      </div>
      <div class="runs" role="img" aria-label="This run {plural(detail.medal.held, 'day')}, best run {plural(best, 'day')}">
        {#each [{ label: 'This run', n: detail.medal.held, best: false }, { label: 'Best run', n: best, best: true }] as r (r.label)}
          <div class="run-bar">
            <p class="line"><span class="t-body-small secondary">{r.label}</span><span class="t-number-default">{r.n}</span></p>
            <span class="track">{#if r.n > 0}<span class="bar" class:best={r.best} style:width="{Math.round((r.n / runMax) * 100)}%"></span>{/if}</span>
          </div>
        {/each}
      </div>
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

    {#if saved && saved.total > 0}
      <section class="saved">
        <SectionLabel text="Runs saved · {saved.total}" />
        {#if saved.cells.length}
          <div class="run" role="img" aria-label="Current run: {saved.cells.length} due days, {saved.cells.filter((c) => c.comeback).length} saved after a miss">
            {#each saved.cells as c (c.day)}
              <span class="run-cell {c.status}">{#if c.comeback}<span class="mark"><Icon name="refresh" size="small" /></span>{/if}</span>
            {/each}
          </div>
        {/if}
        <p class="t-body-small secondary">{saved.recent.map((r) => `Missed ${dayAndNumber(r.missedOn)}, back ${dayAndNumber(r.backOn)}.`).join(' ')} Each mark is a run saved: done right after a miss.</p>
      </section>
    {/if}

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

    <section class="actions">
      <div>
        {#if !archived}<ListRow label="Archive habit" onclick={() => (sheet = 'archive')} />{/if}
        <ListRow type="destructive" label="Delete this habit" onclick={() => (sheet = 'delete')} />
      </div>
      <p class="t-label-small tertiary">{archived ? 'Delete removes its history and medal from this phone.' : 'Archive keeps its history and medal. Delete removes them from this phone.'}</p>
    </section>
  {:else if data}
    <p class="t-body-default secondary">This habit isn’t in the calendar any more.</p>
  {/if}
</main>

{#if habit && detail}
  <Sheet open={sheet === 'delete'} title="Delete “{habit.title}”?" onclose={() => (sheet = null)}>
    <div class="sheet">
      {#if detail.medal.rank && !archived}
        <p class="t-body-default secondary">This removes its {plural(answerCount, 'answer')}{detail.medal.held > 0 ? `, its run of ${plural(detail.medal.held, 'day')}` : ''} and its {rankLabel} medal from this phone. It can’t be undone.</p>
        <p class="t-label-small tertiary">Archive stops reminders from today and keeps everything (E9).</p>
        <Button disabled={busy} onclick={archive}>Archive instead</Button>
        <Button variant="secondary" disabled={busy} onclick={remove}>Delete habit</Button>
      {:else}
        <p class="t-body-default secondary">{answerCount ? `Its ${plural(answerCount, 'answer')}${detail.medal.rank ? ` and its ${rankLabel} medal` : ''} go too.` : 'Nothing has been answered yet.'}</p>
        <Button variant="secondary" disabled={busy} onclick={remove}>Delete habit</Button>
        <Button variant="tertiary" disabled={busy} onclick={() => (sheet = null)}>Cancel</Button>
      {/if}
    </div>
  </Sheet>
  <Sheet open={sheet === 'archive'} title="Archive “{habit.title}”?" onclose={() => (sheet = null)}>
    <div class="sheet">
      <p class="t-body-default secondary">It stops counting and reminding from today. Its history and medal stay, and Settings → Habits can bring it back.</p>
      <Button disabled={busy} onclick={archive}>Archive habit</Button>
      <Button variant="tertiary" disabled={busy} onclick={() => (sheet = null)}>Cancel</Button>
    </div>
  </Sheet>
{/if}

<style>
  .detail { display: flex; flex-direction: column; gap: var(--layout-block-gap); padding-bottom: var(--space-40); }
  .title { overflow-wrap: anywhere; }
  .head { display: flex; align-items: center; gap: var(--space-16); }
  .text { display: grid; gap: var(--space-4); min-width: 0; }
  .next { display: grid; gap: var(--space-8); }
  .line { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-8); }
  .milestone figure { display: grid; gap: var(--space-4); margin: 0; }
  .milestone blockquote { margin: 0; }
  .saved { display: grid; gap: var(--space-8); }
  .run { display: flex; gap: var(--space-4); align-items: center; height: var(--space-16); }
  .run-cell { position: relative; flex: 1; max-width: var(--space-16); height: var(--space-8); border-radius: var(--radius-control-inner); background: var(--state-done); }
  .run-cell.missed, .run-cell.skipped { background: none; border: var(--stroke-hairline) solid var(--border-control); }
  .mark { position: absolute; left: 50%; top: 50%; translate: -50% -50%; width: var(--space-16); height: var(--space-16); display: grid; place-items: center;
    border-radius: var(--radius-round); background: var(--state-done); color: var(--icon-inverse); outline: var(--stroke-illustration) solid var(--bg-default); }
  .mark :global(svg) { width: var(--space-12); height: var(--space-12); }
  .numbers { display: flex; align-items: center; gap: var(--space-16); }
  .runs { flex: 1; min-width: 0; display: grid; gap: var(--space-16); }
  .run-bar { display: grid; gap: var(--space-4); }
  .run-bar .bar.best { background: var(--border-control); } /* the best run: a reference, not an achievement colour (008) */
  .actions { display: grid; gap: var(--space-8); }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-40); }
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
