// App settings: one record in the settings store (CLAUDE.md §4 data model).
import { db } from './db';
import type { Settings } from './schema';

export function defaultSettings(timezone: string): Settings {
  return {
    key: 'settings',
    recapTime: '22:30', // 039
    timezone,
    backupNudgeDays: 7, // O7 is still open (7 or 14); 7 until decided
    lastBackupAt: null,
    trackingStart: null,
    onboardingDone: false,
  };
}

export async function getSettings(): Promise<Settings> {
  const stored = (await (await db()).get('settings', 'settings')) as Settings | undefined;
  return stored ?? defaultSettings(Intl.DateTimeFormat().resolvedOptions().timeZone);
}

export async function updateSettings(change: Partial<Omit<Settings, 'key'>>): Promise<Settings> {
  // One read-write transaction, so two quick saves (an answer and a recap seen, say) never overwrite each other.
  const database = await db();
  const tx = database.transaction('settings', 'readwrite');
  const stored = (await tx.store.get('settings')) as Settings | undefined;
  const base = stored ?? defaultSettings(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const next = { ...base, ...change, key: 'settings' as const };
  await tx.store.put(next);
  await tx.done;
  return next;
}
