<script lang="ts">
  import { iconMarkup, type IconName } from './icons';
  // Lucide on a 24 px grid with the stroke/icon token (1.5). Colour comes from currentColor.
  let { name, label }: { name: IconName; label?: string } = $props();
  const markup = $derived(iconMarkup(name));
</script>

<svg class="icon" viewBox="0 0 24 24" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
  {@html markup}
</svg>

<style>
  .icon {
    width: var(--size-icon); height: var(--size-icon); flex: none;
    fill: none; stroke: currentColor; stroke-width: var(--stroke-icon);
    stroke-linecap: round; stroke-linejoin: round;
  }
</style>
