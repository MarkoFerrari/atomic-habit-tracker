// A new habit, habits first (Figma page 14: S3 Your habit, S4 When, E1 New habit). What, how often, when: the same
// three questions in onboarding and in the editor. It lives in the HABITS calendar (made if missing, 079), keeps clock
// time (028) and gets a push at its start (069). "Per week" is not offered yet: it has no fixed due days, so rates
// and runs need new rules first (006, 051).
import { ensureHabitCalendar } from './calendars';
import { createEvent, durationFromTitle, type EventDraft } from './events';
import { saveHabit } from './habits';
import type { CalendarEvent } from './schema';
import type { IsoDay } from '../domain/day';
import { addMinutes, type Wall } from '../domain/zone';
import type { HabitIcon } from '../ui/icons';

export type Often = 'daily' | 'days';
export interface HabitDraft {
  title: string;
  icon: HabitIcon;
  often: Often;
  days: number[]; // 0 = Monday … 6 = Sunday, for 'days'
  start: string; // 'HH:mm', clock time
  minutes: number;
  nudge: boolean; // a push at the start (069)
  after: string; // 085, optional
  smallest: string;
  identity: string;
}

export const SUGGESTIONS = ['Walk 20 min', 'Breakfast 30 min', 'Train 45 min', 'Stretch 10 min', 'Read 20 min'] as const;

export function blankHabit(): HabitDraft {
  return { title: '', icon: 'sprout', often: 'daily', days: [0, 1, 2, 3, 4], start: '07:30', minutes: 20, nudge: true, after: '', smallest: '', identity: '' };
}

/** 004: the end point in the title sets the length ("Read 20 min" lasts 20 minutes). */
export function withTitle(d: HabitDraft, title: string): HabitDraft {
  const m = durationFromTitle(title);
  return { ...d, title, minutes: m && m > 0 && m < 24 * 60 ? m : d.minutes };
}

export const canSave = (d: HabitDraft) => d.title.trim().length > 0 && (d.often === 'daily' || d.days.length > 0);

export function toDraft(d: HabitDraft, calendarId: string, today: IsoDay): EventDraft {
  const start = `${today}T${d.start}` as Wall;
  return {
    title: d.title.trim(), calendarId, allDay: false, start, end: addMinutes(start, d.minutes),
    repeat: d.often === 'daily' ? { kind: 'daily', days: [], until: null } : { kind: 'days', days: [...d.days].sort((a, b) => a - b), until: null, every: 1 },
    repeatChanged: true, reminders: d.nudge ? [0] : [], place: '', notes: '',
    after: d.after, smallest: d.smallest, identity: d.identity,
  };
}

export async function createHabit(d: HabitDraft, today: IsoDay, zone: string): Promise<CalendarEvent> {
  const cal = await ensureHabitCalendar();
  const e = await createEvent(toDraft(d, cal.id, today), zone);
  await saveHabit(e, { title: e.title, icon: d.icon });
  return { ...e, icon: d.icon };
}
