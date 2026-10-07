// First import (065, onboarding H06–H09): files are read into a plan, the person reviews it,
// then it's saved. Nothing is written until the review is confirmed.
// Duplicates are matched by event ID (E8) across the files and against what's already stored.
import type { IsoDay } from '../domain/day';
import { instantOf, type Wall } from '../domain/zone';
import { db } from './db';
import type { IcsCalendar, IcsEvent, IcsOverride, IcsTime } from './ics';
import type { Calendar, CalendarEvent, CalendarToken } from './schema';

export type CalendarRole = 'habits' | 'merge' | 'calendar';

export interface PlannedCalendar {
  key: string;
  name: string;
  color: CalendarToken;
  role: CalendarRole;
  events: IcsEvent[];
  overrides: IcsOverride[];
  repeating: number;
  duplicates: number;
  problems: string[];
}
export interface ImportPlan { calendars: PlannedCalendar[]; duplicates: number }

// 034: calendar colours are markers. The habit calendar always gets the habits marker; the others
// take the remaining three in order. A fifth calendar has no distinct colour yet (046, E13).
const OTHER_COLORS: CalendarToken[] = ['marko', 'work', 'family'];

export function planImport(files: { fileName: string; calendar: IcsCalendar }[], existingUids: ReadonlySet<string>): ImportPlan {
  const seen = new Set(existingUids);
  let duplicates = 0;
  const calendars: PlannedCalendar[] = files.map(({ fileName, calendar }, i) => {
    const events: IcsEvent[] = [];
    let dupes = 0;
    for (const e of calendar.events) {
      if (seen.has(e.uid)) { dupes += 1; continue; }
      seen.add(e.uid);
      events.push(e);
    }
    duplicates += dupes;
    const kept = new Set(events.map((e) => e.uid));
    const name = calendar.name?.trim() || fileName.replace(/\.ics$/i, '');
    return {
      key: `file-${i}`, name, color: 'marko', role: 'calendar',
      events, overrides: calendar.overrides.filter((o) => kept.has(o.uid)),
      repeating: events.filter((e) => e.rrule).length, duplicates: dupes, problems: calendar.problems,
    };
  });
  // A calendar called "habits" is the obvious first guess; the person confirms it on the review (H08).
  const guess = calendars.find((c) => /habit/i.test(c.name));
  if (guess) guess.role = 'habits';
  return recolor({ calendars, duplicates });
}

function recolor(plan: ImportPlan): ImportPlan {
  let next = 0;
  for (const c of plan.calendars) {
    c.color = c.role === 'habits' || c.role === 'merge' ? 'habits' : OTHER_COLORS[next++ % OTHER_COLORS.length]!;
  }
  return plan;
}

/**
 * The review toggle (H08). There is one habit calendar; switching on a second one merges it into
 * the first (023, 066: SPORT merges into HABITS). Switching off the habit calendar also undoes merges.
 */
export function toggleHabits(plan: ImportPlan, key: string): ImportPlan {
  const target = plan.calendars.find((c) => c.key === key);
  if (!target) return plan;
  const hasHabits = plan.calendars.some((c) => c.role === 'habits');
  if (target.role === 'habits') {
    plan.calendars.forEach((c) => { if (c.role !== 'calendar') c.role = 'calendar'; });
  } else if (target.role === 'merge') {
    target.role = 'calendar';
  } else {
    target.role = hasHabits ? 'merge' : 'habits';
  }
  return recolor({ ...plan, calendars: [...plan.calendars] });
}

export interface FoundHabit { uid: string; title: string; calendarName: string }

/** The last day a repeating event can occur, from its UNTIL (null: it never ends). */
function untilDay(rrule: string): IsoDay | null {
  const m = /UNTIL=(\d{4})(\d{2})(\d{2})/.exec(rrule);
  return m ? (`${m[1]}-${m[2]}-${m[3]}` as IsoDay) : null;
}

/**
 * H09: one habit per repeating event in the habit calendar (and any calendar merged into it) that still
 * repeats from `today`. Series that already ended are imported as history but not listed (U01: a real
 * export listed "Train, Gym, Gym, Train" because Proton splits a series each time it is edited).
 */
