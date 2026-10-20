<script lang="ts">
  // List row (Figma 36:309). Navigation opens a screen; Toggle switches a setting;
  // Destructive deletes and is always followed by a confirming sheet.
  // 116: `oninfo` adds an (i) beside the label that explains the row in a sheet. It has its own 44 hit area (041)
  // and sits above the row's own button, which still covers the whole row.
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
    onchange?: (on: boolean) => void;
    oninfo?: () => void;
    /** Style B: the icon on a 40 tile of this colour (E2 Settings). */
    tile?: string;
  }
  let { type = 'navigation', label, value, icon, on = $bindable(false), onclick, onchange, oninfo, tile }: Props = $props();
</script>

{#snippet glyph()}
  {#if icon}{#if tile}<span class="tile" style:--tile={tile}><Icon name={icon} /></span>{:else}<Icon name={icon} />{/if}{/if}
{/snippet}

{#snippet info()}
  <button class="info" aria-label="What is {label}?" onclick={oninfo}><Icon name="info" size="small" /></button>
{/snippet}

{#if type === 'toggle'}
  <div class="row">
    {@render glyph()}
    <span class="label t-body-default">{label}{#if oninfo}{@render info()}{/if}</span>
    <Toggle bind:on {label} {onchange} />
  </div>
{:else if oninfo}
  <div class="row {type} stretched">
    {@render glyph()}
    <span class="label t-body-default">{label}{@render info()}</span>
    <button class="hit" {onclick} aria-label={value ? `${label}, ${value}` : label}>
      {#if type === 'navigation'}
        {#if value}<span class="value t-body-small">{value}</span>{/if}
        <span class="chevron"><Icon name="chevron-right" /></span>
      {/if}
    </button>
  </div>
{:else}
  <button class="row {type}" {onclick}>
    {@render glyph()}
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
  .destructive .label { color: var(--text-destructive); }
  .value { color: var(--text-tertiary); white-space: nowrap; }
  .chevron { color: var(--icon-muted); display: flex; }
  .tile { flex: none; display: grid; place-items: center; width: var(--space-40); height: var(--space-40); border-radius: var(--radius-tile); background: var(--tile); color: var(--icon-default); }
  /* 116: the row's button covers the whole row (stretched); the (i) sits above it */
  .stretched { position: relative; }
  .hit { display: flex; align-items: center; gap: var(--space-12); color: inherit; }
  .hit::after { content: ''; position: absolute; inset: 0; }
  .label { display: inline-flex; align-items: center; }
  .info {
    position: relative; z-index: 1; flex: none; display: grid; place-items: center;
    width: var(--size-touch); height: var(--size-touch); color: var(--icon-muted);
    margin-block: calc((var(--space-24) - var(--size-touch)) / 2);
    margin-inline: calc((var(--space-16) - var(--size-touch)) / 2 + var(--space-4)) calc((var(--space-16) - var(--size-touch)) / 2);
  }
</style>
