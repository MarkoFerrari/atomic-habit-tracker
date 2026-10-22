<script lang="ts">
  // 134 Reminder card (Playground section 18, R1–R3): what a tap on a reminder's push opens. A stand-alone card like
  // the empty Today's: the reminder's object, what has been nudged so far today, Close. Not a habit: nothing to
  // tick and nothing counted (005, 130), so the times are the nudges sent, not drinks taken. Close goes to Today.
  // A pushed screen: no tab bar (044). A reminder deleted since the push has nothing to show: straight to Today.
  import { onMount } from 'svelte';
  import Button from '../../ui/Button.svelte';
  import HabitObject from '../../ui/HabitObject.svelte';
  import { getTimed } from '../../data/timed';
  import type { TimedReminder } from '../../data/schema';
  import { habitDayOf } from '../../domain/day';
  import { wallOf } from '../../domain/zone';
  import { nudgeCard } from '../../domain/timed';

  interface Props { id: string; onclose: () => void }
  let { id, onclose }: Props = $props();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let r = $state.raw<TimedReminder | null>(null);
  onMount(async () => {
    r = await getTimed(id);
    if (!r) onclose();
  });
  const now = new Date();
  const card = $derived(r ? nudgeCard(r, habitDayOf(now, zone), wallOf(now, zone).slice(11, 16)) : null);
</script>

<main class="screen nudge">
  {#if r && card}
    <section class="card sheet-card">
      <HabitObject icon={r.icon} size="xl" />
      <p class="t-label-section secondary">Reminder · not counted</p>
      <h1 class="t-heading-medium">{r.title}</h1>
      <p class="t-body-small secondary">{card.line}</p>
      {#if card.passed.length}
        <ul class="times" aria-label="Nudges so far today">
          {#each card.passed as t, i (t)}
            <li class="time t-number-default" class:current={i === card.passed.length - 1}>{t}</li>
          {/each}
        </ul>
      {/if}
      <div class="close"><Button onclick={onclose}>Close</Button></div>
    </section>
  {/if}
</main>

<style>
  .nudge { min-height: 100dvh; display: grid; align-content: center; }
  .sheet-card { display: grid; justify-items: center; gap: var(--space-8); padding: var(--space-24) var(--space-24) var(--space-32); text-align: center; }
  .sheet-card :global(.object) { margin-bottom: var(--space-8); }
  .times { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-8); margin-top: var(--space-8); }
  .time { min-height: var(--size-touch); display: grid; place-items: center; padding: 0 var(--space-16); border-radius: var(--radius-round); background: var(--bg-app); color: var(--text-secondary); }
  .time.current { background: var(--bg-inverse); color: var(--text-inverse); }
  .close { width: 100%; margin-top: var(--space-16); }
  .secondary { color: var(--text-secondary); }
</style>
