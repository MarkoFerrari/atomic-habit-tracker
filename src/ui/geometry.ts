// Drawing geometry measured from Figma components (not layout values, so they live here, not in tokens).

/** Mastery ring (Figma 31:41): 44 × 44, five annular segments, inner radius 0.91 of the outer. Angles in radians,
 *  clockwise from 3 o'clock, as Figma's arcData reports them. Segment 5 is the crimson one. */
export const RING = {
  size: 44,
  innerRatio: 0.91,
  segments: [
    [-1.4607963562011719, -0.4241592586040497],
    [-0.20415925979614258, 0.8324778079986572],
    [1.0524778366088867, 2.0891149044036865],
    [2.309114933013916, 3.345752000808716],
    [3.5657520294189453, 4.602388858795166],
  ] as const,
};

/** State icon (Figma 31:117): base circle 36 at (4, 4), glyph 24 at (10, 10), slash from (9.3, 34.7) at −45°, 36 long. */
export const STATE_ICON = { base: { cx: 22, cy: 22, r: 18 }, glyph: 10, slash: { x1: 9.3, y1: 34.7, x2: 34.76, y2: 9.24 }, missedDash: '3 3' };

/** SVG path for an annular sector, centred in a square of `size`. */
export function annulusPath(size: number, innerRatio: number, a0: number, a1: number): string {
  const c = size / 2;
  const ro = c;
  const ri = c * innerRatio;
  const pt = (r: number, a: number) => `${(c + r * Math.cos(a)).toFixed(3)} ${(c + r * Math.sin(a)).toFixed(3)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${pt(ro, a0)}A${ro} ${ro} 0 ${large} 1 ${pt(ro, a1)}L${pt(ri, a1)}A${ri} ${ri} 0 ${large} 0 ${pt(ri, a0)}Z`;
}

/** Rank medal (Figma 76:479): 64 × 64. Each rank's shape path is placed at (x, y); glyph 28 at (18, gy).
 *  Master adds an outer frame and a gem. Stroke widths are tokens: stroke/medal (3), stroke/illustration (2). */
export const MEDAL = {
  size: 64,
  glyph: 28,
  starter: { x: 3.5, y: 3.5, gy: 18, d: 'M57 28.5C57 44.24 44.24 57 28.5 57C12.76 57 0 44.24 0 28.5C0 12.76 12.76 0 28.5 0C44.24 0 57 12.76 57 28.5Z' },
  builder: { x: 5.5, y: 5.5, gy: 18, d: 'M14 0L39 0C46.73 0 53 6.27 53 14L53 39C53 46.73 46.73 53 39 53L14 53C6.27 53 0 46.73 0 39L0 14C0 6.27 6.27 0 14 0Z' },
  keeper: { x: 5.5, y: 4.5, gy: 20, d: 'M26.5 0L53 19L43 54L10 54L0 19Z' },
  artisan: { x: 7.8, y: 4, gy: 18, d: 'M24.2 0L48.4 14L48.4 42L24.2 56L0 42L0 14Z' },
  master: {
    x: 10.7, y: 7.5, gy: 19, d: 'M21.3 0L42.6 12.3L42.6 36.7L21.3 49L0 36.7L0 12.3Z',
    frame: { x: 6, y: 2, d: 'M26 0L52 15L52 45L26 60L0 45L0 15Z' },
    gem: { x: 28, y: 0.5, d: 'M4 0L8 4L4 8L0 4Z' },
  },
} as const;

/** Award star (Figma 219:52, 093): a 160 box, five points (outer radius 74, inner 35, centre 80/82), cut into ten
 *  facets lit from the top left so it reads as 3D with flat fills. Tones map to award/facet-light, -mid and -dark. */
export const STAR = (() => {
  const cx = 80, cy = 82, R = 74, r = 35;
  const P = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r : R;
    return [cx + d * Math.cos(a), cy + d * Math.sin(a)] as const;
  });
  const light = [-0.62, -0.78]; // unit vector toward the light
  const f = (n: number) => n.toFixed(2);
  const facets = P.map((a, i) => {
    const b = P[(i + 1) % 10]!;
    let nx = b[1] - a[1], ny = -(b[0] - a[0]);
    if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
    const len = Math.hypot(nx, ny);
    const lit = (nx / len) * light[0]! + (ny / len) * light[1]!;
    const tone = lit > 0.45 ? 'light' : lit > -0.6 ? 'mid' : 'dark';
    return { d: `M${cx} ${cy}L${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}Z`, tone };
  });
  return { size: 160, facets, outline: `M${P.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z` };
})();

/** Star medal (Figma 228:3338, 100): a 96 box; the disc (56) holds the habit icon (28); twelve slots on a radius of
 *  40, placed like a watch: star n sits at n o'clock, so the 6th is opposite the 12th and the 9th opposite the 3rd
 *  (owner, 8 Oct 2026). A 14 star when earned, a 3 dot when still to come. */
export const STAR_MEDAL = (() => {
  const size = 96, c = 48, ring = 40;
  const slots = Array.from({ length: 12 }, (_, k) => {
    const a = -Math.PI / 2 + ((k + 1) * Math.PI) / 6; // slot k is hour k + 1
    return { x: c + ring * Math.cos(a), y: c + ring * Math.sin(a) };
  });
  return { size, c, disc: 56, glyph: 28, star: 14, dot: 3, slots };
})();
