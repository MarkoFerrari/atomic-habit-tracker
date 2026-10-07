// Reads an .ics calendar export (RFC 5545) on the phone: nothing is uploaded (020, 022).
// It keeps what ATOMIC uses: title, ID, time, repeat rule and its exceptions, moved or cancelled
// occurrences, and reminders. Times are kept as wall-clock time plus the zone they were written in,
// so a habit can keep its clock time (028) and a meeting its real time.
import type { IsoDay } from '../domain/day';
import { parseRRule } from '../domain/recurrence';
import { addMinutes, isValidZone, wallOf, type Wall } from '../domain/zone';

export interface IcsTime { wall: Wall | IsoDay; allDay: boolean; tz: string | null } // tz null: floating
export interface IcsEvent {
  uid: string;
  title: string;
  start: IcsTime;
  end: IcsTime;
  rrule: string | null; // normalised: UNTIL as a local date (YYYYMMDD)
  repeatSupported: boolean; // false: imported as a single event, and listed as a problem
  exdates: IsoDay[];
  reminders: number[]; // minutes before the start
  place?: string; // LOCATION, or URL when there is no location
  notes?: string; // DESCRIPTION
}
export interface IcsOverride { uid: string; occurrence: IsoDay; start: IcsTime; end: IcsTime; title: string; cancelled: boolean }
export interface IcsCalendar { name: string | null; color: string | null; events: IcsEvent[]; overrides: IcsOverride[]; problems: string[] }

export class IcsError extends Error {
  constructor(public readonly code: 'not-a-calendar' | 'no-events', message: string) { super(message); }
}

interface Prop { name: string; params: Record<string, string>; value: string }

function unfold(text: string): string[] {
  return text.replace(/\r\n|\r/g, '\n').replace(/\n[ \t]/g, '').split('\n').filter((l) => l.length > 0);
}

function parseLine(line: string): Prop | null {
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ':' && !inQuotes) { colon = i; break; }
  }
  if (colon < 0) return null;
  const [rawName, ...rawParams] = line.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: (rawName ?? '').toUpperCase(), params, value: line.slice(colon + 1) };
}

const unescapeText = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();

/** DTSTART-style value → wall time in its own zone. UTC values are shown in the phone's zone. */
function parseTime(prop: Prop, phoneZone: string, problems: string[]): IcsTime | null {
  const value = prop.value.trim();
  const date = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (date || prop.params.VALUE === 'DATE') {
    const m = date ?? /^(\d{4})(\d{2})(\d{2})/.exec(value);
    if (!m) return null;
    return { wall: `${m[1]}-${m[2]}-${m[3]}` as IsoDay, allDay: true, tz: null };
  }
  const dt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})\d{2}(Z?)$/.exec(value);
  if (!dt) return null;
  const wall = `${dt[1]}-${dt[2]}-${dt[3]}T${dt[4]}:${dt[5]}` as Wall;
  if (dt[6] === 'Z') return { wall: wallOf(new Date(`${wall}:00Z`), phoneZone), allDay: false, tz: phoneZone };
  const tz = prop.params.TZID ?? null;
  if (tz && !isValidZone(tz)) {
    problems.push(`Unknown time zone “${tz}”: times read as ${phoneZone}.`);
    return { wall, allDay: false, tz: phoneZone };
  }
  return { wall, allDay: false, tz };
}

/** ISO 8601 durations as used in .ics (P1D, PT45M, -PT15M, P1W). Returns minutes. */
export function durationMinutes(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m || v.trim() === 'P' || v.trim().endsWith('T')) return null;
  const total = (+(m[2] ?? 0)) * 7 * 1440 + (+(m[3] ?? 0)) * 1440 + (+(m[4] ?? 0)) * 60 + (+(m[5] ?? 0)) + Math.floor(+(m[6] ?? 0) / 60);
  return m[1] === '-' ? -total : total;
}

const dayOf = (t: IcsTime): IsoDay => t.wall.slice(0, 10) as IsoDay;

function shift(t: IcsTime, minutes: number): IcsTime {
  if (t.allDay) {
    const days = Math.max(1, Math.round(minutes / 1440));
    const end = addMinutes(`${t.wall}T00:00` as Wall, days * 1440);
    return { ...t, wall: end.slice(0, 10) as IsoDay };
  }
  return { ...t, wall: addMinutes(t.wall as Wall, minutes) };
}

