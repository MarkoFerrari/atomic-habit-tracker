<script lang="ts" module>
  // Star 3D (decision 127, Figma component "Star 3D" in Playground section 15): the one star of ATOMIC, used for the
  // perfect day, the week strip, the perfect-week sky and the Master badge. Ten facets lit from the top left, each
  // drawn in one of the five award golds, with a thin warm edge and a soft gloss from the top. Vector, so it stays
  // crisp from 16 to 200. The geometry is computed once here, the colours come from the award/* tokens.
  const S = 160, CX = 80, CY = 84, R = 76, r = 34;
  const pt = (deg: number, rad: number): [number, number] => [CX + rad * Math.cos((deg * Math.PI) / 180), CY + rad * Math.sin((deg * Math.PI) / 180)];
  const outer = Array.from({ length: 5 }, (_, i) => pt(-90 + 72 * i, R));
  const inner = Array.from({ length: 5 }, (_, i) => pt(-54 + 72 * i, r));
  const L = [-0.45, -0.89].map((v, _i, a) => v / Math.hypot(a[0]!, a[1]!)) as [number, number];
  const tone = (b: number) => (b < -0.5 ? 'shadow' : b < -0.05 ? 'dark' : b < 0.35 ? 'mid' : b < 0.75 ? 'light' : 'highlight');
  const f = (n: number) => n.toFixed(2);
  const FACETS: { d: string; tone: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const o = outer[i]!;
    for (const inn of [inner[(i + 4) % 5]!, inner[i]!]) {
      let nx = -(inn[1] - o[1]), ny = inn[0] - o[0];
      const mx = (o[0] + inn[0]) / 2 - CX, my = (o[1] + inn[1]) / 2 - CY;
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
      const m = Math.hypot(nx, ny);
      FACETS.push({ d: `M${CX} ${CY}L${f(o[0])} ${f(o[1])}L${f(inn[0])} ${f(inn[1])}Z`, tone: tone((nx / m) * L[0] + (ny / m) * L[1]) });
    }
  }
  const OUTLINE = 'M' + outer.flatMap((o, i) => [o, inner[i]!]).map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
  let uid = 0;
</script>

<script lang="ts">
  interface Props { size?: 'tiny' | 'cell' | 'ring' | 'icon' | 'hero'; label?: string }
  let { size = 'icon', label }: Props = $props();
  const gloss = `star-gloss-${++uid}`;
</script>

<svg class="award-star {size}" viewBox="0 0 {S} {S}" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
  <defs>
    <linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="gloss-top" /><stop offset="0.45" class="gloss-end" />
    </linearGradient>
  </defs>
  {#each FACETS as facet, i (i)}<path class={facet.tone} d={facet.d} />{/each}
  <path d={OUTLINE} fill="url(#{gloss})" />
  <path class="edge" d={OUTLINE} />
</svg>

<style>
  .award-star { display: block; flex: none; overflow: visible; }
  .tiny { width: var(--space-16); height: var(--space-16); }
  .cell { width: calc(var(--space-24) + var(--space-4)); height: calc(var(--space-24) + var(--space-4)); }
  .ring { width: var(--space-32); height: var(--space-32); }
  .icon { width: var(--space-40); height: var(--space-40); }
  .hero { width: calc(var(--space-64) * 3); height: calc(var(--space-64) * 3); }
  .shadow { fill: var(--award-facet-shadow); }
  .dark { fill: var(--award-facet-dark); }
  .mid { fill: var(--award-facet-mid); }
  .light { fill: var(--award-facet-light); }
  .highlight { fill: var(--award-facet-highlight); }
  .gloss-top { stop-color: var(--color-white); stop-opacity: 0.38; }
  .gloss-end { stop-color: var(--color-white); stop-opacity: 0; }
  .edge { fill: none; stroke: var(--award-facet-dark); stroke-opacity: 0.55; stroke-width: var(--stroke-hairline); stroke-linejoin: round; vector-effect: non-scaling-stroke; }
</style>
