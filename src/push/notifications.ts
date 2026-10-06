// Notifications for build test 0. Real push subscription needs the push host (M0 part B).
export type Permission = NotificationPermission | 'unsupported';

export const VAPID_PUBLIC_KEY: string | undefined = import.meta.env.VITE_VAPID_PUBLIC_KEY || undefined;

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

export async function subscribe(): Promise<PushSubscriptionJSON> {
  if (!VAPID_PUBLIC_KEY) throw new Error('No push host yet');
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) }));
  return sub.toJSON();
}
