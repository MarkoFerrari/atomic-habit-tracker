// Today (H11–H13), as pure rules: which habit occurrences fall on a habit day, their state at a moment,
// which one carries "Mark as done" (040), and how the list is grouped (E22).
import type { IsoDay } from './day';
import { occurrences, parseRRule } from './recurrence';
import { habitState, type AnswerStatus, type HabitState } from './states';
import { addMinutes, instantOf, type Wall } from './zone';
import { versionsOf, type PastVersion } from './versions';
import { isPaused, type Pause } from './pause';
import { routinesOf } from './routines';

/** The parts of a stored habit event these rules need (clock time, 028). */
export interface HabitSource {
  id: string;
  title: string;
  icon?: string;
  start: string; // 'YYYY-MM-DDTHH:mm', clock time
  end: string;
  allDay: boolean;
  rrule?: string;
  exdates: string[];
  overrides?: Record<string, { start: string; end: string; title?: string; cancelled?: boolean }>;
  archivedOn?: string;
  after?: string;
  smallest?: string;
  identity?: string;
  past?: PastVersion[]; // 115: earlier schedules, same habit
  pauses?: Pause[]; // 117
}

export interface Occurrence {
  eventId: string;
  occurrence: IsoDay; // the day it belongs to: the day it starts (E7)
  title: string;
  icon?: string;
  start: Wall; // on this day, clock time
  end: Wall;
  allDay: boolean;
  minutes: number; // duration
  after?: string; // 085 (P3)
  smallest?: string;
  identity?: string;
}

const day = (w: string) => w.slice(0, 10) as IsoDay;
const time = (w: string) => w.slice(11, 16) || '00:00';
const toWall = (d: IsoDay, t: string) => `${d}T${t}` as Wall;
const minutesBetween = (a: string, b: string) => Math.round((Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 60_000);

const design = (h: HabitSource) => ({ ...(h.after ? { after: h.after } : {}), ...(h.smallest ? { smallest: h.smallest } : {}), ...(h.identity ? { identity: h.identity } : {}) });

/** Every occurrence of the habits that starts on `target` (moved occurrences included, cancelled ones not). */
export function occurrencesOn(habits: readonly HabitSource[], target: IsoDay): Occurrence[] {
  const out: Occurrence[] = [];
  for (const h of habits.flatMap((x) => versionsOf(x))) { // 115: every schedule the habit has had
    if (h.archivedOn && target >= h.archivedOn) continue; // E9: stops counting from the day it's archived
    if (isPaused(h.pauses, target)) continue; // 117: a paused day is not a day for this habit
    const startDay = day(h.start);
    const length = minutesBetween(h.start, h.end);
    const rule = h.rrule ? parseRRule(h.rrule) : null;
    const overrides = h.overrides ?? {};

    const regular = occurrences(startDay, rule, h.exdates as IsoDay[], target);
    if (regular[regular.length - 1] === target && !overrides[target]) {
      const start = toWall(target, time(h.start));
      const end = addMinutes(start, length);
      out.push({ eventId: h.id, occurrence: target, title: h.title, icon: h.icon, start, end, allDay: h.allDay, minutes: length, ...design(h) });
    }
    // An occurrence moved onto this day (or kept on it with a new time). It belongs to the day it starts (E7).
    for (const [original, o] of Object.entries(overrides)) {
      if (o.cancelled || day(o.start) !== target) continue;
      if (!occurrences(startDay, rule, [], original as IsoDay).includes(original as IsoDay)) continue;
      out.push({
        eventId: h.id, occurrence: original as IsoDay, title: o.title ?? h.title, icon: h.icon,
        start: o.start as Wall, end: o.end as Wall, allDay: h.allDay, minutes: minutesBetween(o.start, o.end), ...design(h),
      });
    }
  }
  // E7: all-day habits first, then by time, then by name.
  return out.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

export interface AnswerLike { eventId: string; occurrence: string; status: AnswerStatus; reason?: string; small?: boolean; answeredAt: string }
export interface TodayRow extends Occurrence { state: HabitState; answer: AnswerLike | null; markDone: boolean }

export interface TodayView {
  open: TodayRow[]; // still to answer, in time order ("Today's goals")
  answered: TodayRow[]; // done and skipped ("Done" or "Answered")
  done: number;
  due: number;
  /** 118: habits linked by After, together in the order they follow each other. Their rows are also in open/answered. */
  routines: { name: string; rows: TodayRow[]; done: number }[];
}

export const rowKey = (r: Pick<TodayRow, 'eventId' | 'occurrence'>) => `${r.eventId}|${r.occurrence}`;

/**
 * The day as Today shows it at `now`. Clock times are read in the phone's zone (028, E6).
 * "Mark as done" goes on the running habit, else the next one to start (040); late in the evening,
 * when every open habit has passed, none carries it: the recap is the way to close them.
 */
export function todayView(
  habits: readonly HabitSource[], answers: readonly AnswerLike[], habitDay: IsoDay, now: Date, zone: string, dayClosed = false,
): TodayView {
  const byKey = new Map(answers.map((a) => [`${a.eventId}|${a.occurrence}`, a]));
  const rows: TodayRow[] = occurrencesOn(habits, habitDay).map((o) => {
    const answer = byKey.get(`${o.eventId}|${o.occurrence}`) ?? null;
    const slotStart = o.allDay ? null : instantOf(o.start, zone);
    const slotEnd = o.allDay ? null : instantOf(o.end, zone);
    return { ...o, answer, markDone: false, state: habitState({ answer: answer?.status ?? null, slotStart, slotEnd, now, dayClosed }) };
  });
  const open = rows.filter((r) => r.state === 'open' || r.state === 'running');
  const routines = routinesOf(rows.map((r) => ({ ...r, id: rowKey(r) }))).map((g) => {
    const members = g.members.map((m) => rows.find((r) => rowKey(r) === m.id)!);
    return { name: g.name, rows: members, done: members.filter((r) => r.state === 'done').length };
  });
  // 118: inside a routine, a done hands Mark as done to the next open habit, whatever its clock time
  const handed = routines.map((g) => {
    const lastAnswered = g.rows.map((r) => !!r.answer).lastIndexOf(true);
    return lastAnswered >= 0 ? g.rows.slice(lastAnswered + 1).find((r) => r.state === 'open' || r.state === 'running') : undefined;
  }).find(Boolean);
  const pick = handed ?? open.find((r) => r.state === 'running')
    ?? open.find((r) => !r.allDay && instantOf(r.start, zone) >= now)
    ?? open.find((r) => r.allDay);
  if (pick) pick.markDone = true;
  const answered = rows.filter((r) => r.answer).sort((a, b) => b.answer!.answeredAt.localeCompare(a.answer!.answeredAt));
  return { open, answered, done: rows.filter((r) => r.state === 'done').length, due: rows.length, routines };
}

export type Greeting = 'Good morning' | 'Good afternoon' | 'Good evening';
/** By the local hour: the habit day runs 04:00–04:00 (R1), so after midnight it's still evening. */
export function greeting(hour: number): Greeting {
  if (hour >= 4 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "Close the day" appears in the evening (C6): from 18:00 until the day closes at 04:00. */
export function showCloseTheDay(hour: number): boolean {
  return hour >= 18 || hour < 4;
}
