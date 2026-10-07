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
const ORDINAL: Record<number, string> = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', [-1]: 'last' };

/** How often a habit repeats, in words. Clock times are 24-hour, as the design writes them. */
export function repeatLabel(rule: Recurrence | null, start?: IsoDay): string {
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
