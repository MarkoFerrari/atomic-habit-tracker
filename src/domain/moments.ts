// The moments that earn words (Figma Playground 02, 04, 05; owner approved 8 Oct 2026):
// 107 milestones on the way to the next rank, 108 the comeback after a miss, 109 the perfect week.
// Pure rules over the same Context as Stats; the quotes themselves live in quotes.ts (110).
import { addDays, type IsoDay } from './day';
import { shortName } from './format';
import { RANKS, type RankId } from './ranks';
import { daysHeld, EMPTY_RUN, step, type DueDay } from './runs';
import { dayVerdict } from './award';
import { habitDays, historyOf, mondayOf, type Context, type Medal } from './stats';
import type { HabitSource } from './today';

const rankLabel = (r: RankId) => RANKS.find((x) => x.id === r)!.label;

// --- 107 · Milestones -------------------------------------------------------------------------------------------

/**
 * The milestone days on the way to a rank, in days held (060): halfway on the first two ranks, every quarter on
 * the long ones, so no stretch without a word is longer than 46 days. Apprentice 5 · Builder 20 · Keeper 45, 60,
 * 75 · Artisan 113, 136, 159 · Master 228, 274, 319.
 */
export function milestoneDays(next: RankId): number[] {
  const i = RANKS.findIndex((r) => r.id === next);
  const from = i > 0 ? RANKS[i - 1]!.days : 0;
  const to = RANKS[i]!.days;
  const parts = i < 2 ? 2 : 4;
  return Array.from({ length: parts - 1 }, (_, k) => Math.round(from + ((k + 1) * (to - from)) / parts));
}

export interface Milestone {
  eventId: string;
  title: string;
  rank: RankId; // the rank it leads to
  day: number; // the milestone, in days held
  part: number; // 1 of 2, or 1–3 of 4
  parts: 2 | 4;
  held: number;
  of: number; // days held for the rank
  stops: number[]; // every milestone on the way to the rank, for the ticks on the bar
}

/** A milestone is fresh for a week, so a habit that isn't daily still meets it on its next done. */
export const MILESTONE_FRESH_DAYS = 7;

/** The milestone a habit has just reached, once it is done today. Null when there is none to show. */
export function milestoneOf(m: Medal, doneToday: boolean): Milestone | null {
  if (!doneToday || !m.next) return null;
  const stops = milestoneDays(m.next.rank);
  let part = 0;
  stops.forEach((d, i) => { if (d <= m.held) part = i + 1; });
  if (!part) return null;
  const day = stops[part - 1]!;
  if (m.held - day >= MILESTONE_FRESH_DAYS) return null;
  return { eventId: m.eventId, title: m.title, rank: m.next.rank, day, part, parts: stops.length === 1 ? 2 : 4, held: m.held, of: m.next.days, stops };
}

export const milestoneKey = (m: Pick<Milestone, 'eventId' | 'rank' | 'day'>) => `milestone|${m.eventId}|${m.rank}|${m.day}`;

/** "Read 20 min: halfway to Builder. Keep going." */
export function milestoneLine(m: Milestone): string {
  const where = m.parts === 2 || m.part === 2 ? 'halfway' : m.part === 1 ? 'a quarter of the way' : 'three quarters of the way';
  return `${shortName(m.title)}: ${where} to ${rankLabel(m.rank)}. Keep going.`;
}

// --- 108 · Comebacks --------------------------------------------------------------------------------------------

/** Days a run was saved: a done right after a single miss, while the run was alive (051). */
export function comebackDays(history: readonly DueDay[]): IsoDay[] {
  let run = EMPTY_RUN;
  const out: IsoDay[] = [];
  for (const due of history) {
    if (due.status === 'done' && run.startedOn && run.missesInARow === 1) out.push(due.day);
    run = step(run, due);
  }
  return out;
}

export interface Comeback { eventId: string; title: string; held: number; day: IsoDay }

/** Habits brought back today, in time order. */
export function comebacksToday(ctx: Context): Comeback[] {
  const out: Comeback[] = [];
  for (const h of ctx.habits) {
    const history = historyOf(ctx, h);
    if (!comebackDays(history).includes(ctx.today)) continue;
    out.push({ eventId: h.id, title: h.title, held: daysHeld(history.reduce(step, EMPTY_RUN), ctx.today), day: ctx.today });
  }
  return out;
}

export const comebackKey = (c: Comeback) => `comeback|${c.eventId}|${c.day}`;
export const riskKey = (eventId: string, today: IsoDay) => `risk|${eventId}|${today}`;

/** "Back after a miss: your 50-day run holds." */
export const comebackLine = (c: Comeback) => `Back after a miss: your ${c.held}-day run holds.`;

/** Every day in a range on which some habit came back, for the marks in the week strip. */
export function comebackDaySet(ctx: Context, from: IsoDay, to: IsoDay): Set<IsoDay> {
  const out = new Set<IsoDay>();
  for (const h of ctx.habits) for (const d of comebackDays(historyOf(ctx, h))) if (d >= from && d <= to) out.add(d);
  return out;
}