/** UNTIL can be a UTC date-time; habits work in local dates, so it becomes the local date. */
function normaliseRRule(value: string, start: IcsTime, phoneZone: string): string {
  return value.replace(/UNTIL=(\d{8})(T\d{6}Z?)?/i, (_all, d: string, time?: string) => {
    if (!time || !time.toUpperCase().endsWith('Z')) return `UNTIL=${d}`;
    const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${time.slice(1, 3)}:${time.slice(3, 5)}:${time.slice(5, 7)}Z`;
    return `UNTIL=${wallOf(new Date(iso), start.tz ?? phoneZone).slice(0, 10).replace(/-/g, '')}`;
  });
}

export function parseIcs(text: string, phoneZone: string): IcsCalendar {
  const lines = unfold(text.replace(/^﻿/, ''));
  if (!lines.some((l) => l.toUpperCase() === 'BEGIN:VCALENDAR')) {
    throw new IcsError('not-a-calendar', 'This file isn’t a calendar export (.ics).');
  }
  const cal: IcsCalendar = { name: null, color: null, events: [], overrides: [], problems: [] };
  const stack: string[] = [];
  let props: Prop[] = [];
  let alarms: string[] = [];

  const finishEvent = () => {
    const get = (n: string) => props.find((p) => p.name === n);
    const uid = get('UID')?.value.trim();
    const dtstart = get('DTSTART');
    const start = dtstart ? parseTime(dtstart, phoneZone, cal.problems) : null;
    const title = unescapeText(get('SUMMARY')?.value ?? '') || 'Untitled';
    if (!uid || !start) { cal.problems.push(`Skipped “${title}”: no ID or start time.`); return; }
    const dtend = get('DTEND');
    const duration = get('DURATION');
    let end = dtend ? parseTime(dtend, phoneZone, cal.problems) : null;
    if (!end) {
      const minutes = duration ? durationMinutes(duration.value) : null;
      end = shift(start, minutes ?? (start.allDay ? 1440 : 0));
    }
    const cancelled = (get('STATUS')?.value ?? '').trim().toUpperCase() === 'CANCELLED';
    const recurrenceId = get('RECURRENCE-ID');
    if (recurrenceId) {
      const rid = parseTime(recurrenceId, phoneZone, cal.problems);
      if (rid) cal.overrides.push({ uid, occurrence: dayOf(rid), start, end, title, cancelled });
      return;
    }
    if (cancelled) return;
    const rruleProp = get('RRULE');
    const rrule = rruleProp ? normaliseRRule(rruleProp.value.trim(), start, phoneZone) : null;
    const repeatSupported = !rrule || parseRRule(rrule) !== null;
    if (!repeatSupported) cal.problems.push(`“${title}” repeats in a way ATOMIC can’t read yet; only its first date was kept.`);
    const exdates: IsoDay[] = [];
    for (const p of props.filter((x) => x.name === 'EXDATE')) {
      for (const v of p.value.split(',')) {
        const t = parseTime({ ...p, value: v }, phoneZone, cal.problems);
        if (t) exdates.push(dayOf(t));
      }
    }
    const reminders = alarms
      .map((v) => durationMinutes(v))
      .filter((m): m is number => m !== null && m <= 0)
      .map((m) => -m);
    const place = unescapeText(get('LOCATION')?.value ?? '') || get('URL')?.value.trim() || '';
    const notes = unescapeText(get('DESCRIPTION')?.value ?? '');
    cal.events.push({
      uid, title, start, end, rrule: repeatSupported ? rrule : null, repeatSupported, exdates, reminders: [...new Set(reminders)],
      ...(place ? { place } : {}), ...(notes ? { notes } : {}),
    });
  };

  for (const line of lines) {
    const prop = parseLine(line);
    if (!prop) continue;
    if (prop.name === 'BEGIN') {
      stack.push(prop.value.toUpperCase());
      if (prop.value.toUpperCase() === 'VEVENT') { props = []; alarms = []; }
      continue;
    }
    if (prop.name === 'END') {
      const done = stack.pop();
      if (done === 'VEVENT') finishEvent();
      continue;
    }
    const where = stack[stack.length - 1];
    if (where === 'VCALENDAR') {
      if (prop.name === 'X-WR-CALNAME') cal.name = unescapeText(prop.value);
      if (prop.name === 'X-APPLE-CALENDAR-COLOR' || prop.name === 'COLOR') cal.color = prop.value.trim();
    } else if (where === 'VEVENT') {
      props.push(prop);
    } else if (where === 'VALARM' && prop.name === 'TRIGGER' && (prop.params.RELATED ?? 'START').toUpperCase() === 'START' && prop.params.VALUE !== 'DATE-TIME') {
      alarms.push(prop.value);
    }
  }
  if (cal.events.length === 0) throw new IcsError('no-events', 'This calendar file has no events in it.');
  return cal;
}
