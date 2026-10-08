<script lang="ts">
  // E1 New habit (Figma page 14, section 05). What, how often, when: the same order as the first-habit steps,
  // on one screen, 40 between blocks (092). The extras of 085 (cue, smallest version, identity) fold into one
  // optional row. Editing an existing habit keeps the full editor (H30), which handles repeats and past answers.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import TextField from '../../ui/TextField.svelte';
  import Button from '../../ui/Button.svelte';
  import HabitWhat from './HabitWhat.svelte';
  import HabitWhen from './HabitWhen.svelte';
  import { blankHabit, canSave, createHabit, type HabitDraft } from '../../data/newHabit';
  import { habitEvents } from '../../data/answers';
  import { habitDayOf } from '../../domain/day';
  import { syncReminders } from '../../push/reminders';

  let { oncancel, onsaved }: { oncancel: () => void; onsaved: () => void } = $props();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let draft = $state<HabitDraft>(blankHabit());
  let stick = $state(false);
  let others = $state<string[]>([]);
  let busy = $state(false);
  let problem = $state('');
  onMount(async () => { others = [...new Set((await habitEvents()).filter((e) => !e.archivedOn).map((e) => e.title))].sort(); });
  const extras = $derived([draft.after && `After ${draft.after}`, draft.smallest && 'smallest version', draft.identity && 'identity'].filter(Boolean).join(' · ') || 'Optional');

  async function save() {
    if (!canSave(draft) || busy) return;
    busy = true; problem = '';
    try {
      await createHabit($state.snapshot(draft) as HabitDraft, habitDayOf(new Date(), zone), zone);
      syncReminders().catch(() => {});
      onsaved();
    } catch { problem = 'Couldn’t save the habit. Try again.'; }
    finally { busy = false; }
  }
</script>

<main class="screen editor">
  <TopBar type="modal" title="New habit" leftLabel="Cancel" rightLabel="Save" onleft={oncancel} onright={save} />
  <section class="group"><HabitWhat bind:draft suggestions={false} /></section>
  <section class="group"><HabitWhen bind:draft /></section>
  <section class="group">
    <ListRow label="Make it stick" value={extras} onclick={() => (stick = true)} />
    <p class="t-label-small tertiary">A cue (“after Read”), a smallest version and who you are becoming.</p>
  </section>
  {#if problem}<p class="t-body-small problem" role="alert">{problem}</p>{/if}
  {#if !canSave(draft) && draft.often === 'days' && !draft.days.length}<p class="t-body-small tertiary">Pick at least one day.</p>{/if}
</main>

<Sheet open={stick} title="Make it stick" onclose={() => (stick = false)}>
  <div class="sheet">
    <TextField bind:value={draft.after} label="After (a habit you already do)" placeholder={others[0] ?? 'Breakfast'} autocapitalize="sentences" />
    <TextField bind:value={draft.smallest} label="Smallest version (2 minutes)" placeholder="Read one page" autocapitalize="sentences" />
    <TextField bind:value={draft.identity} label="I’m becoming" placeholder="A reader" autocapitalize="sentences" />
    <Button onclick={() => (stick = false)}>Done</Button>
  </div>
</Sheet>

<style>
  .editor { display: flex; flex-direction: column; gap: var(--layout-block-gap); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .group { display: grid; gap: var(--space-16); }
  .tertiary { color: var(--text-tertiary); }
  .problem { color: var(--text-accent); }
  .sheet { display: grid; gap: var(--space-16); padding-bottom: var(--space-40); }
</style>
