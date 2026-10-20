<script lang="ts">
  // N1 How often and when (style B): the frequency on its own white strip, then one card of rows. Habits keep clock
  // time: 07:30 stays 07:30 wherever you are (028). Starts opens the iPhone's own wheel.
  // 119: Per week asks how many times; any day counts, and Starts is the usual time for the nudge.
  // 130 (N1b): the first row, Count it as a habit, on by default. Off makes a reminder: Times a day and the suggested
  // times (every 2 hours from the start), each one a tap to change; no Lasts, no Make it stick, always a nudge.
  import type { Snippet } from 'svelte';
  import SegmentedControl from '../../ui/SegmentedControl.svelte';
  import PickerRow from '../../ui/PickerRow.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import Chip from '../../ui/Chip.svelte';
  import Icon from '../../ui/Icon.svelte';
  import type { HabitDraft, Often } from '../../data/newHabit';
  import { PER_WEEK_MAX, PER_WEEK_MIN } from '../../domain/perweek';
  import { sortTimes, spacingLine, suggestTimes, TIMES_MAX, TIMES_MIN } from '../../domain/timed';
  import HabitHelp, { type HelpTopic } from './HabitHelp.svelte';

  let { draft = $bindable(), countable = true, children }: { draft: HabitDraft; countable?: boolean; children?: Snippet } = $props();
  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const LENGTHS = [2, 5, 10, 15, 20, 30, 45, 60, 90];
  let lasts = $state(false);
  let times = $state(false);
  let help = $state<HelpTopic | null>(null);
  function toggle(d: number) {
    const on = draft.days.includes(d);
    draft = { ...draft, days: on ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort((a, b) => a - b) };
  }
  const length = (m: number) => (m >= 60 && m % 60 === 0 ? `${m / 60} h` : `${m} min`);
  const often = $derived(draft.count
    ? [{ id: 'daily' as Often, label: 'Every day' }, { id: 'days' as Often, label: 'On days' }, { id: 'week' as Often, label: 'Per week' }]
    : [{ id: 'daily' as Often, label: 'Every day' }, { id: 'days' as Often, label: 'On days' }]);
  function setCount(on: boolean) {
    draft = { ...draft, count: on, ...(on ? {} : { often: draft.often === 'week' ? 'daily' : draft.often, remindTimes: suggestTimes(draft.start, draft.perDay) }) };
  }
  function setStart(v: string) { draft = { ...draft, start: v, ...(draft.count ? {} : { remindTimes: suggestTimes(v, draft.perDay) }) }; }
  function setPerDay(n: number) {
    const perDay = Math.min(TIMES_MAX, Math.max(TIMES_MIN, n));
    draft = { ...draft, perDay, remindTimes: suggestTimes(draft.start, perDay) };
  }
  function setTime(i: number, v: string) {
    if (!v) return;
    const next = sortTimes(draft.remindTimes.map((t, k) => (k === i ? v : t)));
    draft = { ...draft, remindTimes: next, perDay: next.length, start: next[0]! };
  }
  const spacing = $derived(spacingLine(draft.remindTimes));
</script>

