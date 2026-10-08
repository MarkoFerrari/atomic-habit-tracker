<script lang="ts">
  // Star medal (Figma 228:3338, 100), one per habit (055): the habit's own icon on a disc, ringed by twelve slots like
  // the European flag. Stars fill like a watch, star n at n o'clock, as ranks are reached: Apprentice 1, Builder 3, Keeper 6,
  // Artisan 9, Master 12. Empty slots stay as dots, so the way to Master is always in sight. Ranks are never lost.
  // The gold alone is under 3:1 on white, so the rank's name always travels with the medal (1.4.11).
  import { iconMarkup, type IconName } from './icons';
  import { STAR, STAR_MEDAL as M } from './geometry';
  import { starsFor, type RankId } from '../domain/ranks';

  interface Props { rank: RankId | null; icon: IconName; earned?: boolean; label?: string; size?: 'small' | 'medium' | 'large'; celebrate?: boolean }
  let { rank, icon, earned = true, label, size = 'small', celebrate = false }: Props = $props();
  const stars = $derived(earned ? starsFor(rank) : 0);
  const glyph = $derived(iconMarkup(icon));
  const s = M.star / STAR.size;
</script>

<svg class="medal {size}" class:none={stars === 0} class:celebrate viewBox="0 0 {M.size} {M.size}"
  role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
  <circle class="disc" cx={M.c} cy={M.c} r={M.disc / 2} />
  <svg class="glyph" x={M.c - M.glyph / 2} y={M.c - M.glyph / 2} width={M.glyph} height={M.glyph} viewBox="0 0 24 24">{@html glyph}</svg>
  {#each M.slots as p, k (k)}
    {#if k < stars}
      <g transform="translate({p.x - M.star / 2} {p.y - M.star / 2})">
        <g class="star" style:--i={k}><g transform="scale({s})">
          {#each STAR.facets as f, i (i)}<path class={f.tone} d={f.d} />{/each}
          <path class="rim" d={STAR.outline} />
        </g></g>
      </g>
    {:else}
      <circle class="slot" cx={p.x} cy={p.y} r={M.dot / 2} />
    {/if}
  {/each}
</svg>

<style>
  .medal { flex: none; overflow: visible; }
  .small { width: calc(var(--space-48) + var(--space-8)); height: calc(var(--space-48) + var(--space-8)); }
  .medium { width: calc(var(--space-48) * 2); height: calc(var(--space-48) * 2); }
  .large { width: calc(var(--space-64) * 2 + var(--space-32)); height: calc(var(--space-64) * 2 + var(--space-32)); }
  .disc { fill: var(--bg-default); stroke: var(--border-control); stroke-width: var(--stroke-hairline); }
  .none .disc { fill: var(--bg-subtle); stroke: var(--border-divider); }
  .glyph { fill: none; stroke: var(--rank-illustration); stroke-width: var(--stroke-icon); stroke-linecap: round; stroke-linejoin: round; }
  .none .glyph { stroke: var(--rank-illustration-locked); }
  .slot { fill: var(--border-control); }
  .light { fill: var(--award-facet-light); }
  .mid { fill: var(--award-facet-mid); }
  .dark { fill: var(--award-facet-dark); }
  .rim { fill: none; stroke: var(--award-facet-dark); stroke-width: calc(var(--stroke-medal) * 5); stroke-linejoin: round; }
  /* A rank just reached (H5): the stars pop in one by one, clockwise; one of the three things allowed to overshoot (053). */
  .celebrate .star { transform-box: fill-box; transform-origin: center; animation: star-in var(--motion-duration-fast) var(--motion-easing-spring) both;
    animation-delay: calc(var(--i) * var(--motion-duration-instant) * 0.6 + var(--motion-duration-base)); }
  .celebrate .disc, .celebrate .glyph { animation: disc-in var(--motion-duration-celebrate) var(--motion-easing-spring) both; transform-box: fill-box; transform-origin: center; }
  @keyframes star-in { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
  @keyframes disc-in { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
</style>
