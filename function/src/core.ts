// ATOMIC push function, host-agnostic core (CLAUDE.md §10). The host adapter maps its request
// format onto `Req`/`Res` and supplies a Store and a Sender. Nothing here logs a payload.
import { createHash, timingSafeEqual } from 'node:crypto';
import { habitDay, inRecapWindow, isValidZone } from './time';

export interface PushSubscriptionData { endpoint: string; keys: { p256dh: string; auth: string } }

export interface QueueItem { id: string; fireAt: string; kind: 'reminder' | 'test'; ciphertext?: string }

/** One record per phone (059). No accounts: the random device token is the only key. */
export interface Device {
  token: string;
  subscription: PushSubscriptionData;
  timezone: string;
  queue: QueueItem[];
  lastRecapDay?: string;
  /** The push service said this address is gone; sending pauses until the app subscribes again (E1). */
  paused?: boolean;
  createdAt: string;
  updatedAt: string;
  rate: { minute: string; count: number };
}

export interface Store {
  get(token: string): Promise<Device | null>;
  put(device: Device): Promise<void>;
  delete(token: string): Promise<void>;
  list(): Promise<string[]>;
}

export type SendResult = 'ok' | 'gone' | 'error';
export interface Sender {
  publicKey(): Promise<string>;
  send(sub: PushSubscriptionData, payload: Record<string, unknown>, opts: { ttl: number; urgency: 'normal' | 'high' }): Promise<SendResult>;
}

export interface Deps { store: Store; sender: Sender; inviteCode: string; allowedOrigin: string; now: () => Date }

export interface Req { method: string; path: string; headers: Record<string, string | undefined>; body: string }
export interface Res { status: number; headers: Record<string, string>; body: string }

const RATE_PER_MINUTE = 30;
const MAX_QUEUE = 500; // 14 days of reminders is far below this
const MAX_CIPHERTEXT = 2048;
const MAX_TEST_DELAY_MS = 24 * 3600_000;
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
const ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;
// Only real push services: the function never fetches an arbitrary URL a caller hands it.
const PUSH_HOSTS = [/(^|\.)push\.apple\.com$/, /^fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

function json(status: number, data: unknown, headers: Record<string, string> = {}): Res {
  return { status, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) };
}

