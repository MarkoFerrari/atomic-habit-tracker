// Shared UI copy, so the same thing is always called the same way.
import type { SkipReason } from '../domain/states';

/** 007: skip reasons as designed (H17). */
export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  'no-time': 'No time', forgot: 'Forgot', 'low-energy': 'Low energy', 'not-relevant-today': 'Not relevant today',
};
