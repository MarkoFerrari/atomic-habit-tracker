<script lang="ts">
  // H45 Archived habits (Figma 54:3333). Editing a habit, its object included, lives in Habits → the habit → Edit (133),
  // so this screen only lists the archived ones (E9: they keep their history and badges) and brings one back from today (074).
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import HabitRow from '../../ui/HabitRow.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import Button from '../../ui/Button.svelte';
  import type { HabitIcon } from '../../ui/icons';
  import { db } from '../../data/db';
  import { activeHabits, unarchiveHabit } from '../../data/habits';
  import { toSource } from '../../data/answers';
  import { getSettings } from '../../data/settings';
  import type { Answer, CalendarEvent, RankRecord } from '../../data/schema';
  import { parseRRule } from '../../domain/recurrence';
  import { repeatLabel, timesAWeek } from '../../domain/format';
  import { daysHeldFor } from '../../domain/stats';
  import { RANKS, reachedRank, type RankId } from '../../domain/ranks';
  import { habitDayOf, type IsoDay } from '../../domain/day';
  import { syncReminders } from '../../push/reminders';

  let { onback }: { onback: () => void } = $props();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = habitDayOf(new Date(), zone);

  let archived = $state.raw<CalendarEvent[]>([]);
  let answers = $state.raw<Answer[]>([]);
  let ranks = $state.raw<RankRecord[]>([]);
  let trackingStart = $state<IsoDay>(today);

  async function load() {
    const database = await db();
    const [list, ans, rk, settings] = await Promise.all([activeHabits(), database.getAll('answers'), database.getAll('ranks'), getSettings()]);
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
    return `${e.perWeek ? timesAWeek(e.perWeek) : repeatLabel(e.rrule ? parseRRule(e.rrule) : null, e.start.slice(0, 10) as IsoDay)} · ${when} · ${rank ? RANKS.find((r) => r.id === rank)!.label : 'no rank yet'}`;
  }

  // --- bring back ------------------------------------------------------------------------------------
  let open = $state.raw<CalendarEvent | null>(null);
  let busy = $state(false);
  async function bringBack() {
    if (!open) return;
    busy = true;
    try { await unarchiveHabit(open); open = null; await load(); syncReminders().catch(() => {}); } finally { busy = false; }
  }
</script>

<main class="screen habits">
  <TopBar type="navigation" title="" leftLabel="Settings" onleft={onback} />
  <h1 class="t-heading-large">Archived habits</h1>
  <SectionLabel text="Archived · {archived.length}" />
  {#if archived.length}
    <ul>
      {#each archived as e (e.id)}
        <li><HabitRow name={e.title} meta={meta(e)} status="open" icon={(e.icon ?? 'sprout') as HabitIcon}
          swipeable={false} actionLabel="Bring back" onaction={() => (open = e)} onopen={() => (open = e)} /></li>
      {/each}
    </ul>
  {:else}
    <p class="t-body-default empty">No archived habits.</p>
  {/if}
  <p class="t-body-small note">Archived habits keep their history and badges. To change a habit, open it in Habits and tap Edit.</p>
</main>

<Sheet open={open !== null} title="Bring back this habit?" showClose onclose={() => (open = null)}>
  {#if open}
    <div class="sheet">
      <p class="t-body-small note">“{open.title}” counts again from today. Its history and badges are still there.</p>
      <Button disabled={busy} onclick={bringBack}>Bring back from today</Button>
      <Button variant="secondary" disabled={busy} onclick={() => (open = null)}>Cancel</Button>
    </div>
  {/if}
</Sheet>

<style>
  .habits { display: flex; flex-direction: column; gap: var(--space-12); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .note, .empty { color: var(--text-secondary); }
  ul { display: grid; gap: var(--space-12); }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-40); }
</style>
