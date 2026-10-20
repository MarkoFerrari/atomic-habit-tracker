<script lang="ts">
  // D1 Habit detail (style B, Playground section 17, 129; was H4/H37): the habit's field with its object leads, then
  // This run and Rank side by side, the month week by week (the one Month calendar), the last milestone, and below
  // why it wasn't done and the actions. One left edge, cards on stone. The ring, the 12 week bars and the time
  // buckets of 113 left: the calendar shows the same thing bigger.
  // Kaizen (080): the trial in progress shows here. A pushed screen: no tab bar (044).
  // 107: the next-rank bar carries its milestone ticks, and the last milestone keeps its quote here.
  // 108: runs saved, counted with the recent comebacks named. 113: the best run stays, as a line under This run.
  // 117 (Playground 08): Pause habit, set ahead for 3 days to 2 weeks, with a reason; the 2-min version is offered first.
  // 112 (Playground 04): at the bottom, Archive habit and Delete this habit. Delete asks first: a habit with a rank is
  // offered Archive instead (A); one without gets a plain question (B). Either way the toast keeps Undo for 5 s.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import Button from '../../ui/Button.svelte';
  import { archiveHabit, getEvent } from '../../data/events';
  import { deleteHabit, pauseHabit, resumeHabit, type DeletedHabit } from '../../data/habits';
  import PickerRow from '../../ui/PickerRow.svelte';
  import Chip from '../../ui/Chip.svelte';
  import TextField from '../../ui/TextField.svelte';
  import { currentPause, lastPausedDay, PAUSE_LENGTHS, PAUSE_REASONS, PauseError, type PauseReason } from '../../domain/pause';
  import { addDays } from '../../domain/day';
  import { syncReminders } from '../../push/reminders';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import RankMedal from '../../ui/RankMedal.svelte';
  import { bestRun, nextRankLine } from '../../domain/award';
  import HabitObject from '../../ui/HabitObject.svelte';
  import MonthCalendar from '../../ui/MonthCalendar.svelte';
  import { habitMonthDays, monthCount } from '../../ui/calendar';
  import { fieldColor } from '../../ui/objects';
  import { monthName } from '../../domain/format';
  import { PAUSE_REASON_LABEL, SKIP_REASON_LABEL } from '../../ui/copy';
  import type { IconName } from '../../ui/icons';
  import { RANKS } from '../../domain/ranks';
  import { SKIP_REASONS } from '../../domain/states';
  import { parseRRule } from '../../domain/recurrence';
  import { fullDate, percent, plural, repeatLabel, timesAWeek } from '../../domain/format';
  import { habitDetail, monthView, WHY_NONE, type HabitDetail } from '../../domain/stats';
  import type { IsoDay } from '../../domain/day';
  import { activeAdjustment } from '../../domain/adjust';
  import { loadStats, type StatsData } from '../../data/stats';
  import { getSettings } from '../../data/settings';
  import { lastMilestone } from '../../data/moments';
  import { runsSaved } from '../../domain/moments';
  import type { QuoteState } from '../../domain/quotes';
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
  const schedule = $derived(habit ? `${habit.perWeek ? timesAWeek(habit.perWeek) : repeatLabel(habit.rrule ? parseRRule(habit.rrule) : null, habit.start.slice(0, 10) as IsoDay)} · ${detail?.slot}` : '');
  // bestRun counts answered days; the current run also counts today (060), so the run in progress can be the best.
  const best = $derived(data && habit ? Math.max(bestRun(data.ctx, habit), detail?.medal.held ?? 0) : 0);
  const rankSub = $derived(detail ? (detail.medal.rank ? `Since day ${RANKS.find((r) => r.id === detail.medal.rank)!.days}` : `Apprentice at day ${RANKS[0]!.days}`) : '');
  const month = $derived(data && habit ? monthView({ ...data.ctx, habits: [habit] }, data.ctx.today) : null);
  const milestone = $derived(lastMilestone(quotes, eventId));
  const saved = $derived(data && habit ? runsSaved(data.ctx, habit) : null);
  const answerCount = $derived(data ? data.ctx.answers.filter((a) => a.eventId === eventId).length : 0);
  const archived = $derived(!!habit?.archivedOn && !!data && habit.archivedOn <= data.ctx.today);

  let sheet = $state<'delete' | 'archive' | 'pause' | null>(null);
  // --- 117: pause ---------------------------------------------------------------------------------------------
  let reload = $state(0);
  $effect(() => { if (reload) loadStats().then((d) => (data = d)); });
  const pause = $derived(habit && data ? currentPause(habit.pauses, data.ctx.today) : null);
  const pauseLast = $derived(pause ? lastPausedDay(pause) : null);
  let pFrom = $state<IsoDay | ''>('');
  let pDays = $state<number>(7);
  let pReason = $state<PauseReason | null>(null);
  let pNote = $state('');
  let pProblem = $state('');
  const pStart = $derived((pFrom || data?.ctx.today || '') as IsoDay);
  const pUntil = $derived(pStart ? addDays(pStart, pDays - 1) : ('' as IsoDay));
  const lengthLabel = (n: number) => (n === 3 ? '3 days' : n === 7 ? '1 week' : '2 weeks');
  function openPause() { pFrom = ''; pDays = 7; pReason = null; pNote = ''; pProblem = ''; sheet = 'pause'; }
  async function savePause() {
    if (!data || !pReason) return;
    busy = true; pProblem = '';
    try {
      await pauseHabit(eventId, { from: pStart, until: pUntil, reason: pReason, ...(pReason === 'other' ? { note: pNote } : {}) }, data.ctx.today);
      sheet = null; syncReminders().catch(() => {}); reload++;
    } catch (e) { pProblem = e instanceof PauseError ? e.message : 'Couldn’t pause it. Try again.'; }
    finally { busy = false; }
  }
  async function bringBack() {
    if (!data) return;
    await resumeHabit(eventId, data.ctx.today);
    syncReminders().catch(() => {}); reload++;
  }
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
    <section class="hero" style:--field={fieldColor(habit.icon ?? 'sprout')}>
      <HabitObject icon={(habit.icon ?? 'sprout') as IconName} size="lg" />
      <div class="text">
        <h1 class="t-heading-small title">{habit.title}</h1>
        <p class="t-body-small secondary">{schedule}</p>
      </div>
    </section>

    <div class="pair">
      <section class="card stat" aria-label="This run">
        <h2 class="t-label-section secondary">This run</h2>
        <p class="t-number-large">{plural(detail.medal.held, 'day')}</p>
        <p class="t-body-small secondary">{detail.medal.next ? nextRankLine(detail.medal) : 'Mastered, still counting'}{best > detail.medal.held ? ` · best ${best}` : ''}</p>
      </section>
      <section class="card stat" aria-label="Rank">
        <h2 class="t-label-section secondary">Rank</h2>
        <div class="rank">
          <RankMedal rank={detail.medal.rank} icon={(habit.icon ?? 'sprout') as IconName} size="tiny" />
          <div class="text">
            <p class="t-body-strong">{rankLabel}</p>
            <p class="t-body-small secondary">{rankSub}</p>
          </div>
        </div>
      </section>
    </div>

    {#if month}
      <MonthCalendar title="{monthName(month.first)} {month.first.slice(0, 4)}" count={monthCount(month)} leading={month.leading} days={habitMonthDays(month)} showPartial={false} />
    {/if}

    {#if milestone}
      <section class="card note" aria-label="Last milestone">
        <h2 class="t-label-section secondary">Milestone · day {milestone.day}</h2>
        <p class="t-body-default">“{milestone.quote.text}” <span class="secondary">{milestone.quote.source}</span></p>
      </section>
    {/if}

    {#if mine}
      <section class="card note">
        <h2 class="t-label-section secondary">Trying until {fullDate(mine.reviewOn)}</h2>
        <p class="t-body-default">{mine.text}</p>
      </section>
    {/if}

    {#if (saved && saved.total > 0) || smallCount > 0}
      <section class="card note">
        {#if saved && saved.total > 0}
          <h2 class="t-label-section secondary">Runs saved · {saved.total}</h2>
          <p class="t-body-small">{saved.recent.map((r) => `Missed ${dayAndNumber(r.missedOn)}, back ${dayAndNumber(r.backOn)}.`).join(' ')} Each one: done right after a miss.</p>
        {/if}
        {#if smallCount > 0}<p class="t-body-small secondary">Done {doneCount}: {doneCount - smallCount} in full, {smallCount} as the 2-min version.</p>{/if}
      </section>
    {/if}

    {#if detail.whyTotal > 0}
      <section class="card why-card">
        <h2 class="t-label-section secondary">Why it wasn’t done · {detail.whyTotal}</h2>
        <ul class="why">
          {#each rows.filter((r) => r.n > 0) as r (r.key)}
            <li><span class="t-body-default">{r.label}</span><span class="t-number-default">{r.n}</span></li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="actions">
      <div class="card-list">
        {#if !archived && pause && pauseLast}
          <ListRow label={pause.from > data!.ctx.today ? 'Cancel the pause' : 'Bring it back today'} value="Paused until {fullDate(pauseLast)}" onclick={bringBack} />
        {:else if !archived}
          <ListRow label="Pause habit" onclick={openPause} />
        {/if}
        {#if !archived}<ListRow label="Archive habit" onclick={() => (sheet = 'archive')} />{/if}
        <ListRow type="destructive" label="Delete this habit" onclick={() => (sheet = 'delete')} />
      </div>
      {#if !archived && pause}<p class="t-label-small secondary">Paused · {PAUSE_REASON_LABEL[pause.reason]}{pause.note ? `: ${pause.note}` : ''}</p>{/if}
      <p class="t-label-small secondary">{archived ? 'Delete removes its history and medal from this phone.' : 'Archive keeps its history and medal. Delete removes them from this phone.'}</p>
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
  <Sheet open={sheet === 'pause'} title="Pause “{habit.title}”" onclose={() => (sheet = null)}>
    <div class="sheet">
      {#if habit.smallest}
        <p class="t-body-small travel">Can it travel? The 2-min version ({habit.smallest}) counts as done and keeps the run going without a pause.</p>
      {/if}
      <div>
        <PickerRow label="Starts" type="date" value={pStart === data?.ctx.today ? 'Today' : fullDate(pStart)} input={pStart} min={data?.ctx.today} onchange={(v) => v && (pFrom = v as IsoDay)} />
        <div class="chips" role="group" aria-label="How long">
          {#each PAUSE_LENGTHS as n (n)}<Chip label={lengthLabel(n)} selected={pDays === n} onclick={() => (pDays = n)} />{/each}
        </div>
      </div>
      <div>
        <SectionLabel text="Why" />
        <div class="chips" role="group" aria-label="Why">
          {#each PAUSE_REASONS as r (r)}<Chip label={PAUSE_REASON_LABEL[r]} selected={pReason === r} onclick={() => (pReason = r)} />{/each}
        </div>
        {#if pReason === 'other'}<TextField bind:value={pNote} label="In a few words" placeholder="Moving house" autocapitalize="sentences" />{/if}
      </div>
      <p class="t-body-small secondary">Until {fullDate(pUntil)}. Paused days don’t count: nothing is due, nothing is missed. {detail.medal.held > 0 ? `Your ${plural(detail.medal.held, 'day')} run waits and carries on after.` : 'Nothing is lost.'} No nudges until then.</p>
      <p class="t-label-small tertiary">Only ahead, so a pause can’t erase a miss. Two weeks at most; for longer, Archive keeps everything.</p>
      {#if pProblem}<p class="t-body-small problem" role="alert">{pProblem}</p>{/if}
      <Button disabled={busy || !pReason} onclick={savePause}>{pReason ? `Pause until ${fullDate(pUntil)}` : 'Choose why first'}</Button>
      <Button variant="tertiary" disabled={busy} onclick={() => (sheet = null)}>Cancel</Button>
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
  .detail { display: flex; flex-direction: column; gap: var(--space-12); padding-bottom: var(--space-40); }
  .title { overflow-wrap: anywhere; }
  .hero { display: flex; align-items: center; gap: var(--space-16); padding: var(--space-16); background: var(--field); border-radius: var(--radius-card); }
  .text { display: grid; gap: var(--space-4); min-width: 0; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-12); }
  .stat { display: grid; align-content: start; gap: var(--space-8); }
  .rank { display: flex; align-items: center; gap: var(--space-12); }
  .note { display: grid; gap: var(--space-8); }
  .why-card { display: grid; gap: var(--space-4); }
  .why li { display: flex; justify-content: space-between; align-items: center; min-height: var(--size-control); border-bottom: var(--stroke-hairline) solid var(--border-divider); }
  .why li:last-child { border-bottom: none; }
  .actions { display: grid; gap: var(--space-8); padding-top: var(--space-12); }
  .chips { display: flex; flex-wrap: wrap; column-gap: var(--space-8); }
  .travel { padding: var(--space-12) var(--space-16); background: var(--bg-app); border-radius: var(--radius-tile); color: var(--text-primary); }
  .problem { color: var(--text-destructive); }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-40); }
  .tertiary { color: var(--text-tertiary); }
  .secondary { color: var(--text-secondary); }
</style>
