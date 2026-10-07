<script lang="ts">
  // Tab bar (Figma 37:410): root navigation, four tabs, each a full-width hit area.
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  import type { Tab } from './tabs';

  const TABS: { id: Tab; label: string; icon: IconName }[] = [
    { id: 'today', label: 'Today', icon: 'today' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    { id: 'stats', label: 'Stats', icon: 'stats' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];
  // `ready`: tabs whose screens exist. The others show, but say they're not built yet (M3–M5).
  let { active, onselect, ready = TABS.map((t) => t.id) }: { active: Tab; onselect?: (tab: Tab) => void; ready?: Tab[] } = $props();
</script>

<nav aria-label="Main">
  {#each TABS as tab, i (tab.id)}
    <button
      class:active={tab.id === active}
      aria-current={tab.id === active ? 'page' : undefined}
      aria-label="{tab.label}, tab, {i + 1} of {TABS.length}{ready.includes(tab.id) ? '' : ', coming later'}"
      aria-disabled={!ready.includes(tab.id)}
      class:later={!ready.includes(tab.id)}
      onclick={() => ready.includes(tab.id) && onselect?.(tab.id)}
    >
      <Icon name={tab.icon} />
      <span class="t-label-small">{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  nav {
    display: flex; background: var(--bg-default);
    border-top: var(--stroke-hairline) solid var(--border-divider);
    padding: var(--space-12) env(safe-area-inset-right) max(env(safe-area-inset-bottom), var(--space-12)) env(safe-area-inset-left);
  }
  button { flex: 1; display: grid; justify-items: center; gap: var(--space-4); min-height: var(--size-touch); color: var(--icon-muted); }
  span { color: var(--text-tertiary); }
  .active { color: var(--action-primary); }
  .active span { color: var(--text-accent); }
  .later { opacity: 0.4; cursor: default; } /* as the disabled controls in Figma (40%) */
</style>
