import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  DB_NAME, DB_VERSION,
  type Answer, type Calendar, type CalendarEvent, type Diagnostic, type PushLogEntry, type RankRecord, type Settings,
} from './schema';

export interface AtomicDB extends DBSchema {
  diagnostics: { key: number; value: Diagnostic; indexes: { at: string } };
  calendars: { key: string; value: Calendar };
  events: { key: string; value: CalendarEvent; indexes: { calendarId: string; icsUid: string } };
  answers: { key: string; value: Answer; indexes: { occurrence: string; eventId: string } };
  ranks: { key: string; value: RankRecord; indexes: { seriesId: string } };
  pushLog: { key: number; value: PushLogEntry; indexes: { receivedAt: string } };
  settings: { key: string; value: Settings };
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

let dbPromise: Promise<IDBPDatabase<AtomicDB>> | null = null;

export function db(): Promise<IDBPDatabase<AtomicDB>> {
  dbPromise ??= openDB<AtomicDB>(DB_NAME, DB_VERSION, {
    upgrade: (database, oldVersion) => upgrade(database, oldVersion),
    blocking: () => { dbPromise = null; }, // a newer tab or worker wants to upgrade: let go
  });
  return dbPromise;
}

/** Test seam: forget the open connection (fake-indexeddb resets between tests). */
export function resetDbForTests(): void { dbPromise = null; }

export async function addDiagnostic(entry: Omit<Diagnostic, 'id'>): Promise<void> {
  await (await db()).add('diagnostics', entry);
}

export async function listDiagnostics(): Promise<Diagnostic[]> {
  return (await db()).getAllFromIndex('diagnostics', 'at');
}