function cors(req: Req, allowedOrigin: string): Record<string, string> {
  const origin = req.headers['origin'];
  if (origin !== allowedOrigin) return {};
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Device-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function parseBody(body: string): Record<string, unknown> {
  if (!body) return {};
  if (body.length > 256 * 1024) throw new HttpError(413, 'Body too large');
  try {
    const value = JSON.parse(body);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch { /* fall through */ }
  throw new HttpError(400, 'Body must be a JSON object');
}

function sameSecret(given: unknown, expected: string): boolean {
  if (!expected || typeof given !== 'string') return false;
  const a = createHash('sha256').update(given.trim()).digest();
  const b = createHash('sha256').update(expected.trim()).digest();
  return timingSafeEqual(a, b);
}

function validSubscription(value: unknown): PushSubscriptionData {
  const sub = value as PushSubscriptionData | undefined;
  if (!sub || typeof sub.endpoint !== 'string' || typeof sub.keys?.p256dh !== 'string' || typeof sub.keys?.auth !== 'string') {
    throw new HttpError(400, 'Invalid subscription');
  }
  let url: URL;
  try { url = new URL(sub.endpoint); } catch { throw new HttpError(400, 'Invalid subscription endpoint'); }
  if (url.protocol !== 'https:' || !PUSH_HOSTS.some((re) => re.test(url.hostname))) throw new HttpError(400, 'Unknown push service');
  return { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } };
}

function deviceToken(req: Req): string {
  const token = req.headers['x-device-token'];
  if (!token || !TOKEN_RE.test(token)) throw new HttpError(401, 'Missing or invalid device token');
  return token;
}

/** Counts a call against the device's per-minute budget; throws 429 when it's spent. */
function spend(device: Device, now: Date): void {
  const minute = now.toISOString().slice(0, 16);
  if (device.rate.minute !== minute) device.rate = { minute, count: 0 };
  device.rate.count += 1;
  if (device.rate.count > RATE_PER_MINUTE) throw new HttpError(429, 'Too many requests');
}

async function knownDevice(req: Req, deps: Deps): Promise<Device> {
  const device = await deps.store.get(deviceToken(req));
  if (!device) throw new HttpError(404, 'Unknown device: subscribe first');
  spend(device, deps.now());
  return device;
}

async function subscribe(req: Req, deps: Deps): Promise<Res> {
  const token = deviceToken(req);
  const body = parseBody(req.body);
  const existing = await deps.store.get(token);
  // 059: a new phone needs the invite code; a known phone renewing its address (E1) or zone (E6) doesn't.
  if (!existing && !sameSecret(body.invite, deps.inviteCode)) throw new HttpError(403, 'Wrong invite code');
  const timezone = typeof body.timezone === 'string' && isValidZone(body.timezone) ? body.timezone : null;
  if (!timezone) throw new HttpError(400, 'Invalid time zone');
  const subscription = validSubscription(body.subscription);
  const now = deps.now();
  const device: Device = existing ?? {
    token, subscription, timezone, queue: [], createdAt: now.toISOString(), updatedAt: now.toISOString(), rate: { minute: '', count: 0 },
  };
  if (existing) spend(device, now);
  device.subscription = subscription;
  device.timezone = timezone;
  device.paused = false;
  device.updatedAt = now.toISOString();
  // Subscribing during the recap window doesn't fire tonight's recap straight away.
  if (!existing && inRecapWindow(now, timezone)) device.lastRecapDay = habitDay(now, timezone);
  await deps.store.put(device);
  return json(existing ? 200 : 201, { ok: true });
}

async function putReminders(req: Req, deps: Deps): Promise<Res> {
  const device = await knownDevice(req, deps);
  const items = parseBody(req.body).items;
  if (!Array.isArray(items) || items.length > MAX_QUEUE) throw new HttpError(400, `items must be an array of at most ${MAX_QUEUE}`);
  const reminders: QueueItem[] = items.map((raw) => {
    const item = raw as Partial<QueueItem>;
    if (typeof item.id !== 'string' || !ID_RE.test(item.id)) throw new HttpError(400, 'Invalid reminder id');
    if (typeof item.fireAt !== 'string' || Number.isNaN(Date.parse(item.fireAt))) throw new HttpError(400, 'Invalid fireAt');
    if (typeof item.ciphertext !== 'string' || item.ciphertext.length > MAX_CIPHERTEXT) throw new HttpError(400, 'Invalid ciphertext');
    return { id: item.id, fireAt: new Date(item.fireAt).toISOString(), kind: 'reminder', ciphertext: item.ciphertext };
  });
  // The whole reminder queue is replaced; scheduled tests stay (064).
  device.queue = [...device.queue.filter((q) => q.kind === 'test'), ...reminders];
  device.updatedAt = deps.now().toISOString();
  await deps.store.put(device);
  return json(200, { ok: true, queued: reminders.length });
}

async function test(req: Req, deps: Deps): Promise<Res> {
  const device = await knownDevice(req, deps);
  const at = parseBody(req.body).at;
  const now = deps.now();
  if (at === undefined) {
    const result = await deps.sender.send(device.subscription, { kind: 'test', sentAt: now.toISOString() }, { ttl: 3600, urgency: 'high' });
    if (result === 'gone') device.paused = true;
    await deps.store.put(device);
    if (result === 'gone') throw new HttpError(410, 'This phone’s push address has expired: subscribe again');
    if (result === 'error') throw new HttpError(502, 'The push service refused the test');
    return json(200, { ok: true, sent: true });
  }
  // 064: a test can be scheduled, so it arrives while the app is closed (M0 step 5).
  const fireAt = typeof at === 'string' ? Date.parse(at) : NaN;
  if (Number.isNaN(fireAt) || fireAt < now.getTime() - 60_000 || fireAt > now.getTime() + MAX_TEST_DELAY_MS) {
    throw new HttpError(400, 'at must be within the next 24 hours');
  }
  device.queue = [...device.queue.filter((q) => q.kind !== 'test'), { id: `test-${fireAt}`, fireAt: new Date(fireAt).toISOString(), kind: 'test' }];
  device.updatedAt = now.toISOString();
  await deps.store.put(device);
  return json(202, { ok: true, scheduledFor: new Date(fireAt).toISOString() });
}

export async function handle(req: Req, deps: Deps): Promise<Res> {
  const headers = cors(req, deps.allowedOrigin);
  const method = req.method.toUpperCase();
  const path = req.path.replace(/\/+$/, '') || '/';
  try {
    if (method === 'OPTIONS') return { status: 204, headers, body: '' };
    let res: Res;
    if (method === 'GET' && path === '/') res = json(200, { ok: true, service: 'atomic-push' });
    else if (method === 'POST' && path === '/' && parseBody(req.body).tick === true) res = json(200, { ok: true, ...(await tick(deps)) });
    else if (method === 'GET' && path === '/vapid-public-key') res = json(200, { key: await deps.sender.publicKey() });
    else if (method === 'POST' && path === '/subscribe') res = await subscribe(req, deps);
    else if (method === 'PUT' && path === '/reminders') res = await putReminders(req, deps);
    else if (method === 'POST' && path === '/test') res = await test(req, deps);
    else throw new HttpError(404, 'Not found');
    return { ...res, headers: { ...res.headers, ...headers } };
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message }, headers);
    console.error('atomic-push: unexpected error', (e as Error).name); // never the payload
    return json(500, { error: 'Internal error' }, headers);
  }
}

