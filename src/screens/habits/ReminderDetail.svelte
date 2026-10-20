<script lang="ts">
  // B4 Reminder detail (130): a reminder is not a habit, so no run, no rank, no calendar: its field, today's times
  // (passed, next, still to come), Pause and Delete. Edit opens the same form as New habit; switching Count it as a
  // habit on there turns it into one. A pushed screen: no tab bar (044).
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import Button from '../../ui/Button.svelte';
  import HabitObject from '../../ui/HabitObject.svelte';
  import { fieldColor } from '../../ui/objects';
  import { deleteTimed, getTimed, updateTimed } from '../../data/timed';
  import type { TimedReminder } from '../../data/schema';
  import { habitDayOf } from '../../domain/day';
  import { wallOf } from '../../domain/zone';
  import { sortTimes, todayOf } from '../../domain/timed';
  import { syncReminders } from '../../push/reminders';

  interface Props { id: string; backLabel?: string; onback: () => void; onedit?: (r: TimedReminder) => void }
  let { id, backLabel = 'Habits', onback, onedit }: Props = $props();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const DAY = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];

  let r = $state.raw<TimedReminder | null>(null);
  let loaded = $state(false);
  let now = $state(new Date());
  let confirm = $state(false);
  let busy = $state(false);
  async function load() { r = await getTimed(id); loaded = true; }
  onMount(() => { load(); const t = setInterval(() => (now = new Date()), 30_000); return () => clearInterval(t); });

  const day = $derived(habitDayOf(now, zone));
  const clock = $derived(wallOf(now, zone).slice(11, 16));
  const today = $derived(r ? todayOf(r, day, clock) : null);
  const times = $derived(r ? sortTimes(r.times) : []);
  const days = $derived(!r?.days?.length ? '' : r.days.join() === '0,1,2,3,4' ? 'Weekdays' : r.days.join() === '5,6' ? 'Weekends' : r.days.map((d) => DAY[d]!.slice(0, 3)).join(', '));
  const line = $derived(r ? ['Reminder', days, `${times.length} times a day`].filter(Boolean).join(' · ') : '');
  const label = $derived(r?.paused ? 'Paused' : today?.on ? 'Today' : 'Not today');

  async function togglePause() {
    if (!r) return;
    await updateTimed(r.id, { paused: !r.paused });
    syncReminders().catch(() => {});
    await load();
  }
  async function remove() {
    if (!r) return;
    busy = true;
    try { await deleteTimed(r.id); confirm = false; syncReminders().catch(() => {}); onback(); }
    finally { busy = false; }
  }
</script>

<main class="screen detail">
  <TopBar type="navigation" title="" leftLabel={backLabel} onleft={onback} rightLabel={onedit && r ? 'Edit' : undefined} onright={() => r && onedit?.(r)} />
  {#if r && today}
    <section class="hero" style:--field={fieldColor(r.icon)}>
      <div class="head">
        <HabitObject icon={r.icon} size="xl" />
        <div class="text">
          <h1 class="t-heading-small title">{r.title}</h1>
          <p class="t-body-small secondary">{line}</p>
        </div>
      </div>
      <p class="t-label-small secondary">Not a habit: no run, no rank, never counted. Just a nudge at each time.</p>
    </section>

    <section class="card today" aria-label={label}>
      <h2 class="t-label-section secondary">{label}</h2>
      <ul class="times">
        {#each times as t (t)}
          {@const passed = !r.paused && today.on && t <= clock}
          {@const next = !r.paused && today.next === t}
          <li class="time t-number-default" class:passed class:next aria-label="{t}{passed ? ', passed' : next ? ', next' : ''}">{t}{#if next}<span>next</span>{/if}</li>
        {/each}
      </ul>
    </section>

    <div class="card-list">
      <ListRow icon="pause" label={r.paused ? 'Turn reminders back on' : 'Pause reminders'} onclick={togglePause} />
      <ListRow icon="trash" type="destructive" label="Delete reminder" onclick={() => (confirm = true)} />
    </div>
    <p class="t-label-small secondary">To track it, open Edit and switch on Count it as a habit.</p>
  {:else if loaded}
    <p class="t-body-default secondary">This reminder isn’t here any more.</p>
  {/if}
</main>

{#if r}
  <Sheet open={confirm} title="Delete “{r.title}”?" onclose={() => (confirm = false)}>
    <div class="sheet">
      <p class="t-body-default secondary">Its nudges stop. Nothing else changes: a reminder is never counted.</p>
      <Button variant="secondary" disabled={busy} onclick={remove}>Delete reminder</Button>
      <Button variant="tertiary" disabled={busy} onclick={() => (confirm = false)}>Cancel</Button>
    </div>
  </Sheet>
{/if}

<style>
  .detail { display: flex; flex-direction: column; gap: var(--space-12); padding-bottom: var(--space-40); }
  .hero { display: grid; gap: var(--space-12); padding: var(--space-16); background: var(--field); border-radius: var(--radius-card); }
  .head { display: flex; align-items: center; gap: var(--space-16); }
  .text { display: grid; gap: var(--space-4); min-width: 0; }
  .title { overflow-wrap: anywhere; }
  .today { display: grid; gap: var(--space-12); }
  .times { display: flex; flex-wrap: wrap; gap: var(--space-8); }
  .time { min-height: var(--size-touch); display: grid; grid-auto-flow: column; gap: 1ch; align-items: center; padding: 0 var(--space-16); border-radius: var(--radius-round);
    box-shadow: inset 0 0 0 var(--stroke-hairline) var(--border-control); color: var(--text-primary); }
  .time.passed { box-shadow: none; background: var(--bg-app); color: var(--text-secondary); }
  .time.next { box-shadow: none; background: var(--bg-inverse); color: var(--text-inverse); }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-40); }
  .secondary { color: var(--text-secondary); }
</style>
