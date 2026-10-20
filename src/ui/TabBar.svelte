<script module lang="ts">
  // The tab bar is drawn by each root screen, so the last tab is remembered here: the new screen's capsule glides
  // from where the old one was.
  let lastTab: string | null = null;
</script>

<script lang="ts">
  // Tab bar, style B (decision 125, Playground section 12, version B): a floating ink pill. The active tab sits in a
  // white capsule with its label; on a tap the icon dips (0.88), the capsule glides and reshapes to the new tab
  // (base, spring) and the old label folds away. Reduced motion turns it into a short fade (motion.css).
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  import type { Tab } from './tabs';

  const TABS: { id: Tab; label: string; icon: IconName }[] = [
    { id: 'today', label: 'Today', icon: 'today' },
    { id: 'habits', label: 'Habits', icon: 'sprout' },
    { id: 'stats', label: 'Stats', icon: 'stats' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];
  // `ready`: tabs whose screens exist. The others show, but say they're not built yet.
  let { active, onselect, ready = TABS.map((t) => t.id) }: { active: Tab; onselect?: (tab: Tab) => void; ready?: Tab[] } = $props();

  // `shown` is the tab drawn as active: it starts at the previous tab and moves to `active` one frame later.
  // svelte-ignore state_referenced_locally
  let shown = $state<string>(lastTab && lastTab !== active ? lastTab : active);
  let moved = $state(false);
  let nav = $state<HTMLElement>();
  let capsule = $state<{ x: number; w: number } | null>(null);
  /** Where the capsule ends up, from the final widths: an inactive tab is padding + icon, the active one adds its label. */
  function target(id: string) {
    if (!nav) return null;
    const buttons = [...nav.querySelectorAll<HTMLElement>('button')];
    const style = getComputedStyle(nav);
    const pad = parseFloat(style.paddingLeft), gap = parseFloat(style.columnGap || style.gap) || 0;
    let x = pad;
    for (const [i, b] of buttons.entries()) {
      const glyph = b.querySelector<HTMLElement>('.glyph')!, label = b.querySelector<HTMLElement>('.label')!;
      const bs = getComputedStyle(b);
      const base = parseFloat(bs.paddingLeft) + parseFloat(bs.paddingRight) + glyph.offsetWidth;
      const w = TABS[i]!.id === id ? base + parseFloat(style.getPropertyValue('--space-8')) + label.scrollWidth : base;
      if (TABS[i]!.id === id) return { x, w };
      x += w + gap;
    }
    return null;
  }
  onMount(() => {
    capsule = target(shown);
    lastTab = active;
    if (shown !== active) requestAnimationFrame(() => requestAnimationFrame(() => { moved = true; shown = active; capsule = target(active); }));
  });
  $effect(() => { if (active !== shown && capsule) { moved = true; shown = active; capsule = target(active); lastTab = active; } });
  function select(id: Tab) {
    if (!ready.includes(id) || id === active) return;
    onselect?.(id);
  }
</script>

<div class="dock">
  <nav aria-label="Main" bind:this={nav}>
    {#if capsule}<span class="capsule" class:moved style:transform="translateX({capsule.x}px)" style:width="{capsule.w}px"></span>{/if}
    {#each TABS as tab, i (tab.id)}
      <button
        class:active={tab.id === shown}
        aria-current={tab.id === active ? 'page' : undefined}
        aria-label="{tab.label}, tab, {i + 1} of {TABS.length}{ready.includes(tab.id) ? '' : ', coming later'}"
        aria-disabled={!ready.includes(tab.id)}
        class:later={!ready.includes(tab.id)}
        onclick={() => select(tab.id)}
      >
        <span class="glyph"><Icon name={tab.icon} /></span>
        <span class="label t-label-small">{tab.label}</span>
      </button>
    {/each}
  </nav>
</div>

<style>
  .dock {
    position: sticky; bottom: 0; z-index: 1; display: flex; justify-content: center; pointer-events: none;
    padding: var(--space-12) env(safe-area-inset-right) max(env(safe-area-inset-bottom), var(--space-12)) env(safe-area-inset-left);
  }
  nav {
    position: relative; display: flex; gap: var(--space-4); padding: var(--space-8); pointer-events: auto;
    background: var(--bg-inverse); border-radius: var(--radius-round);
  }
  .capsule {
    position: absolute; top: var(--space-8); left: 0; height: var(--size-control);
    background: var(--bg-card); border-radius: var(--radius-round);
  }
  .capsule.moved { transition: transform var(--motion-duration-base) var(--motion-easing-spring), width var(--motion-duration-base) var(--motion-easing-spring); }
  button {
    position: relative; display: flex; align-items: center; gap: var(--space-8);
    min-height: var(--size-control); padding: 0 var(--space-16); border-radius: var(--radius-round);
    color: var(--icon-inverse); transition: padding var(--motion-duration-base) var(--motion-easing-spring);
  }
  .glyph { display: flex; transition: transform var(--motion-duration-instant) var(--motion-easing-standard); }
  button:active .glyph { transform: scale(0.88); }
  .label { max-width: 0; overflow: hidden; opacity: 0; white-space: nowrap; transition: max-width var(--motion-duration-base) var(--motion-easing-standard), opacity var(--motion-duration-fast) var(--motion-easing-standard); }
  .active { color: var(--text-primary); }
  .active .label { max-width: calc(var(--space-64) + var(--space-16)); opacity: 1; }
  button:not(.active) { gap: 0; }
  .later { opacity: 0.4; cursor: default; }
</style>
