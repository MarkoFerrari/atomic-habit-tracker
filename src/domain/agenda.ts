// The calendar (M3, 015): every event of every calendar, expanded into the occurrences that fall in a
// range of days, in the phone's zone. Habits keep clock time; other events keep real time and are shown
// in the phone's zone (028, E6). Pure rules: no DOM, no IndexedDB.
import { addDays, type IsoDay } from './day';
import { occurrences, parseRRule } from './recurrence';
import { addMinutes, instantOf, wallOf, type Wall } from './zone';

/** The parts of a stored event the calendar needs (structurally the same as CalendarEvent). */
export interface EventSource {
  id: string;
  calendarId: string;
  title: string;
  start: string; // 'clock' or all-day: 'YYYY-MM-DDTHH:mm'; 'zoned': an ISO instant
  end: string;
  allDay: boolean;
  timeMode: 'clock' | 'zoned';
  tz?: string;
  rrule?: string;
  exdates: string[];
  overrides?: Record<string, { start: string; end: string; title?: string; cancelled?: boolean }>;
  archivedOn?: string;
}

export interface AgendaItem {
  eventId: string;
  calendarId: string;
  occurrence: IsoDay; // the day the rule produced, in the event's own zone: the answer key for habits
  title: string;
  start: Wall; // in the phone's zone
  end: Wall;
  startAt: number; // ms since epoch
  endAt: number;
  allDay: boolean;
  repeating: boolean;
}

