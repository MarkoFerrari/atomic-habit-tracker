// Reading a Motion token in script (053). The production build minifies "250ms" to ".25s", so a duration
// is parsed with its unit, never with parseFloat alone (U10: the Undo toast left after 5 ms instead of 5 s).
export function durationMs(raw: string): number {
  const v = raw.trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n;
}

/** A Motion duration token, in ms: `motionMs('base')` reads --motion-duration-base. */
export function motionMs(name: string, el: Element = document.documentElement): number {
  return durationMs(getComputedStyle(el).getPropertyValue(`--motion-duration-${name}`));
}
