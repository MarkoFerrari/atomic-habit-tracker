<script lang="ts">
  // S4 When / E1 (Figma page 14): every day or on chosen days, then the start, the length and the nudge.
  // Habits keep clock time: 07:30 stays 07:30 wherever you are (028). Starts opens the iPhone's own wheel.
  import SegmentedControl from '../../ui/SegmentedControl.svelte';
  import PickerRow from '../../ui/PickerRow.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import Chip from '../../ui/Chip.svelte';
  import type { HabitDraft, Often } from '../../data/newHabit';

  let { draft = $bindable() }: { draft: HabitDraft } = $props();
  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const LENGTHS = [2, 5, 10, 15, 20, 30, 45, 60, 90];
  let lasts = $state(false);
  function toggle(d: number) {
    const on = draft.days.includes(d);
    draft = { ...draft, days: on ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort((a, b) => a - b) };
  }
  const length = (m: number) => (m >= 60 && m % 60 === 0 ? `${m / 60} h` : `${m} min`);
</script>

<div class="block">
  <SegmentedControl label="How often" selected={draft.often}
    options={[{ id: 'daily' as Often, label: 'Every day' }, { id: 'days' as Often, label: 'On days' }]}
    onselect={(o) => (draft = { ...draft, often: o })} />
  {#if draft.often === 'days'}
    <div class="days" role="group" aria-label="Days">
      {#each DAYS as l, i (i)}
        <button class="day t-body-strong" class:on={draft.days.includes(i)} aria-pressed={draft.days.includes(i)} aria-label={NAMES[i]} onclick={() => toggle(i)}>{l}</button>
      {/each}
    </div>
  {/if}
</div>
<div class="rows">
  <PickerRow label="Starts" type="time" value={draft.start} input={draft.start} onchange={(v) => v && (draft = { ...draft, start: v })} />
  <ListRow label="Lasts" value={length(draft.minutes)} onclick={() => (lasts = true)} />
  <ListRow type="toggle" label="Nudge at the start" on={draft.nudge} onchange={(on) => (draft = { ...draft, nudge: on })} />
</div>

<Sheet open={lasts} title="How long" onclose={() => (lasts = false)}>
  <div class="chips">
    {#each LENGTHS as m (m)}<Chip label={length(m)} selected={draft.minutes === m} onclick={() => { draft = { ...draft, minutes: m }; lasts = false; }} />{/each}
  </div>
</Sheet>

<style>
  .block { display: grid; gap: var(--space-16); }
  .days { display: flex; justify-content: space-between; }
  .day { width: var(--size-touch); height: var(--size-touch); border-radius: var(--radius-round); color: var(--text-secondary);
    box-shadow: inset 0 0 0 var(--stroke-hairline) var(--border-control); transition: background var(--motion-duration-fast) var(--motion-easing-standard); }
  .day.on { background: var(--bg-inverse); color: var(--text-inverse); box-shadow: none; }
  .rows { display: grid; }
  .chips { display: flex; flex-wrap: wrap; column-gap: var(--space-8); padding-bottom: var(--space-40); }
</style>
