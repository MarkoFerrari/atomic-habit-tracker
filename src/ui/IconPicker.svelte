<script lang="ts">
  // Habit icon grid (H45b, 043): 8 per row, three rows first, the full set behind "Show all icons".
  // Selected = accent ring. Each option is a 44 px target (041).
  import Icon from './Icon.svelte';
  import Button from './Button.svelte';
  import { HABIT_ICONS, type HabitIcon } from './icons';

  let { selected = $bindable() }: { selected: HabitIcon } = $props();

  // The first three rows as designed (eat and cook, drink and training, read and study), then the rest.
  const FIRST: HabitIcon[] = [
    'coffee', 'utensils', 'salad', 'apple', 'sandwich', 'soup', 'chef-hat', 'cooking-pot',
    'glass-water', 'cup-soda', 'milk', 'dumbbell', 'biceps-flexed', 'bike', 'person-standing', 'timer',
    'book-open', 'book', 'book-open-text', 'notebook-pen', 'graduation-cap', 'brain', 'pen-line', 'moon',
  ];
  const ALL: HabitIcon[] = [...FIRST, ...HABIT_ICONS.filter((i) => !FIRST.includes(i))];

  let showAll = $state(!FIRST.includes(selected));
  const shown = $derived(showAll ? ALL : FIRST);
</script>

<div class="grid" role="radiogroup" aria-label="Habit icon">
  {#each shown as icon (icon)}
    <button class="option" class:selected={icon === selected} role="radio" aria-checked={icon === selected} aria-label={icon.replace(/-/g, ' ')}
      onclick={() => (selected = icon)}>
      <Icon name={icon} />
    </button>
  {/each}
</div>
{#if !showAll}
  <Button variant="tertiary" onclick={() => (showAll = true)}>Show all icons</Button>
{/if}

<style>
  .grid { display: grid; grid-template-columns: repeat(8, var(--size-touch)); justify-content: space-between; }
  .option {
    width: var(--size-touch); height: var(--size-touch); display: grid; place-items: center;
    border-radius: var(--radius-control); color: var(--icon-default);
  }
  .option.selected { box-shadow: inset 0 0 0 var(--stroke-illustration) var(--action-primary); }
</style>
