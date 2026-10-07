// Repeating events (RFC 5545 RRULE), the subset calendar apps like Proton export:
// FREQ (DAILY, WEEKLY, MONTHLY, YEARLY), INTERVAL, BYDAY (with ordinals for monthly/yearly),
// BYMONTHDAY, BYMONTH, COUNT, UNTIL, WKST. Anything else is reported as unsupported, never guessed.
// Works on dates only: a habit keeps its clock time on every occurrence (028), so the time of day
// is not part of the rule. UNTIL is expected as a local date (YYYYMMDD); the .ics reader converts it.
import { addDays, daysBetween, type IsoDay } from './day';

export type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export interface WeekdayRule { weekday: number; nth?: number } // weekday 0 = Monday … 6 = Sunday; nth ±1–5
export interface Recurrence {
  freq: Freq;
  interval: number;
  byDay?: WeekdayRule[];
  byMonthDay?: number[];
  byMonth?: number[];
  count?: number;
  until?: IsoDay;
}

const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const SUPPORTED = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'COUNT', 'UNTIL', 'WKST']);

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}` as IsoDay;
const parts = (d: IsoDay) => d.split('-').map(Number) as [number, number, number];
const weekdayOf = (d: IsoDay) => { const [y, m, dd] = parts(d); return (new Date(Date.UTC(y, m - 1, dd)).getUTCDay() + 6) % 7; };
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Parses an RRULE value. Returns null for anything outside the supported subset. */
export function parseRRule(text: string): Recurrence | null {
  const fields = new Map<string, string>();
  for (const pair of text.replace(/^RRULE:/i, '').split(';')) {
    const [k, v] = pair.split('=');
    if (!k || v === undefined) return null;
    fields.set(k.toUpperCase(), v.toUpperCase());
  }
  if ([...fields.keys()].some((k) => !SUPPORTED.has(k))) return null;
  if (fields.has('WKST') && fields.get('WKST') !== 'MO') return null; // weeks start on Monday here
  const freq = fields.get('FREQ') as Freq | undefined;
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null;
  const rule: Recurrence = { freq, interval: 1 };
  const int = (v: string) => (/^-?\d+$/.test(v) ? Number(v) : NaN);

  if (fields.has('INTERVAL')) {
    rule.interval = int(fields.get('INTERVAL')!);
    if (!(rule.interval >= 1)) return null;
  }
  if (fields.has('COUNT')) {
    rule.count = int(fields.get('COUNT')!);
    if (!(rule.count >= 1)) return null;
  }
  if (fields.has('UNTIL')) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(fields.get('UNTIL')!);
    if (!m) return null;
    rule.until = `${m[1]}-${m[2]}-${m[3]}` as IsoDay;
  }
  if (fields.has('BYDAY')) {
    const list: WeekdayRule[] = [];
    for (const item of fields.get('BYDAY')!.split(',')) {
      const m = /^([+-]?\d)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(item);
      if (!m) return null;
      const nth = m[1] ? Number(m[1]) : undefined;
      if (nth !== undefined && (nth === 0 || Math.abs(nth) > 5 || freq === 'DAILY' || freq === 'WEEKLY')) return null;
      list.push({ weekday: WEEKDAYS.indexOf(m[2]!), ...(nth !== undefined ? { nth } : {}) });
    }
    if (freq === 'DAILY') return null; // a daily rule filtered by weekday: rare, and ambiguous with WEEKLY
    rule.byDay = list;
  }
  if (fields.has('BYMONTHDAY')) {
    const days = fields.get('BYMONTHDAY')!.split(',').map(int);
    if (days.some((d) => !d || Math.abs(d) > 31) || (freq !== 'MONTHLY' && freq !== 'YEARLY')) return null;
    rule.byMonthDay = days;
  }
  if (fields.has('BYMONTH')) {
    const months = fields.get('BYMONTH')!.split(',').map(int);
    if (months.some((m) => !(m >= 1 && m <= 12)) || freq !== 'YEARLY') return null;
    rule.byMonth = months;
  }
  return rule;
}

/** Days of one month that match the rule's day selectors (defaulting to the start's day of month). */
function daysInMonthMatching(y: number, m: number, rule: Recurrence, start: IsoDay): IsoDay[] {
  const last = daysInMonth(y, m);
  const out = new Set<number>();
  if (rule.byMonthDay) {
    for (const d of rule.byMonthDay) { const day = d > 0 ? d : last + d + 1; if (day >= 1 && day <= last) out.add(day); }
  }
  if (rule.byDay) {
    for (const { weekday, nth } of rule.byDay) {
      const matches: number[] = [];
      for (let d = 1; d <= last; d += 1) if (weekdayOf(iso(y, m, d)) === weekday) matches.push(d);
      if (nth === undefined) matches.forEach((d) => out.add(d));
      else { const pick = nth > 0 ? matches[nth - 1] : matches[matches.length + nth]; if (pick) out.add(pick); }
    }
  }
  if (!rule.byMonthDay && !rule.byDay) { const d = parts(start)[2]; if (d <= last) out.add(d); }
  return [...out].sort((a, b) => a - b).map((d) => iso(y, m, d));
}

/** Each period's first day (its anchor) and its candidate days, in order, from the start's period onwards. */
function* periods(start: IsoDay, rule: Recurrence): Generator<{ anchor: IsoDay; days: IsoDay[] }> {
  const [sy, sm] = parts(start);
  for (let k = 0; ; k += 1) {
    const step = k * rule.interval;
    if (rule.freq === 'DAILY') {
      const d = addDays(start, step);
      yield { anchor: d, days: [d] };
    } else if (rule.freq === 'WEEKLY') {
      const monday = addDays(start, -weekdayOf(start) + step * 7);
      const wanted = rule.byDay ? rule.byDay.map((w) => w.weekday) : [weekdayOf(start)];
      yield { anchor: monday, days: [...new Set(wanted)].sort((a, b) => a - b).map((w) => addDays(monday, w)) };
    } else if (rule.freq === 'MONTHLY') {
      const total = sm - 1 + step;
      const y = sy + Math.floor(total / 12);
      const m = (total % 12) + 1;
      yield { anchor: iso(y, m, 1), days: daysInMonthMatching(y, m, rule, start) };
    } else {
      const months = rule.byMonth ? [...rule.byMonth].sort((a, b) => a - b) : [sm];
      yield { anchor: iso(sy + step, 1, 1), days: months.flatMap((m) => daysInMonthMatching(sy + step, m, rule, start)) };
    }
  }
}

const MAX_YEARS = 100; // a safety stop for rules that never match (e.g. 31 February)

/**
 * Every occurrence day from `start` up to `to` (inclusive), in order. The start itself always counts,
 * as RFC 5545 says DTSTART is the first instance. EXDATEs are removed after COUNT is applied.
 */
export function occurrences(start: IsoDay, rule: Recurrence | null, exdates: readonly IsoDay[], to: IsoDay): IsoDay[] {
  const excluded = new Set(exdates);
  if (start > to) return [];
  if (!rule) return excluded.has(start) ? [] : [start];
  const out: IsoDay[] = [];
  let counted = 0;
  const stop = rule.until && rule.until < to ? rule.until : to;
  const take = (d: IsoDay) => { counted += 1; if (!excluded.has(d)) out.push(d); };
  take(start);
  for (const { anchor, days } of periods(start, rule)) {
    if (anchor > stop || daysBetween(start, anchor) > MAX_YEARS * 366) return out;
    for (const d of days) {
      if (d <= start) continue;
      if (d > stop || (rule.count && counted >= rule.count)) return out;
      take(d);
    }
  }
  return out;
}

export function occursOn(start: IsoDay, rule: Recurrence | null, exdates: readonly IsoDay[], day: IsoDay): boolean {
  if (day < start) return false;
  const list = occurrences(start, rule, exdates, day);
  return list[list.length - 1] === day;
}
