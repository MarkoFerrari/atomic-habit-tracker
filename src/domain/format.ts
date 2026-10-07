// 061: numbers are plain whole numbers, never zero-padded (82%, not 082%).
import type { Rate } from './rates';
import type { Recurrence } from './recurrence';
import type { IsoDay } from './day';

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

// --- Schedules (H09, Today): "Tue, Thu, Sat · 05:30", "Every day · 08:00", "Weekdays · 08:30" ---

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ORDINAL: Record<number, string> = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', [-1]: 'last' };

/** How often a habit repeats, in words. Clock times are 24-hour, as the design writes them. */
/** `long`: H29 writes a single weekday out ("Every Tuesday"); H09 keeps it short ("Tue"). */
export function repeatLabel(rule: Recurrence | null, start?: IsoDay, long = false): string {
  if (!rule) return 'Once';
  const every = (unit: string) => (rule.interval === 1 ? null : `Every ${rule.interval} ${unit}`);
  if (rule.freq === 'DAILY') return every('days') ?? 'Every day';
  if (rule.freq === 'WEEKLY') {
    const own = start ? [(new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7] : [];
    const days = [...new Set(rule.byDay ? rule.byDay.map((d) => d.weekday) : own)].sort((a, b) => a - b);
    let which = days.map((d) => DAY_NAMES[d]).join(', ');
    if (days.length === 7) which = 'Every day';
    else if (days.join() === '0,1,2,3,4') which = 'Weekdays';
    else if (days.join() === '5,6') which = 'Weekends';
    else if (long && days.length === 1 && rule.interval === 1) return `Every ${DAY_LONG[days[0]!]}`; // H29: "Every Tuesday"
    const prefix = every('weeks');
    if (!which) return prefix ?? 'Every week';
    return prefix ? `${prefix} · ${which}` : which;
  }
  if (rule.freq === 'MONTHLY') {
    const nth = rule.byDay?.[0];
    const base = every('months') ?? 'Monthly';
    if (nth?.nth !== undefined) return `${base}, ${ORDINAL[nth.nth] ?? nth.nth} ${DAY_NAMES[nth.weekday]}`;
    if (rule.byMonthDay?.length) return `${base}, day ${rule.byMonthDay.join(', ')}`;
    return base;
  }
  return every('years') ?? 'Yearly';
}

/** "05:30" from a stored clock time ('YYYY-MM-DDTHH:mm'), or "All day". */
export function clockLabel(start: string, allDay: boolean): string {
  return allDay ? 'All day' : start.slice(11, 16);
}

/** 004: habits are written with their end point ("Diorama - 45 min"). Short form for sentences: "Diorama". */
export function shortName(title: string): string {
  const short = title.replace(/\s*[-–·:]?\s*\d+\s*(min|mins|minutes|h|hr|hours?)\.?$/i, '').trim();
  return short || title;
}

// --- Dates (Calendar, H26–H29). Days are formatted as dates, never shifted by a zone. ---

const at = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`);
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...o, timeZone: 'UTC' });

/** "Tuesday 6 October" */
export const fullDate = (d: string) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(at(d));
/** "October" */
export const monthName = (d: string) => fmt({ month: 'long' }).format(at(d));
/** "Tue" */
export const weekdayShort = (d: string) => fmt({ weekday: 'short' }).format(at(d));
/** "T" */
export const weekdayLetter = (d: string) => weekdayShort(d).slice(0, 1);
/** "Sunday 11": the empty day's title (H33). */
export const dayAndNumber = (d: string) => `${fmt({ weekday: 'long' }).format(at(d))} ${Number(d.slice(8, 10))}`;

/** ISO 8601 week number: weeks start on Monday, week 1 holds the year's first Thursday. */
export function isoWeek(d: string): number {
  const date = at(d);
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday + 3); // the Thursday of this week
  const jan4 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((date.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

/** "5–11 October", "28 September – 4 October" */
export function weekRange(first: string, last: string): string {
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  const d = (x: string) => Number(x.slice(8, 10));
  return sameMonth ? `${d(first)}–${d(last)} ${monthName(last)}` : `${d(first)} ${monthName(first)} – ${d(last)} ${monthName(last)}`;
}

/** "1h", "1h 30m": free time in Day view (070). */
export function hoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
