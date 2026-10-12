<script lang="ts">
  // 01 Start (Figma page 14, habits first, 097; 114): Welcome (S1) → Get started → the empty Today, which asks for
  // the first habit (E17, 079). No reminders step and no invite code on the way in: Today offers reminders once a
  // habit exists (114), and the invite code is asked only there, when the phone first subscribes (067). The .ics import keeps its own flow (`from="bring"`), opened from Settings → Calendars:
  // bring your calendars (H06) → files read (H07, or H07b) → review (H08) → habits found (H09) → your data (H10).
  // The import is a plan until H09's Continue: nothing is saved before the person has reviewed it.
  import { untrack } from 'svelte';
  import Button from '../../ui/Button.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import StepRow from '../../ui/StepRow.svelte';
  import Stepper from '../../ui/Stepper.svelte';
  import BackLink from '../../ui/BackLink.svelte';
  import AwardStar from '../../ui/AwardStar.svelte';
  import Icon from '../../ui/Icon.svelte';
  import Banner from '../../ui/Banner.svelte';
  import TextField from '../../ui/TextField.svelte';
  import CalendarRow from '../../ui/CalendarRow.svelte';
  import HabitRow from '../../ui/HabitRow.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import IconPicker from '../../ui/IconPicker.svelte';
  import { guessHabitIcon } from '../../ui/habit-icon-guess';
  import type { HabitIcon } from '../../ui/icons';
  import { IcsError, parseIcs } from '../../data/ics';
  import { commitImport, habitsFound, planImport, storedUids, toggleHabits, type ImportPlan, type PlannedCalendar } from '../../data/import';
  import { backupFileName, shareBackup } from '../../data/backup';
  import { getSettings, updateSettings } from '../../data/settings';
  import { habitDayOf, type IsoDay } from '../../domain/day';
  import { clockLabel, repeatLabel } from '../../domain/format';
  import { parseRRule } from '../../domain/recurrence';
  import wordmark from '../../../design/logo-wordmark.svg';
  import { readBackup, BackupError, type BackupPreview } from '../../data/restore';

  type Step = 'welcome' | 'bring' | 'unreadable' | 'found' | 'review' | 'habits' | 'data';
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

{#snippet importHead(n: number)}
  <div class="block tight progress">{#if onback}<BackLink label="Settings" onclick={onback} />{/if}<Stepper steps={IMPORT} current={n} /></div>
{/snippet}

{#snippet error()}
  {#if problem}<p class="t-body-small error" role="alert">{problem}</p>{/if}
{/snippet}

<main class="screen flow">
  {#if step === 'welcome'}
    <div class="spacer"></div>
    <img class="wordmark" src={wordmark} alt="ATOMIC" />
    <div class="intro">
      <h1 class="t-heading-large">Small habits, kept.</h1>
      <p class="t-body-default secondary">Pick a habit and a time. ATOMIC nudges you when it starts, and every day you keep them all lights a star.</p>
    </div>
    <ul class="promises">
      <li><span class="mark"><Icon name="bell" /></span><span class="t-body-small">A nudge when each habit starts</span></li>
      <li><span class="mark"><AwardStar size="tiny" /></span><span class="t-body-small">A star for every perfect day, a medal for every run</span></li>
      <li><span class="mark"><Icon name="lock" /></span><span class="t-body-small">Everything stays on this phone</span></li>
    </ul>
    <div class="spacer"></div>
    <div class="actions">
    <Button onclick={finish}>Get started</Button>
    {#if onrestore}
      <Button variant="tertiary" icon="download" onclick={() => restoreInput?.click()}>Restore from a backup</Button>
      <input bind:this={restoreInput} type="file" accept=".json,application/json" hidden onchange={pickBackup} />
      {#if restoreProblem}<p class="t-body-small error" role="alert">{restoreProblem}</p>{/if}
    {/if}
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
  /* U13: the welcome reads as three groups: the mark, what ATOMIC is, what you get */
  .intro { display: grid; gap: var(--space-12); }
  .promises { display: grid; gap: var(--space-12); }
  .promises li { display: grid; grid-template-columns: var(--size-icon) 1fr; column-gap: var(--space-12); align-items: start; }
  .mark { height: var(--space-20); display: grid; place-items: center; color: var(--icon-default); } /* one text line (14/20): the icon centres on the first line */
  .spacer { flex: 1; }
  .hidden { display: none; }
  .wordmark { width: calc(var(--space-64) * 2); height: auto; align-self: flex-start; margin-bottom: var(--space-8); } /* U13: a signature, not a headline */
  .secondary { color: var(--text-secondary); }
  .tertiary { color: var(--text-tertiary); }
  .error { color: var(--text-accent); }
  .file {
    display: flex; align-items: center; gap: var(--space-12);
    padding: var(--space-12) var(--space-16) var(--space-12) var(--space-12); background: var(--bg-subtle);
  }
  .file { border-radius: var(--radius-control); }
  .file > span { flex: 1; min-width: 0; display: grid; }
  .list > li + li { border-top: var(--stroke-hairline) solid var(--border-divider); }
  .notes { display: grid; gap: var(--space-4); }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-16); }
</style>