const dayOf = (w: string) => w.slice(0, 10) as IsoDay;
const timeOf = (w: string) => w.slice(11, 16) || '00:00';
const minutesBetween = (a: string, b: string) => Math.round((Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 60_000);

/** All occurrences of one event that overlap the days `from`–`to` (inclusive) in `zone`. */
export function expand(e: EventSource, from: IsoDay, to: IsoDay, zone: string): AgendaItem[] {
  const rule = e.rrule ? parseRRule(e.rrule) : null;
  const overrides = e.overrides ?? {};
  const clock = e.timeMode === 'clock' || e.allDay;
  const ownZone = clock ? zone : (e.tz ?? zone);
  const startWall = (clock ? e.start.slice(0, 16) : wallOf(new Date(e.start), ownZone)) as Wall;
  const lengthMin = clock ? minutesBetween(e.start.slice(0, 16), e.end.slice(0, 16)) : Math.round((Date.parse(e.end) - Date.parse(e.start)) / 60_000);
  const spanDays = Math.ceil(Math.max(lengthMin, 0) / 1440) + 1;
  const firstDay = dayOf(startWall);
  const out: AgendaItem[] = [];

  const push = (occurrence: IsoDay, s: Wall, en: Wall, title: string, exactEnd?: number) => {
    // Clock and all-day times are walls in the phone's zone; zoned ones convert through their own zone
    // and keep their real length across a daylight-saving change.
    const startAt = instantOf(s, ownZone).getTime();
    const endAt = clock ? instantOf(en, ownZone).getTime() : (exactEnd ?? startAt + lengthMin * 60_000);
    const start = clock ? s : wallOf(new Date(startAt), zone);
    const end = clock ? en : wallOf(new Date(endAt), zone);
    out.push({ eventId: e.id, calendarId: e.calendarId, occurrence, title, start, end, startAt, endAt, allDay: e.allDay, repeating: !!rule });
  };

  const days = occurrences(firstDay, rule, e.exdates as IsoDay[], addDays(to, 1));
  const earliest = addDays(from, -spanDays);
  for (const d of days) {
    if (d < earliest || overrides[d]) continue;
    if (e.archivedOn && d >= e.archivedOn) continue; // E9
    const s = `${d}T${timeOf(startWall)}` as Wall;
    push(d, s, addMinutes(s, lengthMin), e.title);
  }
  for (const [original, o] of Object.entries(overrides)) {
    if (o.cancelled || (e.archivedOn && original >= e.archivedOn)) continue;
    if (!occurrences(firstDay, rule, [], original as IsoDay).includes(original as IsoDay)) continue;
    const s = (clock ? o.start.slice(0, 16) : wallOf(new Date(o.start), ownZone)) as Wall;
    const en = (clock ? o.end.slice(0, 16) : wallOf(new Date(o.end), ownZone)) as Wall;
    push(original as IsoDay, s, en, o.title ?? e.title, clock ? undefined : Date.parse(o.end));
  }
  const lo = `${from}T00:00`;
  const hi = `${addDays(to, 1)}T00:00`;
  return out.filter((i) => (i.end > i.start ? i.end > lo : i.start >= lo) && i.start < hi);
}

/** Everything in the range, all-day items first, then by start time, then by title. */
export function agenda(events: readonly EventSource[], from: IsoDay, to: IsoDay, zone: string): AgendaItem[] {
  return events.flatMap((e) => expand(e, from, to, zone))
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

/** The items that touch one day (an event running past midnight shows on both days). */
export function onDay(items: readonly AgendaItem[], day: IsoDay): AgendaItem[] {
  const lo = `${day}T00:00`;
  const hi = `${addDays(day, 1)}T00:00`;
  return items.filter((i) => (i.end > i.start ? i.end > lo : i.start >= lo) && i.start < hi);
}

export const itemKey = (i: Pick<AgendaItem, 'eventId' | 'occurrence'>) => `${i.eventId}|${i.occurrence}`;

// --- Day view (H26) -------------------------------------------------------------------------------

/** Minutes from the day's midnight, clipped to the day. */
export function minuteOfDay(w: Wall, day: IsoDay): number {
  const m = minutesBetween(`${day}T00:00`, w);
  return Math.min(Math.max(m, 0), 1440);
}

export interface Placed { item: AgendaItem; top: number; bottom: number; column: number; columns: number }

/**
 * E23: overlapping events sit side by side. Items are grouped into clusters that overlap in time;
 * each takes the first free column, and every item in a cluster shares the cluster's column count.
 */
export function layoutDay(items: readonly AgendaItem[], day: IsoDay, minMinutes = 0): Placed[] {
  const timed = items.filter((i) => !i.allDay)
    .map((item) => {
      const top = minuteOfDay(item.start, day);
      return { item, top, bottom: Math.max(minuteOfDay(item.end, day), top + minMinutes), column: 0, columns: 1 };
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const columnsEnd: number[] = [];
  const close = () => { const n = Math.max(1, columnsEnd.length); cluster.forEach((p) => (p.columns = n)); cluster = []; columnsEnd.length = 0; };
  for (const p of timed) {
    if (p.top >= clusterEnd && cluster.length) close();
    let col = columnsEnd.findIndex((end) => end <= p.top);
    if (col < 0) { col = columnsEnd.length; columnsEnd.push(p.bottom); } else columnsEnd[col] = p.bottom;
    p.column = col;
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, p.bottom);
  }
  close();
  return timed;
}

/** 070: free time worth showing is a gap of an hour or more between 08:00 and 20:00. */
export const FREE_FROM = 8 * 60;
export const FREE_TO = 20 * 60;
export const FREE_MIN = 60;

export function freeBands(placed: readonly Placed[]): { top: number; bottom: number }[] {
  const busy = placed.map((p) => [p.top, p.bottom] as const).sort((a, b) => a[0] - b[0]);
  if (!busy.length) return [];
  const out: { top: number; bottom: number }[] = [];
  // Only gaps between events: the time before the first and after the last isn't "free", it's the day's edge.
  let cursor = busy[0]![1];
  for (const [top, bottom] of busy.slice(1)) {
    const a = Math.max(cursor, FREE_FROM);
    const b = Math.min(top, FREE_TO);
    if (b - a >= FREE_MIN) out.push({ top: a, bottom: b });
    cursor = Math.max(cursor, bottom);
  }
  return out;
}

// --- Week and month (H27, H28) --------------------------------------------------------------------

const weekdayOf = (d: IsoDay) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday

/** The Monday-to-Sunday week that contains `day`. */
export function weekOf(day: IsoDay): IsoDay[] {
  const monday = addDays(day, -weekdayOf(day));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** The month's days in weeks, Monday first; days outside the month are null. */
export function monthGrid(anyDay: IsoDay): (IsoDay | null)[][] {
  const first = `${anyDay.slice(0, 8)}01` as IsoDay;
  const weeks: (IsoDay | null)[][] = [];
  let week: (IsoDay | null)[] = Array.from({ length: weekdayOf(first) }, () => null);
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) weeks.push([...week, ...Array.from({ length: 7 - week.length }, () => null)]);
  return weeks;
}

/** H28 / E23: up to three dots a day, one per calendar, in the order the calendars are listed. */
export function dotsOn(items: readonly AgendaItem[], day: IsoDay, calendarOrder: readonly string[]): string[] {
  const present = new Set(onDay(items, day).map((i) => i.calendarId));
  return calendarOrder.filter((id) => present.has(id)).slice(0, 3);
}

// --- Labels ---------------------------------------------------------------------------------------

const clock = (w: string) => w.slice(11, 16);

/** "10:00–11:00", "All day", or for events crossing midnight "From 22:00" / "Until 01:00" on the clipped day. */
export function timeRange(i: Pick<AgendaItem, 'start' | 'end' | 'allDay'>, day: IsoDay): string {
  if (i.allDay) return 'All day';
  const startsBefore = dayOf(i.start) < day;
  const endsAfter = i.end > `${addDays(day, 1)}T00:00`;
  if (startsBefore && endsAfter) return 'All day';
  if (startsBefore) return `Until ${clock(i.end)}`;
  if (endsAfter) return `From ${clock(i.start)}`;
  return i.start === i.end ? clock(i.start) : `${clock(i.start)}–${clock(i.end)}`;
}

/** H29: a meeting link found in the place or the notes gives the event a Join button. */
const MEETING = /https?:\/\/(?:[\w-]+\.)*(?:meet\.proton\.me|zoom\.us|teams\.microsoft\.com|teams\.live\.com|meet\.google\.com|whereby\.com|meet\.jit\.si|webex\.com)\/\S*/i;
export function meetingLink(...texts: (string | undefined)[]): string | null {
  for (const t of texts) { const m = t ? MEETING.exec(t) : null; if (m) return m[0].replace(/[).,;]+$/, ''); }
  return null;
}
