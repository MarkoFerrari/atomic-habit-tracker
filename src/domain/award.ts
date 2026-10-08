// The habits-first rewards (Figma page 14) as pure rules: the week strip under the Today ring (096),
// perfect days (093), the line the morning after a miss (099) and the next-rank line on every row (098).
import { addDays, type IsoDay } from './day';
import { plural, shortName, weekdayLetter, weekdayShort } from './format';
import { RANKS } from './ranks';
import { daysHeld, step, EMPTY_RUN, type DueDay } from './runs';
import { bestHeld, habitDays, mondayOf, rateOf, type Context, type HabitDay, type Medal } from './stats';

/** perfect: every due habit done · partial: some done · missed: past, none done · open: today, not yet perfect ·
 *  future: ahead · empty: nothing due, or before tracking started (never counted, 033). */
export type StripState = 'perfect' | 'partial' | 'missed' | 'open' | 'future' | 'empty';
export interface DayVerdict { state: StripState; done: number; due: number; share: number }
export interface StripDay extends DayVerdict { day: IsoDay; letter: string; today: boolean }

/** One day's verdict from its habit occurrences. Today counts what is due today, answered or not. */
export function dayVerdict(cells: readonly HabitDay[], day: IsoDay, today: IsoDay): DayVerdict {
  const counted = cells.filter((c) => c.day === day && c.state !== 'before');
  const due = counted.length;
  const done = counted.filter((c) => c.state === 'done').length;
  const share = due ? done / due : 0;
  if (day > today) return { state: 'future', done: 0, due, share: 0 };
  if (!due) return { state: 'empty', done, due, share };
  if (done === due) return { state: 'perfect', done, due, share };
  if (day === today) return { state: 'open', done, due, share };
  return { state: done > 0 ? 'partial' : 'missed', done, due, share };
}

/** Monday to Sunday of the week that holds `today`. */
export function weekStrip(ctx: Context): StripDay[] {
  const from = mondayOf(ctx.today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const cells = habitDays(ctx, from, days[6]!);
  return days.map((day) => ({ day, letter: weekdayLetter(day), today: day === ctx.today, ...dayVerdict(cells, day, ctx.today) }));
}

/** Perfect days from `from` to `to` (never past today). */
export function perfectDays(ctx: Context, from: IsoDay, to: IsoDay): IsoDay[] {
  const end = to < ctx.today ? to : ctx.today;
  if (end < from) return [];
  const cells = habitDays(ctx, from, end);
  const out: IsoDay[] = [];
  for (let d = from; d <= end; d = addDays(d, 1)) if (dayVerdict(cells, d, ctx.today).state === 'perfect') out.push(d);
  return out;
}

/** "Builder in 6 days", or "Mastered" at the top (098). */
export function nextRankLine(m: Pick<Medal, 'rank' | 'next'>): string {
  if (!m.next) return m.rank === 'master' ? 'Mastered' : '';
  return `${RANKS.find((r) => r.id === m.next!.rank)!.label} in ${plural(m.next.daysLeft, 'day')}`;
}

export interface RunAtRisk { eventId: string; title: string; held: number; missedOn: IsoDay }

/**
 * 099, never miss twice (051) made visible: a habit due and still open today whose last due day was a miss,
 * with its run still alive. Today decides whether the run holds. The first one, in time order.
 */
export function runAtRisk(ctx: Context): RunAtRisk | null {
  if (!ctx.trackingStart) return null;
  const todays = habitDays(ctx, ctx.today, ctx.today).filter((c) => c.state === 'open');
  for (const c of todays) {
    const h = ctx.habits.find((x) => x.id === c.eventId);
    if (!h) continue;
    const startDay = h.start.slice(0, 10) as IsoDay;
    const from = ctx.trackingStart > startDay ? ctx.trackingStart : startDay;
    const yesterday = addDays(ctx.today, -1);
    if (from > yesterday) continue;
    const history: DueDay[] = habitDays({ ...ctx, habits: [h] }, from, yesterday)
      .filter((d) => d.state === 'done' || d.state === 'skipped' || d.state === 'missed')
      .map((d) => ({ day: d.day, status: d.state as DueDay['status'] }));
    const run = history.reduce(step, EMPTY_RUN);
    if (run.startedOn && run.missesInARow === 1) {
      return { eventId: h.id, title: h.title, held: daysHeld(run, ctx.today), missedOn: history.at(-1)!.day };
    }
  }
  return null;
}

/** "Walk slipped yesterday. Do it today and your 23-day run holds." */
export function runAtRiskLine(r: RunAtRisk, today: IsoDay): string {
  const when = r.missedOn === addDays(today, -1) ? 'yesterday' : `on ${weekdayShort(r.missedOn)}`;
  return `${shortName(r.title)} slipped ${when}. Do it today and your ${r.held}-day run holds.`;
}

export interface WeekBar { from: IsoDay; done: number; due: number; share: number | null } // null: before the habit was tracked (033)

/** H4: twelve weeks of one habit, oldest first, ending with this week. */
export function twelveWeeks(ctx: Context, h: Context['habits'][number]): WeekBar[] {
  const startDay = h.start.slice(0, 10) as IsoDay;
  const from = ctx.trackingStart && ctx.trackingStart > startDay ? ctx.trackingStart : startDay;
  const thisWeek = mondayOf(ctx.today);
  return Array.from({ length: 12 }, (_, i) => {
    const monday = addDays(thisWeek, (i - 11) * 7);
    const sunday = addDays(monday, 6);
    if (sunday < from) return { from: monday, done: 0, due: 0, share: null };
    const r = rateOf(habitDays({ ...ctx, habits: [h] }, monday, sunday < ctx.today ? sunday : ctx.today));
    return { from: monday, done: r.done, due: r.due, share: r.due ? r.done / r.due : 0 };
  });
}

/** H4: the longest run the habit ever held, in days (060). */
export function bestRun(ctx: Context, h: Context['habits'][number]): number {
  const startDay = h.start.slice(0, 10) as IsoDay;
  const from = ctx.trackingStart && ctx.trackingStart > startDay ? ctx.trackingStart : startDay;
  if (!ctx.trackingStart || from > ctx.today) return 0;
  const history: DueDay[] = habitDays({ ...ctx, habits: [h] }, from, ctx.today)
    .filter((d) => d.state === 'done' || d.state === 'skipped' || d.state === 'missed')
    .map((d) => ({ day: d.day, status: d.state as DueDay['status'] }));
  return bestHeld(history);
}
