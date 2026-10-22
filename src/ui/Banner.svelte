<script lang="ts">
  // Banner (Figma 37:444). Warning for data or delivery risks (backup, push); Info for neutral context.
  import Icon from './Icon.svelte';
  // 135: `onclose` adds a small x (20 inside a 44 hit area, top right) so the person can remove the banner for good.
  interface Props { tone?: 'warning' | 'info'; message: string; action?: string; onaction?: () => void; onclose?: () => void; closeLabel?: string }
  let { tone = 'warning', message, action, onaction, onclose, closeLabel = 'Close' }: Props = $props();
</script>

<div class="banner" role={tone === 'warning' ? 'alert' : 'status'}>
  <Icon name={tone === 'warning' ? 'alert' : 'info'} />
  <div class="text">
    <p class="t-body-small">{message}</p>
    {#if action}<button class="action t-body-strong" onclick={onaction}>{action}</button>{/if}
  </div>
  {#if onclose}<button class="close" aria-label={closeLabel} onclick={onclose}><Icon name="close" /></button>{/if}
</div>

<style>
  .banner {
    position: relative;
    display: flex; gap: var(--space-12); align-items: flex-start;
    padding: var(--space-16);
    background: var(--bg-card); border-radius: var(--radius-card); color: var(--icon-default);
  }
  .banner:has(.close) .text { padding-right: var(--space-24); }
  .close { position: absolute; top: var(--space-4); right: var(--space-4); width: var(--size-touch); height: var(--size-touch); display: grid; place-items: center; color: var(--text-secondary); }
  .close :global(svg) { width: var(--space-20); height: var(--space-20); }
  .text { display: grid; gap: var(--space-4); min-width: 0; }
  p { color: var(--text-primary); }
  .action { justify-self: start; color: var(--text-accent); min-height: var(--size-touch); margin: calc(var(--space-12) * -1) 0; }
</style>
