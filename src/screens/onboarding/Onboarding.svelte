<script lang="ts">
  // 02 Onboarding (Figma 65:3812), flow F1: Welcome (H01) → notifications (H04/H05) → bring your
  // calendars (H06) → files read (H07, or H07b) → review (H08) → habits found (H09) → your data (H10).
  // The import is a plan until H09's Continue: nothing is saved before the person has reviewed it.
  import { untrack } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import Button from '../../ui/Button.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import StepRow from '../../ui/StepRow.svelte';
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
  import { updateSettings } from '../../data/settings';
  import { habitDayOf, type IsoDay } from '../../domain/day';
  import { clockLabel, repeatLabel } from '../../domain/format';
  import { parseRRule } from '../../domain/recurrence';
  import wordmark from '../../../design/logo-wordmark.svg';
  import appIcon from '../../../design/app-icon.svg';

  type Step = 'welcome' | 'notifications' | 'notifications-off' | 'bring' | 'unreadable' | 'found' | 'review' | 'habits' | 'data';
  // `from`: Today's empty state reopens the import at "Bring your calendars" (H14 → H06).
  let { ondone, from = 'welcome' }: { ondone: () => void; from?: Step } = $props();
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
      step = 'bring';
    } else step = perm === 'denied' ? 'notifications-off' : 'notifications';
  }

  async function allow() {
    busy = true; problem = '';
    try {
      const perm = permission() === 'granted' ? 'granted' : await askPermission();
      if (perm !== 'granted') { step = 'notifications-off'; return; }
      if (pushSupported() && PUSH_URL) await turnOnPush(invite);
      step = 'bring';
    } catch (e) {
      problem = (e as Error).message;
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
    await updateSettings({ onboardingDone: true, timezone: zone, trackingStart: habitDayOf(new Date(), zone) });
    ondone();
  }
</script>

<input bind:this={fileInput} class="hidden" type="file" accept=".ics,text/calendar" multiple onchange={(e) => read(e.currentTarget.files)} />

{#snippet error()}
  {#if problem}<p class="t-body-small error" role="alert">{problem}</p>{/if}
{/snippet}

<main class="screen flow">
  {#if step === 'welcome'}
    <div class="spacer"></div>
    <img class="wordmark" src={wordmark} alt="ATOMIC" />
    <h1 class="t-heading-medium">Every habit ends with an answer.</h1>
    <p class="t-body-default secondary">A calendar for your days and your habits. Each evening, every habit gets a done or a skip, so a miss always leaves a trace.</p>
    <div class="spacer"></div>
    <Button onclick={start}>Get started</Button>

  {:else if step === 'notifications'}
    <TopBar eyebrow="1 of 4" title="One push a day" />
    <p class="t-body-default secondary">At 22:30 ATOMIC asks you to close the day. Event reminders arrive only for the events you set them on.</p>
    <SectionLabel text="What arrives" />
    <div class="feature">
      <Icon name="bell" />
      <span><span class="t-body-strong block">22:30 · Close the day</span><span class="t-body-small secondary">Answer every habit in one go.</span></span>
    </div>
    <div class="feature">
      <Icon name="clock" />
      <span><span class="t-body-strong block">Event reminders</span><span class="t-body-small secondary">Title and time, encrypted on this phone.</span></span>
    </div>
    <SectionLabel text="How it looks" />
    <div class="preview" aria-hidden="true">
      <img src={appIcon} alt="" />
      <span class="preview-text">
        <span class="preview-head t-label-small"><span>ATOMIC</span><span class="tertiary">22:30</span></span>
        <span class="t-body-small">Time to close the day.</span>
      </span>
    </div>
    {#if needsInvite && PUSH_URL}
      <TextField bind:value={invite} label="Invite code" placeholder="The phrase you were given" />
    {/if}
    {@render error()}
    <div class="spacer"></div>
    <Button onclick={allow} disabled={busy || (needsInvite && !!PUSH_URL && !invite.trim())}>Allow notifications</Button>
    <Button variant="tertiary" onclick={() => (step = 'bring')}>Not now</Button>

  {:else if step === 'notifications-off'}
    <TopBar eyebrow="1 of 4" title="Notifications are off" />
    <p class="t-body-default secondary">ATOMIC still works, but the 22:30 recap and your event reminders won’t arrive.</p>
    <SectionLabel text="To turn them on" />
    <ol>
      <StepRow n={1} text="Open iPhone Settings" />
      <StepRow n={2} text="Notifications, then ATOMIC" />
      <StepRow n={3} text="Turn on Allow Notifications" />
    </ol>
    <div class="spacer"></div>
    <Button onclick={() => (step = 'bring')}>Continue</Button>

  {:else if step === 'bring'}
    <TopBar eyebrow="2 of 4" title="Bring your calendars" />
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
    <TopBar eyebrow="2 of 4" title="Can’t read this file" />
    <TextField value={badFile} readonly error="Calendar files end in .ics" />
    <Banner tone="info" message={problem} />
    <div class="spacer"></div>
    <Button icon="upload" onclick={() => fileInput.click()} disabled={busy}>Choose another file</Button>

  {:else if step === 'found' && plan}
    <TopBar eyebrow="2 of 4" title="{plan.calendars.length} {plan.calendars.length === 1 ? 'calendar' : 'calendars'} found" />
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
    <TopBar eyebrow="2 of 4" title="Review your calendars" />
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
    <TopBar eyebrow="3 of 4" title="{found.length} {found.length === 1 ? 'habit' : 'habits'} in {habitCalendar?.name ?? 'your habits'}" />
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
    <TopBar eyebrow="4 of 4" title="Your data lives on this phone" />
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
  .flow { display: flex; flex-direction: column; gap: var(--space-16); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .spacer { flex: 1; }
  .hidden { display: none; }
  .wordmark { width: calc(var(--space-48) * 5); height: auto; align-self: flex-start; }
  .secondary { color: var(--text-secondary); }
  .tertiary { color: var(--text-tertiary); }
  .block { display: block; }
  .error { color: var(--text-accent); }
  .feature { display: flex; align-items: flex-start; gap: var(--space-12); padding: var(--space-8) 0; }
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
