// 121: turning reminders on takes one tap and no invite code. iOS shows its own question only in answer to a tap,
// and only once, so the app asks at a moment that explains itself: saving a habit with Nudge on (or Today's banner).
import { askPermission, permission, PUSH_URL, pushSupported, turnOnPush, type Permission } from './notifications';
import { syncReminders } from './reminders';

/** Can this phone be asked yet? Push is set up, supported here, and the iPhone hasn't been asked before. */
export function canAsk(): boolean {
  return !!PUSH_URL && pushSupported() && permission() === 'default';
}

/**
 * The iPhone's question, then this phone joins the push function and gets its reminders.
 * Call it straight from a tap: the question has to start before anything else is awaited.
 */
export async function enablePush(asked: Promise<Permission> = askPermission()): Promise<Permission> {
  const p = await asked;
  if (p !== 'granted') return p;
  await turnOnPush();
  await syncReminders();
  return p;
}
