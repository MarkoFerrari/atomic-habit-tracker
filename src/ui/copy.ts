// Shared UI copy, so the same thing is always called the same way.
import type { SkipReason } from '../domain/states';
import type { PauseReason } from '../domain/pause';

/** 007: skip reasons as designed (H17). */
/** 117: why a habit is paused (Playground 08, a small form). */
export const PAUSE_REASON_LABEL: Record<PauseReason, string> = { travel: 'Travel', ill: 'Ill or injured', busy: 'Busy stretch', other: 'Other' };

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  'no-time': 'No time', forgot: 'Forgot', 'low-energy': 'Low energy', 'not-relevant-today': 'Not relevant today',
};
