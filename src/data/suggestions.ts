// 136: a small set of common habits to start from. Every field is only a starting point: the picker opens the same
// New habit form with these values in it, and each row stays editable. Pure data; the objects are the 3D set (132).
import type { HabitDraft, Often } from './newHabit';
import { blankHabit, withTitle } from './newHabit';
import type { HabitIcon } from '../ui/icons';

export interface Suggestion {
  id: string;
  title: string;
  icon: HabitIcon;
  often: Often;
  days?: number[]; // 0 = Monday … 6 = Sunday, for 'days'
  start: string;
  /** A reminder (130), not a habit: 6 times a day, never counted. */
  reminder?: boolean;
  /** The second line on the card. */
  meta: string;
}

export const SUGGESTED: readonly Suggestion[] = [
  { id: 'read', title: 'Read 20 min', icon: 'book-open', often: 'daily', start: '21:30', meta: 'Every day · 21:30' },
  { id: 'walk', title: 'Walk 20 min', icon: 'person-standing', often: 'daily', start: '17:30', meta: 'Every day · 17:30' },
  { id: 'workout', title: 'Workout 30 min', icon: 'dumbbell', often: 'days', days: [0, 2, 4], start: '18:00', meta: 'Mon Wed Fri · 18:00' },
  { id: 'journal', title: 'Journal 10 min', icon: 'pen-line', often: 'daily', start: '07:15', meta: 'Every day · 07:15' },
  { id: 'breakfast', title: 'Breakfast 30 min', icon: 'coffee', often: 'daily', start: '08:00', meta: 'Every day · 08:00' },
  { id: 'wind-down', title: 'Wind down 30 min', icon: 'moon-star', often: 'daily', start: '22:00', meta: 'Every day · 22:00' },
  { id: 'vitamins', title: 'Vitamins', icon: 'pill', often: 'daily', start: '08:00', meta: 'Every day · 08:00' },
  { id: 'water', title: 'Drink water', icon: 'glass-water', often: 'daily', start: '09:00', reminder: true, meta: 'Reminder · 6 a day' },
];

/** The New habit form, filled in. A reminder starts with Count it as a habit off and its suggested times (130). */
export function draftFrom(s: Suggestion): HabitDraft {
  const base = withTitle({ ...blankHabit(), icon: s.icon, often: s.often, start: s.start, ...(s.days ? { days: [...s.days] } : {}) }, s.title);
  return s.reminder ? { ...base, count: false } : base;
}
