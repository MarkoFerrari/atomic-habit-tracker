// Backup (020, R7, H10): one JSON file with everything, handed to the share sheet (Files, Proton Drive).
// Restore (replace after a preview, never merge: 026, R6) arrives with M4.
import { db } from './db';
import { DB_VERSION } from './schema';
import { updateSettings } from './settings';

export interface Backup {
  app: 'atomic';
  schemaVersion: number;
  exportedAt: string;
  calendars: unknown[];
  events: unknown[];
  answers: unknown[];
  ranks: unknown[];
  pushLog: unknown[];
  settings: unknown[];
}

export async function buildBackup(now = new Date()): Promise<Backup> {
  const database = await db();
  const [calendars, events, answers, ranks, pushLog, settings] = await Promise.all([
    database.getAll('calendars'), database.getAll('events'), database.getAll('answers'),
    database.getAll('ranks'), database.getAll('pushLog'), database.getAll('settings'),
  ]);
  return {
    app: 'atomic', schemaVersion: DB_VERSION, exportedAt: now.toISOString(),
    calendars, events, answers, ranks, pushLog,
    // The push-device record stays out: it identifies this phone to the push function (059),
    // and a restored copy on another phone must register as a new device.
    settings: settings.filter((s) => s.key === 'settings'),
  };
}

export function backupFileName(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  return `atomic-backup-${local}.json`;
}

export type BackupOutcome = 'shared' | 'downloaded' | 'cancelled';

/** Opens the share sheet with the backup file; falls back to a download where sharing files isn't possible. */
export async function shareBackup(): Promise<BackupOutcome> {
  const now = new Date();
  const file = new File([JSON.stringify(await buildBackup(now), null, 1)], backupFileName(now), { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      throw e;
    }
    await updateSettings({ lastBackupAt: now.toISOString() });
    return 'shared';
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  await updateSettings({ lastBackupAt: now.toISOString() });
  return 'downloaded';
}
