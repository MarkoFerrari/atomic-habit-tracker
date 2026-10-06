<script lang="ts">
  // Banner (Figma 37:444). Warning for data or delivery risks (backup, push); Info for neutral context.
  import Icon from './Icon.svelte';
  interface Props { tone?: 'warning' | 'info'; message: string; action?: string; onaction?: () => void }
  let { tone = 'warning', message, action, onaction }: Props = $props();
</script>

<div class="banner" role={tone === 'warning' ? 'alert' : 'status'}>
  <Icon name={tone === 'warning' ? 'alert' : 'info'} />
  <div class="text">
    <p class="t-body-small">{message}</p>
    {#if action}<button class="action t-body-strong" onclick={onaction}>{action}</button>{/if}
  </div>
</div>

<style>
  .banner {
    display: flex; gap: var(--space-12); align-items: flex-start;
    padding: var(--space-12) var(--space-16) var(--space-12) var(--space-12);
    background: var(--bg-subtle); border-radius: var(--radius-control); color: var(--icon-default);
  }
  .text { display: grid; gap: var(--space-4); min-width: 0; }
  p { color: var(--text-primary); }
  .action { justify-self: start; color: var(--text-accent); min-height: var(--size-touch); margin: calc(var(--space-12) * -1) 0; }
</style>
