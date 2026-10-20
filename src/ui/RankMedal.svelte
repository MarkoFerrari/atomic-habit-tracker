<script lang="ts" module>
  // Badge 3D (decision 128, Figma component set "Badge 3D" 390:1619), one per habit (055). The container gains corners
  // as the habit hardens: Apprentice a circle, Builder a rounded square, Keeper a pentagon, Artisan a hexagon, Master
  // the hexagon crowned with the star (127). The rim metal backs up the shape (bronze, silver, gold), so a rank never
  // rests on colour alone; the face is the habit's field and holds its 3D object. No rank yet: stone, object faded.
  // Ranks are never lost. The rank's name always travels with the medal (1.4.11).
  import type { RankId } from '../domain/ranks';
  type Shape = 'circle' | 'square' | 'penta' | 'hexa';
  export const SHAPE: Record<RankId | 'none', { shape: Shape; metal: 'stone' | 'bronze' | 'silver' | 'gold' }> = {
    none: { shape: 'circle', metal: 'stone' }, starter: { shape: 'circle', metal: 'bronze' }, builder: { shape: 'square', metal: 'silver' },
    keeper: { shape: 'penta', metal: 'gold' }, artisan: { shape: 'hexa', metal: 'gold' }, master: { shape: 'hexa', metal: 'gold' },
  };
  const CX = 80, CY = 90;
  const f = (n: number) => n.toFixed(2);
  /** A shape `size` wide, as a path; polygons are inset by `round` and drawn with a round stroke of 2 × round. */
  function path(shape: Shape, size: number, round: number): string {
    if (shape === 'circle') { const r = size / 2; return `M${CX - r} ${CY}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`; }
    if (shape === 'square') {
      const s = size * 0.88, h = s / 2, k = s * 0.24;
      return `M${f(CX - h + k)} ${f(CY - h)}H${f(CX + h - k)}Q${f(CX + h)} ${f(CY - h)} ${f(CX + h)} ${f(CY - h + k)}V${f(CY + h - k)}Q${f(CX + h)} ${f(CY + h)} ${f(CX + h - k)} ${f(CY + h)}H${f(CX - h + k)}Q${f(CX - h)} ${f(CY + h)} ${f(CX - h)} ${f(CY + h - k)}V${f(CY - h + k)}Q${f(CX - h)} ${f(CY - h)} ${f(CX - h + k)} ${f(CY - h)}Z`;
    }
    const n = shape === 'penta' ? 5 : 6;
    const R = (size / 2) * (shape === 'penta' ? 1.06 : 1.04) - round;
    const pts = Array.from({ length: n }, (_, i) => { const a = ((-90 + (360 * i) / n) * Math.PI) / 180; return `${f(CX + R * Math.cos(a))} ${f(CY + R * Math.sin(a))}`; });
    return `M${pts.join('L')}Z`;
  }
  let uid = 0;
</script>

<script lang="ts">
  import AwardStar from './AwardStar.svelte';
  import type { IconName } from './icons';
  import { objectUrl, fieldColor } from './objects';

  interface Props { rank: RankId | null; icon: IconName; earned?: boolean; label?: string; size?: 'tiny' | 'small' | 'medium' | 'large'; celebrate?: boolean }
  let { rank, icon, earned = true, label, size = 'small', celebrate = false }: Props = $props();
  const id = `badge-${++uid}`;
  const spec = $derived(SHAPE[earned && rank ? rank : 'none']);
  const locked = $derived(!earned || !rank);
  const poly = $derived(spec.shape === 'penta' || spec.shape === 'hexa');
  const R = 13; // the corner rounding of the polygons, in viewBox units
  const url = $derived(objectUrl(icon));
</script>

