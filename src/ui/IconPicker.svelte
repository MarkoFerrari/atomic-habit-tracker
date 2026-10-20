<script lang="ts">
  // N2 Choose an object (122, replaces the icon grid of H45b and 043): the 48 habit objects in their 8 groups, each on
  // its own field, with a search. The selected one is ringed in ink. Each tile is a 44+ target (041). The list scrolls
  // inside the sheet, which itself never scrolls (076).
  import Icon from './Icon.svelte';
  import HabitObject from './HabitObject.svelte';
  import type { HabitIcon } from './icons';
  import { OBJECT_GROUPS } from './objects';

  let { selected = $bindable() }: { selected: HabitIcon } = $props();
  let query = $state('');
  const words = (i: string) => i.replace(/-\d+$/, '').replace(/-/g, ' ');
  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return OBJECT_GROUPS.map((g) => ({ ...g, icons: q && !g.label.toLowerCase().includes(q) ? g.icons.filter((i) => words(i).includes(q)) : g.icons }))
      .filter((g) => g.icons.length);
  });
</script>

<div class="picker">
  <label class="search">
    <Icon name="search" size="small" />
    <input class="t-body-default" type="search" placeholder="Search objects" bind:value={query} enterkeyhint="search" autocapitalize="none" />
  </label>
  <div class="list">
    {#each groups as g (g.id)}
      <section aria-label={g.label}>
        <h3 class="t-label-section">{g.label}</h3>
        <div class="grid" role="radiogroup" aria-label={g.label}>
          {#each g.icons as icon (icon)}
            <button class="option" class:selected={icon === selected} role="radio" aria-checked={icon === selected} aria-label={words(icon)} onclick={() => (selected = icon)}>
              <HabitObject {icon} size="lg" />
            </button>
          {/each}
        </div>
      </section>
    {:else}
      <p class="t-body-small empty">No object called “{query}”. Try a group: Move, Drink, Learn, Rest, Joy, Food, Health, Make.</p>
    {/each}
  </div>
</div>

<style>
  .picker { display: grid; gap: var(--space-16); }
  .search {
    display: flex; align-items: center; gap: var(--space-8); min-height: var(--size-control); padding: 0 var(--space-16);
    background: var(--bg-app); border-radius: var(--radius-round); color: var(--icon-muted);
  }
  .search input { flex: 1; min-width: 0; border: none; background: none; color: var(--text-primary); outline: none; }
  .list { display: grid; gap: var(--space-16); max-height: 56vh; overflow-y: auto; overscroll-behavior: contain; padding-bottom: var(--space-8); }
  section { display: grid; gap: var(--space-8); }
  h3 { color: var(--text-secondary); }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-8); justify-items: start; }
  .option { display: grid; place-items: center; padding: var(--space-4); border-radius: calc(var(--radius-tile) + var(--space-4)); }
  .option.selected { box-shadow: inset 0 0 0 var(--stroke-illustration) var(--border-strong); }
  .empty { color: var(--text-secondary); }
</style>
