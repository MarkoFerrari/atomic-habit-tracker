// One IndexedDB database for the whole app (020).
// Every schema change bumps DB_VERSION and adds one `if (oldVersion < n)` step in db.ts. Steps never change once shipped.
import type { IsoDay } from '../domain/day';
import type { AnswerStatus, SkipReason } from '../domain/states';
import type { RankId } from '../domain/ranks';

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
}

export interface Answer {
  key: string; // `${eventId}|${occurrence}`
  eventId: string;
  occurrence: IsoDay;
  status: AnswerStatus;
  reason?: SkipReason;
  answeredAt: string;
  history: { ts: string; from: AnswerStatus | null; to: AnswerStatus }[]; // append-only
}

export interface RankRecord { key: string; seriesId: string; rank: RankId; reachedOn: IsoDay } // never deleted

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
