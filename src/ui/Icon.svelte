<script lang="ts">
  import { iconMarkup, type IconName } from './icons';
  // Lucide on a 24 px grid with the stroke/icon token (1.5). Colour comes from currentColor.
  // `small` (16) is for checks inside labels, such as the stepper's (095); it keeps the 24 grid, scaled.
  let { name, label, size = 'default' }: { name: IconName; label?: string; size?: 'default' | 'small' } = $props();
  const markup = $derived(iconMarkup(name));
</script>

<svg class="icon {size}" viewBox="0 0 24 24" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
  {@html markup}
</svg>

<style>
  .icon {
    width: var(--size-icon); height: var(--size-icon); flex: none;
    fill: none; stroke: currentColor; stroke-width: var(--stroke-icon);
    stroke-linecap: round; stroke-linejoin: round;
  }
  .small { width: var(--space-16); height: var(--space-16); stroke-width: calc(var(--stroke-icon) * 1.5); }
</style>
