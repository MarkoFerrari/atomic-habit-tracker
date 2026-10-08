<script lang="ts">
  // "‹ Back" for flows and pushed views (Figma page 14, S2–S4): the chevron's drawing sits flush with the gutter,
  // so it lines up with the content below it. Its 24 box carries 8 of empty space on the left, offset here.
  import Icon from './Icon.svelte';
  let { label = 'Back', onclick }: { label?: string; onclick: () => void } = $props();
</script>

<button class="back t-body-default" {onclick}><span class="chev"><Icon name="chevron-left" /></span>{label}</button>

<style>
  .back { display: inline-flex; align-items: center; gap: var(--space-4); min-height: var(--size-touch); align-self: flex-start; color: var(--text-primary); }
  .chev { display: flex; width: var(--space-16); overflow: visible; }
  .chev :global(svg) { margin-left: calc(var(--space-8) * -1); }
</style>
