<script lang="ts">
  // Award star (Figma 219:52, 093): the perfect-day reward. Faceted gold, lit from the top left; flat fills,
  // so it stays crisp at 20 and at 160. Distinct from the medals, so a daily reward never reads as a rank.
  import { STAR } from './geometry';
  interface Props { size?: 'tiny' | 'cell' | 'ring' | 'icon' | 'hero'; label?: string }
  let { size = 'icon', label }: Props = $props();
</script>

<svg class="award-star {size}" viewBox="0 0 {STAR.size} {STAR.size}" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
  {#each STAR.facets as f, i (i)}<path class={f.tone} d={f.d} />{/each}
  <path class="rim" d={STAR.outline} />
</svg>

<style>
  .award-star { display: block; flex: none; overflow: visible; }
  .tiny { width: var(--space-16); height: var(--space-16); }
  .cell { width: calc(var(--space-24) + var(--space-4)); height: calc(var(--space-24) + var(--space-4)); }
  .ring { width: var(--space-32); height: var(--space-32); }
  .icon { width: var(--space-40); height: var(--space-40); }
  .hero { width: calc(var(--space-64) * 2 + var(--space-32)); height: calc(var(--space-64) * 2 + var(--space-32)); }
  .light { fill: var(--award-facet-light); }
  .mid { fill: var(--award-facet-mid); }
  .dark { fill: var(--award-facet-dark); }
  .rim { fill: none; stroke: var(--award-facet-dark); stroke-width: var(--stroke-medal); stroke-linejoin: round; }
</style>
