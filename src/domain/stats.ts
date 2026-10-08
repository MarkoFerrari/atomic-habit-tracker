// M5 Stats (Figma page 08 section 06 and 07), as pure rules: the week grid, the month heatmap, the year bars,
// one habit in depth, medals per habit, and the Sunday recap. No DOM, no IndexedDB.
// 006: completion rate = done ÷ due, with the number due beside it. 033: days before tracking started
// and days ahead are never counted as zero. 051/052: a skip and an unanswered closed day both count as a miss.
import { addDays, daysBetween, type IsoDay } from './day';
import { isoWeek, monthName, shortName, weekRange } from './format';
import { nextRank, RANKS, reachedRank, type RankId } from './ranks';
import type { Rate } from './rates';
import { daysHeld, step, EMPTY_RUN, type DueDay } from './runs';
import { SKIP_REASONS, type AnswerStatus, type SkipReason } from './states';
import { occurrencesOn, type AnswerLike, type HabitSource } from './today';
import { addMinutes, wallOf, type Wall } from './zone';

/** What one habit occurrence looks like on a chart. `ahead` = due but not yet; `before` = before tracking started. */
export type CellState = AnswerStatus | 'open' | 'ahead' | 'before';

export interface HabitDay {
  eventId: string;
  title: string;
  icon?: string;
  day: IsoDay;
  state: CellState;
  reason?: SkipReason;
  start: Wall;
  end: Wall;
  allDay: boolean;
  minutes: number;
}

export interface Context {
  habits: readonly HabitSource[];
  answers: readonly AnswerLike[];
  trackingStart: IsoDay | null;
  today: IsoDay;
}

const answerKey = (eventId: string, occurrence: string) => `${eventId}|${occurrence}`;

/** Every habit occurrence from `from` to `to`, each with the state a chart draws. */
export function habitDays(ctx: Context, from: IsoDay, to: IsoDay): HabitDay[] {
  const byKey = new Map(ctx.answers.map((a) => [answerKey(a.eventId, a.occurrence), a]));
  const out: HabitDay[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    for (const o of occurrencesOn(ctx.habits, day)) {
      const a = byKey.get(answerKey(o.eventId, o.occurrence));
      let state: CellState;
      if (!ctx.trackingStart || day < ctx.trackingStart) state = 'before';
      else if (a) state = a.status;
      else if (day < ctx.today) state = 'missed'; // 052
      else state = day === ctx.today ? 'open' : 'ahead';
      out.push({
        eventId: o.eventId, title: o.title, icon: o.icon, day, state, start: o.start, end: o.end, allDay: o.allDay, minutes: o.minutes,
        ...(a?.status === 'skipped' && a.reason ? { reason: a.reason as SkipReason } : {}),
      });
    }
  }
  return out;
}

/** Done ÷ due over decided occurrences only (open, ahead and before-start never count, 033). */
export function rateOf(days: readonly HabitDay[]): Rate {
  let done = 0;
  let due = 0;
  for (const d of days) {
    if (d.state === 'done') { done += 1; due += 1; } else if (d.state === 'skipped' || d.state === 'missed') due += 1;
  }
  return { done, due, rate: due === 0 ? null : done / due };
}

// --- Week (H34) ---------------------------------------------------------------------------------------------

export const mondayOf = (d: IsoDay): IsoDay => addDays(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));

export interface WeekRow { eventId: string; title: string; icon?: string; cells: (HabitDay | null)[] }
export interface WeekView { from: IsoDay; to: IsoDay; days: IsoDay[]; number: number; rows: WeekRow[]; rate: Rate }