/** The every-minute CRON run (§10): due reminders and tests, then the recap window. */
export async function tick(deps: Deps): Promise<{ devices: number; sent: number; paused: number }> {
  const now = deps.now();
  let sent = 0;
  let paused = 0;
  const tokens = await deps.store.list();
  for (const token of tokens) {
    const device = await deps.store.get(token);
    if (!device || device.paused) continue;
    let changed = false;
    let gone = false;

    const due = device.queue.filter((q) => Date.parse(q.fireAt) <= now.getTime());
    for (const item of due) {
      const payload = item.kind === 'test'
        ? { kind: 'test', sentAt: now.toISOString() }
        : { kind: 'reminder', ciphertext: item.ciphertext, sentAt: now.toISOString() };
      const result = await deps.sender.send(device.subscription, payload, { ttl: 3600, urgency: 'high' });
      if (result === 'ok') sent += 1;
      if (result === 'gone') { gone = true; break; }
      // Sent, or failed for more than an hour: either way it leaves the queue.
      if (result === 'ok' || now.getTime() - Date.parse(item.fireAt) > 3600_000) {
        device.queue = device.queue.filter((q) => q !== item);
        changed = true;
      }
    }

    const today = habitDay(now, device.timezone);
    if (!gone && inRecapWindow(now, device.timezone) && device.lastRecapDay !== today) {
      // 025: the recap push carries no data; the app builds the recap from local data.
      const result = await deps.sender.send(device.subscription, { kind: 'recap', sentAt: now.toISOString() }, { ttl: 6 * 3600, urgency: 'normal' });
      if (result === 'gone') gone = true;
      if (result === 'ok') { sent += 1; device.lastRecapDay = today; changed = true; }
    }

    // E1: keep the device and its queue; the app renews the address without the invite code.
    if (gone) { device.paused = true; changed = true; paused += 1; }
    if (changed) await deps.store.put(device);
  }
  return { devices: tokens.length, sent, paused };
}
