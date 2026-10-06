import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, type Diagnostic } from './schema';

interface AtomicDB extends DBSchema {
  diagnostics: { key: number; value: Diagnostic; indexes: { at: string } };
}

let dbPromise: Promise<IDBPDatabase<AtomicDB>> | null = null;

export function db(): Promise<IDBPDatabase<AtomicDB>> {
  dbPromise ??= openDB<AtomicDB>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const store = database.createObjectStore('diagnostics', { keyPath: 'id', autoIncrement: true });
        store.createIndex('at', 'at');
      }
    },
  });
  return dbPromise;
}

export async function addDiagnostic(entry: Omit<Diagnostic, 'id'>): Promise<void> {
  await (await db()).add('diagnostics', entry);
}

export async function listDiagnostics(): Promise<Diagnostic[]> {
  return (await db()).getAllFromIndex('diagnostics', 'at');
}
