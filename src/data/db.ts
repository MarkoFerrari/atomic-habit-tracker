import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import {
  DB_NAME, DB_VERSION,
  type Answer, type Calendar, type CalendarEvent, type Diagnostic, type PushDevice, type PushLogEntry, type RankRecord, type ReminderKey, type Settings,
} from './schema';

export interface AtomicDB extends DBSchema {
  diagnostics: { key: number; value: Diagnostic; indexes: { at: string } };
  calendars: { key: string; value: Calendar };
  events: { key: string; value: CalendarEvent; indexes: { calendarId: string; icsUid: string } };
  answers: { key: string; value: Answer; indexes: { occurrence: string; eventId: string } };
  ranks: { key: string; value: RankRecord; indexes: { seriesId: string } };
  pushLog: { key: number; value: PushLogEntry; indexes: { receivedAt: string } };
  settings: { key: string; value: Settings | PushDevice | ReminderKey }; // keyed records, so no schema bump
}

/** Upgrade steps, in order. The service worker may have created v1 (diagnostics) first. */
export function upgrade(database: IDBPDatabase<AtomicDB>, oldVersion: number): void {
  const has = (name: string) => database.objectStoreNames.contains(name as never);
  if (oldVersion < 1 && !has('diagnostics')) {
    database.createObjectStore('diagnostics', { keyPath: 'id', autoIncrement: true }).createIndex('at', 'at');
  }
  if (oldVersion < 2) {
    database.createObjectStore('calendars', { keyPath: 'id' });
    const events = database.createObjectStore('events', { keyPath: 'id' });
    events.createIndex('calendarId', 'calendarId');
    events.createIndex('icsUid', 'icsUid');
    const answers = database.createObjectStore('answers', { keyPath: 'key' });
    answers.createIndex('occurrence', 'occurrence');
    answers.createIndex('eventId', 'eventId');
    database.createObjectStore('ranks', { keyPath: 'key' }).createIndex('seriesId', 'seriesId');
    database.createObjectStore('pushLog', { keyPath: 'id', autoIncrement: true }).createIndex('receivedAt', 'receivedAt');
    database.createObjectStore('settings', { keyPath: 'key' });
  }
}

/**
 * Data steps that run inside the upgrade transaction, after the store steps.
 * v3 (069): a habit's push comes at its start, so habits imported with Proton's "15 min before" get [0].
 */
async function migrate(tx: IDBPTransaction<AtomicDB, StoreNames<AtomicDB>[], 'versionchange'>, oldVersion: number): Promise<void> {
  if (oldVersion >= 2 && oldVersion < 3) {
    const habitCalendars = new Set((await tx.objectStore('calendars').getAll()).filter((c) => c.trackAsHabits).map((c) => c.id));
    let cursor = await tx.objectStore('events').openCursor();
    while (cursor) {
      if (habitCalendars.has(cursor.value.calendarId)) await cursor.update({ ...cursor.value, reminders: [0] });
      cursor = await cursor.continue();
    }
  }
}

let dbPromise: Promise<IDBPDatabase<AtomicDB>> | null = null;

export function db(): Promise<IDBPDatabase<AtomicDB>> {
  dbPromise ??= openDB<AtomicDB>(DB_NAME, DB_VERSION, {
    upgrade: (database, oldVersion, _newVersion, tx) => { upgrade(database, oldVersion); void migrate(tx, oldVersion); },
    blocking: () => { dbPromise = null; }, // a newer tab or worker wants to upgrade: let go
  });
  return dbPromise;
}

/** Test seam: forget the open connection (fake-indexeddb resets between tests). */
export function resetDbForTests(): void { dbPromise = null; }

/** Test seam: close the connection and delete the database, so each test starts empty. */
export async function wipeDbForTests(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  await new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase(DB_NAME);
    r.onsuccess = r.onerror = r.onblocked = () => resolve();
  });
}

export async function addDiagnostic(entry: Omit<Diagnostic, 'id'>): Promise<void> {
  await (await db()).add('diagnostics', entry);
}

export async function listDiagnostics(): Promise<Diagnostic[]> {
  return (await db()).getAllFromIndex('diagnostics', 'at');
}
