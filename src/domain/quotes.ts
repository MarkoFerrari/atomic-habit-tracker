import { addDays, type IsoDay } from './day';

// 110: quotes at the moments that need words (Figma Playground 02–05). Each moment has its own pool, so the words
// fit what just happened. Sources are public domain (translations before 1929) or written for ATOMIC: no modern
// authors, and never a name on a line that person didn't say. No exclamation marks (E14).

export type QuotePool = 'milestone' | 'risk' | 'comeback' | 'week';
export interface Quote { id: string; text: string; source: string }

const ATOMIC = 'ATOMIC';
export const QUOTES: Record<QuotePool, readonly Quote[]> = {
  // 107: halfway and every quarter on the way to the next rank
  milestone: [
    { id: 'm-begun', text: 'Well begun is half done.', source: 'Proverb, after Aristotle' },
    { id: 'm-faculty', text: 'Every habit and faculty is maintained and increased by the corresponding actions.', source: 'Epictetus, Discourses 2.18, trans. George Long' },
    { id: 'm-drops', text: 'Even by the falling of water-drops a water-pot is filled.', source: 'Dhammapada 122, trans. Max Müller' },
    { id: 'm-small', text: 'Small is not slow. Small is what lasts.', source: ATOMIC },
    { id: 'm-step', text: 'The journey of a thousand li commenced with a single step.', source: 'Lao Tzu, Tao Te Ching 64, trans. James Legge' },
    { id: 'm-middle', text: 'The middle is where most habits end. Yours didn’t.', source: ATOMIC },
    { id: 'm-say', text: 'First say to yourself what you would be: and then do what you have to do.', source: 'Epictetus, Discourses 3.23, trans. George Long' },
    { id: 'm-road', text: 'Half the road is behind you, and it was the harder half.', source: ATOMIC },
    { id: 'm-hour', text: 'Hold every hour in your grasp.', source: 'Seneca, Letters 1, trans. Richard Gummere' },
    { id: 'm-nobody', text: 'Nobody saw it. That is why it counts.', source: ATOMIC },
  ],
  // 108: the morning after a miss, with the 099 line
  risk: [
    { id: 'r-seven', text: 'Fall seven times, stand up eight.', source: 'Japanese proverb' },
    { id: 'r-vote', text: 'Today is a vote, not a verdict.', source: ATOMIC },
    { id: 'r-hour', text: 'Hold every hour in your grasp.', source: 'Seneca, Letters 1, trans. Richard Gummere' },
    { id: 'r-once', text: 'One miss is an accident. Today decides the habit.', source: ATOMIC },
  ],
  // 108: done the day after a miss, so the run held
  comeback: [
    { id: 'c-return', text: 'When thou hast failed, return back again.', source: 'Marcus Aurelius, Meditations 5.9, trans. George Long' },
    { id: 'c-bent', text: 'The run bent. It didn’t break.', source: ATOMIC },
    { id: 'c-drops', text: 'Even by the falling of water-drops a water-pot is filled.', source: 'Dhammapada 122, trans. Max Müller' },
    { id: 'c-back', text: 'Missing once is an accident. Coming back is the habit.', source: ATOMIC },
  ],
  // 109: a perfect week
  week: [
    { id: 'w-repeat', text: 'We are what we repeatedly do.', source: 'Will Durant on Aristotle, 1926' },
    { id: 'w-faculty', text: 'Every habit and faculty is maintained and increased by the corresponding actions.', source: 'Epictetus, Discourses 2.18, trans. George Long' },
    { id: 'w-small', text: 'Small is not slow. Small is what lasts.', source: ATOMIC },
    { id: 'w-step', text: 'The journey of a thousand li commenced with a single step.', source: 'Lao Tzu, Tao Te Ching 64, trans. James Legge' },
  ],
};

/** Which quote went to which moment, and how far each pool has turned. Kept in Settings, so a backup carries it. */
export interface QuoteState {
  turns: Partial<Record<QuotePool, number>>;
  given: Record<string, { q: string; on: IsoDay }>;
}
export const EMPTY_QUOTES: QuoteState = { turns: {}, given: {} };

const poolOf = (key: string) => key.split('|')[0] as QuotePool;
export const quoteById = (id: string): Quote | undefined => Object.values(QUOTES).flat().find((q) => q.id === id);

/**
 * The quote for one moment (`pool|…` key). A moment keeps its quote for good, so Today shows the same words all
 * day; a new moment takes the next quote in its pool, so none repeats until the pool has gone round (110).
 */
export function quoteFor(state: QuoteState, key: string, today: IsoDay): { state: QuoteState; quote: Quote } {
  const pool = poolOf(key);
  const had = state.given[key];
  const known = had && quoteById(had.q);
  if (known) return { state, quote: known };
  const list = QUOTES[pool];
  const turn = state.turns[pool] ?? 0;
  const quote = list[turn % list.length]!;
  return { quote, state: { turns: { ...state.turns, [pool]: turn + 1 }, given: { ...state.given, [key]: { q: quote.id, on: today } } } };
}

/** Day-bound moments (risk, comeback) are dropped after 30 days; milestones and weeks stay as a record. */
export function pruneQuotes(state: QuoteState, today: IsoDay): QuoteState {
  const cutoff = addDays(today, -30);
  const given = Object.fromEntries(Object.entries(state.given).filter(([k, v]) => !['risk', 'comeback'].includes(poolOf(k)) || v.on >= cutoff));
  return Object.keys(given).length === Object.keys(state.given).length ? state : { ...state, given };
}
