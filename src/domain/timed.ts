// 130: reminders that aren't habits. Pure rules: the suggested times, the push plan, and where today stands.
// A reminder is never due, never answered and never counted (005); it only nudges at each of its times.
import { addDays, type IsoDay } from './day';
import { instantOf, type Wall } from './zone';

export interface TimedSource { id: string; title: string; times: readonly string[]; days?: readonly number[]; paused?: boolean }

export const TIMES_MIN = 2;
export const TIMES_MAX = 12;
const LATEST = 21 * 60; // suggestions end by 21:00, so a reminder doesn't nudge late in the evening
const STEP = 120; // every 2 hours when it fits (N1b)

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * N1b: `count` times from `start`, every 2 hours when that ends by 21:00, otherwise spread evenly up to 21:00 in
 * 15-minute steps. A start after 21:00 spreads to midnight.
 */
export function suggestTimes(start: string, count: number): string[] {
  const n = Math.min(TIMES_MAX, Math.max(TIMES_MIN, Math.round(count)));
  const s = toMin(start);
  const end = s < LATEST ? LATEST : 24 * 60 - 15;
  const step = s + STEP * (n - 1) <= end ? STEP : Math.max(15, Math.floor((end - s) / (n - 1) / 15) * 15);
  return [...new Set(Array.from({ length: n }, (_, i) => toTime(Math.min(s + step * i, 24 * 60 - 1))))];
}

/** "Every 2 hours from the start", "Every 1 h 30 min from the start", or nothing when the gaps differ. */
export function spacingLine(times: readonly string[]): string | null {
  if (times.length < 2) return null;
  const gaps = new Set(times.slice(1).map((t, i) => toMin(t) - toMin(times[i]!)));
  if (gaps.size !== 1) return null;
  const g = [...gaps][0]!;
  const h = Math.floor(g / 60), m = g % 60;
  const text = m === 0 ? `${h} ${h === 1 ? 'hour' : 'hours'}` : h === 0 ? `${m} min` : `${h} h ${m} min`;
  return `Every ${text} from the start`;
}

export const sortTimes = (times: readonly string[]) => [...new Set(times)].sort();

/** 0 = Monday … 6 = Sunday. */
const weekday = (day: IsoDay) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
export const remindsOn = (r: TimedSource, day: IsoDay) => !r.paused && (!r.days?.length || r.days.includes(weekday(day)));

export interface PlannedNudge { fireAt: string; title: string; body: string; tag: string }

/** Every reminder push from `now` over the next `days` days (B2: "13:00 · 3 of 6 today"). One tag per reminder, so each replaces the last. */
export function planTimed(reminders: readonly TimedSource[], fromDay: IsoDay, now: Date, zone: string, days: number): PlannedNudge[] {
  const out: PlannedNudge[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = addDays(fromDay, i);
    for (const r of reminders) {
      if (!remindsOn(r, day)) continue;
      const times = sortTimes(r.times);
      times.forEach((t, k) => {
        const at = instantOf(`${day}T${t}` as Wall, zone);
        if (at.getTime() <= now.getTime()) return;
        out.push({ fireAt: at.toISOString(), title: r.title, body: `${t} · ${k + 1} of ${times.length} today`, tag: `nudge.${r.id}` });
      });
    }
  }
  return out.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}

/** B3/B4: where today stands at clock time `now` ('HH:mm'): how many times have passed, and the next one. */
export function todayOf(r: TimedSource, day: IsoDay, now: string): { on: boolean; passed: number; next: string | null; total: number } {
  const times = sortTimes(r.times);
  const on = remindsOn(r, day);
  const passed = on ? times.filter((t) => t <= now).length : 0;
  return { on, passed, next: on ? times.find((t) => t > now) ?? null : null, total: times.length };
}

/** H1: "6 times a day · 09:00 to 19:00", "Weekdays · 2 times a day · 10:00 and 15:00". */
export function timedLine(r: TimedSource, daysLabel?: string): string {
  const times = sortTimes(r.times);
  const span = times.length === 2 ? `${times[0]} and ${times[1]}` : `${times[0]} to ${times.at(-1)}`;
  return [daysLabel, `${times.length} times a day`, times.length ? span : null].filter(Boolean).join(' · ');
}

/** 134: what the card opened from a reminder push shows: the times nudged so far (the last is the one that just came), and what is left. */
export interface NudgeCard { passed: string[]; next: string | null; total: number; line: string }
export function nudgeCard(r: TimedSource, day: IsoDay, now: string): NudgeCard {
  const times = sortTimes(r.times);
  const on = remindsOn(r, day);
  const passed = on ? times.filter((t) => t <= now) : [];
  const next = on ? times.find((t) => t > now) ?? null : null;
  const total = times.length;
  const line = !on ? 'Nothing more today'
    : next ? `${passed.length} of ${total} so far · next at ${next}` : `${passed.length} of ${total} · that’s all for today`;
  return { passed, next, total, line };
}