export function habitsFound(plan: ImportPlan, today: IsoDay = new Date().toISOString().slice(0, 10) as IsoDay): FoundHabit[] {
  return plan.calendars
    .filter((c) => c.role !== 'calendar')
    .flatMap((c) => c.events
      .filter((e) => e.rrule && (untilDay(e.rrule) ?? today) >= today)
      .map((e) => ({ uid: e.uid, title: e.title, calendarName: c.name })));
}

const day = (t: IcsTime): IsoDay => t.wall.slice(0, 10) as IsoDay;
const wall = (t: IcsTime): Wall => (t.allDay ? `${t.wall}T00:00` : t.wall) as Wall;

/** 028: habits keep clock time (wall time); other events keep real time (an instant, with their zone). */
function toStored(t: IcsTime, clock: boolean, phoneZone: string): string {
  if (clock || t.allDay) return wall(t);
  return instantOf(wall(t), t.tz ?? phoneZone).toISOString();
}

export function toCalendarEvent(e: IcsEvent, calendarId: string, clock: boolean, phoneZone: string, overrides: IcsOverride[], icon?: string): CalendarEvent {
  const own = overrides.filter((o) => o.uid === e.uid);
  return {
    id: crypto.randomUUID(),
    icsUid: e.uid,
    calendarId,
    title: e.title,
    ...(icon ? { icon } : {}),
    start: toStored(e.start, clock, phoneZone),
    end: toStored(e.end, clock, phoneZone),
    allDay: e.start.allDay,
    timeMode: clock ? 'clock' : 'zoned',
    ...(!clock && !e.start.allDay ? { tz: e.start.tz ?? phoneZone } : {}),
    ...(e.rrule ? { rrule: e.rrule } : {}),
    exdates: e.exdates,
    reminders: clock ? [0] : e.reminders, // 069: a habit's push comes when it starts
    ...(e.place ? { place: e.place } : {}),
    ...(e.notes ? { notes: e.notes } : {}),
    ...(own.length
      ? { overrides: Object.fromEntries(own.map((o) => [o.occurrence, {
          start: toStored(o.start, clock, phoneZone), end: toStored(o.end, clock, phoneZone), title: o.title, ...(o.cancelled ? { cancelled: true } : {}),
        }])) }
      : {}),
  };
}

export interface ImportResult { calendars: number; events: number; habits: number }

/** Saves the reviewed plan in one transaction: either everything lands, or nothing does. */
export async function commitImport(plan: ImportPlan, icons: Record<string, string>, phoneZone: string): Promise<ImportResult> {
  const database = await db();
  const now = new Date().toISOString();
  const habitsPlan = plan.calendars.find((c) => c.role === 'habits');
  const habitsId = habitsPlan ? crypto.randomUUID() : null;
  const calendars: Calendar[] = [];
  const events: CalendarEvent[] = [];
  for (const c of plan.calendars) {
    if (c.role === 'merge' && habitsId) {
      events.push(...c.events.map((e) => toCalendarEvent(e, habitsId, true, phoneZone, c.overrides, icons[e.uid])));
      continue;
    }
    const id = c.role === 'habits' && habitsId ? habitsId : crypto.randomUUID();
    const clock = c.role === 'habits';
    calendars.push({ id, name: c.name, color: c.color, trackAsHabits: clock, createdAt: now });
    events.push(...c.events.map((e) => toCalendarEvent(e, id, clock, phoneZone, c.overrides, clock ? icons[e.uid] : undefined)));
  }
  const tx = database.transaction(['calendars', 'events'], 'readwrite');
  await Promise.all([
    ...calendars.map((c) => tx.objectStore('calendars').put(c)),
    ...events.map((e) => tx.objectStore('events').put(e)),
    tx.done,
  ]);
  return { calendars: calendars.length, events: events.length, habits: events.filter((e) => e.calendarId === habitsId && e.rrule).length };
}

export async function storedUids(): Promise<Set<string>> {
  const all = await (await db()).getAll('events');
  return new Set(all.map((e) => e.icsUid).filter((u): u is string => !!u));
}