export interface RunCell { day: IsoDay; status: DueDay['status']; comeback: boolean }
export interface RunsSaved { total: number; cells: RunCell[]; recent: { missedOn: IsoDay; backOn: IsoDay }[] }

/** H4: runs saved over the habit's life, and the current run drawn occurrence by occurrence (the last 28). */
export function runsSaved(ctx: Context, h: HabitSource): RunsSaved {
  const history = historyOf(ctx, h);
  const backs = comebackDays(history);
  const run = history.reduce(step, EMPTY_RUN);
  const current = run.startedOn ? history.filter((d) => d.day >= run.startedOn!) : [];
  const cells = current.slice(-28).map((d) => ({ day: d.day, status: d.status, comeback: backs.includes(d.day) }));
  const recent = backs.slice(-2).map((backOn) => {
    const i = history.findIndex((d) => d.day === backOn);
    return { missedOn: history[i - 1]!.day, backOn };
  });
  return { total: backs.length, cells, recent };
}

// --- 109 · Perfect weeks ----------------------------------------------------------------------------------------

/** perfect: every due habit, every day, Monday to Sunday · held: tracked, not perfect · current: this week, still
 *  open · ahead: still to come · before: before tracking, or nothing due (never counted, 033). */
export type WeekState = 'perfect' | 'held' | 'current' | 'ahead' | 'before';

export function weekState(ctx: Context, monday: IsoDay): WeekState {
  const sunday = addDays(monday, 6);
  if (monday > ctx.today) return 'ahead';
  if (!ctx.trackingStart || monday < ctx.trackingStart) return 'before'; // a week begun before tracking can't be whole
  const cells = habitDays(ctx, monday, sunday);
  let anyDue = false;
  let whole = true;
  let broken = false;
  for (let d = monday; d <= sunday; d = addDays(d, 1)) {
    const v = dayVerdict(cells, d, ctx.today);
    if (v.due > 0) anyDue = true;
    if (d > ctx.today) { if (v.due > 0) whole = false; continue; }
    if (v.state === 'perfect' || v.state === 'empty') continue;
    whole = false;
    if (d < ctx.today) broken = true; // a past day that wasn't perfect
  }
  if (!anyDue) return 'before';
  if (whole) return 'perfect';
  return broken || sunday < ctx.today ? 'held' : 'current';
}

/** W1: today is the last due day of a week that is perfect so far. How many habits are left to close it. */
export function weekCloses(ctx: Context): number | null {
  const monday = mondayOf(ctx.today);
  if (!ctx.trackingStart || monday < ctx.trackingStart) return null;
  const cells = habitDays(ctx, monday, addDays(monday, 6));
  let earlierPerfect = 0;
  let left = 0;
  for (let d = monday; d <= addDays(monday, 6); d = addDays(d, 1)) {
    const v = dayVerdict(cells, d, ctx.today);
    if (d < ctx.today) { if (v.state === 'perfect') earlierPerfect += 1; else if (v.state !== 'empty') return null; }
    else if (d === ctx.today) { if (v.state !== 'open') return null; left = v.due - v.done; }
    else if (v.due > 0) return null;
  }
  return earlierPerfect > 0 && left > 0 ? left : null;
}

/** "One more habit closes a perfect week." */
export const weekLine = (left: number) => (left === 1 ? 'One more habit closes a perfect week.' : `${left} more habits close a perfect week.`);

export interface SkyWeek { monday: IsoDay; state: WeekState }
export interface Sky { year: number; weeks: SkyWeek[]; perfect: number; longest: { weeks: number; from: IsoDay; to: IsoDay } | null }

/** The ISO weeks of a year (52 or 53): the first is the week that holds 4 January. */
export function weeksOf(year: number): IsoDay[] {
  const out: IsoDay[] = [];
  for (let m = mondayOf(`${year}-01-04` as IsoDay); Number(addDays(m, 3).slice(0, 4)) === year; m = addDays(m, 7)) out.push(m);
  return out;
}

/** W3: the year's sky. Every perfect week is a star; neighbours join into constellations; none is taken back. */
export function sky(ctx: Context, year: number): Sky {
  const weeks = weeksOf(year).map((monday) => ({ monday, state: weekState(ctx, monday) }));
  let longest: Sky['longest'] = null;
  let i = 0;
  while (i < weeks.length) {
    if (weeks[i]!.state !== 'perfect') { i += 1; continue; }
    let j = i;
    while (j + 1 < weeks.length && weeks[j + 1]!.state === 'perfect') j += 1;
    const n = j - i + 1;
    if (!longest || n > longest.weeks) longest = { weeks: n, from: weeks[i]!.monday, to: addDays(weeks[j]!.monday, 6) };
    i = j + 1;
  }
  return { year, weeks, perfect: weeks.filter((w) => w.state === 'perfect').length, longest };
}

export const weekKey = (monday: IsoDay) => `week|${monday}`;
