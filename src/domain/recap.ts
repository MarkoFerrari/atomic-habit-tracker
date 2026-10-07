// Evening Recap (F5, H18–H25): which day it closes, its title, and the line under the day result.
import { habitDayOf, localParts, type IsoDay } from './day';
import { isPerfectDay } from './rates';
import type { HabitState } from './states';

export interface RecapFor { day: IsoDay; afterMidnight: boolean; title: string }

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' });

/** R1, H24: between 00:00 and 04:00 the recap closes yesterday, and the title names it ("Close Tuesday"). */
export function recapFor(now: Date, zone: string): RecapFor {
  const day = habitDayOf(now, zone);
  const afterMidnight = localParts(now, zone).hour < 4;
  return { day, afterMidnight, title: afterMidnight ? `Close ${WEEKDAY.format(new Date(`${day}T12:00:00Z`))}` : 'Close the day' };
}

export interface ResultRow { title: string; state: HabitState; reason?: string }

/**
 * The line under the result ring (H20). The design's example sets the tone: plain, no drama (E14).
 * Only the one-slip sentence is designed; the others follow it and are proposed copy.
 */
export function resultSentence(rows: readonly ResultRow[], shortName: (t: string) => string): string {
  const due = rows.length;
  const slipped = rows.filter((r) => r.state !== 'done');
  if (due === 0) return 'Nothing was due today.';
  if (isPerfectDay(rows.map((r) => r.state))) return 'Every habit done.';
  if (slipped.length === due) return 'None held today. Tomorrow starts clean.';
  if (slipped.length === 1) {
    const [s] = slipped;
    return `A good day. ${shortName(s!.title)} was the one that slipped${s!.reason ? `, for ${s!.reason}` : ''}.`;
  }
  const names = slipped.map((r) => shortName(r.title));
  const list = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${due - slipped.length} of ${due} held. ${list} slipped.`;
}

/** 032: the bulk action names its count. */
export function bulkDoneLabel(open: number): string {
  if (open <= 1) return 'Mark it as done';
  if (open === 2) return 'Mark both as done';
  return `Mark all ${open} as done`;
}