<div class="often">
  <SegmentedControl label="How often" selected={draft.often} options={often} onselect={(o) => (draft = { ...draft, often: o })} />
  {#if draft.often === 'days'}
    <div class="days" role="group" aria-label="Days">
      {#each DAYS as l, i (i)}
        <button class="day t-body-strong" class:on={draft.days.includes(i)} aria-pressed={draft.days.includes(i)} aria-label={NAMES[i]} onclick={() => toggle(i)}>{l}</button>
      {/each}
    </div>
  {/if}
</div>
<div class="card-list rows">
  {#if countable}
    <div class="count">
      <ListRow type="toggle" label="Count it as a habit" on={draft.count} onchange={setCount} />
      {#if !draft.count}<p class="t-body-small secondary explain">Only reminders: a nudge at each time, nothing to tick. Never counted in your day, runs or ranks.</p>{/if}
    </div>
  {/if}
  {#if draft.count && draft.often === 'week'}
    <ListRow label="Times a week" value={String(draft.times)} onclick={() => (times = true)} />
  {/if}
  <PickerRow label={draft.count && draft.often === 'week' ? 'Usual time' : 'Starts'} type="time" value={draft.start} input={draft.start} onchange={(v) => v && setStart(v)} />
  {#if draft.count}
    <ListRow label="Lasts" value={length(draft.minutes)} onclick={() => (lasts = true)} />
    <ListRow type="toggle" label={draft.often === 'week' ? 'Nudge until it’s done' : 'Nudge at the start'} on={draft.nudge} onchange={(on) => (draft = { ...draft, nudge: on })} oninfo={() => (help = 'nudge')} />
    {@render children?.()}
  {:else}
    <div class="perday">
      <div class="stepper-row">
        <span class="t-body-default">Times a day</span>
        <div class="stepper" role="group" aria-label="Times a day">
          <button class="step" aria-label="Fewer" disabled={draft.perDay <= TIMES_MIN} onclick={() => setPerDay(draft.perDay - 1)}><Icon name="minus" size="small" /></button>
          <span class="t-number-default n" aria-live="polite">{draft.perDay}</span>
          <button class="step" aria-label="More" disabled={draft.perDay >= TIMES_MAX} onclick={() => setPerDay(draft.perDay + 1)}><Icon name="plus" size="small" /></button>
        </div>
      </div>
      <div class="times" role="group" aria-label="Times">
        {#each draft.remindTimes as t, i (t)}
          <label class="time t-number-default">{t}<input type="time" value={t} aria-label="Reminder {i + 1}, {t}" onchange={(e) => setTime(i, (e.currentTarget as HTMLInputElement).value)} /></label>
        {/each}
      </div>
      <p class="t-label-small secondary">{spacing ? `${spacing}. ` : ''}Tap a time to change it.</p>
    </div>
  {/if}
</div>

<HabitHelp bind:topic={help} topics={['nudge']} />

<Sheet open={times} title="Times a week" onclose={() => (times = false)}>
  <div class="chips">
    {#each Array.from({ length: PER_WEEK_MAX }, (_, i) => i + PER_WEEK_MIN) as n (n)}<Chip label={String(n)} selected={draft.times === n} onclick={() => { draft = { ...draft, times: n }; times = false; }} />{/each}
  </div>
  <p class="t-body-small secondary sheet-note">Any days count. On the last days of a week, the ones still needed become due.</p>
</Sheet>

<Sheet open={lasts} title="How long" onclose={() => (lasts = false)}>
  <div class="chips">
    {#each LENGTHS as m (m)}<Chip label={length(m)} selected={draft.minutes === m} onclick={() => { draft = { ...draft, minutes: m }; lasts = false; }} />{/each}
  </div>
</Sheet>

<style>
  .often { display: grid; gap: var(--space-12); }
  .days { display: flex; justify-content: space-between; }
  .day { width: var(--size-touch); height: var(--size-touch); border-radius: var(--radius-round); color: var(--text-secondary); background: var(--bg-card);
    transition: background var(--motion-duration-fast) var(--motion-easing-standard); }
  .day.on { background: var(--bg-inverse); color: var(--text-inverse); }
  .count { display: grid; }
  .explain { padding-bottom: var(--space-12); }
  .perday { display: grid; gap: var(--space-12); padding: var(--space-12) 0 var(--space-16); }
  .stepper-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-12); }
  .stepper { display: flex; align-items: center; gap: var(--space-4); }
  .step { position: relative; width: var(--size-touch); height: var(--size-touch); display: grid; place-items: center; color: var(--icon-default); }
  .step::before { content: ''; position: absolute; inset: calc((var(--size-touch) - var(--space-32)) / 2); border-radius: var(--radius-round); background: var(--bg-app); } /* 041: a 32 circle in a 44 target */
  .step :global(svg) { position: relative; }
  .step:disabled { color: var(--icon-muted); }
  .n { min-width: var(--space-24); text-align: center; }
  .times { display: flex; flex-wrap: wrap; gap: var(--space-8); }
  .time { position: relative; min-width: calc(var(--space-64) + var(--space-16)); min-height: var(--size-touch); display: grid; place-items: center;
    padding: 0 var(--space-12); border-radius: var(--radius-round); background: var(--bg-app); color: var(--text-primary); }
  .time input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; font: var(--type-body-default); -webkit-appearance: none; appearance: none; border: 0; background: none; }
  .time:has(input:focus-visible) { outline: var(--stroke-illustration) solid var(--border-strong); outline-offset: var(--space-4); }
  .chips { display: flex; flex-wrap: wrap; column-gap: var(--space-8); padding-bottom: var(--space-16); }
  .secondary { color: var(--text-secondary); }
  .sheet-note { padding-bottom: var(--space-40); }
</style>
