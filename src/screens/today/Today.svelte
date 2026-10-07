<script lang="ts">
  // 03 Today (Figma 65:3816), flow F4: the day's habits, check-off with Undo, skip with a reason,
  // and the habit sheet. H11 morning, H12 midday + Undo, H13 evening, H14 empty, H16 sheet, H17 skip.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import TabBar from '../../ui/TabBar.svelte';
  import type { Tab } from '../../ui/tabs';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import HabitRow from '../../ui/HabitRow.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import ProgressRing from '../../ui/ProgressRing.svelte';
  import EmptyState from '../../ui/EmptyState.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import StateIcon from '../../ui/StateIcon.svelte';
  import Button from '../../ui/Button.svelte';
  import Chip from '../../ui/Chip.svelte';
  import TimeWheel from '../../ui/TimeWheel.svelte';
  import Toast from '../../ui/Toast.svelte';
  import { SKIP_REASON_LABEL } from '../../ui/copy';
  import type { IconName } from '../../ui/icons';
  import { answer, answersFor, answersOn, habitEvents, moveOccurrence, restoreOverrides, toSource, undoAnswer, ReadOnlyAnswerError } from '../../data/answers';
  import { getSettings } from '../../data/settings';
  import { db } from '../../data/db';
  import { syncReminders } from '../../push/reminders';
  import { READY_TABS } from '../../ui/tabs';
  import Banner from '../../ui/Banner.svelte';
  import { shareBackup } from '../../data/backup';
  import { backupAge } from '../../domain/format';
  import type { Answer, CalendarEvent } from '../../data/schema';
  import { habitDayOf, localParts, type IsoDay } from '../../domain/day';
  import { fullDate, percent, shortName } from '../../domain/format';
  import { activeAdjustment, type Adjustment } from '../../domain/adjust';
  import { addMinutes, wallOf, type Wall } from '../../domain/zone';
  import { SKIP_REASONS, type AnswerStatus, type SkipReason } from '../../domain/states';
  import { greeting, runLine, showCloseTheDay, todayView, type TodayRow, type TodayView } from '../../domain/today';

  interface Props { onrecap?: () => void; onnewhabit?: () => void; onimport?: () => void; ontab?: (tab: Tab) => void }
  let { onrecap, onnewhabit, onimport, ontab }: Props = $props();

  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let now = $state(new Date());
  let events = $state<CalendarEvent[]>([]);
  let answers = $state<Answer[]>([]);
  let habitCalendarName = $state('');
  let trackingStart = $state<IsoDay | null>(null);
  let trial = $state<Adjustment | null>(null); // 080: the Kaizen adjustment being tried, if any
  let loaded = $state(false);
  let backupNote = $state('');
  async function backUpNow() {
    try { await shareBackup(); } catch { /* the banner stays */ }
    await load();
  }

  const habitDay = $derived(habitDayOf(now, zone));
  const hour = $derived(localParts(now, zone).hour);
  const view = $derived<TodayView>(todayView(events.map(toSource), answers, habitDay, now, zone));
  const dateLabel = $derived(new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${habitDay}T12:00:00Z`)));
  const allDone = $derived(view.answered.every((r) => r.state === 'done'));
  // 085 (P3): who today's next habit votes for; the first open habit that has an identity
  const voting = $derived((view.open.find((r) => r.identity) ?? view.answered.find((r) => r.identity))?.identity ?? '');
  const trialHabit = $derived(trial ? events.find((e) => e.id === trial!.habitId) : undefined);

  async function load() {
    now = new Date();
    const [evs, ans, settings, calendars] = await Promise.all([
      habitEvents(), answersOn(habitDayOf(now, zone)), getSettings(), (await db()).getAll('calendars'),
    ]);
    events = evs;
    answers = ans;
    trackingStart = settings.trackingStart as IsoDay | null;
    trial = activeAdjustment(settings.adjustments ?? []);
    // R7 (O7 open: 7 or 14 days): a nudge once the last backup is older than the setting, or there's none
    // and tracking has run that long. Everything since the last backup is lost if the app is removed (E2).
    const nudge = settings.backupNudgeDays;
    const since = settings.lastBackupAt ?? (trackingStart ? `${trackingStart}T00:00:00Z` : null);
    backupNote = since && Date.now() - Date.parse(since) >= nudge * 86_400_000
      ? `${settings.lastBackupAt ? `Last backup ${backupAge(settings.lastBackupAt, new Date(), '').toLowerCase()}` : 'No backup yet'}. If ATOMIC is removed, everything since is gone.`
      : '';
    habitCalendarName = calendars.find((c) => c.trackAsHabits)?.name ?? '';
    loaded = true;
    // 069: after every load (open, return to the app, answer, undo) the push function gets a fresh queue,
    // so a habit answered early sends no reminder. Offline or failing: the last queue stays.
    syncReminders().catch(() => {});
  }

  onMount(() => {
    load();
    const tick = setInterval(() => (now = new Date()), 30_000); // running state and Mark as done move with the clock
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', onVisible); };
  });

  // --- answering, with Undo (H12) ----------------------------------------------------------------
  let toast = $state<{ message: string; undo: () => Promise<void> } | null>(null);
  let problem = $state('');

  async function set(row: TodayRow, status: AnswerStatus, reason?: SkipReason, small = false) {
    problem = '';
    try {
      const before = await answer(row.eventId, row.occurrence, status, habitDay, reason, small);
      const name = shortName(row.title);
      toast = {
        message: status === 'done' ? `${name} ${small ? 'done, 2-min version' : 'done'}` : `${name} skipped`,
        undo: async () => { await undoAnswer(row.eventId, row.occurrence, before); await load(); },
      };
      await load();
    } catch (e) {
      problem = e instanceof ReadOnlyAnswerError ? e.message : 'Couldn’t save the answer. Try again.';
    }
  }

  // --- habit sheet (H16) and skip reasons (H17) ------------------------------------------------
  let sheetRow = $state<TodayRow | null>(null);
  let sheetLine = $state('');
  let skipRow = $state<TodayRow | null>(null);

  async function openSheet(row: TodayRow) {
    sheetRow = row;
    const event = events.find((e) => e.id === row.eventId);
    sheetLine = event && trackingStart ? runLine(toSource(event), await answersFor(row.eventId), trackingStart, habitDay) : '';
  }
  function askSkip(row: TodayRow) { sheetRow = null; skipRow = row; moveTo = defaultMove(); }
  async function smallFromSheet() {
    const row = sheetRow;
    sheetRow = null;
    if (row) await set(row, 'done', undefined, true); // 086
  }

  // --- plan B (P5, 087): move it to a later time today instead of skipping -------------------------------
  const pad = (n: number) => String(n).padStart(2, '0');
  const nowWall = $derived(wallOf(now, zone));
  /** The first sensible time: half an hour from now, on the next 5 minutes. Null when that runs past midnight. */
  function defaultMove(): string {
    const w = wallOf(new Date(now.getTime() + 30 * 60_000), zone);
    const m = Math.ceil(Number(w.slice(14, 16)) / 5) * 5;
    const base = m === 60 ? addMinutes(`${w.slice(0, 13)}:00` as Wall, 60) : (`${w.slice(0, 14)}${pad(m)}` as Wall);
    return base.slice(0, 10) === nowWall.slice(0, 10) ? base.slice(11, 16) : '';
  }
  let moveTo = $state('');
  const canMove = $derived(!!skipRow && !skipRow.allDay && skipRow.state !== 'done' && skipRow.start.slice(0, 10) === nowWall.slice(0, 10) && !!defaultMove());
  const moveHours = $derived(Array.from({ length: 24 - Number((defaultMove() || '23:00').slice(0, 2)) }, (_, i) => Number((defaultMove() || '23:00').slice(0, 2)) + i));
  const moveMinutes = Array.from({ length: 12 }, (_, i) => i * 5);
  const moveValid = $derived(!!moveTo && moveTo > nowWall.slice(11, 16));
  async function move() {
    const row = skipRow;
    skipRow = null;
    if (!row || !moveValid) return;
    const start = `${row.start.slice(0, 10)}T${moveTo}` as Wall;
    const before = await moveOccurrence(row.eventId, row.occurrence, start, addMinutes(start, row.minutes));
    toast = { message: `${shortName(row.title)} moved to ${moveTo}`, undo: async () => { await restoreOverrides(row.eventId, before); await load(); } };
    await load();
  }
  async function skip(reason?: SkipReason) {
    const row = skipRow;
    skipRow = null;
    if (row) await set(row, 'skipped', reason);
  }
  async function doneFromSheet() {
    const row = sheetRow;
    sheetRow = null;
    if (row) await set(row, 'done');
  }

  // --- labels ----------------------------------------------------------------------------------
  const clock = (wall: string) => wall.slice(11, 16);
  const meta = (r: TodayRow) => `${r.allDay ? 'All day' : `${clock(r.start)} · ${r.minutes} min`}${r.after ? ` · after ${r.after}` : ''}`; // P3: the cue
  function trailing(r: TodayRow): string | undefined {
    if (r.state === 'done' && r.answer) {
      if (r.answer.small) return '2-min';
      return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone }).format(new Date(r.answer.answeredAt));
    }
    if (r.state === 'skipped') return r.answer?.reason ? SKIP_REASON_LABEL[r.answer.reason as SkipReason] : 'Skipped';
    return undefined;
  }
  const icon = (r: TodayRow) => (r.icon ?? 'sprout') as IconName;
</script>

<div class="page">
  <main class="screen today">
    <TopBar eyebrow={dateLabel} title={greeting(hour)} />
    {#if backupNote}<Banner message={backupNote} action="Back up now" onaction={backUpNow} />{/if}

    {#if !loaded}
      <!-- first read from IndexedDB: a frame or two -->
    {:else if events.length === 0}
      <div class="spacer"></div>
      <!-- 079: the first action is a habit, not a calendar; New habit makes the HABITS calendar if there is none -->
      <EmptyState title="No habits yet" body="A habit is an event you answer every day."
        action={onnewhabit ? 'New habit' : undefined} onaction={onnewhabit}
        secondary={onimport ? 'Import from Proton (.ics)' : undefined} onsecondary={onimport} />
      <div class="spacer"></div>
    {:else}
      {#if onrecap && showCloseTheDay(hour) && view.open.length}
        <ListRow label="Close the day" value="{view.open.length} left" onclick={onrecap} />
      {/if}

      <div class="progress">
        <ProgressRing done={view.done} due={view.due} />
        <div class="numbers">
          <p class="t-number-large">{view.done} of {view.due}</p>
          <p class="t-label-small tertiary">{view.due} due today · {percent(view.due ? view.done / view.due : null)}</p>
          {#if voting}<p class="t-label-small tertiary">Voting for: {voting}</p>{/if}
        </div>
      </div>
      {#if trial && trialHabit}
        <!-- 080: the adjustment being tried stays in sight until its review -->
        <p class="t-body-small secondary trial">Trying until {fullDate(trial.reviewOn)} · {shortName(trialHabit.title)}: {trial.text}</p>
      {/if}

      {#if view.due === 0}
        <EmptyState title="Nothing due today" body="No habit repeats on this day." />
      {/if}

      {#if view.open.length}
        <SectionLabel text="Today’s goals" />
        <ul>
          {#each view.open as r (`${r.eventId}|${r.occurrence}`)}
            <li>
              <HabitRow name={r.title} meta={meta(r)} status={r.state} icon={icon(r)} showMarkDone={r.markDone}
                onopen={() => openSheet(r)} ondone={() => set(r, 'done')} onskip={() => askSkip(r)} />
            </li>
          {/each}
        </ul>
      {/if}

      {#if view.answered.length}
        <SectionLabel text={allDone ? 'Done' : 'Answered'} />
        <ul>
          {#each view.answered as r (`${r.eventId}|${r.occurrence}`)}
            <li>
              <HabitRow name={r.title} meta={meta(r)} status={r.state} icon={icon(r)} trailing={trailing(r)}
                onopen={() => openSheet(r)} ondone={() => set(r, 'done')} onskip={() => askSkip(r)} />
            </li>
          {/each}
        </ul>
      {/if}
      {#if problem}<p class="t-body-small problem" role="alert">{problem}</p>{/if}
    {/if}
  </main>

  {#if toast}
    <div class="toast-slot">
      <Toast message={toast.message} onaction={() => toast?.undo()} ondismiss={() => (toast = null)} />
    </div>
  {/if}
  <TabBar active="today" ready={READY_TABS} onselect={ontab} />
</div>

<Sheet open={sheetRow !== null} title={sheetRow?.title ?? ''} onclose={() => (sheetRow = null)}>
  {#if sheetRow}
    <div class="sheet">
      <div class="summary">
        <StateIcon status={sheetRow.state} icon={icon(sheetRow)} />
        <span>
          <span class="t-body-small secondary block">{sheetRow.allDay ? 'All day' : `${clock(sheetRow.start)}–${clock(sheetRow.end)}`}{habitCalendarName ? ` · ${habitCalendarName}` : ''}</span>
          {#if sheetLine}<span class="t-label-small tertiary block">{sheetLine}</span>{/if}
          {#if sheetRow.identity}<span class="t-label-small tertiary block">Voting for: {sheetRow.identity}</span>{/if}
        </span>
      </div>
      {#if sheetRow.state !== 'done'}<Button icon="check" onclick={doneFromSheet}>Done</Button>{/if}
      {#if sheetRow.smallest && sheetRow.state !== 'done'}
        <Button variant="secondary" onclick={smallFromSheet}>Did the 2-min version</Button>
        <p class="t-label-small tertiary">2-min version: {sheetRow.smallest}. It counts as done; Stats keeps it apart.</p>
      {/if}
      {#if sheetRow.state !== 'skipped'}<Button variant="secondary" onclick={() => askSkip(sheetRow!)}>Skip</Button>{/if}
    </div>
  {/if}
</Sheet>

<Sheet open={skipRow !== null} title="Why skip {shortName(skipRow?.title ?? '')}?" onclose={() => (skipRow = null)}>
  <div class="sheet">
    {#if canMove}
      <p class="t-body-small secondary">Plan B first: move it to later today. Scroll hours and minutes, then confirm.</p>
      <TimeWheel hours={moveHours} minutes={moveMinutes} value={moveTo || defaultMove()} onchange={(v) => (moveTo = v)} />
      <Button onclick={move} disabled={!moveValid}>Move to {moveTo || defaultMove()} today</Button>
      <p class="t-body-small secondary">Or skip. A reason is optional, and the skip counts as a miss.</p>
    {:else}
      <p class="t-body-small secondary">Optional. The skip counts either way.</p>
    {/if}
    <div class="chips">
      {#each SKIP_REASONS as reason (reason)}
        <Chip label={SKIP_REASON_LABEL[reason]} onclick={() => skip(reason)} />
      {/each}
    </div>
    <Button variant="tertiary" onclick={() => skip()}>Skip without a reason</Button>
  </div>
</Sheet>

<style>
  .page { min-height: 100dvh; display: flex; flex-direction: column; }
  .today {
    flex: 1; min-height: 0; display: flex; flex-direction: column; gap: var(--space-8);
    padding-bottom: var(--space-16);
  }
  .spacer { flex: 1; }
  .progress { display: flex; align-items: center; gap: var(--space-16); padding: var(--space-8) 0; }
  .numbers { display: grid; }
  .tertiary { color: var(--text-tertiary); }
  .secondary { color: var(--text-secondary); }
  .trial { padding-bottom: var(--space-8); }
  .block { display: block; }
  .problem { color: var(--text-accent); }
  .toast-slot {
    position: fixed; left: var(--layout-gutter); right: var(--layout-gutter); z-index: 1;
    bottom: calc(max(env(safe-area-inset-bottom), var(--space-12)) + var(--space-64) + var(--space-16)); /* above the tab bar (H12) */
  }
  .page :global(nav) { position: sticky; bottom: 0; }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-40); } /* the sheet already pads 8 on top and the gutter at the sides (Figma 46:2315) */
  .summary { display: flex; align-items: center; gap: var(--space-12); }
  .chips { display: flex; flex-wrap: wrap; column-gap: var(--space-8); }
</style>
