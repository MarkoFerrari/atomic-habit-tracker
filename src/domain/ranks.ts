// 047, 055: consistency ranks, reached by days held in a run. Ranks are never lost.
export const RANKS = [
  { id: 'starter', label: 'Apprentice', days: 10 }, // 105: was Starter ("Starter in 6 days" read as a start date); the id stays
  { id: 'builder', label: 'Builder', days: 30 },
  { id: 'keeper', label: 'Keeper', days: 90 },
  { id: 'artisan', label: 'Artisan', days: 182 },
  { id: 'master', label: 'Master', days: 365 },
] as const;

export type RankId = (typeof RANKS)[number]['id'];
const order = (r: RankId | null) => (r ? RANKS.findIndex((x) => x.id === r) : -1);

/** The highest rank a number of days held qualifies for. */
export function rankForDays(days: number): RankId | null {
  let best: RankId | null = null;
  for (const r of RANKS) if (days >= r.days) best = r.id;
  return best;
}

/** Ranks never drop: the stored rank wins over a shorter current run. */
export function reachedRank(stored: RankId | null, daysHeld: number): RankId | null {
  const now = rankForDays(daysHeld);
  return order(now) > order(stored) ? now : stored;
}

/** A rank reached today that wasn't reached before: feeds the Recap sheet (E15), never a push. */
export function newlyReached(stored: RankId | null, daysHeld: number): RankId | null {
  const next = reachedRank(stored, daysHeld);
  return next !== stored ? next : null;
}

/** What the current run is heading for. At Master there is nothing next; the run keeps counting (H22b). */
export function nextRank(stored: RankId | null, daysHeld: number): { rank: RankId; daysLeft: number } | null {
  const target = RANKS.find((r) => order(r.id) > order(stored));
  if (!target) return null;
  return { rank: target.id, daysLeft: Math.max(0, target.days - daysHeld) };
}

/**
 * 100: the star medal. Twelve slots around the habit's icon, like the European flag; stars fill clockwise from
 * the top as ranks are reached, and Master closes the ring. Replaces the shapes of 049/055.
 */
export const STAR_SLOTS = 12;
export const STARS: Record<RankId, number> = { starter: 1, builder: 3, keeper: 6, artisan: 9, master: 12 };
export function starsFor(rank: RankId | null): number {
  return rank ? STARS[rank] : 0;
}

/** Mastery ring (Figma 31:41): filled segments = rank order + 1; the fifth is crimson (state/perfect). */
export function ringSegments(stored: RankId | null): number {
  return order(stored) + 1;
}
