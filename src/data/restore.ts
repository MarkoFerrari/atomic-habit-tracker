// Restore (H48, R6, 026): a backup replaces everything on the phone after a preview. Never a merge.
// The push device and the reminder key stay: they belong to this phone, not to the data (059, 021).
import { db } from './db';
import { DB_VERSION, type Calendar, type CalendarEvent, type PushLogEntry, type Settings } from './schema';
import type { Backup } from './backup';

export class BackupError extends Error {}

export interface BackupPreview {
  backup: Backup;
  exportedAt: string;
  events: number;
  answers: number;
  calendars: number;
}

/** Reads a backup file's text. Says plainly what's wrong with anything that isn't one. */
export function readBackup(text: string): BackupPreview {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new BackupError('This file isn’t an ATOMIC backup. Backups end in .json and start with “atomic-backup”.'); }
  const b = data as Partial<Backup> | null;
  if (!b || b.app !== 'atomic' || typeof b.schemaVersion !== 'number') {
    throw new BackupError('This file isn’t an ATOMIC backup. Backups end in .json and start with “atomic-backup”.');
  }
  if (b.schemaVersion > DB_VERSION) throw new BackupError('This backup comes from a newer ATOMIC. Update the app (close it and open it again), then restore.');
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const backup: Backup = {
    app: 'atomic', schemaVersion: b.schemaVersion, exportedAt: String(b.exportedAt ?? ''),
    calendars: list(b.calendars), events: list(b.events), answers: list(b.answers),
    ranks: list(b.ranks), pushLog: list(b.pushLog), settings: list(b.settings),
  };
  return { backup, exportedAt: backup.exportedAt, events: backup.events.length, answers: backup.answers.length, calendars: backup.calendars.length };
}

/** Brings an older backup up to this schema (the same steps as db.ts, applied to plain records). */
function migrate(b: Backup): Backup {
  let events = b.events as CalendarEvent[];
  if (b.schemaVersion < 3) {
    const habits = new Set((b.calendars as Calendar[]).filter((c) => c.trackAsHabits).map((c) => c.id));
    events = events.map((e) => (habits.has(e.calendarId) ? { ...e, reminders: [0] } : e)); // 069
  }
  return { ...b, events, schemaVersion: DB_VERSION };
}

/** Replaces everything on the phone with the backup, in one transaction. */
export async function restoreBackup(preview: BackupPreview): Promise<void> {
  const b = migrate(preview.backup);
  const database = await db();
  const stores = ['calendars', 'events', 'answers', 'ranks', 'pushLog', 'settings'] as const;
  const tx = database.transaction([...stores], 'readwrite');
  const settings = tx.objectStore('settings');
  const kept = (await settings.getAll()).filter((s) => s.key !== 'settings'); // push device, reminder key
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
  const put = (store: 'calendars' | 'events' | 'answers' | 'ranks' | 'pushLog', rows: unknown[]) =>
    rows.map((r) => tx.objectStore(store).put(r as never));
  const restored = (b.settings as Settings[]).filter((s) => s?.key === 'settings').map((s) => ({ ...s, onboardingDone: true }));
  await Promise.all([
    ...put('calendars', b.calendars),
    ...put('events', b.events),
    ...put('answers', b.answers),
    ...put('ranks', b.ranks),
    ...put('pushLog', (b.pushLog as PushLogEntry[]).map(({ id: _id, ...rest }) => rest)),
    ...[...kept, ...restored].map((s) => settings.put(s)),
    tx.done,
  ]);
}
