<script lang="ts">
  // E1 New habit (Figma page 14, section 05). What, how often, when: the same order as the first-habit steps,
  // on one screen, 40 between blocks (092). The extras of 085 (cue, smallest version, identity) fold into one
  // optional row. Editing an existing habit keeps the full editor (H30), which handles repeats and past answers.
  // Style B (N1): white cards on stone, the What card first. 130 (N1b): Count it as a habit off saves a reminder,
  // not a habit; the same screen edits a reminder (`reminder`), and switching Count on there turns it into a habit.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import TextField from '../../ui/TextField.svelte';
  import Button from '../../ui/Button.svelte';
  import HabitWhat from './HabitWhat.svelte';
  import HabitWhen from './HabitWhen.svelte';
  import HabitHelp, { type HelpTopic } from './HabitHelp.svelte';
  import { blankHabit, canSave, createHabit, createReminder, type HabitDraft } from '../../data/newHabit';
  import { deleteTimed, updateTimed } from '../../data/timed';
  import type { TimedReminder } from '../../data/schema';
  import type { HabitIcon } from '../../ui/icons';
  import { habitEvents } from '../../data/answers';
  import { habitDayOf } from '../../domain/day';
  import { syncReminders } from '../../push/reminders';
  import { askPermission } from '../../push/notifications';
  import { canAsk, enablePush } from '../../push/enable';

  let { oncancel, onsaved, reminder }: { oncancel: () => void; onsaved: () => void; reminder?: TimedReminder } = $props();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fromReminder = (r: TimedReminder): HabitDraft => ({
    ...blankHabit(), title: r.title, icon: r.icon as HabitIcon, count: false, remindTimes: [...r.times], perDay: r.times.length, start: r.times[0] ?? '09:00',
    often: r.days?.length ? 'days' : 'daily', days: r.days?.length ? [...r.days] : [0, 1, 2, 3, 4],
  });
  // svelte-ignore state_referenced_locally
  let draft = $state<HabitDraft>(reminder ? fromReminder(reminder) : blankHabit());
  let stick = $state(false);
  let help = $state<HelpTopic | null>(null);
  let others = $state<string[]>([]);
  let busy = $state(false);
  let problem = $state('');
  onMount(async () => { others = [...new Set((await habitEvents()).filter((e) => !e.archivedOn).map((e) => e.title))].sort(); });
  const extras = $derived([draft.after && `After ${draft.after}`, draft.smallest && 'smallest version', draft.identity && 'identity'].filter(Boolean).join(' · ') || 'Optional');

  async function save() {
    if (!canSave(draft) || busy) return;
    busy = true; problem = '';
    // 121: a habit with Nudge on, on a phone never asked: the iPhone asks now, inside the tap on Save
    const asked = (draft.nudge || !draft.count) && canAsk() ? askPermission() : null;
    try {
      const d = $state.snapshot(draft) as HabitDraft;
      if (d.count) {
        await createHabit(d, habitDayOf(new Date(), zone), zone);
        if (reminder) await deleteTimed(reminder.id); // 130: a reminder switched to Count it as a habit becomes one
      } else if (reminder) {
        await updateTimed(reminder.id, { title: d.title, icon: d.icon, times: d.remindTimes, days: d.often === 'days' ? d.days : [] });
      } else await createReminder(d);
      if (asked) await enablePush(asked).catch(() => 'default'); // Not now, or no connection: Today's banner stays
      else syncReminders().catch(() => {});
      onsaved();
    } catch { problem = 'Couldn’t save the habit. Try again.'; }
    finally { busy = false; }
  }
</script>

<main class="screen editor">
  <TopBar type="modal" title={reminder ? 'Edit reminder' : 'New habit'} leftLabel="Cancel" rightLabel="Save" onleft={oncancel} onright={save} />
  <section class="group"><HabitWhat bind:draft suggestions={false} label={draft.count ? 'Habit' : 'Reminder'} /></section>
  <section class="group">
    <HabitWhen bind:draft>
      <ListRow label="Make it stick" value={extras} onclick={() => (stick = true)} oninfo={() => (help = 'stick')} />
    </HabitWhen>
  </section>
  {#if problem}<p class="t-body-small problem" role="alert">{problem}</p>{/if}
  {#if !canSave(draft) && draft.often === 'days' && !draft.days.length}<p class="t-body-small tertiary">Pick at least one day.</p>{/if}
</main>

<HabitHelp bind:topic={help} topics={['stick']} />

<Sheet open={stick} title="Make it stick" onclose={() => (stick = false)}>
  <div class="sheet">
    <TextField bind:value={draft.after} label="After (a habit you already do)" placeholder={others[0] ?? 'Breakfast'} autocapitalize="sentences" />
    <TextField bind:value={draft.smallest} label="Smallest version (2 minutes)" placeholder="Read one page" autocapitalize="sentences" />
    <TextField bind:value={draft.identity} label="I’m becoming" placeholder="A reader" autocapitalize="sentences" />
    <Button onclick={() => (stick = false)}>Done</Button>
  </div>
</Sheet>

<style>
  .editor { display: flex; flex-direction: column; gap: var(--space-12); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .group { display: grid; gap: var(--space-12); }
  .tertiary { color: var(--text-tertiary); }
  .problem { color: var(--text-destructive); }
  .sheet { display: grid; gap: var(--space-16); padding-bottom: var(--space-40); }
</style>
