// 061: numbers are plain whole numbers, never zero-padded (82%, not 082%).
import type { Rate } from './rates';

/** A rate as a whole percentage, or an en dash when nothing was due (033: no data is not 0%). */
export function percent(rate: number | null): string {
  return rate === null ? '–' : `${Math.round(rate * 100)}%`;
}

/** "82% · 4 due": the rate always travels with the number due (006). */
export function rateLabel(r: Rate): string {
  return `${percent(r.rate)} · ${r.due} due`;
}

/** Progress toward a rank: "10/30". */
export function progress(done: number, of: number): string {
  return `${done}/${of}`;
}