<span class="medal {size}" class:celebrate style:--face={fieldColor(icon)} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
  <svg viewBox="0 0 160 160" class="body">
    <defs>
      <linearGradient id="{id}-rim" x1="0" y1="0" x2="1" y2="1" class="metal {spec.metal}">
        <stop offset="0" class="m0" /><stop offset="0.45" class="m1" /><stop offset="1" class="m2" />
      </linearGradient>
      <linearGradient id="{id}-bevel" x1="1" y1="1" x2="0" y2="0" class="metal {spec.metal}">
        <stop offset="0" class="m0" /><stop offset="0.45" class="m1" /><stop offset="1" class="m2" />
      </linearGradient>
      <radialGradient id="{id}-face" cx="0.4" cy="0.35" r="0.75" class:locked>
        <stop offset="0" class="f0" /><stop offset="0.6" class="f1" /><stop offset="1" class="f2" />
      </radialGradient>
      <linearGradient id="{id}-gloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" class="g0" /><stop offset="0.5" class="g1" />
      </linearGradient>
    </defs>
    {#each [['rim', 132], ['bevel', 118], ['face', 108]] as [layer, sz] (layer)}
      <path d={path(spec.shape, Number(sz), poly ? R : 0)} fill="url(#{id}-{layer})"
        stroke={poly ? `url(#${id}-${layer})` : 'none'} stroke-width={poly ? 2 * R : 0} stroke-linejoin="round" />
    {/each}
    {#if url}
      <!-- the object's own tile fills the face, cut to its shape, so the face takes the habit's field -->
      <mask id="{id}-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="160">
        <path d={path(spec.shape, 108, poly ? R : 0)} class="cut" stroke-width={poly ? 2 * R : 0} stroke-linejoin="round" />
      </mask>
      <image href={url} x="18" y="28" width="124" height="124" mask="url(#{id}-cut)" class:faded={locked} />
    {/if}
    <path d={path(spec.shape, 108, poly ? R : 0)} fill="url(#{id}-gloss)"
      stroke={poly ? `url(#${id}-gloss)` : 'none'} stroke-width={poly ? 2 * R : 0} stroke-linejoin="round" />
  </svg>
  {#if !locked && rank === 'master'}<span class="crown"><AwardStar size="ring" /></span>{/if}
</span>

<style>
  .medal { position: relative; display: block; flex: none; }
  .tiny { width: var(--space-40); height: var(--space-40); }
  .small { width: calc(var(--space-48) + var(--space-8)); height: calc(var(--space-48) + var(--space-8)); }
  .medium { width: calc(var(--space-48) * 2); height: calc(var(--space-48) * 2); }
  .large { width: calc(var(--space-64) * 3); height: calc(var(--space-64) * 3); }
  .body { width: 100%; height: 100%; display: block; overflow: visible; }
  /* the metals: stone (locked), bronze, silver, gold, light to dark */
  .stone .m0 { stop-color: var(--color-stone-100); } .stone .m1 { stop-color: var(--color-rank-stone-100); } .stone .m2 { stop-color: var(--color-ink-500); }
  .bronze .m0 { stop-color: var(--color-rank-bronze-200); } .bronze .m1 { stop-color: var(--rank-starter-rim); } .bronze .m2 { stop-color: var(--color-rank-bronze-700); }
  .silver .m0 { stop-color: var(--color-white); } .silver .m1 { stop-color: var(--color-rank-silver-200); } .silver .m2 { stop-color: var(--color-rank-silver-700); }
  .gold .m0 { stop-color: var(--award-facet-highlight); } .gold .m1 { stop-color: var(--award-facet-light); } .gold .m2 { stop-color: var(--award-facet-dark); }
  .f0 { stop-color: var(--color-white); stop-opacity: 0.85; } .f1 { stop-color: var(--face); } .f2 { stop-color: var(--face); }
  .locked .f1, .locked .f2 { stop-color: var(--color-rank-stone-100); }
  .cut { fill: var(--color-white); stroke: var(--color-white); }
  .faded { opacity: 0.45; filter: grayscale(1); }
  .g0 { stop-color: var(--color-white); stop-opacity: 0.45; } .g1 { stop-color: var(--color-white); stop-opacity: 0; }
  .crown { position: absolute; left: 50%; top: 0; translate: -50% -12%; width: 38%; height: 38%; display: grid; }
  .crown :global(svg) { width: 100%; height: 100%; }
  /* 053: the rank medal is one of the three things that may overshoot */
  .celebrate { animation: medal-in var(--motion-duration-celebrate) var(--motion-easing-spring) both; }
  @keyframes medal-in { from { transform: scale(0.6); opacity: 0; } }
</style>
