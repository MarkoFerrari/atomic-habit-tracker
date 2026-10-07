<script lang="ts">
  // 04 Evening Recap (Figma 65:3820), flow F5: answer what's still open (H18 all at once, H19 one by
  // one), see the day result (H20) or the perfect day (H21), then tomorrow (H23). After midnight it
  // closes yesterday by name (H24); a day with nothing open goes straight to the result (H25).
  // New ranks (H22, H22b) arrive with M5: ranks are recomputable from answers, so none are lost.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import SegmentedControl from '../../ui/SegmentedControl.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import HabitRow from '../../ui/HabitRow.svelte';
  import StateIcon from '../../ui/StateIcon.svelte';
  import ProgressRing from '../../ui/ProgressRing.svelte';
  import Button from '../../ui/Button.svelte';
  import Banner from '../../ui/Banner.svelte';
  import Chip from '../../ui/Chip.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { SKIP_REASON_LABEL } from '../../ui/copy';
  import type { IconName } from '../../ui/icons';
  import { answer, answersOn, habitEvents, toSource } from '../../data/answers';
  import { db } from '../../data/db';
  import type { Answer, CalendarEvent } from '../../data/schema';
  import { addDays } from '../../domain/day';
  import { percent, shortName } from '../../domain/format';
  import { isPerfectDay } from '../../domain/rates';
  import { bulkDoneLabel, recapFor, resultSentence } from '../../domain/recap';
  import { SKIP_REASONS, type AnswerStatus, type SkipReason } from '../../domain/states';
  import { occurrencesOn, todayView, type TodayRow } from '../../domain/today';

  let { onclose }: { onclose: () => void } = $props();

  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const opened = new Date();
  const recap = recapFor(opened, zone);

  let events = $state<CalendarEvent[]>([]);
  let answers = $state<Answer[]>([]);
  let calendarName = $state('');
  let loaded = $state(false);
  type Step = 'answer' | 'result' | 'tomorrow';
  let step = $state<Step>('answer');
  let mode = $state<'all' | 'one'>('all'); // 032: all at once by default
  let closedOnArrival = $state(false);
  let startOpen = $state(0);
  let problem = $state('');

  const sources = $derived(events.map(toSource));
  const view = $derived(todayView(sources, answers, recap.day, new Date(), zone));
  const allRows = $derived([...view.open, ...view.answered].sort((a, b) => a.start.localeCompare(b.start)));
  const perfect = $derived(isPerfectDay(allRows.map((r) => r.state)));
  const tomorrow = $derived(occurrencesOn(sources, addDays(recap.day, 1)));

  const fullDate = (d: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const weekdayShort = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${recap.day}T12:00:00Z`));
  const clockNow = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone }).format(opened);
  const eyebrow = recap.afterMidnight ? `Opened at ${clockNow}` : `${fullDate(recap.day)} · ${clockNow}`;

  async function load() {
    const [evs, ans, calendars] = await Promise.all([habitEvents(), answersOn(recap.day), (await db()).getAll('calendars')]);
    events = evs;
    answers = ans;
    calendarName = calendars.find((c) => c.trackAsHabits)?.name ?? '';
  }

  onMount(async () => {
    await load();
    loaded = true;
    startOpen = view.open.length;
    if (startOpen === 0) { closedOnArrival = true; step = 'result'; }
  });

  async function set(row: TodayRow, status: AnswerStatus, reason?: SkipReason) {
    problem = '';
    try {
      await answer(row.eventId, row.occurrence, status, recap.day, reason);
      await load();
      if (view.open.length === 0) step = 'result';
    } catch {
      problem = 'Couldn’t save the answer. Try again.';
    }
  }
  async function markAllDone() {
    for (const r of [...view.open]) await answer(r.eventId, r.occurrence, 'done', recap.day);
    await load();
    step = 'result';
  }

  // Skip with a reason: a sheet in "all at once" (as on Today, H17); in place in "one by one" (H19).
  let skipRow = $state<TodayRow | null>(null);
  let askingReason = $state(false);
  async function skipWith(reason?: SkipReason) {
    const row = mode === 'one' ? view.open[0] : skipRow;
    skipRow = null;
    askingReason = false;
    if (row) await set(row, 'skipped', reason);
  }

  const clock = (w: string) => w.slice(11, 16);
  const openMeta = (r: TodayRow) => `${recap.afterMidnight ? `${weekdayShort} · ` : ''}${r.allDay ? 'All day' : `${clock(r.start)} · ${r.minutes} min`}`;
  const answeredMeta = (r: TodayRow) => (r.allDay ? 'All day' : clock(r.start));
  const icon = (r: { icon?: string }) => (r.icon ?? 'sprout') as IconName;
  function trailing(r: TodayRow): string | undefined {
    if (r.state === 'done' && r.answer) {
      return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone }).format(new Date(r.answer.answeredAt));
    }
    if (r.state === 'skipped') return r.answer?.reason ? SKIP_REASON_LABEL[r.answer.reason as SkipReason] : 'Skipped';
    if (r.state === 'missed') return 'Missed';
    return undefined;
  }
  const close = { icon: 'close' as const, label: 'Close' };
</script>

<main class="screen recap">
  {#if !loaded}
    <!-- reading the day from the phone -->
  {:else if step === 'answer'}
    {@const current = view.open[0]}
    <TopBar eyebrow={mode === 'one' ? `${startOpen - view.open.length + 1} of ${startOpen}` : eyebrow} title={recap.title} action={close} onaction={onclose} />
    {#if recap.afterMidnight}
      <Banner tone="info" message="It’s past midnight. {fullDate(recap.day).split(' ')[0]} stays open until 04:00." />
    {/if}
    {#if startOpen > 1}
      <SegmentedControl label="How to answer" selected={mode} onselect={(m) => { mode = m; askingReason = false; }}
        options={[{ id: 'all', label: 'All at once' }, { id: 'one', label: 'One by one' }]} />
    {/if}

    {#if mode === 'all'}
      <SectionLabel text="Open · {view.open.length}" />
      {#each view.open as r (`${r.eventId}|${r.occurrence}`)}
        <HabitRow name={r.title} meta={openMeta(r)} status={r.state} icon={icon(r)} swipeable={false} />
        <div class="answer">
          <Button variant="secondary" onclick={() => (skipRow = r)}>Skip</Button>
          <Button icon="check" onclick={() => set(r, 'done')}>Done</Button>
        </div>
      {/each}
      {#if view.answered.length}
        <SectionLabel text="Answered · {view.answered.length}" />
        {#each view.answered as r (`${r.eventId}|${r.occurrence}`)}
          <HabitRow name={r.title} meta={answeredMeta(r)} status={r.state} icon={icon(r)} trailing={trailing(r)} swipeable={false} />
        {/each}
      {/if}
      {#if problem}<p class="t-body-small problem" role="alert">{problem}</p>{/if}
      <div class="spacer"></div>
      {#if view.open.length}<Button variant="tertiary" onclick={markAllDone}>{bulkDoneLabel(view.open.length)}</Button>{/if}
    {:else if current}
      <div class="bars" aria-hidden="true">
        {#each Array.from({ length: startOpen }, (_, i) => i) as i (i)}<span class:filled={i <= startOpen - view.open.length}></span>{/each}
      </div>
      <div class="spacer"></div>
      <div class="big"><StateIcon status={current.state} icon={icon(current)} /></div>
      <h2 class="t-heading-large">{current.title}</h2>
      <p class="t-body-small tertiary">{openMeta(current)}{calendarName ? ` · ${calendarName}` : ''}</p>
      {#if askingReason}
        <SectionLabel text="Why skipped? Optional" />
        <div class="chips">
          {#each SKIP_REASONS as reason (reason)}<Chip label={SKIP_REASON_LABEL[reason]} onclick={() => skipWith(reason)} />{/each}
        </div>
      {/if}
      {#if problem}<p class="t-body-small problem" role="alert">{problem}</p>{/if}
      <div class="spacer"></div>
      <Button icon="check" onclick={() => set(current, 'done')}>Done</Button>
      {#if askingReason}
        <Button variant="secondary" onclick={() => skipWith()}>Skip without a reason</Button>
      {:else}
        <Button variant="secondary" onclick={() => (askingReason = true)}>Skip</Button>
      {/if}
    {/if}

  {:else if step === 'result'}
    <TopBar eyebrow={fullDate(recap.day)} title="Day result" action={close} onaction={onclose} />
    <div class="ring">
      <ProgressRing done={view.done} due={view.due} size="large" perfect={perfect}>
        <p class="t-number-large">{view.done} of {view.due}</p>
        <p class="t-label-small tertiary">{percent(view.due ? view.done / view.due : null)} · {view.due} due</p>
      </ProgressRing>
      {#if perfect}
        <span class="spark one" aria-hidden="true"><Icon name="spark" /></span>
        <span class="spark two" aria-hidden="true"><Icon name="spark" /></span>
        <span class="spark three" aria-hidden="true"><Icon name="spark" /></span>
      {/if}
    </div>
    {#if perfect}
      <h2 class="t-heading-large">Perfect day</h2>
      <p class="t-body-default secondary">Every habit done.</p>
    {:else if closedOnArrival}
      <p class="t-body-default secondary">Every habit has an answer. Change one from Today until 04:00.</p>
    {:else}
      <p class="t-body-default secondary">{resultSentence(allRows.map((r) => ({ title: r.title, state: r.state, reason: r.answer?.reason ? SKIP_REASON_LABEL[r.answer.reason as SkipReason] : undefined })), shortName)}</p>
      {#each allRows as r (`${r.eventId}|${r.occurrence}`)}
        <HabitRow name={r.title} meta={answeredMeta(r)} status={r.state} icon={icon(r)} trailing={trailing(r)} swipeable={false} />
      {/each}
    {/if}
    <div class="spacer"></div>
    <Button onclick={() => (step = 'tomorrow')}>See tomorrow</Button>

  {:else}
    <TopBar eyebrow={fullDate(addDays(recap.day, 1))} title="Tomorrow" action={close} onaction={onclose} />
    {#if tomorrow.length}
      <SectionLabel text="Habits · {tomorrow.length}" />
      {#each tomorrow as o (`${o.eventId}|${o.occurrence}`)}
        <HabitRow name={o.title} meta={o.allDay ? 'All day' : `${clock(o.start)} · ${o.minutes} min`} status="open" icon={icon(o)} swipeable={false} />
      {/each}
    {:else}
      <p class="t-body-default secondary">No habits tomorrow.</p>
    {/if}
    <div class="spacer"></div>
    <Button onclick={onclose}>Done for today</Button>
  {/if}
</main>

<Sheet open={skipRow !== null} title="Why skip {shortName(skipRow?.title ?? '')}?" onclose={() => (skipRow = null)}>
  <div class="sheet">
    <p class="t-body-small secondary">Optional. The skip counts either way.</p>
    <div class="chips">
      {#each SKIP_REASONS as reason (reason)}<Chip label={SKIP_REASON_LABEL[reason]} onclick={() => skipWith(reason)} />{/each}
    </div>
    <Button variant="tertiary" onclick={() => skipWith()}>Skip without a reason</Button>
  </div>
</Sheet>

<style>
  .recap { display: flex; flex-direction: column; gap: var(--space-8); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .spacer { flex: 1; }
  .answer { display: flex; gap: var(--space-8); padding-bottom: var(--space-8); }
  .answer :global(.btn) { flex: 1; }
  .tertiary { color: var(--text-tertiary); }
  .secondary { color: var(--text-secondary); }
  .problem { color: var(--text-accent); }
  .bars { display: flex; gap: var(--space-4); }
  .bars span { flex: 1; height: var(--space-4); border-radius: var(--radius-round); background: var(--border-divider); }
  .bars span.filled { background: var(--icon-default); }
  .big { align-self: flex-start; transform: scale(1.6); transform-origin: left center; margin: var(--space-12) 0; }
  .chips { display: flex; flex-wrap: wrap; column-gap: var(--space-8); }
  .ring { position: relative; display: flex; justify-content: center; padding: var(--space-16) 0; }
  .spark { position: absolute; color: var(--celebrate-spark); animation: spark var(--motion-duration-celebrate) var(--motion-easing-spring) both; }
  .spark.one { top: var(--space-8); left: calc(50% + var(--space-64)); }
  .spark.two { bottom: var(--space-16); left: calc(50% - var(--space-64) - var(--space-12)); }
  .spark.three { bottom: var(--space-8); left: calc(50% + var(--space-64) + var(--space-8)); }
  @keyframes spark { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-40); } /* the sheet already pads 8 on top and the gutter at the sides (Figma 46:2315) */
</style>
