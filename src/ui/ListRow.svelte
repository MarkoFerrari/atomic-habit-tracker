<script lang="ts">
  // List row (Figma 36:309). Navigation opens a screen; Toggle switches a setting;
  // Destructive deletes and is always followed by a confirming sheet.
  import Icon from './Icon.svelte';
  import Toggle from './Toggle.svelte';
  import type { IconName } from './icons';

  interface Props {
    type?: 'navigation' | 'toggle' | 'destructive';
    label: string;
    value?: string;
    icon?: IconName;
    on?: boolean;
    onclick?: () => void;
  }
  let { type = 'navigation', label, value, icon, on = $bindable(false), onclick }: Props = $props();
</script>

{#if type === 'toggle'}
  <div class="row">
    {#if icon}<Icon name={icon} />{/if}
    <span class="label t-body-default">{label}</span>
    <Toggle bind:on {label} />
  </div>
{:else}
  <button class="row {type}" {onclick}>
    {#if icon}<Icon name={icon} />{/if}
    <span class="label t-body-default">{label}</span>
    {#if type === 'navigation'}
      {#if value}<span class="value t-body-small">{value}</span>{/if}
      <span class="chevron"><Icon name="chevron-right" /></span>
    {/if}
  </button>
{/if}

<style>
  .row {
    display: flex; align-items: center; gap: var(--space-12); width: 100%;
    min-height: var(--size-control); padding: var(--space-12) 0; text-align: left; color: var(--icon-default);
  }
  .label { flex: 1; min-width: 0; color: var(--text-primary); }
  .destructive .label { color: var(--text-accent); }
  .value { color: var(--text-tertiary); white-space: nowrap; }
  .chevron { color: var(--icon-muted); display: flex; }
</style>
