<script lang="ts">
  // The habit's 3D object on its tile (122). The tile and its field colour are part of the image, so the object
  // looks the same everywhere it appears. Icons without an object fall back to the 2D Lucide icon on the field.
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  import { objectUrl, fieldColor } from './objects';

  interface Props { icon: string | undefined; size?: 'sm' | 'md' | 'lg' | 'xl'; muted?: boolean }
  let { icon, size = 'md', muted = false }: Props = $props();
  const url = $derived(objectUrl(icon ?? 'sprout'));
</script>

<span class="object {size}" class:muted aria-hidden="true" style:--tile={fieldColor(icon)}>
  {#if url}
    <img src={url} alt="" draggable="false" />
  {:else}
    <span class="fallback"><Icon name={(icon ?? 'sprout') as IconName} /></span>
  {/if}
</span>

<style>
  .object { display: block; flex: none; position: relative; }
  .sm { width: var(--space-40); height: var(--space-40); }
  .md { width: calc(var(--space-48) + var(--space-4)); height: calc(var(--space-48) + var(--space-4)); }
  .lg { width: var(--space-64); height: var(--space-64); }
  .xl { width: calc(var(--space-64) + var(--space-32)); height: calc(var(--space-64) + var(--space-32)); }
  img { display: block; width: 100%; height: 100%; user-select: none; -webkit-user-select: none; }
  .fallback { display: grid; place-items: center; width: 100%; height: 100%; border-radius: var(--radius-tile); background: var(--tile); color: var(--icon-default); }
  .muted { opacity: 0.4; } /* locked medal, archived habit */
</style>
