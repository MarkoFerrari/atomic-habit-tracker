// Habit states (CLAUDE.md §4): open → running → done | skipped | missed.
export type AnswerStatus = 'done' | 'skipped' | 'missed';
export type HabitState = 'open' | 'running' | AnswerStatus;

/** 007: the four optional skip reasons, as designed (Figma H37: No time, Forgot, Low energy, Not relevant today).
 *  No reason given is stored as an absent reason. Ids stay stable for data; labels live in the UI copy. */
export const SKIP_REASONS = ['no-time', 'forgot', 'low-energy', 'not-relevant-today'] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export interface StateInput {
  answer: AnswerStatus | null; // what the user said, if anything
  slotStart: Date | null; // null for an all-day habit (E7)
  slotEnd: Date | null;
  now: Date;
  dayClosed: boolean; // true once the habit day passed 04:00 (R1)
}

export function habitState({ answer, slotStart, slotEnd, now, dayClosed }: StateInput): HabitState {
  if (answer) return answer;
  if (dayClosed) return 'missed'; // 052: unanswered becomes missed when the day closes
  if (slotStart && slotEnd && now >= slotStart && now < slotEnd) return 'running';
  return 'open';
}
