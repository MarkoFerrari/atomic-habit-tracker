// Notifications and Web Push (016, 021, 059, CLAUDE.md §10).
// The push function's URL comes from the build (the Pages deploy looks it up on Scaleway).
// Its VAPID public key is fetched from the function itself (063), so no key lives in this repo.
import { db } from '../data/db';
import type { PushDevice } from '../data/schema';
import { getSettings, updateSettings } from '../data/settings';

export type Permission = NotificationPermission | 'unsupported';

export const PUSH_URL: string | undefined = import.meta.env.VITE_PUSH_URL || undefined;

/** 069: the 22:30 recap push is off unless switched on in Notifications (H46); habits remind at their start. */
export async function recapWanted(): Promise<boolean> {
  return (await getSettings()).recapPush ?? false;
}

export function permission(): Permission {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function askPermission(): Promise<Permission> {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

export async function showLocalTest(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('ATOMIC test', { body: 'Notifications can be shown on this iPhone.', tag: 'local-test' });
}

function base64UrlToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** This phone's record with the push function (059): a random token, made once, kept in IndexedDB. */
export async function pushDevice(): Promise<PushDevice> {
  const database = await db();
  const existing = (await database.get('settings', 'push-device')) as PushDevice | undefined;
  if (existing) return existing;
  const fresh: PushDevice = { key: 'push-device', token: randomToken(), subscribedAt: null };
  await database.put('settings', fresh);
  return fresh;
}

export async function call(path: string, method: string, token: string, body?: unknown): Promise<Record<string, unknown>> {
  if (!PUSH_URL) throw new Error('The push service isn’t set up yet');
  let res: Response;
  try {
    res = await fetch(`${PUSH_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Device-Token': token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Couldn’t reach the push service. Check the connection and try again.');
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `Push service error ${res.status}`);
  return data;
}

/**
 * Subscribes this phone and registers it with the push function. A new phone needs the invite code (059);
 * a known one just renews its address and time zone (E1, E6).
 */
export async function turnOnPush(invite: string): Promise<void> {
  const device = await pushDevice();
  const { key } = await call('/vapid-public-key', 'GET', device.token);
  if (typeof key !== 'string') throw new Error('The push service sent no key');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, key)) { await sub.unsubscribe(); sub = null; }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(key) });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const data = await call('/subscribe', 'POST', device.token, { subscription: sub.toJSON(), timezone, invite: invite.trim() || undefined, recap: await recapWanted() });
  const latest = await pushDevice(); // a reminder sync may have written to it meanwhile
  // 069: keep only what the function confirmed, so an older function that ignored the flag gets asked again.
  const recap = typeof data.recap === 'boolean' ? data.recap : undefined;
  await (await db()).put('settings', { ...latest, subscribedAt: new Date().toISOString(), recap });
}

function sameKey(sub: PushSubscription, key: string): boolean {
  const current = sub.options.applicationServerKey;
  if (!current) return false;
  const a = new Uint8Array(current);
  const b = base64UrlToBytes(key);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Asks the push function for a test push (E1); with a delay it arrives while the app is closed (064). */
export async function sendTestPush(delayMinutes = 0): Promise<string | null> {
  const device = await pushDevice();
  const at = delayMinutes > 0 ? new Date(Date.now() + delayMinutes * 60_000).toISOString() : undefined;
  const data = await call('/test', 'POST', device.token, at ? { at } : {});
  return typeof data.scheduledFor === 'string' ? data.scheduledFor : null;
}

/** H46: the recap push on or off, told to the push function at once (069). */
export async function setRecapPush(on: boolean): Promise<void> {
  await updateSettings({ recapPush: on });
  if ((await pushDevice()).subscribedAt && permission() === 'granted') await turnOnPush('');
}

/** The last push this phone logged (027, E1): the service worker writes one line per arrival. */
export async function lastPushArrival(): Promise<string | null> {
  const database = await db();
  let cursor = await database.transaction('diagnostics').store.index('at').openCursor(null, 'prev');
  while (cursor) {
    if (cursor.value.kind === 'push') return cursor.value.at;
    cursor = await cursor.continue();
  }
  return null;
}
