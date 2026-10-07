<script lang="ts">
  // H45 Habits and H45b Edit habit (Figma 54:3333, 54:3478): icon, display name, archive.
  // Archived habits (E9) keep their history and badges. New habits come from events on a calendar with
  // Track as habits on. Each row shows the schedule and the rank reached (047): "no rank yet" before day 10.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import HabitRow from '../../ui/HabitRow.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import TextField from '../../ui/TextField.svelte';
  import IconPicker from '../../ui/IconPicker.svelte';
  import Button from '../../ui/Button.svelte';
  import type { HabitIcon } from '../../ui/icons';
  import { db } from '../../data/db';
  import { activeHabits, saveHabit, unarchiveHabit } from '../../data/habits';
  import { archiveHabit } from '../../data/events';
  import { toSource } from '../../data/answers';
  import { getSettings } from '../../data/settings';
  import type { Answer, CalendarEvent, RankRecord } from '../../data/schema';
  import { parseRRule } from '../../domain/recurrence';
  import { repeatLabel } from '../../domain/format';
  import { daysHeldFor } from '../../domain/today';
  import { RANKS, reachedRank, ringSegments, type RankId } from '../../domain/ranks';
  import { habitDayOf, type IsoDay } from '../../domain/day';
  import { syncReminders } from '../../push/reminders';

  let { onback }: { onback: () => void } = $props();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = habitDayOf(new Date(), zone);

  let active = $state.raw<CalendarEvent[]>([]);
  let archived = $state.raw<CalendarEvent[]>([]);
  let answers = $state.raw<Answer[]>([]);
  let ranks = $state.raw<RankRecord[]>([]);
  let trackingStart = $state<IsoDay>(today);

  async function load() {
    const database = await db();
    const [list, ans, rk, settings] = await Promise.all([activeHabits(), database.getAll('answers'), database.getAll('ranks'), getSettings()]);
    active = list.active;
    archived = list.archived;
    answers = ans;
    ranks = rk;
    trackingStart = (settings.trackingStart as IsoDay | null) ?? today;
  }
  onMount(load);

  function rankOf(e: CalendarEvent): RankId | null {
    const stored = ranks.filter((r) => r.seriesId === e.id).map((r) => r.rank);
    const best = RANKS.filter((r) => stored.includes(r.id)).at(-1)?.id ?? null;
    return reachedRank(best, daysHeldFor(toSource(e), answers, trackingStart, today));
  }
  function meta(e: CalendarEvent): string {
    const rank = rankOf(e);
    const when = e.allDay ? 'All day' : e.start.slice(11, 16);
    return `${repeatLabel(e.rrule ? parseRRule(e.rrule) : null, e.start.slice(0, 10) as IsoDay)} · ${when} · ${rank ? RANKS.find((r) => r.id === rank)!.label : 'no rank yet'}`;
  }

  // --- H45b ------------------------------------------------------------------------------------------
  let editing = $state.raw<CalendarEvent | null>(null);
  let name = $state('');
  let icon = $state<HabitIcon>('sprout');
  let busy = $state(false);
  function edit(e: CalendarEvent) { editing = e; name = e.title; icon = (e.icon ?? 'sprout') as HabitIcon; }
  async function run(action: () => Promise<void>) {
    busy = true;
    try { await action(); editing = null; await load(); syncReminders().catch(() => {}); } finally { busy = false; }
  }
</script>

<main class="screen habits">
  <TopBar type="navigation" title="" leftLabel="Settings" onleft={onback} />
  <h1 class="t-heading-large">Habits</h1>
  <SectionLabel text="Active · {active.length}" />
  <ul>
    {#each active as e (e.id)}
      <li><HabitRow name={e.title} meta={meta(e)} status="open" icon={(e.icon ?? 'sprout') as HabitIcon} level={ringSegments(rankOf(e))}
        swipeable={false} actionLabel="Edit" onaction={() => edit(e)} onopen={() => edit(e)} /></li>
    {/each}
  </ul>
  <SectionLabel text="Archived · {archived.length}" />
  {#if archived.length}
    <ul>
      {#each archived as e (e.id)}
        <li><HabitRow name={e.title} meta={meta(e)} status="open" icon={(e.icon ?? 'sprout') as HabitIcon} level={ringSegments(rankOf(e))}
          swipeable={false} actionLabel="Edit" onaction={() => edit(e)} onopen={() => edit(e)} /></li>
      {/each}
    </ul>
  {/if}
  <p class="t-body-small note">Archived habits keep their history and badges. New habits come from events on a calendar with Track as habits on.</p>
</main>

<Sheet open={editing !== null} title="Edit habit" showClose onclose={() => (editing = null)}>
  {#if editing}
    <div class="sheet">
      <TextField bind:value={name} autocapitalize="sentences" spellcheck />
      <SectionLabel text="Icon · 44 in 8 groups" />
      <IconPicker bind:selected={icon} />
      <Button disabled={busy || !name.trim()} onclick={() => run(() => saveHabit(editing!, { title: name, icon }))}>Save</Button>
      {#if editing.archivedOn && editing.archivedOn <= today}
        <Button variant="secondary" disabled={busy} onclick={() => run(() => unarchiveHabit(editing!))}>Bring back from today</Button>
      {:else}
        <Button variant="secondary" disabled={busy} onclick={() => run(() => archiveHabit(editing!, today))}>Archive habit</Button>
      {/if}
    </div>
  {/if}
</Sheet>

<style>
  .habits { display: flex; flex-direction: column; gap: var(--space-8); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .note { color: var(--text-tertiary); }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-40); }
</style>
