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
