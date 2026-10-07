// 069 + 021: a push when each habit starts, and each event's own reminders (M3). The phone plans the next 14 days of reminders, encrypts each
// one's text with a key that never leaves the phone, and hands the push function only the ciphertext and
// the time to send it. The service worker (src/sw/sw.js) decrypts it when the push arrives.
import { db } from '../data/db';
import type { ReminderKey } from '../data/schema';
import { habitDayOf } from '../domain/day';
import { planReminders } from '../domain/reminders';
import { call, permission, pushDevice, PUSH_URL, recapWanted, turnOnPush } from './notifications';

/** What a reminder carries once decrypted. Short keys keep the ciphertext small. */
export interface ReminderText { t: string; b: string; g: string }

const IV_BYTES = 12;
const MAX_TITLE = 200; // keeps the ciphertext well under the function's 2048-character limit

const toB64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64Url = (text: string) => {
  const pad = '='.repeat((4 - (text.length % 4)) % 4);
  return Uint8Array.from(atob((text + pad).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
};

/**
 * The reminder key: 256 random bits, made once, kept in IndexedDB as raw bytes. Raw bytes rather than a
 * stored CryptoKey, so the service worker of any browser's Home Screen app can read it back (058).
 */
export async function reminderKey(): Promise<CryptoKey> {
  const database = await db();
  let record = (await database.get('settings', 'reminder-key')) as ReminderKey | undefined;
  if (!record) {
    record = { key: 'reminder-key', raw: crypto.getRandomValues(new Uint8Array(32)) };
    await database.put('settings', record);
  }
  return crypto.subtle.importKey('raw', record.raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** AES-GCM; the output is base64url(iv ‖ ciphertext). The service worker reverses exactly this. */
export async function seal(key: CryptoKey, text: ReminderText): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plain = new TextEncoder().encode(JSON.stringify(text));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  const out = new Uint8Array(IV_BYTES + sealed.length);
  out.set(iv);
  out.set(sealed, IV_BYTES);
  return toB64Url(out);
}

export async function unseal(key: CryptoKey, ciphertext: string): Promise<ReminderText> {
  const bytes = fromB64Url(ciphertext);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES) }, key, bytes.slice(IV_BYTES));
  return JSON.parse(new TextDecoder().decode(plain)) as ReminderText;
}

let running: Promise<number | null> | null = null;
let again = false;

/**
 * Replaces the push function's queue with the next 14 days of reminders. Runs whenever Today loads or an
 * answer changes, so a habit answered early sends no reminder. Returns how many were queued, or null when
 * this phone has no push (a browser tab, notifications off, never subscribed).
 */
export function syncReminders(now = new Date()): Promise<number | null> {
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      let result = await syncOnce(now);
      while (again) { again = false; result = await syncOnce(new Date()); }
      return result;
    } finally { running = null; }
  })();
  return running;
}

async function syncOnce(now: Date): Promise<number | null> {
  if (!PUSH_URL || permission() !== 'granted') return null;
  let device = await pushDevice();
  if (!device.subscribedAt) return null;
  // 069: tell the function about the recap choice once (a phone subscribed before 069 still gets the recap).
  if (device.recap !== (await recapWanted())) {
    try { await turnOnPush(''); device = await pushDevice(); } catch { /* the next open tries again */ }
  }
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = habitDayOf(now, zone);
  const database = await db();
  const [events, cals, answers, key] = await Promise.all([database.getAll('events'), database.getAll('calendars'), database.getAll('answers'), reminderKey()]);
  const answered = new Set(answers.filter((a) => a.occurrence >= today).map((a) => a.key));
  const habitCalendars = new Set(cals.filter((c) => c.trackAsHabits).map((c) => c.id));
  const plan = planReminders(events, habitCalendars, answered, today, now, zone);
  const items = await Promise.all(plan.map(async (r) => ({
    id: r.id,
    fireAt: r.fireAt,
    ciphertext: await seal(key, { t: r.title.slice(0, MAX_TITLE), b: r.body, g: r.tag }),
  })));
  await call('/reminders', 'PUT', device.token, { items });
  await database.put('settings', { ...(await pushDevice()), lastReminderSync: new Date().toISOString() });
  return items.length;
}
