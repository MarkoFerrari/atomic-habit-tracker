<script lang="ts">
  // Top bar (Figma 37:270). Large on tab roots; Navigation for drill-downs; Modal for editors.
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  interface Props {
    type?: 'large' | 'navigation' | 'modal';
    title: string;
    eyebrow?: string;
    leftLabel?: string;
    rightLabel?: string;
    action?: { icon: IconName; label: string };
    onleft?: () => void;
    onright?: () => void;
    onaction?: () => void;
  }
  let { type = 'large', title, eyebrow, leftLabel = 'Back', rightLabel, action, onleft, onright, onaction }: Props = $props();
</script>

{#if type === 'large'}
  <header class="large">
    <div class="titles">
      {#if eyebrow}<p class="t-body-small eyebrow">{eyebrow}</p>{/if}
      <h1 class="t-heading-large">{title}</h1>
    </div>
    {#if action}
      <button class="action" aria-label={action.label} onclick={onaction}><Icon name={action.icon} /></button>
    {/if}
  </header>
{:else}
  <header class="bar">
    <div class="side left">
      <button class="hit {type}" onclick={onleft}>
        {#if type === 'navigation'}<Icon name="chevron-left" />{/if}
        <span class="t-body-default">{leftLabel}</span>
      </button>
    </div>
    <h1 class="t-body-strong">{title}</h1>
    <div class="side right">
      {#if rightLabel}<button class="hit save t-body-strong" onclick={onright}>{rightLabel}</button>{/if}
    </div>
  </header>
{/if}

<style>
  .large { display: flex; align-items: flex-end; gap: var(--space-12); padding: var(--space-8) 0; }
  .titles { flex: 1; min-width: 0; display: grid; gap: var(--space-4); }
  .eyebrow { color: var(--text-tertiary); }
  .action {
    display: grid; place-items: center; flex: none;
    width: var(--size-touch); height: var(--size-touch);
    border-radius: var(--radius-control); box-shadow: inset 0 0 0 var(--stroke-hairline) var(--border-control);
  }
  .bar { display: flex; align-items: center; min-height: var(--size-touch); }
  .side { flex: 1; display: flex; min-width: 0; }
  .right { justify-content: flex-end; }
  .hit { display: flex; align-items: center; min-height: var(--size-touch); color: var(--text-primary); }
  .hit.modal { color: var(--text-secondary); }
  .save { color: var(--text-accent); }
  h1 { white-space: nowrap; }
</style>
