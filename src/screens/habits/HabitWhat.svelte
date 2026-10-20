<script lang="ts">
  // N1 What (style B, Playground section 17): one white card with the habit's object on its field and the name beside
  // it. Change opens N2, the objects by group (122). The field colour comes from the object's group, never chosen (123).
  // An action with an end point (004); until the object is chosen by hand, it follows the name.
  import TextField from '../../ui/TextField.svelte';
  import Chip from '../../ui/Chip.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import IconPicker from '../../ui/IconPicker.svelte';
  import Button from '../../ui/Button.svelte';
  import HabitObject from '../../ui/HabitObject.svelte';
  import type { HabitIcon } from '../../ui/icons';
  import { guessHabitIcon } from '../../ui/habit-icon-guess';
  import { SUGGESTIONS, withTitle, type HabitDraft } from '../../data/newHabit';

  let { draft = $bindable(), suggestions = true, label = 'Habit' }: { draft: HabitDraft; suggestions?: boolean; label?: string } = $props();
  let title = $state(draft.title);
  let iconTouched = $state(false);
  let more = $state(false);
  let pick = $state<HabitIcon>(draft.icon);
  $effect(() => {
    const t = title;
    const next = withTitle(draft, t);
    if (!iconTouched && t.trim()) next.icon = guessHabitIcon(t) as HabitIcon;
    if (next.title !== draft.title || next.icon !== draft.icon || next.minutes !== draft.minutes) draft = next;
  });
  function choose(i: HabitIcon) { iconTouched = true; draft = { ...draft, icon: i }; }
</script>

<div class="what card">
  <button class="object" aria-label="Change the object" onclick={() => { pick = draft.icon; more = true; }}>
    <HabitObject icon={draft.icon} size="lg" />
    <span class="t-label-small change">Change</span>
  </button>
  <div class="name"><TextField bind:value={title} {label} placeholder="Read 20 min" autocapitalize="sentences" filled /></div>
</div>
{#if suggestions}
  <div class="chips" aria-label="Suggestions">
    {#each SUGGESTIONS as s (s)}<Chip label={s} selected={title === s} onclick={() => (title = s)} />{/each}
  </div>
{/if}

<Sheet open={more} title="Choose an object" onclose={() => (more = false)}>
  <div class="sheet">
    <IconPicker bind:selected={pick} />
    <Button onclick={() => { choose(pick); more = false; }}>Use this object</Button>
  </div>
</Sheet>

<style>
  .what { display: flex; align-items: flex-start; gap: var(--space-16); }
  .object { display: grid; justify-items: center; gap: var(--space-4); flex: none; }
  .change { color: var(--text-primary); text-decoration: underline; text-underline-offset: var(--space-4); }
  .name { flex: 1; min-width: 0; }
  .chips { display: flex; flex-wrap: wrap; column-gap: var(--space-8); }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-16); }
</style>
