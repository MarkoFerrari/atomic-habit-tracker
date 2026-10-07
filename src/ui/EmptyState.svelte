<script lang="ts">
  // Empty state (Figma 37:454): the zero is typographic, not an illustration (E17).
  import Button from './Button.svelte';
  interface Props { number?: string; title: string; body: string; action?: string; onaction?: () => void; secondary?: string; onsecondary?: () => void }
  let { number = '0', title, body, action, onaction, secondary, onsecondary }: Props = $props();
</script>

<div class="empty">
  <p class="t-number-display number" aria-hidden="true">{number}</p>
  <h2 class="t-heading-small">{title}</h2>
  <p class="t-body-small body">{body}</p>
  {#if action}<Button onclick={onaction}>{action}</Button>{/if}
  {#if secondary}<Button variant="tertiary" onclick={onsecondary}>{secondary}</Button>{/if}
</div>

<style>
  .empty { display: grid; justify-items: center; gap: var(--space-8); padding: var(--space-32) 0; text-align: center; }
  .number { color: var(--text-disabled); }
  .body { color: var(--text-secondary); }
  .empty :global(.btn) { margin-top: var(--space-8); }
</style>
