<script lang="ts">
  // Button (Figma 32:144). Primary: the one action of a screen. Secondary: alternatives.
  // Tertiary: low-emphasis text actions. Disabled is shown, never hidden, when the reason is visible nearby.
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  interface Props {
    variant?: 'primary' | 'secondary' | 'tertiary';
    icon?: IconName;
    disabled?: boolean;
    type?: 'button' | 'submit';
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  }
  let { variant = 'primary', icon, disabled = false, type = 'button', onclick, children }: Props = $props();
</script>

<button class="btn {variant}" {type} {disabled} {onclick}>
  {#if icon}<Icon name={icon} />{/if}
  <span class="t-body-strong">{@render children()}</span>
</button>

<style>
  .btn {
    display: flex; align-items: center; justify-content: center; gap: var(--space-8);
    width: 100%; min-height: var(--size-control); padding: 0 var(--space-16);
    border-radius: var(--radius-control);
    transition: background-color var(--motion-press), transform var(--motion-press);
  }
  .btn:active:not(:disabled) { transform: scale(0.98); }
  .primary { background: var(--action-primary); color: var(--action-on-primary); }
  .primary:active:not(:disabled) { background: var(--action-primary-pressed); }
  .secondary { background: var(--bg-subtle); color: var(--text-primary); } /* 035: a filled track, no outline (U02) */
  .secondary:active:not(:disabled) { background: var(--border-divider); }
  .tertiary { color: var(--text-accent); }
  .tertiary:active:not(:disabled) { background: var(--bg-subtle); }
  .btn:disabled { color: var(--text-disabled); cursor: default; }
  .primary:disabled { background: var(--bg-subtle); }
</style>
