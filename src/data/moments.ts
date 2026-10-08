// Today's words (107–110): at most one quote block on Today, and the perfect-week award when a week closes.
// Quotes are given once per moment and kept in Settings, so Today shows the same words all day and a backup carries
// them. One quote per screen: a milestone first, then a comeback, then the morning after a miss.
import { getSettings, updateSettings } from './settings';
import type { StatsData } from './stats';
import { addDays, type IsoDay } from '../domain/day';
import { comebackKey, comebackLine, comebacksToday, milestoneKey, milestoneLine, milestoneOf, riskKey, sky, weekKey, weekState } from '../domain/moments';
import { EMPTY_QUOTES, pruneQuotes, quoteById, quoteFor, type Quote, type QuoteState } from '../domain/quotes';
import { habitDays, mondayOf, type Medal } from '../domain/stats';
import { dayVerdict, type RunAtRisk } from '../domain/award';
import { RANKS } from '../domain/ranks';
import { shortName } from '../domain/format';

export interface TodayMoment {
  kind: 'milestone' | 'comeback' | 'risk';
  eventId: string;
  quote: Quote;
  label?: string; // "Milestone · day 20", "Comeback · Read"
  line?: string; // the proof, in the ATOMIC voice
  bar?: { value: number; of: number; stops: number[]; rank: string };
}

/** The one moment Today shows, giving it a quote the first time it is seen. */
export async function todayMoment(d: StatsData, medals: readonly Medal[], risk: RunAtRisk | null): Promise<TodayMoment | null> {
  const today = d.ctx.today;
  const settings = await getSettings();
  const before: QuoteState = settings.quotes ?? EMPTY_QUOTES;
  let state = pruneQuotes(before, today);
  const doneToday = new Set(d.ctx.answers.filter((a) => a.occurrence === today && a.status === 'done').map((a) => a.eventId));
  let moment: TodayMoment | null = null;

  // 107: a milestone, shown all day on the day it was first seen
  for (const m of medals) {
    const ms = milestoneOf(m, doneToday.has(m.eventId));
    if (!ms) continue;
    const key = milestoneKey(ms);
    const had = state.given[key];
    if (had && had.on !== today) continue;
    const r = quoteFor(state, key, today);
    state = r.state;
    moment = { kind: 'milestone', eventId: ms.eventId, quote: r.quote, label: `Milestone · day ${ms.day}`, line: milestoneLine(ms),
      bar: { value: ms.held, of: ms.of, stops: ms.stops, rank: RANKS.find((x) => x.id === ms.rank)!.label } };
    break;
  }
  // 108: the run held after a miss
  if (!moment) {
    const c = comebacksToday(d.ctx)[0];
    if (c) {
      const r = quoteFor(state, comebackKey(c), today);
      state = r.state;
      moment = { kind: 'comeback', eventId: c.eventId, quote: r.quote, label: `Comeback · ${shortName(c.title)}`, line: comebackLine(c) };
    }
  }
  // 108: the morning after a miss: a quote above the 099 line
  if (!moment && risk) {
    const r = quoteFor(state, riskKey(risk.eventId, today), today);
    state = r.state;
    moment = { kind: 'risk', eventId: risk.eventId, quote: r.quote };
  }
  if (state !== before) await updateSettings({ quotes: state });
  return moment;
}

/** H4: the last milestone a habit reached, with its quote. */
export function lastMilestone(quotes: QuoteState | undefined, eventId: string): { day: number; quote: Quote } | null {
  const mine = Object.entries(quotes?.given ?? {})
    .filter(([k]) => k.startsWith(`milestone|${eventId}|`))
    .map(([k, v]) => ({ day: Number(k.split('|')[3]), on: v.on, quote: quoteById(v.q) }))
    .filter((x): x is { day: number; on: IsoDay; quote: Quote } => !!x.quote)
    .sort((a, b) => a.on.localeCompare(b.on) || a.day - b.day);
  const last = mine.at(-1);
  return last ? { day: last.day, quote: last.quote } : null;
}

export interface WeekAward { monday: IsoDay; quote: Quote; line: string }

/**
 * 109: a perfect week whose award hasn't played. This week, or last week on its Monday (a week closed on Sunday
 * night and opened the next morning). Once a week at most.
 */
export async function weekAwardDue(d: StatsData): Promise<WeekAward | null> {
  const settings = await getSettings();
  const today = d.ctx.today;
  const candidates = [mondayOf(today)];
  if (mondayOf(today) === today) candidates.push(addDays(today, -7));
  const monday = candidates.find((m) => weekState(d.ctx, m) === 'perfect' && (!settings.weekAwardShown || settings.weekAwardShown < m));
  if (!monday) return null;
  const year = Number(addDays(monday, 3).slice(0, 4));
  const nth = sky(d.ctx, year).weeks.filter((w) => w.state === 'perfect' && w.monday <= monday).length;
  const r = quoteFor(settings.quotes ?? EMPTY_QUOTES, weekKey(monday), today);
  await updateSettings({ quotes: r.state });
  const cells = habitDays(d.ctx, monday, addDays(monday, 6));
  let due = 0;
  for (let day = monday; day <= addDays(monday, 6); day = addDays(day, 1)) if (dayVerdict(cells, day, today).due > 0) due += 1;
  return { monday, quote: r.quote, line: `${due} of ${due} days · ${ordinal(nth)} this year` };
}

export async function markWeekAward(monday: IsoDay): Promise<void> {
  await updateSettings({ weekAwardShown: monday });
}

/** "the 1st", "the 22nd", "the 13th" (061: plain numbers). */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `the ${n}${s}`;
}
