<script lang="ts">
  // Rank medal (Figma 76:479, 055): shape and colour = rank; the icon inside = the habit's own icon.
  // Locked keeps the same shape in grey.
  import { iconMarkup, type IconName } from './icons';
  import { MEDAL } from './geometry';
  import type { RankId } from '../domain/ranks';

  interface Props { rank: RankId; icon: IconName; earned?: boolean; label?: string; celebrate?: boolean }
  let { rank, icon, earned = true, label, celebrate = false }: Props = $props();
  const shape = $derived(MEDAL[rank]);
  const glyph = $derived(iconMarkup(icon));
</script>

<svg class="medal {rank}" class:locked={!earned} class:celebrate viewBox="0 0 {MEDAL.size} {MEDAL.size}"
  role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
  {#if rank === 'master'}
    <path class="frame" transform="translate({MEDAL.master.frame.x} {MEDAL.master.frame.y})" d={MEDAL.master.frame.d} />
  {/if}
  <path class="shape" transform="translate({shape.x} {shape.y})" d={shape.d} />
  <svg class="glyph" x={(MEDAL.size - MEDAL.glyph) / 2} y={shape.gy} width={MEDAL.glyph} height={MEDAL.glyph} viewBox="0 0 24 24">
    {@html glyph}
  </svg>
  {#if rank === 'master'}
    <path class="gem" transform="translate({MEDAL.master.gem.x} {MEDAL.master.gem.y})" d={MEDAL.master.gem.d} />
  {/if}
</svg>

<style>
  .medal { width: var(--space-64); height: var(--space-64); flex: none; overflow: visible; }
  .shape { stroke-width: var(--stroke-medal); stroke-linejoin: round; }
  .glyph { fill: none; stroke: var(--rank-illustration); stroke-width: var(--stroke-icon); stroke-linecap: round; stroke-linejoin: round; }

  .starter .shape { fill: var(--rank-starter-fill); stroke: var(--rank-starter-rim); }
  .builder .shape { fill: var(--rank-builder-fill); stroke: var(--rank-builder-rim); }
  .keeper .shape { fill: var(--rank-keeper-fill); stroke: var(--rank-keeper-rim); }
  .artisan .shape { fill: var(--rank-artisan-fill); stroke: var(--rank-artisan-rim); }
  .master .shape { fill: var(--rank-master-fill); stroke: var(--rank-master-rim); stroke-width: var(--stroke-illustration); }
  .master .frame { fill: var(--rank-master-frame); }
  .master .gem { fill: var(--rank-master-gem); }

  .locked .shape { fill: var(--rank-locked-fill); stroke: var(--rank-locked-rim); }
  .locked .frame { fill: var(--rank-locked-fill); stroke: var(--rank-locked-rim); stroke-width: var(--stroke-illustration); }
  .locked .gem { fill: var(--rank-locked-rim); }
  .locked .glyph { stroke: var(--rank-illustration-locked); }

  /* A rank just reached (E15 sheet): one of the three things allowed to overshoot (053). */
  .celebrate { transform-origin: 50% 50%; animation: medal-in var(--motion-duration-slow) var(--motion-easing-spring); }
  @keyframes medal-in { from { transform: scale(0.88); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>
