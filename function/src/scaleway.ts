// Scaleway Serverless Functions adapter (Node runtime). Handler: "handler.handle".
// HTTP calls and the every-minute CRON trigger (POST / with { "tick": true }) both land here.
import { handle as coreHandle, type Deps } from './core';
import { S3DeviceStore, S3Json } from './s3-store';
import { WebPushSender } from './web-push-sender';

interface ScalewayEvent {
  httpMethod?: string;
  path?: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

let deps: Deps | null = null;
function getDeps(): Deps {
  if (deps) return deps;
  const s3 = new S3Json({
    bucket: env('ATOMIC_BUCKET'),
    region: env('ATOMIC_REGION'),
    accessKeyId: env('ATOMIC_S3_ACCESS_KEY'),
    secretAccessKey: env('ATOMIC_S3_SECRET_KEY'),
  });
  const appUrl = env('ATOMIC_APP_URL'); // e.g. https://markoferrari.github.io/atomic-habit-tracker/
  deps = {
    store: new S3DeviceStore(s3),
    sender: new WebPushSender(s3, appUrl), // VAPID subject: the app's URL, so no email sits in this public repo
    inviteCode: env('ATOMIC_INVITE_CODE'),
    allowedOrigin: new URL(appUrl).origin,
    now: () => new Date(),
  };
  return deps;
}

export async function handle(event: ScalewayEvent): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(event.headers ?? {})) headers[k.toLowerCase()] = v;
  const raw = event.body ?? '';
  const body = event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;
  try {
    const res = await coreHandle({ method: event.httpMethod ?? 'GET', path: event.path ?? '/', headers, body }, getDeps());
    return { statusCode: res.status, headers: res.headers, body: res.body };
  } catch (e) {
    console.error('atomic-push: setup error', (e as Error).message); // e.g. a missing variable name, never a value
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: '{"error":"Not configured"}' };
  }
}
