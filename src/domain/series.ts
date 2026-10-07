// Editing and deleting repeating events (H31, H32, E16), as pure functions on stored events.
// "Only this event" writes an override or an exception; "This and following" ends the series the day
// before and starts a new one; "All events" changes the series itself. Past answers stay on the
// series they were given to, with its original time and title (E16).
import { addDays, type IsoDay } from './day';
import { occurrences, parseRRule, type Recurrence } from './recurrence';
import type { EventSource } from './agenda';

export type Scope = 'this' | 'following' | 'all';

export interface SeriesEvent extends EventSource {
  reminders: number[];
  icon?: string;
  icsUid?: string;
  place?: string;
  notes?: string;
}

// --- RRULE text --------------------------------------------------------------------------------------

const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const MAX_EVERY = 4; // Custom: every 1 to 4 weeks

/** The repeat choices of H30 (the picker), and how each one reads. */
// 'days' is the picker's Custom (077): every N weeks, on the weekdays chosen. 'custom' is a rule the editor can't build (as imported).
export type RepeatKind = 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'days' | 'monthly' | 'yearly' | 'custom';
export interface RepeatDraft { kind: RepeatKind; days: number[]; until: IsoDay | null; raw?: string; every?: number }

export function repeatFromRule(rrule: string | undefined, start: IsoDay): RepeatDraft {
  const weekday = (new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7;
  if (!rrule) return { kind: 'none', days: [weekday], until: null };
  const r = parseRRule(rrule);
  const until = r?.until ?? null;
  if (!r || r.count) return { kind: 'custom', days: [weekday], until, raw: rrule };
  const days = r.byDay ? [...new Set(r.byDay.map((d) => d.weekday))].sort((a, b) => a - b) : [weekday];
  const plain = !r.byDay?.some((d) => d.nth !== undefined) && !r.byMonthDay && !r.byMonth;
  if (r.freq === 'DAILY' && r.interval === 1) return { kind: 'daily', days, until };
  if (r.freq === 'WEEKLY' && plain && r.interval <= 2) {
    if (r.interval === 1 && days.join() === '0,1,2,3,4') return { kind: 'weekdays', days, until };
    if (r.interval === 1 && days.length === 7) return { kind: 'daily', days, until };
    return { kind: r.interval === 2 ? 'biweekly' : 'weekly', days, until };
  }
  if (r.freq === 'WEEKLY' && plain && r.interval <= MAX_EVERY) return { kind: 'days', days, until, every: r.interval };
  if (r.freq === 'MONTHLY' && r.interval === 1 && !r.byDay && !r.byMonthDay) return { kind: 'monthly', days, until };
  if (r.freq === 'YEARLY' && r.interval === 1 && !r.byDay && !r.byMonthDay && !r.byMonth) return { kind: 'yearly', days, until };
  return { kind: 'custom', days, until, raw: rrule };
}

export function ruleFromRepeat(r: RepeatDraft): string | undefined {
  const until = r.until ? `;UNTIL=${r.until.replace(/-/g, '')}` : '';
  const byDay = (days: number[]) => `;BYDAY=${[...new Set(days)].sort((a, b) => a - b).map((d) => WEEKDAYS[d]).join(',')}`;
  switch (r.kind) {
    case 'none': return undefined;
    case 'daily': return `FREQ=DAILY${until}`;
    case 'weekdays': return `FREQ=WEEKLY${byDay([0, 1, 2, 3, 4])}${until}`;
    case 'weekly': return `FREQ=WEEKLY${byDay(r.days.length ? r.days : [0])}${until}`;
    case 'biweekly': return `FREQ=WEEKLY;INTERVAL=2${byDay(r.days.length ? r.days : [0])}${until}`;
    case 'days': { const n = Math.min(Math.max(r.every ?? 1, 1), MAX_EVERY); return `FREQ=WEEKLY${n > 1 ? `;INTERVAL=${n}` : ''}${byDay(r.days.length ? r.days : [0])}${until}`; }
    case 'monthly': return `FREQ=MONTHLY${until}`;
    case 'yearly': return `FREQ=YEARLY${until}`;
    case 'custom': return r.raw ? withUntil(r.raw, r.until) : undefined;
  }
}

/** Sets (or removes) UNTIL, and drops COUNT, which can't be kept exact once a series is cut. */
export function withUntil(rrule: string, until: IsoDay | null): string {
  const parts = rrule.split(';').filter((p) => !/^(UNTIL|COUNT)=/i.test(p));
  if (until) parts.push(`UNTIL=${until.replace(/-/g, '')}`);
  return parts.join(';');
}

const ruleOf = (e: EventSource): Recurrence | null => (e.rrule ? parseRRule(e.rrule) : null);
const firstDay = (e: EventSource, zoneDay: (iso: string) => IsoDay) => (e.timeMode === 'clock' || e.allDay ? (e.start.slice(0, 10) as IsoDay) : zoneDay(e.start));

/** How many occurrences a series has before `day` (for COUNT rules split in two). */
function countBefore(e: EventSource, day: IsoDay, zoneDay: (iso: string) => IsoDay): number {
  return occurrences(firstDay(e, zoneDay), ruleOf(e), [], addDays(day, -1)).length;
}

// --- Scoped changes ----------------------------------------------------------------------------------

/** "Only this event": an exception for that day. */
export function excludeOne<E extends EventSource>(e: E, occurrence: IsoDay): E {
  const overrides = { ...(e.overrides ?? {}) };
  delete overrides[occurrence];
  return { ...e, exdates: [...new Set([...e.exdates, occurrence])], overrides };
}

/** "Only this event": a moved or renamed occurrence. Start and end in the event's stored form. */
export function overrideOne<E extends EventSource>(e: E, occurrence: IsoDay, change: { start: string; end: string; title: string }): E {
  return { ...e, overrides: { ...(e.overrides ?? {}), [occurrence]: { start: change.start, end: change.end, ...(change.title !== e.title ? { title: change.title } : {}) } } };
}

/** Ends a series the day before `day`; exceptions and overrides after it go. Null: nothing would be left. */
export function endBefore<E extends EventSource>(e: E, day: IsoDay, zoneDay: (iso: string) => IsoDay): E | null {
  if (!e.rrule || firstDay(e, zoneDay) >= day) return null;
  const keep = (d: string) => d < day;
  return {
    ...e,
    rrule: withUntil(e.rrule, addDays(day, -1)),
    exdates: e.exdates.filter(keep),
    overrides: Object.fromEntries(Object.entries(e.overrides ?? {}).filter(([d]) => keep(d))),
  };
}

/**
 * The part of a series from `day` on, as its own event (new id, no ICS UID: it no longer matches the
 * import). COUNT becomes the number of occurrences that were still to come.
 */
export function restFrom<E extends EventSource>(e: E, day: IsoDay, id: string, zoneDay: (iso: string) => IsoDay): E {
  const r = ruleOf(e);
  let rrule = e.rrule;
  if (rrule && r?.count) {
    const left = r.count - countBefore(e, day, zoneDay);
    rrule = rrule.replace(/COUNT=\d+/i, `COUNT=${Math.max(left, 1)}`);
  }
  const keep = (d: string) => d >= day;
  const { icsUid: _drop, ...rest } = e as E & { icsUid?: string };
  return {
    ...(rest as E),
    id,
    ...(rrule ? { rrule } : {}),
    exdates: e.exdates.filter(keep),
    overrides: Object.fromEntries(Object.entries(e.overrides ?? {}).filter(([d]) => keep(d))),
  };
}
