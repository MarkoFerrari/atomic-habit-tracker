// Web Push with VAPID (RFC 8292) through the `web-push` library.
// 063: the function makes its own VAPID key pair on first use and keeps it in its private bucket,
// so the private key is never typed, pasted or logged by anyone. The app fetches the public half.
import webpush from 'web-push';
import type { PushSubscriptionData, SendResult, Sender } from './core';
import type { S3Json } from './s3-store';

interface VapidKeys { publicKey: string; privateKey: string; createdAt: string }
const VAPID_KEY = 'config/vapid.json';

export class WebPushSender implements Sender {
  private keys: Promise<VapidKeys> | null = null;

  constructor(private readonly s3: S3Json, private readonly subject: string) {}

  private load(): Promise<VapidKeys> {
    this.keys ??= (async () => {
      const existing = await this.s3.get<VapidKeys>(VAPID_KEY);
      if (existing) return existing;
      const fresh = { ...webpush.generateVAPIDKeys(), createdAt: new Date().toISOString() };
      await this.s3.put(VAPID_KEY, fresh);
      // Two cold starts could race: whichever pair landed last is the one everyone uses.
      return (await this.s3.get<VapidKeys>(VAPID_KEY)) ?? fresh;
    })().catch((e) => { this.keys = null; throw e; });
    return this.keys;
  }

  async publicKey(): Promise<string> {
    return (await this.load()).publicKey;
  }

  async send(sub: PushSubscriptionData, payload: Record<string, unknown>, opts: { ttl: number; urgency: 'normal' | 'high' }): Promise<SendResult> {
    const { publicKey, privateKey } = await this.load();
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload), {
        vapidDetails: { subject: this.subject, publicKey, privateKey },
        TTL: opts.ttl,
        urgency: opts.urgency,
      });
      return 'ok';
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return 'gone';
      console.error('atomic-push: push service refused', status ?? 'no status'); // status only, never the payload
      return 'error';
    }
  }
}
