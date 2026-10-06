<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props { variant?: 'primary' | 'secondary'; disabled?: boolean; onclick?: () => void; children: Snippet }
  let { variant = 'primary', disabled = false, onclick, children }: Props = $props();
</script>

<button class="btn {variant}" {disabled} {onclick}>{@render children()}</button>

<style>
  .btn {
    display: flex; align-items: center; justify-content: center;
    width: 100%; min-height: var(--size-control);
    padding: 0 var(--space-16);
    border-radius: var(--radius-control);
    font: var(--type-body-strong);
    transition: transform var(--motion-press), background-color var(--motion-press);
  }
  .btn:active:not(:disabled) { transform: scale(0.98); }
  .primary { background: var(--action-primary); color: var(--action-on-primary); }
  .primary:active:not(:disabled) { background: var(--action-primary-pressed); }
  .secondary { background: var(--bg-default); color: var(--text-primary); box-shadow: inset 0 0 0 var(--stroke-hairline) var(--border-strong); }
  .btn:disabled { background: var(--bg-subtle); color: var(--text-disabled); box-shadow: none; cursor: default; }
</style>
