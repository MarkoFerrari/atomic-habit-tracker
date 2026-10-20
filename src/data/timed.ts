// 130: reminders that aren't habits, kept in the settings record (no new store, so no schema bump, and a backup carries
// them). Each change is one read-write transaction, so two quick edits never overwrite each other.
import { db } from './db';
import { defaultSettings } from './settings';
import type { Settings, TimedReminder } from './schema';
import { sortTimes } from '../domain/timed';

async function change(fn: (list: TimedReminder[]) => TimedReminder[]): Promise<TimedReminder[]> {
  const database = await db();
  const tx = database.transaction('settings', 'readwrite');
  const stored = ((await tx.store.get('settings')) as Settings | undefined) ?? defaultSettings(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const next = fn(stored.timedReminders ?? []);
  await tx.store.put({ ...stored, timedReminders: next, key: 'settings' });
  await tx.done;
  return next;
}

export async function listTimed(): Promise<TimedReminder[]> {
  const stored = (await (await db()).get('settings', 'settings')) as Settings | undefined;
  return stored?.timedReminders ?? [];
}

export async function getTimed(id: string): Promise<TimedReminder | null> {
  return (await listTimed()).find((r) => r.id === id) ?? null;
}

export interface TimedDraft { title: string; icon: string; times: string[]; days?: number[] }

export async function createTimed(d: TimedDraft): Promise<TimedReminder> {
  const r: TimedReminder = {
    id: `t${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`, title: d.title.trim(), icon: d.icon, times: sortTimes(d.times),
    ...(d.days?.length && d.days.length < 7 ? { days: [...d.days].sort((a, b) => a - b) } : {}), createdAt: new Date().toISOString(),
  };
  await change((list) => [...list, r]);
  return r;
}

export async function updateTimed(id: string, d: Partial<TimedDraft> & { paused?: boolean }): Promise<void> {
  await change((list) => list.map((r) => {
    if (r.id !== id) return r;
    const next: TimedReminder = { ...r, ...d, ...(d.title !== undefined ? { title: d.title.trim() } : {}), ...(d.times ? { times: sortTimes(d.times) } : {}) };
    if ('days' in d && (!d.days?.length || d.days.length === 7)) delete next.days;
    if (next.paused === false) delete next.paused;
    return next;
  }));
}

export async function deleteTimed(id: string): Promise<TimedReminder | null> {
  let gone: TimedReminder | null = null;
  await change((list) => { gone = list.find((r) => r.id === id) ?? null; return list.filter((r) => r.id !== id); });
  return gone;
}

/** Undo for a delete: the same reminder, back where it was in the list. */
export async function restoreTimed(r: TimedReminder): Promise<void> {
  await change((list) => (list.some((x) => x.id === r.id) ? list : [...list, r]));
}
