<script lang="ts">
  // S3 Your habit / E1 (Figma page 14): an action with an end point (004). A suggestion fills the field in one tap;
  // the icon becomes the medal's icon (055). Seven quick choices, the full set (043) behind "More icons".
  import TextField from '../../ui/TextField.svelte';
  import Chip from '../../ui/Chip.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import Icon from '../../ui/Icon.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import IconPicker from '../../ui/IconPicker.svelte';
  import Button from '../../ui/Button.svelte';
  import type { HabitIcon } from '../../ui/icons';
  import { guessHabitIcon } from '../../ui/habit-icon-guess';
  import { SUGGESTIONS, withTitle, type HabitDraft } from '../../data/newHabit';

  let { draft = $bindable(), suggestions = true }: { draft: HabitDraft; suggestions?: boolean } = $props();
  const QUICK: HabitIcon[] = ['book-open', 'person-standing', 'coffee', 'dumbbell', 'heart-pulse', 'moon', 'palette'];
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
  const icons = $derived(QUICK.includes(draft.icon) ? QUICK : [draft.icon, ...QUICK.slice(0, 6)]);
  function choose(i: HabitIcon) { iconTouched = true; draft = { ...draft, icon: i }; }
</script>

<div class="block">
  <TextField bind:value={title} label="Habit" placeholder="Read 20 min" autocapitalize="sentences" />
  {#if suggestions}
    <div class="chips" aria-label="Suggestions">
      {#each SUGGESTIONS as s (s)}<Chip label={s} selected={title === s} onclick={() => (title = s)} />{/each}
    </div>
  {/if}
</div>
<div class="block">
  <SectionLabel text="Icon" />
  <div class="icons" role="radiogroup" aria-label="Habit icon">
    {#each icons as i (i)}
      <button class="icon" class:selected={i === draft.icon} role="radio" aria-checked={i === draft.icon} aria-label={i.replace(/-/g, ' ')} onclick={() => choose(i)}>
        <Icon name={i} />
      </button>
    {/each}
  </div>
  <Button variant="tertiary" onclick={() => { pick = draft.icon; more = true; }}>More icons</Button>
</div>

<Sheet open={more} title="Choose an icon" onclose={() => (more = false)}>
  <div class="sheet">
    <IconPicker bind:selected={pick} />
    <Button onclick={() => { choose(pick); more = false; }}>Use this icon</Button>
  </div>
</Sheet>

<style>
  .block { display: grid; gap: var(--space-16); }
  .chips { display: flex; flex-wrap: wrap; column-gap: var(--space-8); }
  .icons { display: flex; justify-content: space-between; }
  .icon { width: var(--size-touch); height: var(--size-touch); border-radius: var(--radius-round); display: grid; place-items: center; background: var(--bg-subtle); color: var(--icon-default); }
  .icon.selected { background: var(--bg-default); box-shadow: inset 0 0 0 var(--stroke-illustration) var(--border-strong); }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-16); }
</style>
