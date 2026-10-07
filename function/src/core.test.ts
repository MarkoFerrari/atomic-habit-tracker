import { beforeEach, describe, expect, it } from 'vitest';
import { handle, tick, type Deps, type PushSubscriptionData, type Req, type SendResult, type Sender } from './core';
import { MemoryStore } from './memory-store';
import { habitDay, inRecapWindow } from './time';

const ORIGIN = 'https://markoferrari.github.io';
const TOKEN = 'a'.repeat(43);
const SUB = { endpoint: 'https://web.push.apple.com/QAbc123', keys: { p256dh: 'p', auth: 'a' } };
const ZONE = 'Europe/Athens';

class FakeSender implements Sender {
  sent: { sub: PushSubscriptionData; payload: Record<string, unknown> }[] = [];
  next: SendResult = 'ok';
  async publicKey() { return 'BPublicKey'; }
  async send(sub: PushSubscriptionData, payload: Record<string, unknown>) { this.sent.push({ sub, payload }); return this.next; }
}

let store: MemoryStore;
let sender: FakeSender;
let clock: Date;
let deps: Deps;

beforeEach(() => {
  store = new MemoryStore();
  sender = new FakeSender();
  clock = new Date('2026-10-07T07:00:00Z'); // 10:00 in Athens
  deps = { store, sender, inviteCode: 'olive tree dawn', allowedOrigin: ORIGIN, now: () => clock };
});

const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Req => ({
  method, path, body: body === undefined ? '' : JSON.stringify(body),
  headers: { origin: ORIGIN, 'x-device-token': TOKEN, ...headers },
});
const subscribe = (extra: Record<string, unknown> = {}) =>
  handle(req('POST', '/subscribe', { subscription: SUB, timezone: ZONE, invite: 'olive tree dawn', ...extra }), deps);

describe('time (R1, 039, E5)', () => {
  it('belongs to yesterday before 04:00', () => {
    expect(habitDay(new Date('2026-10-07T23:30:00Z'), ZONE)).toBe('2026-10-07'); // 02:30 on the 8th in Athens
    expect(habitDay(new Date('2026-10-08T01:30:00Z'), ZONE)).toBe('2026-10-08'); // 04:30
  });
  it('opens the recap window at 22:30 local in summer and in winter', () => {
    expect(inRecapWindow(new Date('2026-10-07T19:29:00Z'), ZONE)).toBe(false); // 22:29 EEST
    expect(inRecapWindow(new Date('2026-10-07T19:30:00Z'), ZONE)).toBe(true); // 22:30 EEST
    expect(inRecapWindow(new Date('2026-12-07T20:29:00Z'), ZONE)).toBe(false); // 22:29 EET
    expect(inRecapWindow(new Date('2026-12-07T20:30:00Z'), ZONE)).toBe(true); // 22:30 EET
    expect(inRecapWindow(new Date('2026-10-08T00:59:00Z'), ZONE)).toBe(true); // 03:59
    expect(inRecapWindow(new Date('2026-10-08T01:00:00Z'), ZONE)).toBe(false); // 04:00
  });
});

