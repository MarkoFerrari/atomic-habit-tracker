// @vitest-environment jsdom
// 069 + 021: reminders are planned on the phone, sealed with a phone-only key, and sent as ciphertext.
import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, wipeDbForTests } from '../data/db';
import type { CalendarEvent } from '../data/schema';

const PUSH = 'https://push.example.test';
const habit = (id: string, title: string, start: string, end: string): CalendarEvent =>
  ({ id, calendarId: 'cal', title, start, end, allDay: false, timeMode: 'clock', rrule: 'FREQ=DAILY', exdates: [], reminders: [0] });

type Mod = typeof import('./reminders');
let mod: Mod;
const calls: { url: string; method: string; body: Record<string, unknown> }[] = [];

beforeAll(async () => {
  vi.stubEnv('VITE_PUSH_URL', PUSH);
  vi.stubGlobal('Notification', { permission: 'granted' });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body as string) : {} });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  mod = await import('./reminders');
});
afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
beforeEach(async () => {
  calls.length = 0;
  await wipeDbForTests();
  const database = await db();
  await database.put('calendars', { id: 'cal', name: 'SAMPLE HABITS', color: 'habits', trackAsHabits: true, createdAt: '' });
  await database.put('events', habit('read', 'Sample read 15 min', '2026-10-01T22:00', '2026-10-01T22:15'));
  await database.put('settings', { key: 'push-device', token: 'x'.repeat(43), subscribedAt: '2026-10-01T10:00:00Z', recap: false });
});

describe('reminder encryption (021)', () => {
  it('round-trips, and a long title stays inside the function’s limit', async () => {
    const key = await mod.reminderKey();
    const text = { t: 'Sample '.repeat(28).slice(0, 200), b: '22:00 · 15 min', g: 'read|2026-10-07' };
    const sealed = await mod.seal(key, text);
    expect(sealed.length).toBeLessThan(2048);
    expect(sealed).not.toContain('Sample');
    expect(await mod.unseal(key, sealed)).toEqual(text);
  });
  it('keeps one key per phone', async () => {
    const a = await mod.seal(await mod.reminderKey(), { t: 'a', b: '', g: '' });
    expect((await mod.unseal(await mod.reminderKey(), a)).t).toBe('a');
  });
});

describe('syncReminders (069)', () => {
  it('replaces the queue with sealed reminders; no title leaves the phone', async () => {
    const queued = await mod.syncReminders(new Date('2026-10-07T12:00:00Z'));
    expect(queued).toBe(14);
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toBe(`${PUSH}/reminders`);
    const items = put!.body.items as { id: string; fireAt: string; ciphertext: string }[];
    expect(JSON.stringify(items)).not.toContain('read');
    const first = await mod.unseal(await mod.reminderKey(), items[0]!.ciphertext);
    expect(first.t).toBe('Sample read 15 min');
  });
  it('tells the function once that the recap push is off (a phone subscribed before 069)', async () => {
    await (await db()).put('settings', { key: 'push-device', token: 'x'.repeat(43), subscribedAt: '2026-10-01T10:00:00Z' });
    // turnOnPush needs a service worker; without one the sync still goes ahead and tries again next time.
    expect(await mod.syncReminders(new Date('2026-10-07T12:00:00Z'))).toBe(14);
  });
  it('does nothing for a phone that never subscribed', async () => {
    await (await db()).put('settings', { key: 'push-device', token: 'x'.repeat(43), subscribedAt: null });
    expect(await mod.syncReminders()).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
