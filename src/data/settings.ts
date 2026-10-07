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
  const next = { ...(await getSettings()), ...change, key: 'settings' as const };
  await (await db()).put('settings', next);
  return next;
}