describe('subscribe (059, E1, E6)', () => {
  it('needs the invite code for a new phone', async () => {
    expect((await subscribe({ invite: 'wrong' })).status).toBe(403);
    expect((await subscribe()).status).toBe(201);
    expect(store.devices.get(TOKEN)?.timezone).toBe(ZONE);
  });
  it('renews a known phone without the invite code, and takes its new zone', async () => {
    await subscribe();
    const res = await handle(req('POST', '/subscribe', { subscription: SUB, timezone: 'Europe/Rome' }), deps);
    expect(res.status).toBe(200);
    expect(store.devices.get(TOKEN)?.timezone).toBe('Europe/Rome');
  });
  it('rejects bad tokens, zones and non-push endpoints', async () => {
    expect((await handle(req('POST', '/subscribe', {}, { 'x-device-token': 'short' }), deps)).status).toBe(401);
    expect((await subscribe({ timezone: 'Mars/Olympus' })).status).toBe(400);
    expect((await subscribe({ subscription: { ...SUB, endpoint: 'https://evil.example/x' } })).status).toBe(400);
  });
  it('answers CORS only for the app’s origin', async () => {
    const ok = await handle(req('OPTIONS', '/subscribe'), deps);
    expect(ok.headers['Access-Control-Allow-Origin']).toBe(ORIGIN);
    const other = await handle(req('OPTIONS', '/subscribe', undefined, { origin: 'https://evil.example' }), deps);
    expect(other.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

describe('test push (E1, 064)', () => {
  it('sends now, or schedules it and the timer sends it once', async () => {
    await subscribe();
    expect((await handle(req('POST', '/test', {}), deps)).status).toBe(200);
    expect(sender.sent.at(-1)?.payload.kind).toBe('test');

    const at = new Date(clock.getTime() + 120_000).toISOString();
    expect((await handle(req('POST', '/test', { at }), deps)).status).toBe(202);
    await tick(deps);
    expect(sender.sent).toHaveLength(1); // not due yet
    clock = new Date(clock.getTime() + 120_000);
    await tick(deps);
    await tick(deps);
    expect(sender.sent).toHaveLength(2);
    expect(store.devices.get(TOKEN)?.queue).toHaveLength(0);
  });
  it('refuses a test more than 24 hours ahead', async () => {
    await subscribe();
    const at = new Date(clock.getTime() + 25 * 3600_000).toISOString();
    expect((await handle(req('POST', '/test', { at }), deps)).status).toBe(400);
  });
  it('needs a known device', async () => {
    expect((await handle(req('POST', '/test', {}), deps)).status).toBe(404);
  });
});

describe('reminders (021)', () => {
  it('replaces the queue and sends each reminder when due, with only its ciphertext', async () => {
    await subscribe();
    const items = [
      { id: 'r1', fireAt: '2026-10-07T07:05:00Z', ciphertext: 'c1' },
      { id: 'r2', fireAt: '2026-10-07T08:00:00Z', ciphertext: 'c2' },
    ];
    expect((await handle(req('PUT', '/reminders', { items }), deps)).status).toBe(200);
    clock = new Date('2026-10-07T07:05:30Z');
    await tick(deps);
    expect(sender.sent.map((s) => s.payload)).toEqual([{ kind: 'reminder', ciphertext: 'c1', sentAt: clock.toISOString() }]);
    expect(store.devices.get(TOKEN)?.queue.map((q) => q.id)).toEqual(['r2']);
  });
  it('rejects oversized ciphertext', async () => {
    await subscribe();
    const items = [{ id: 'r1', fireAt: '2026-10-07T07:05:00Z', ciphertext: 'x'.repeat(3000) }];
    expect((await handle(req('PUT', '/reminders', { items }), deps)).status).toBe(400);
  });
});

describe('recap (039, 025)', () => {
  it('sends one generic recap per habit day from 22:30', async () => {
    await subscribe();
    clock = new Date('2026-10-07T19:29:00Z');
    await tick(deps);
    expect(sender.sent).toHaveLength(0);
    clock = new Date('2026-10-07T19:30:00Z');
    await tick(deps);
    clock = new Date('2026-10-07T19:31:00Z');
    await tick(deps);
    expect(sender.sent.map((s) => s.payload)).toEqual([{ kind: 'recap', sentAt: '2026-10-07T19:30:00.000Z' }]);
    clock = new Date('2026-10-08T19:30:00Z');
    await tick(deps);
    expect(sender.sent).toHaveLength(2);
  });
  it('still sends when the timer missed 22:30, but not after the day closes', async () => {
    await subscribe();
    clock = new Date('2026-10-07T20:10:00Z'); // 23:10
    await tick(deps);
    expect(sender.sent).toHaveLength(1);
  });
  it('doesn’t fire immediately for a phone that subscribes during the window', async () => {
    clock = new Date('2026-10-07T20:00:00Z');
    await subscribe();
    await tick(deps);
    expect(sender.sent).toHaveLength(0);
  });
});

describe('expired push address (E1)', () => {
  it('pauses the device, keeps its queue, and resumes after a renewal', async () => {
    await subscribe();
    await handle(req('PUT', '/reminders', { items: [{ id: 'r1', fireAt: '2026-10-07T09:00:00Z', ciphertext: 'c' }] }), deps);
    sender.next = 'gone';
    clock = new Date('2026-10-07T19:30:00Z');
    await tick(deps);
    expect(store.devices.get(TOKEN)?.paused).toBe(true);
    expect(store.devices.get(TOKEN)?.queue).toHaveLength(1);
    sender.next = 'ok';
    await tick(deps);
    expect(sender.sent).toHaveLength(1); // paused: nothing more sent
    await handle(req('POST', '/subscribe', { subscription: SUB, timezone: ZONE }), deps);
    await tick(deps);
    expect(sender.sent.length).toBeGreaterThan(1);
  });
});

describe('limits', () => {
  it('rate-limits a device to 30 calls a minute', async () => {
    await subscribe();
    let last = 0;
    for (let i = 0; i < 31; i += 1) last = (await handle(req('PUT', '/reminders', { items: [] }), deps)).status;
    expect(last).toBe(429);
  });
  it('runs the timer from a POST / with { tick: true } (the CRON trigger)', async () => {
    const res = await handle(req('POST', '/', { tick: true }), deps);
    expect(JSON.parse(res.body)).toMatchObject({ ok: true, devices: 0 });
  });
});
