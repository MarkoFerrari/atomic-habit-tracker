// One IndexedDB database for the whole app (020).
// Every schema change bumps DB_VERSION and adds one `if (oldVersion < n)` step in db.ts. Steps never change once shipped.
import type { IsoDay } from '../domain/day';
import type { QuoteState } from '../domain/quotes';
import type { AnswerStatus, SkipReason } from '../domain/states';
import type { RankId } from '../domain/ranks';
import type { Adjustment } from '../domain/adjust';
import type { PastVersion } from '../domain/versions';
import type { Pause } from '../domain/pause';

export const DB_NAME = 'atomic';
export const DB_VERSION = 3;

// 034, 046, 081: marker hues. The first four keep their original names (stored in backups); eight more make twelve.
export type CalendarToken =
  | 'marko' | 'work' | 'family' | 'habits'
  | 'violet' | 'orange' | 'teal' | 'brown' | 'slate' | 'plum' | 'gold' | 'sky';

export interface Calendar {
  id: string;
  name: string;
  color: CalendarToken;
  trackAsHabits: boolean;
  createdAt: string;
  /** R5: a new event's reminder follows its calendar. Missing: habits [0] (a push at the start, 069), others [15]. */
  defaultReminders?: number[];
}

export interface CalendarEvent {
  id: string;
  icsUid?: string; // E8: re-import matches on this
  calendarId: string;
  title: string;
  icon?: string; // Lucide icon name for habits (043)
  start: string; // 'clock' mode: local 'YYYY-MM-DDTHH:mm'; 'zoned' mode: ISO instant (028)
  end: string;
  allDay: boolean;
  timeMode: 'clock' | 'zoned';
  tz?: string; // origin zone for 'zoned' events (E6)
  rrule?: string;
  exdates: string[];
  reminders: number[]; // minutes before; 0 = at the start (069)
  place?: string; // H29/H30 "Place or link": LOCATION, or a URL
  notes?: string; // DESCRIPTION
  /** Single occurrences moved or cancelled in the source calendar, keyed by the day they replace. */
  overrides?: Record<string, { start: string; end: string; title?: string; cancelled?: boolean }>;
  archivedOn?: IsoDay; // E9
  /** 085 (P2): habit design, all optional. The habit this one follows, what the smallest version is, who the owner is becoming. */
  after?: string;
  smallest?: string;
  identity?: string;
  /** 115: earlier schedules of this habit, oldest first, each ended by its rule's UNTIL. The habit keeps its id. */
  past?: PastVersion[];
  /** 117: pauses set ahead, oldest first; kept after they end, so history and backups know why days weren't due. */
  pauses?: Pause[];
  /** 119: times a week, any days (the rule is FREQ=DAILY). Missing: a habit with fixed days. */
  perWeek?: number;
}

export interface Answer {
  key: string; // `${eventId}|${occurrence}`
  eventId: string;
  occurrence: IsoDay;
  status: AnswerStatus;
  reason?: SkipReason;
  /** 086 (P4): done with the smallest version. Counts as done everywhere; Stats shows full and small apart. */
  small?: boolean;
  answeredAt: string;
  history: { ts: string; from: AnswerStatus | null; to: AnswerStatus }[]; // append-only
}

export interface RankRecord { key: string; seriesId: string; rank: RankId; reachedOn: IsoDay } // never deleted, unless its habit is (112)

export interface PushLogEntry { id?: number; receivedAt: string; kind: 'recap' | 'reminder' | 'test' }

export interface Settings {
  key: 'settings';
  recapTime: string; // '22:30' (039)
  timezone: string;
  backupNudgeDays: number; // O7: 7 or 14, still open
  lastBackupAt: string | null;
  trackingStart: IsoDay | null;
  onboardingDone: boolean;
  /** 069: the 22:30 recap push, off unless switched on in Notifications (H46). */
  recapPush?: boolean;
  /** 080: Kaizen. Every adjustment tried, newest last; at most one is active. Lives here so a backup carries it. */
  adjustments?: Adjustment[];
  /** The Monday of the last weekly recap that was opened (H34 banner). */
  recapSeen?: IsoDay;
  /** 093: the habit day the perfect-day award last played. Read by 0.6.0–0.6.2 only; 106 uses `awardShown`. */
  awardShownOn?: IsoDay;
  /** 106: the day and the number done when the award last played: it plays again only with more done that day. */
  awardShown?: { day: IsoDay; done: number };
  /** H5: rank records (`${eventId}|${rank}`) already revealed. Missing: none revealed yet, and none owed. */
  ranksSeen?: string[];
  /** 097: show events from other calendars. Unused since 104 (the Calendar left the app); kept so backups read the same. */
  showEvents?: boolean;
  /** 110: which quote went to which moment, and how far each pool has turned. */
  quotes?: QuoteState;
  /** 109: the Monday of the last week whose perfect-week award played. */
  weekAwardShown?: IsoDay;
  /** 115: habits split by an edit before 0.8.2 have been joined back (one-time repair, joinSplitHabits). */
  seriesJoined?: boolean;
  /** 130: reminders that aren't habits ("Drink water, 6 times a day"). Never counted; here so a backup carries them. */
  timedReminders?: TimedReminder[];
  /** 131: the last version whose "Welcome to the new ATOMIC" was shown. Missing on a fresh install: nothing to tell. */
  whatsNewSeen?: string;
}

/**
 * 130: a reminder, not a habit. A nudge at each time, nothing to tick, never in the day's count, rates, runs or
 * ranks (005: water stays untracked). Clock time, like habits (028). `days`: 0 = Monday … 6 = Sunday; missing = every day.
 */
export interface TimedReminder {
  id: string;
  title: string;
  icon: string;
  times: string[]; // 'HH:mm', sorted
  days?: number[];
  paused?: boolean;
  createdAt: string;
}

/** This phone's identity with the push function (059). Lives in the settings store, under its own key. */
export interface PushDevice {
  key: 'push-device';
  token: string;
  subscribedAt: string | null;
  /** 069: what the push function was last told about the recap push. Missing: never told (it sends the recap). */
  recap?: boolean;
  lastReminderSync?: string;
}

/** 021: the key reminder titles are encrypted with. Made on the phone, never sent anywhere, never in a backup. */
export interface ReminderKey { key: 'reminder-key'; raw: Uint8Array<ArrayBuffer> }

export type DiagnosticKind = 'record' | 'push' | 'notification' | 'persist';
export interface Diagnostic {
  id?: number;
  kind: DiagnosticKind;
  at: string;
  installed: boolean | null; // null when written by the service worker
  browser: string;
  note: string;
}