export function weekView(ctx: Context, anchor: IsoDay): WeekView {
  const from = mondayOf(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const all = habitDays(ctx, from, days[6]!);
  const ids = [...new Set(all.map((d) => d.eventId))];
  const rows: WeekRow[] = ids.map((id) => {
    const mine = all.filter((d) => d.eventId === id);
    return { eventId: id, title: mine[0]!.title, icon: mine[0]!.icon, cells: days.map((day) => mine.find((d) => d.day === day) ?? null) };
  }).sort((a, b) => firstStart(all, a.eventId).localeCompare(firstStart(all, b.eventId)) || a.title.localeCompare(b.title));
  return { from, to: days[6]!, days, number: isoWeek(from), rows, rate: rateOf(all) };
}
const firstStart = (all: readonly HabitDay[], id: string) => all.find((d) => d.eventId === id)!.start.slice(11, 16);

// --- Month (H35) --------------------------------------------------------------------------------------------

/** 038: five steps from white to done green. 0 only when something was due and none was done. */
export function heatLevel(rate: number): 0 | 1 | 2 | 3 | 4 {
  if (rate >= 1) return 4;
  if (rate >= 0.75) return 3;
  if (rate >= 0.5) return 2;
  return rate > 0 ? 1 : 0;
}

export interface MonthCell { day: IsoDay; kind: 'rate' | 'today' | 'ahead' | 'empty'; level: 0 | 1 | 2 | 3 | 4 | null; rate: Rate }
export interface MonthView { first: IsoDay; label: string; leading: number; cells: MonthCell[]; rate: Rate; byHabit: { eventId: string; title: string; rate: Rate }[] }

export function monthView(ctx: Context, anchor: IsoDay): MonthView {
  const first = `${anchor.slice(0, 7)}-01` as IsoDay;
  const last = addDays(`${addMonth(first)}` as IsoDay, -1);
  const all = habitDays(ctx, first, last);
  const cells: MonthCell[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) {
    const mine = all.filter((d) => d.day === day && d.state !== 'before');
    const rate = rateOf(mine);
    const kind: MonthCell['kind'] = day === ctx.today ? 'today' : day > ctx.today && mine.length ? 'ahead' : rate.due ? 'rate' : 'empty';
    cells.push({ day, kind, level: rate.rate === null ? null : heatLevel(rate.rate), rate });
  }
  const ids = [...new Set(all.map((d) => d.eventId))];
  const byHabit = ids.map((id) => ({ eventId: id, title: all.find((d) => d.eventId === id)!.title, rate: rateOf(all.filter((d) => d.eventId === id)) }))
    .filter((h) => h.rate.due > 0).sort((a, b) => (b.rate.rate ?? 0) - (a.rate.rate ?? 0) || a.title.localeCompare(b.title));
  return { first, label: monthName(first), leading: (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7, cells, rate: rateOf(all), byHabit };
}
const addMonth = (first: IsoDay): IsoDay => {
  const [y, m] = first.split('-').map(Number) as [number, number];
  return (m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`) as IsoDay;
};

// --- Year (H36) ---------------------------------------------------------------------------------------------

export interface YearBar { month: number; first: IsoDay; letter: string; rate: Rate; ahead: boolean }
export interface YearView { year: number; bars: YearBar[]; rate: Rate; best: YearBar | null; low: YearBar | null; sentence: string }

export function yearView(ctx: Context, anchor: IsoDay): YearView {
  const year = Number(anchor.slice(0, 4));
  const bars: YearBar[] = [];
  const all: HabitDay[] = [];
  for (let m = 1; m <= 12; m += 1) {
    const first = `${year}-${String(m).padStart(2, '0')}-01` as IsoDay;
    const last = addDays(addMonth(first), -1);
    const days = first > ctx.today ? [] : habitDays(ctx, first, last < ctx.today ? last : ctx.today);
    all.push(...days);
    bars.push({ month: m, first, letter: monthName(first).slice(0, 1), rate: rateOf(days), ahead: first > ctx.today });
  }
  const live = bars.filter((b) => b.rate.due > 0);
  const best = live.length >= 2 ? live.reduce((a, b) => ((b.rate.rate ?? 0) > (a.rate.rate ?? 0) ? b : a)) : null;
  const low = live.length >= 2 ? live.reduce((a, b) => ((b.rate.rate ?? 1) < (a.rate.rate ?? 1) ? b : a)) : null;
  const pct = (b: YearBar) => Math.round((b.rate.rate ?? 0) * 100);
  const sentence = best && low && best.month !== low.month
    ? `${monthName(best.first)} was the most consistent month (${pct(best)}%), ${monthName(low.first)} the least (${pct(low)}%). The number under each bar is how many were due.`
    : 'The number under each bar is how many were due. More months will show which held best.';
  return { year, bars, rate: rateOf(all), best, low, sentence };
}

// --- Runs and medals (H38) ----------------------------------------------------------------------------------

export interface Medal {
  eventId: string;
  title: string;
  icon: string;
  rank: RankId | null; // never lost (047)
  held: number; // days held in the current run (060)
  next: { rank: RankId; daysLeft: number; days: number } | null;
}

/** The run history of a habit: closed or answered occurrences up to today (052), in date order. */
export function historyOf(ctx: Context, h: HabitSource): DueDay[] {
  const startDay = h.start.slice(0, 10) as IsoDay;
  const from = ctx.trackingStart && ctx.trackingStart > startDay ? ctx.trackingStart : startDay;
  if (from > ctx.today) return [];
  const mine = { ...ctx, habits: [h] };
  return habitDays(mine, from, ctx.today)
    .filter((d) => d.state === 'done' || d.state === 'skipped' || d.state === 'missed')
    .map((d) => ({ day: d.day, status: d.state as AnswerStatus }));
}

/** The longest days-held ever reached, so a rank is never taken back after a run ends (E4, 047). */
export function bestHeld(history: readonly DueDay[]): number {
  let run = EMPTY_RUN;
  let best = 0;
  for (const due of history) {
    run = step(run, due);
    if (run.startedOn) best = Math.max(best, daysHeld(run, due.day));
  }
  return best;
}

export function medalOf(ctx: Context, h: HabitSource, stored: RankId | null): Medal {
  const history = historyOf(ctx, h);
  const run = history.reduce(step, EMPTY_RUN);
  const held = daysHeld(run, ctx.today);
  const rank = reachedRank(reachedRank(stored, bestHeld(history)), held);
  const n = nextRank(rank, held);
  return {
    eventId: h.id, title: h.title, icon: h.icon ?? 'sprout', rank, held,
    next: n ? { rank: n.rank, daysLeft: n.daysLeft, days: RANKS.find((r) => r.id === n.rank)!.days } : null,
  };
}

const order = (r: RankId | null) => (r ? RANKS.findIndex((x) => x.id === r) : -1);
/** H38: highest rank first, then the longer run, then the name. */
export function sortMedals(medals: readonly Medal[]): Medal[] {
  return [...medals].sort((a, b) => order(b.rank) - order(a.rank) || b.held - a.held || a.title.localeCompare(b.title));
}

/** The next medal to be won: the one with the fewest days left (H38 "Next · …"). */
export function nextUp(medals: readonly Medal[]): Medal | null {
  const open = medals.filter((m) => m.next);
  return open.length ? open.reduce((a, b) => (b.next!.daysLeft < a.next!.daysLeft ? b : a)) : null;
}

// --- One habit in depth (H37) -------------------------------------------------------------------------------

export const WHY_NONE = 'none' as const;
export type WhyKey = SkipReason | typeof WHY_NONE;
export interface TimeBucket { label: string; count: number }
export interface HabitDetail {
  medal: Medal;
  rate: Rate;
  windowDays: number;
  why: Record<WhyKey, number>;
  whyTotal: number;
  times: TimeBucket[] | null; // null for an all-day habit
  slot: string;
}

const hhmm = (w: string) => w.slice(11, 16);

export function habitDetail(ctx: Context, h: HabitSource, stored: RankId | null, zone: string): HabitDetail {
  const startDay = h.start.slice(0, 10) as IsoDay;
  const trackedFrom = ctx.trackingStart && ctx.trackingStart > startDay ? ctx.trackingStart : startDay;
  const windowStart = addDays(ctx.today, -89) > trackedFrom ? addDays(ctx.today, -89) : trackedFrom;
  const mine = { ...ctx, habits: [h] };
  const days = habitDays(mine, windowStart, ctx.today);
  const why = Object.fromEntries([...SKIP_REASONS, WHY_NONE].map((k) => [k, 0])) as Record<WhyKey, number>;
  for (const d of days) {
    if (d.state === 'skipped') why[d.reason ?? WHY_NONE] += 1;
    else if (d.state === 'missed') why[WHY_NONE] += 1;
  }
  const whyTotal = Object.values(why).reduce((a, b) => a + b, 0);
  const done = days.filter((d) => d.state === 'done');
  const first = days[0];
  let times: TimeBucket[] | null = null;
  if (first && !first.allDay) {
    const minutes = first.minutes;
    const b1 = Math.round(minutes / 3);
    const b2 = Math.round((2 * minutes) / 3);
    const labels = ['Before', 'a', 'b', 'c', 'After'];
    const counts = [0, 0, 0, 0, 0];
    const answeredAt = new Map(ctx.answers.filter((a) => a.eventId === h.id).map((a) => [a.occurrence, a.answeredAt]));
    for (const d of done) {
      if (d.day < addDays(ctx.today, -29)) continue;
      const at = answeredAt.get(d.day);
      if (!at) continue;
      const wall = wallOf(new Date(at), zone);
      const s = d.start;
      const e1 = addMinutes(s, b1);
      const e2 = addMinutes(s, b2);
      const end = d.end;
      counts[wall < s ? 0 : wall < e1 ? 1 : wall < e2 ? 2 : wall < end ? 3 : 4]! += 1;
    }
    const s = first.start;
    const edge = (w: Wall) => hhmm(w);
    const names = [`Before ${edge(s)}`, `${edge(s)}–${edge(addMinutes(s, b1))}`, `${edge(addMinutes(s, b1))}–${edge(addMinutes(s, b2))}`,
      `${edge(addMinutes(s, b2))}–${edge(first.end)}`, `After ${edge(first.end)}`];
    times = labels.map((_, i) => ({ label: names[i]!, count: counts[i]! }));
  }
  return {
    medal: medalOf(ctx, h, stored), rate: rateOf(days), windowDays: daysBetween(windowStart, ctx.today) + 1, why, whyTotal, times,
    slot: first && !first.allDay ? `${hhmm(first.start)}–${hhmm(first.end)}` : 'All day',
  };
}

// --- The Sunday recap (H39) ---------------------------------------------------------------------------------

export interface WeeklyRecap {
  from: IsoDay;
  to: IsoDay;
  label: string; // "15–21 November"
  title: string; // "Week 46 recap"
  number: number;
  rate: Rate;
  previous: Rate;
  best: { eventId: string; title: string; rate: Rate } | null;
  weakest: { eventId: string; title: string; rate: Rate } | null;
  bestDay: { day: IsoDay; rate: Rate } | null;
  parts: { morning: Rate; evening: Rate } | null;
  pattern: { eventId: string; title: string; minutes: number; reason: SkipReason | null; count: number; due: number } | null;
}

/** Which week the recap is about: this one on Sunday, the one before from Monday on. Null until something was due. */
export function recapWeekStart(today: IsoDay): IsoDay {
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  return weekday === 6 ? mondayOf(today) : addDays(mondayOf(today), -7);
}

export function weeklyRecap(ctx: Context, weekStart: IsoDay): WeeklyRecap | null {
  const to = addDays(weekStart, 6);
  const days = habitDays(ctx, weekStart, to);
  const rate = rateOf(days);
  if (rate.due < 3) return null; // too little to say anything true (E19)
  const previous = rateOf(habitDays(ctx, addDays(weekStart, -7), addDays(weekStart, -1)));

  const ids = [...new Set(days.map((d) => d.eventId))];
  const perHabit = ids.map((id) => ({ eventId: id, title: days.find((d) => d.eventId === id)!.title, rate: rateOf(days.filter((d) => d.eventId === id)) }))
    .filter((h) => h.rate.due > 0);
  const byRate = [...perHabit].sort((a, b) => (b.rate.rate ?? 0) - (a.rate.rate ?? 0) || a.title.localeCompare(b.title));
  const best = byRate[0] ?? null;
  const worst = byRate.length > 1 ? byRate[byRate.length - 1]! : null;
  const weakest = worst && best && (worst.rate.rate ?? 0) < (best.rate.rate ?? 0) ? worst : null;

  const perDay = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    .map((day) => ({ day, rate: rateOf(days.filter((d) => d.day === day)) })).filter((d) => d.rate.due > 0);
  const bestDay = perDay.length ? perDay.reduce((a, b) => ((b.rate.rate ?? 0) > (a.rate.rate ?? 0) ? b : a)) : null;

  const hour = (d: HabitDay) => Number(d.start.slice(11, 13));
  const morning = rateOf(days.filter((d) => !d.allDay && hour(d) < 12));
  const evening = rateOf(days.filter((d) => !d.allDay && hour(d) >= 17));
  const parts = morning.due && evening.due ? { morning, evening } : null;

  let pattern: WeeklyRecap['pattern'] = null;
  if (weakest) {
    const mine = days.filter((d) => d.eventId === weakest.eventId);
    const slipped = mine.filter((d) => d.state === 'skipped' || d.state === 'missed');
    const counts = new Map<SkipReason | null, number>();
    for (const d of slipped) counts.set(d.reason ?? null, (counts.get(d.reason ?? null) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top = ranked.find(([r]) => r !== null) ?? ranked[0];
    if (top) pattern = { eventId: weakest.eventId, title: weakest.title, minutes: mine[0]!.minutes, reason: top[0], count: top[1], due: mine.filter((d) => d.state !== 'ahead' && d.state !== 'open').length };
  }
  return {
    from: weekStart, to, label: weekRange(weekStart, to), title: `Week ${isoWeek(weekStart)} recap`, number: isoWeek(weekStart),
    rate, previous, best, weakest, bestDay, parts, pattern,
  };
}

/** "Breakfast was skipped for “No time” on 4 of 5 days." (H39; the design's example, extended in 068's spirit.) */
export function patternSentence(p: NonNullable<WeeklyRecap['pattern']>, reasonLabel: (r: SkipReason) => string): string {
  const name = shortName(p.title);
  return p.reason
    ? `${name} was skipped for “${reasonLabel(p.reason)}” on ${p.count} of ${p.due} days.`
    : `${name} slipped on ${p.count} of ${p.due} days, with no reason given.`;
}
