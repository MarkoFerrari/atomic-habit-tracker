import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openDB } from 'idb';
import { DB_NAME, DB_VERSION } from './schema';
import { addDiagnostic, db, listDiagnostics, resetDbForTests } from './db';

describe('IndexedDB schema', () => {
  it('upgrades a v1 database from build test 0 without losing its records', async () => {
    const v1 = await openDB(DB_NAME, 1, {
      upgrade(d) { d.createObjectStore('diagnostics', { keyPath: 'id', autoIncrement: true }).createIndex('at', 'at'); },
    });
    await v1.add('diagnostics', { kind: 'record', at: '2026-10-06T08:20:00Z', installed: true, browser: 'Home Screen app', note: 'Test record 1' });
    v1.close();

    resetDbForTests();
    const database = await db();
    expect(database.version).toBe(DB_VERSION);
    expect([...database.objectStoreNames].sort()).toEqual(['answers', 'calendars', 'diagnostics', 'events', 'pushLog', 'ranks', 'settings']);
    expect((await listDiagnostics()).map((r) => r.note)).toEqual(['Test record 1']);
    await addDiagnostic({ kind: 'record', at: '2026-10-06T08:21:00Z', installed: true, browser: 'Home Screen app', note: 'Test record 2' });
    expect(await listDiagnostics()).toHaveLength(2);
  });
});
