<script lang="ts">
  // Icon button (Figma 32:156). Every icon-only button needs an accessible label, e.g. "New event".
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  let { icon, label, variant = 'outline', onclick }: { icon: IconName; label: string; variant?: 'outline' | 'plain'; onclick?: () => void } = $props();
</script>

<button class="icon-button {variant}" aria-label={label} {onclick}><Icon name={icon} /></button>

<style>
  .icon-button {
    display: grid; place-items: center; flex: none;
    width: var(--size-touch); height: var(--size-touch); border-radius: var(--radius-control); color: var(--icon-default);
    transition: background-color var(--motion-press);
  }
  .outline { box-shadow: inset 0 0 0 var(--stroke-hairline) var(--border-control); }
  .icon-button:active { background: var(--bg-subtle); }
</style>
