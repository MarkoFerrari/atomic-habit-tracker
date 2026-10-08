<script lang="ts">
  // 01 Start (Figma page 14, habits first, 097): Welcome (S1) → Reminders (S2, H05 when off) → Your habit (S3) →
  // When (S4) → Today. No account and no import on the way in; the stepper (095) shows where you are, every block
  // sits 40 apart (092). The .ics import keeps its own flow (`from="bring"`), opened from Settings → Calendars:
  // bring your calendars (H06) → files read (H07, or H07b) → review (H08) → habits found (H09) → your data (H10).
  // The import is a plan until H09's Continue: nothing is saved before the person has reviewed it.
  import { untrack } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import Button from '../../ui/Button.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import StepRow from '../../ui/StepRow.svelte';
  import Stepper from '../../ui/Stepper.svelte';
  import BackLink from '../../ui/BackLink.svelte';
  import AwardStar from '../../ui/AwardStar.svelte';
  import HabitWhat from '../habits/HabitWhat.svelte';
  import HabitWhen from '../habits/HabitWhen.svelte';
  import { blankHabit, canSave, createHabit, type HabitDraft } from '../../data/newHabit';
  import { syncReminders } from '../../push/reminders';
  import Icon from '../../ui/Icon.svelte';
  import Banner from '../../ui/Banner.svelte';
  import TextField from '../../ui/TextField.svelte';
  import CalendarRow from '../../ui/CalendarRow.svelte';
  import HabitRow from '../../ui/HabitRow.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import IconPicker from '../../ui/IconPicker.svelte';
  import { guessHabitIcon } from '../../ui/habit-icon-guess';
  import type { HabitIcon } from '../../ui/icons';
  import { askPermission, permission, pushDevice, pushSupported, PUSH_URL, turnOnPush } from '../../push/notifications';
  import { IcsError, parseIcs } from '../../data/ics';
  import { commitImport, habitsFound, planImport, storedUids, toggleHabits, type ImportPlan, type PlannedCalendar } from '../../data/import';
  import { backupFileName, shareBackup } from '../../data/backup';
  import { getSettings, updateSettings } from '../../data/settings';
  import { habitDayOf, type IsoDay } from '../../domain/day';
  import { clockLabel, repeatLabel } from '../../domain/format';
  import { parseRRule } from '../../domain/recurrence';
  import wordmark from '../../../design/logo-wordmark.svg';
  import appIcon from '../../../design/app-icon.svg';
  import { readBackup, BackupError, type BackupPreview } from '../../data/restore';

  type Step = 'welcome' | 'notifications' | 'notifications-off' | 'habit' | 'when' | 'bring' | 'unreadable' | 'found' | 'review' | 'habits' | 'data';
  const START = ['Reminders', 'Your habit', 'When'];
  const IMPORT = ['Files', 'Review', 'Habits', 'Backup'];
  // `from`: Today's empty state reopens the import at "Bring your calendars" (H14 → H06).
  interface Props { ondone: () => void; from?: Step; onrestore?: (preview: BackupPreview, fileName: string) => void; onback?: () => void }
  let { ondone, from = 'welcome', onrestore, onback }: Props = $props();

  // E2, E3: a new or wiped phone starts here; a backup brings everything back (H48 previews it first).
  let restoreInput = $state<HTMLInputElement>();
  let restoreProblem = $state('');
  async function pickBackup(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    if (!file) return;
    restoreProblem = '';
    try { onrestore?.(readBackup(await file.text()), file.name); }
    catch (err) { restoreProblem = err instanceof BackupError ? err.message : 'Couldn’t read that file. Try again.'; }
  }
  let step = $state<Step>(untrack(() => from)); // only the first screen; the flow moves on from there
  let busy = $state(false);
  let problem = $state('');

  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // --- H04 / H05 · notifications -------------------------------------------------------------
  let needsInvite = $state(false);
  let invite = $state('');

  async function start() {
    const device = await pushDevice();
    needsInvite = !device.subscribedAt; // 067: a phone the push function doesn't know yet needs the code
    const perm = permission();
    if (perm === 'granted' && device.subscribedAt) {
      turnOnPush('').catch(() => {}); // renew the address and time zone quietly (E1, E6)
      step = 'habit';
    } else step = perm === 'denied' ? 'notifications-off' : 'notifications';
  }

  async function allow() {
    busy = true; problem = '';
    try {
      const perm = permission() === 'granted' ? 'granted' : await askPermission();
      if (perm !== 'granted') { step = 'notifications-off'; return; }
      if (pushSupported() && PUSH_URL) await turnOnPush(invite);
      step = 'habit';
    } catch (e) {
      problem = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  // --- S3 / S4 · the first habit ------------------------------------------------------------------
  let habit = $state<HabitDraft>(blankHabit());
  async function createFirst() {
    if (!canSave(habit)) return;
    busy = true; problem = '';
    try {
      await createHabit($state.snapshot(habit) as HabitDraft, habitDayOf(new Date(), zone), zone);
      await finish();
      syncReminders().catch(() => {});
    } catch {
      problem = 'Couldn’t save the habit on this phone. Try again.';
    } finally {
      busy = false;
    }
  }

  // --- H06 / H07 / H07b · files ---------------------------------------------------------------
  let fileInput: HTMLInputElement;
  let plan = $state<ImportPlan | null>(null);
  let problems = $state<string[]>([]);
  let badFile = $state('');

  async function read(files: FileList | null) {
    if (!files?.length) return;
    busy = true; problem = '';
    try {
      const parsed = [];
      for (const file of Array.from(files)) {
        let text: string;
        try {
          text = await file.text();
        } catch {
          problem = `Couldn’t open “${file.name}”. If it’s in Proton Drive, download it to the phone first, then choose it again.`;
          return;
        }
        try {
          parsed.push({ fileName: file.name, calendar: parseIcs(text, zone) });
        } catch (e) {
          if (!(e instanceof IcsError)) throw e;
          badFile = file.name;
          problem = e.code === 'no-events'
            ? 'This calendar file has no events in it. Check you exported the right calendar.'
            : 'Calendar files end in .ics. In Proton, use Export on each calendar; a saved web page will not work.';
          step = 'unreadable';
          return;
        }
      }
      plan = planImport(parsed, await storedUids());
      problems = parsed.flatMap((p) => p.calendar.problems);
      step = 'found';
    } finally {
      busy = false;
      fileInput.value = '';
    }
  }

  // --- H08 · review -------------------------------------------------------------------------------
  const ROLE_LABEL: Record<string, string> = { marko: 'Personal', work: 'Work', family: 'Family' };
  const habitCalendar = $derived(plan?.calendars.find((c) => c.role === 'habits') ?? null);
  function detail(c: PlannedCalendar): string {
    if (c.role === 'habits') return 'Tracked as habits';
    if (c.role === 'merge') return `Merges into ${habitCalendar?.name ?? 'habits'}`;
    return ROLE_LABEL[c.color] ?? 'Calendar';
  }
  const counts = (c: PlannedCalendar) =>
    `${c.events.length} ${c.events.length === 1 ? 'event' : 'events'}${c.repeating ? ` · ${c.repeating} repeating` : ''}`;

  // --- H09 · habits found -------------------------------------------------------------------------
  let icons = $state<Record<string, HabitIcon>>({});
  let editing = $state<string | null>(null);
  let choice = $state<HabitIcon>('sprout');
  const found = $derived(plan ? habitsFound(plan) : []);
  function eventOf(uid: string) {
    return plan?.calendars.flatMap((c) => c.events).find((e) => e.uid === uid);
  }
  function metaOf(uid: string): string {
    const e = eventOf(uid);
    if (!e) return '';
    return `${repeatLabel(parseRRule(e.rrule ?? ''), e.start.wall.slice(0, 10) as IsoDay)} · ${clockLabel(e.start.allDay ? `${e.start.wall}T00:00` : e.start.wall, e.start.allDay)}`;
  }
  function afterReview() {
    icons = Object.fromEntries(found.map((h) => [h.uid, icons[h.uid] ?? guessHabitIcon(h.title)]));
    if (found.length) step = 'habits';
    else void save();
  }
  function pickIcon(uid: string) { choice = icons[uid] ?? 'sprout'; editing = uid; }
  function savePick() { if (editing) icons = { ...icons, [editing]: choice }; editing = null; }

  async function save() {
    busy = true; problem = '';
    try {
      // $state wraps objects in proxies, which IndexedDB can't store: save plain copies.
      if (plan) await commitImport($state.snapshot(plan) as ImportPlan, $state.snapshot(icons), zone);
      step = 'data';
    } catch (e) {
      console.error('atomic: import failed', (e as Error).name);
      problem = 'Couldn’t save the calendars on this phone. Nothing was saved; try again.';
    } finally {
      busy = false;
    }
  }

  // --- H10 · your data --------------------------------------------------------------------------
  async function backup() {
    busy = true; problem = '';
    try {
      const outcome = await shareBackup();
      if (outcome !== 'cancelled') await finish();
    } catch {
      problem = 'The backup couldn’t be made. You can try again later from Settings.';
    } finally {
      busy = false;
    }
  }
  async function finish() {
    const before = await getSettings(); // the import can also run later (Settings → Calendars): keep the start
    await updateSettings({ onboardingDone: true, timezone: zone, trackingStart: before.trackingStart ?? habitDayOf(new Date(), zone) });
    ondone();
  }
</script>

<input bind:this={fileInput} class="hidden" type="file" accept=".ics,text/calendar" multiple onchange={(e) => read(e.currentTarget.files)} />

{#snippet head(n: number, back: () => void)}
  <div class="block tight progress"><BackLink onclick={back} /><Stepper steps={START} current={n} /></div>
{/snippet}
{#snippet importHead(n: number)}
  <div class="block tight progress">{#if onback}<BackLink label="Settings" onclick={onback} />{/if}<Stepper steps={IMPORT} current={n} /></div>
{/snippet}

{#snippet error()}
  {#if problem}<p class="t-body-small error" role="alert">{problem}</p>{/if}
{/snippet}

<main class="screen flow">
  {#if step === 'welcome'}
    <div class="spacer"></div>
    <div class="block">
      <img class="wordmark" src={wordmark} alt="ATOMIC" />
      <h1 class="t-heading-large">Small habits, kept.</h1>
      <p class="t-body-default secondary">Pick a habit and a time. ATOMIC nudges you when it starts, and every day you keep them all lights a star.</p>
    </div>
    <ul class="block promises">
      <li><Icon name="bell" /><span class="t-body-default">A nudge when each habit starts</span></li>
      <li><span class="star"><AwardStar size="tiny" /></span><span class="t-body-default">A star for every perfect day, a medal for every run</span></li>
      <li><Icon name="lock" /><span class="t-body-default">Everything stays on this phone</span></li>
    </ul>
    <div class="spacer"></div>
    <div class="actions">
    <Button onclick={start}>Get started</Button>
    {#if onrestore}
      <Button variant="tertiary" icon="download" onclick={() => restoreInput?.click()}>Restore from a backup</Button>
      <input bind:this={restoreInput} type="file" accept=".json,application/json" hidden onchange={pickBackup} />
      {#if restoreProblem}<p class="t-body-small error" role="alert">{restoreProblem}</p>{/if}
    {/if}
    </div>

  {:else if step === 'notifications'}
    {@render head(1, () => (step = 'welcome'))}
    <div class="block tight">
      <h1 class="t-heading-medium">A nudge when each habit starts</h1>
      <p class="t-body-default secondary">One push at the time you choose, nothing else. The habit name is encrypted on this phone before it leaves.</p>
    </div>
    <div class="block tight">
      <SectionLabel text="What arrives" />
      <div class="preview" aria-hidden="true">
        <img src={appIcon} alt="" />
        <span class="preview-text">
          <span class="preview-head t-label-small"><span>Atomic</span><span class="tertiary">07:30</span></span>
          <span class="t-body-small">Read 20 min · time to start</span>
        </span>
      </div>
    </div>
    {#if needsInvite && PUSH_URL}
      <TextField bind:value={invite} label="Invite code" placeholder="The phrase you were given" />
    {/if}
    {@render error()}
    <div class="spacer"></div>
    <div class="actions">
      <Button onclick={allow} disabled={busy || (needsInvite && !!PUSH_URL && !invite.trim())}>Allow notifications</Button>
      <Button variant="tertiary" onclick={() => (step = 'habit')}>Not now</Button>
    </div>

  {:else if step === 'notifications-off'}
    {@render head(1, () => (step = 'welcome'))}
    <div class="block tight">
      <h1 class="t-heading-medium">Notifications are off</h1>
      <p class="t-body-default secondary">ATOMIC still works, but no nudge will arrive when a habit starts.</p>
    </div>
    <div class="block tight">
      <SectionLabel text="To turn them on" />
      <ol>
        <StepRow n={1} text="Open iPhone Settings" />
        <StepRow n={2} text="Notifications, then Atomic" />
        <StepRow n={3} text="Turn on Allow Notifications" />
      </ol>
    </div>
    <div class="spacer"></div>
    <Button onclick={() => (step = 'habit')}>Continue</Button>

  {:else if step === 'habit'}
    {@render head(2, () => (step = 'notifications'))}
    <div class="block tight">
      <h1 class="t-heading-medium">What do you want to do?</h1>
      <p class="t-body-default secondary">Give it an end, like “Read 20 min”. Small is fine: small is what lasts.</p>
    </div>
    <HabitWhat bind:draft={habit} />
    <div class="spacer"></div>
    <Button onclick={() => (step = 'when')} disabled={!habit.title.trim()}>Next</Button>

  {:else if step === 'when'}
    {@render head(3, () => (step = 'habit'))}
    <div class="block tight">
      <h1 class="t-heading-medium">When does it happen?</h1>
      <p class="t-body-default secondary">Habits keep clock time: {habit.start} stays {habit.start} wherever you are.</p>
    </div>
    <HabitWhen bind:draft={habit} />
    {@render error()}
    <div class="spacer"></div>
    <div class="actions">
      <Button onclick={createFirst} disabled={busy || !canSave(habit)}>Create habit</Button>
      <p class="t-label-small tertiary center">You can change any of this later.</p>
    </div>

  {:else if step === 'bring'}
    {@render importHead(1)}
    <h1 class="t-heading-medium">Bring your calendars</h1>
    <p class="t-body-default secondary">Export each calendar from Proton as an .ics file, then choose the files here. They are read on this phone and never uploaded.</p>
    <SectionLabel text="From Proton" />
    <ol>
      <StepRow n={1} text="In Proton Calendar, open Settings" />
      <StepRow n={2} text="Export each calendar as an .ics file" />
      <StepRow n={3} text="Save the files to Files or Proton Drive" />
    </ol>
    {@render error()}
    <div class="spacer"></div>
    <Button icon="upload" onclick={() => fileInput.click()} disabled={busy}>Choose files</Button>
    <Button variant="secondary" onclick={() => { plan = null; step = 'data'; }}>Start empty</Button>

  {:else if step === 'unreadable'}
    {@render importHead(1)}
    <h1 class="t-heading-medium">Can’t read this file</h1>
    <TextField value={badFile} readonly error="Calendar files end in .ics" />
    <Banner tone="info" message={problem} />
    <div class="spacer"></div>
    <Button icon="upload" onclick={() => fileInput.click()} disabled={busy}>Choose another file</Button>

  {:else if step === 'found' && plan}
    {@render importHead(1)}
    <h1 class="t-heading-medium">{plan.calendars.length} {plan.calendars.length === 1 ? 'calendar' : 'calendars'} found</h1>
    <ul class="list">
      {#each plan.calendars as c (c.key)}
        <li><CalendarRow name={c.name} detail={counts(c)} color={c.color} /></li>
      {/each}
    </ul>
    {#if plan.duplicates || problems.length}
      <div class="notes t-label-small tertiary">
        {#if plan.duplicates}<p>{plan.duplicates} {plan.duplicates === 1 ? 'duplicate' : 'duplicates'} skipped.</p>{/if}
        {#each problems as p (p)}<p>{p}</p>{/each}
      </div>
    {/if}
    <div class="spacer"></div>
    <Button onclick={() => (step = 'review')}>Continue</Button>

  {:else if step === 'review' && plan}
    {@render importHead(2)}
    <h1 class="t-heading-medium">Review your calendars</h1>
    <p class="t-body-default secondary">Turn on Habits for the calendar whose events become habits. Turn it on for a second calendar to merge it in.</p>
    <ul class="list">
      {#each plan.calendars as c (c.key)}
        <li>
          <CalendarRow name={c.name} detail={detail(c)} color={c.color}
            toggle={{
              on: c.role !== 'calendar',
              caption: c.role === 'merge' ? 'Merge' : 'Habits',
              label: `Track ${c.name} as habits`,
              onchange: () => { plan = toggleHabits(plan!, c.key); },
            }} />
        </li>
      {/each}
    </ul>
    <div class="spacer"></div>
    <Button onclick={afterReview} disabled={busy}>Continue</Button>

  {:else if step === 'habits'}
    {@render importHead(3)}
    <h1 class="t-heading-medium">{found.length} {found.length === 1 ? 'habit' : 'habits'} in {habitCalendar?.name ?? 'your habits'}</h1>
    <p class="t-body-default secondary">One habit per repeating event. Pick an icon for each; names stay as written in the calendar.</p>
    <ul>
      {#each found as h (h.uid)}
        <li>
          <HabitRow name={h.title} meta={metaOf(h.uid)} status="open" icon={icons[h.uid] ?? 'sprout'} swipeable={false}
            actionLabel="Change icon" onaction={() => pickIcon(h.uid)} onopen={() => pickIcon(h.uid)} />
        </li>
      {/each}
    </ul>
    {@render error()}
    <div class="spacer"></div>
    <Button onclick={save} disabled={busy}>Continue</Button>

  {:else if step === 'data'}
    {@render importHead(4)}
    <h1 class="t-heading-medium">Your data lives on this phone</h1>
    <ol>
      <StepRow n={1} text="No account, no cloud: everything stays on this phone." />
      <StepRow n={2} text="Removing ATOMIC from the Home Screen deletes it." />
      <StepRow n={3} text="A backup file is your only copy anywhere else." />
    </ol>
    <div class="file">
      <Icon name="download" />
      <span>
        <span class="t-number-small block">{backupFileName()}</span>
        <span class="t-label-small tertiary">Save it to Files or Proton Drive</span>
      </span>
    </div>
    {@render error()}
    <div class="spacer"></div>
    <Button icon="download" onclick={backup} disabled={busy}>Make the first backup</Button>
    <Button variant="tertiary" onclick={finish} disabled={busy}>Later</Button>
  {/if}
</main>

<Sheet open={editing !== null} title="Choose an icon" showClose onclose={() => (editing = null)}>
  <div class="sheet">
    <IconPicker bind:selected={choice} />
    <Button onclick={savePick}>Save</Button>
  </div>
</Sheet>

<style>
  .flow { display: flex; flex-direction: column; gap: var(--layout-block-gap); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-24)); } /* 092 */
  .block { display: grid; gap: var(--space-16); }
  .block.tight { gap: var(--space-8); }
  .progress { gap: var(--space-8); }
  .actions { display: grid; gap: var(--space-8); }
  .promises { gap: var(--space-16); }
  .promises li { display: flex; align-items: center; gap: var(--space-12); }
  .star { width: var(--size-icon); display: grid; place-items: center; }
  .center { text-align: center; }
  .spacer { flex: 1; }
  .hidden { display: none; }
  .wordmark { width: calc(var(--space-48) * 5 * 0.85); height: auto; align-self: flex-start; } /* 15% smaller (owner, 8 Oct 2026) */
  .secondary { color: var(--text-secondary); }
  .tertiary { color: var(--text-tertiary); }
  .block { display: block; }
  .error { color: var(--text-accent); }
  .preview, .file {
    display: flex; align-items: center; gap: var(--space-12);
    padding: var(--space-12) var(--space-16) var(--space-12) var(--space-12); background: var(--bg-subtle);
  }
  .preview { border-radius: var(--radius-sheet); }
  .file { border-radius: var(--radius-control); }
  .preview img { width: var(--space-40); height: var(--space-40); }
  .preview-text, .file > span { flex: 1; min-width: 0; display: grid; }
  .preview-head { display: flex; justify-content: space-between; }
  .list > li + li { border-top: var(--stroke-hairline) solid var(--border-divider); }
  .notes { display: grid; gap: var(--space-4); }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-16); }
</style>
