// 115: a habit keeps one identity for life. When its schedule changes ("this and following" or "all
// events" with past answers, E16), the old schedule is kept inside the habit as a past version instead of
// becoming a separate series with a new id. Runs, ranks, stats, quotes and trials are keyed by the habit's
// id, so they carry on across the change; past occurrences keep their original time and title (E16).
// Pure rules: no DOM, no IndexedDB.
import { addDays, type IsoDay } from './day';
import { occurrences, parseRRule } from './recurrence';

/** The schedule a habit had up to its `rrule`'s UNTIL. Stored oldest first in `past`. */
export interface PastVersion {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  timeMode?: 'clock' | 'zoned';
  tz?: string;
  rrule?: string;
  exdates: string[];
  overrides?: Record<string, { start: string; end: string; title?: string; cancelled?: boolean }>;
}

interface Versioned {
  start: string;
  title: string;
  end: string;
  allDay: boolean;
  rrule?: string;
  exdates: string[];
  overrides?: PastVersion['overrides'];
  past?: PastVersion[];
}

/** The schedule part of a series, to keep as a past version. */
export function snapshot(e: Versioned & { timeMode?: 'clock' | 'zoned'; tz?: string }): PastVersion {
  return {
    title: e.title, start: e.start, end: e.end, allDay: e.allDay,
    ...(e.timeMode ? { timeMode: e.timeMode } : {}),
    ...(e.tz ? { tz: e.tz } : {}),
    ...(e.rrule ? { rrule: e.rrule } : {}),
    exdates: [...e.exdates],
    ...(e.overrides && Object.keys(e.overrides).length ? { overrides: e.overrides } : {}),
  };
}

/**
 * Every version of a habit as a plain series with the habit's id, oldest first, the current one last.
 * A past version only replaces the schedule: name-independent things (id, icon, design, archive) stay the habit's.
 */
export function versionsOf<E extends Versioned>(e: E): E[] {
  if (!e.past?.length) return [e];
  const { past, ...current } = e;
  const plain = current as E;
  return [
    ...past.map((p) => ({ ...plain, rrule: undefined, overrides: undefined, tz: undefined, ...p }) as E),
    plain,
  ];
}

/** The habit's first day across all its versions (the start of its history). */
export function firstDayOf(e: Versioned): IsoDay {
  return versionsOf(e).map((v) => v.start.slice(0, 10) as IsoDay).sort()[0]!;
}

/** Which version (index into versionsOf) an occurrence day belongs to; -1 if none produces it. */
export function versionIndexOf(e: Versioned, occurrence: IsoDay): number {
  const all = versionsOf(e);
  return all.findIndex((v) => {
    const start = v.start.slice(0, 10) as IsoDay;
    return occurrences(start, v.rrule ? parseRRule(v.rrule) : null, [], occurrence).at(-1) === occurrence;
  });
}

/** Applies `change` to the version holding `occurrence` (a past one or the current one). */
export function onVersionOf<E extends Versioned>(e: E, occurrence: IsoDay, change: (v: E) => E): E {
  const i = versionIndexOf(e, occurrence);
  const past = e.past ?? [];
  if (i < 0 || i === past.length) return change(e);
  const all = versionsOf(e);
  const edited = snapshot(change(all[i]!));
  return { ...e, past: past.map((p, j) => (j === i ? edited : p)) };
}

// --- Joining series that were split before 115 ---------------------------------------------------------

export interface SplitCandidate {
  id: string;
  calendarId: string;
  title: string;
  icon?: string;
  start: string;
  rrule?: string;
  past?: PastVersion[];
}

const untilOf = (rrule: string | undefined): IsoDay | null => {
  const m = rrule ? /UNTIL=(\d{4})(\d{2})(\d{2})/i.exec(rrule) : null;
  return m ? (`${m[1]}-${m[2]}-${m[3]}` as IsoDay) : null;
};

/**
 * Habits that were one habit before a time or repeat change split them (0.3.0–0.8.1, 073): a series that
 * ends on a day D−1 and a series in the same calendar, with the same name and icon, whose first day falls in
 * D…D+13, where neither has answers on the other's side of D. Each chain comes back oldest first.
 * Only an unambiguous match joins: one successor, one predecessor.
 */
export function splitChains(events: readonly SplitCandidate[], answerDays: ReadonlyMap<string, readonly IsoDay[]>): string[][] {
  const next = new Map<string, string>();
  const hasPrev = new Set<string>();
  for (const a of events) {
    const until = untilOf(a.rrule);
    if (!until || !a.icon) continue;
    const d = addDays(until, 1);
    const late = addDays(d, 13);
    const matches = events.filter((b) => {
      if (b.id === a.id || b.calendarId !== a.calendarId || b.icon !== a.icon) return false;
      if (b.title.trim().toLowerCase() !== a.title.trim().toLowerCase()) return false;
      const first = firstDayOf({ ...b, end: b.start, allDay: false, exdates: [] });
      if (first < d || first > late) return false;
      if ((answerDays.get(a.id) ?? []).some((x) => x >= d)) return false;
      if ((answerDays.get(b.id) ?? []).some((x) => x < d)) return false;
      return true;
    });
    // A later split of the same habit can fall in the window too; the nearest one is the successor.
    const firstOf = (b: SplitCandidate) => firstDayOf({ ...b, end: b.start, allDay: false, exdates: [] });
    const earliest = matches.map(firstOf).sort()[0];
    const nearest = matches.filter((b) => firstOf(b) === earliest);
    if (nearest.length !== 1) continue;
    const b = nearest[0]!;
    if (hasPrev.has(b.id)) { next.delete([...next].find(([, v]) => v === b.id)![0]); continue; } // ambiguous: leave both
    next.set(a.id, b.id);
    hasPrev.add(b.id);
  }
  const chains: string[][] = [];
  for (const id of next.keys()) {
    if (hasPrev.has(id)) continue; // not a head
    const chain = [id];
    let cur = id;
    while (next.has(cur)) { cur = next.get(cur)!; chain.push(cur); }
    chains.push(chain);
  }
  return chains;
}
