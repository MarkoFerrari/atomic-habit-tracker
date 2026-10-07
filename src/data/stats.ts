// M5 data: what the Stats screens read, medals kept for good, and the Kaizen trial (080).
import { db } from './db';
import { habitEvents, toSource } from './answers';
import { getSettings, updateSettings } from './settings';
import type { RankRecord } from './schema';
import { habitDayOf, type IsoDay } from '../domain/day';
import { RANKS, type RankId } from '../domain/ranks';
import { medalOf, type Context, type Medal } from '../domain/stats';
import type { HabitSource } from '../domain/today';
import type { Adjustment } from '../domain/adjust';

export interface StatsData {
  ctx: Context;
  events: Map<string, { icon?: string; archivedOn?: IsoDay }>;
  stored: Map<string, RankId | null>;
  adjustments: Adjustment[];
  recapSeen: IsoDay | null;
  zone: string;
}

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const highest = (ranks: readonly RankRecord[]): RankId | null => {
  const ids = new Set(ranks.map((r) => r.rank));
  return RANKS.filter((r) => ids.has(r.id)).at(-1)?.id ?? null;
};

export async function loadStats(now = new Date()): Promise<StatsData> {
  const database = await db();
  const [events, answers, settings, ranks] = await Promise.all([habitEvents(), database.getAll('answers'), getSettings(), database.getAll('ranks')]);
  const habits: HabitSource[] = events.map(toSource);
  const stored = new Map(events.map((e) => [e.id, highest(ranks.filter((r) => r.seriesId === e.id))]));
  const tz = zone();
  return {
    ctx: { habits, answers, trackingStart: (settings.trackingStart as IsoDay | null) ?? null, today: habitDayOf(now, tz) },
    events: new Map(events.map((e) => [e.id, { icon: e.icon, archivedOn: e.archivedOn }])),
    stored, adjustments: settings.adjustments ?? [], recapSeen: settings.recapSeen ?? null, zone: tz,
  };
}

/** Habits that still count today (E9): archived ones keep their medals but leave the charts. */
export const activeIds = (d: StatsData): Set<string> =>
  new Set(d.ctx.habits.filter((h) => !h.archivedOn || h.archivedOn > d.ctx.today).map((h) => h.id));

/** Every habit's medal, and the ranks newly reached written down so none is ever taken back (E4, 047). */
export async function medals(d: StatsData): Promise<Medal[]> {
  const out = d.ctx.habits.map((h) => medalOf(d.ctx, h, d.stored.get(h.id) ?? null));
  const database = await db();
  for (const m of out) {
    const had = d.stored.get(m.eventId) ?? null;
    if (!m.rank) continue;
    const from = had ? RANKS.findIndex((r) => r.id === had) + 1 : 0;
    const to = RANKS.findIndex((r) => r.id === m.rank);
    for (let i = from; i <= to; i += 1) {
      const rank = RANKS[i]!.id;
      await database.put('ranks', { key: `${m.eventId}|${rank}`, seriesId: m.eventId, rank, reachedOn: d.ctx.today });
    }
    d.stored.set(m.eventId, m.rank);
  }
  return out;
}

export async function saveAdjustments(adjustments: Adjustment[]): Promise<void> {
  await updateSettings({ adjustments });
}

export async function markRecapSeen(weekStart: IsoDay): Promise<void> {
  await updateSettings({ recapSeen: weekStart });
}
