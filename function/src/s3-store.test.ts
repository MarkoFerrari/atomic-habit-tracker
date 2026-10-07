import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { S3DeviceStore, S3Json } from './s3-store';
import type { Device } from './core';

// A tiny in-memory S3: enough of GET/PUT/DELETE/ListObjectsV2 to check URLs, signing and parsing.
function fakeS3() {
  const objects = new Map<string, string>();
  const calls: { method: string; url: string; signed: boolean }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    calls.push({ method: request.method, url: url.toString(), signed: (request.headers.get('authorization') ?? '').startsWith('AWS4-HMAC-SHA256') });
    const key = decodeURIComponent(url.pathname.replace(/^\/atomic-test\/?/, ''));
    if (request.method === 'GET' && url.searchParams.get('list-type') === '2') {
      const prefix = url.searchParams.get('prefix') ?? '';
      const keys = [...objects.keys()].filter((k) => k.startsWith(prefix));
      return new Response(`<ListBucketResult>${keys.map((k) => `<Contents><Key>${k}</Key></Contents>`).join('')}<IsTruncated>false</IsTruncated></ListBucketResult>`);
    }
    if (request.method === 'GET') return objects.has(key) ? new Response(objects.get(key)) : new Response('', { status: 404 });
    if (request.method === 'PUT') { objects.set(key, await request.text()); return new Response(''); }
    if (request.method === 'DELETE') { objects.delete(key); return new Response(null, { status: 204 }); }
    return new Response('', { status: 405 });
  });
  return { objects, calls, fetchMock };
}

let s3: ReturnType<typeof fakeS3>;
beforeEach(() => { s3 = fakeS3(); vi.stubGlobal('fetch', s3.fetchMock); });
afterEach(() => vi.unstubAllGlobals());

const device = (token: string): Device => ({
  token, subscription: { endpoint: 'https://web.push.apple.com/x', keys: { p256dh: 'p', auth: 'a' } },
  timezone: 'Europe/Athens', queue: [], createdAt: '', updatedAt: '', rate: { minute: '', count: 0 },
});

describe('S3DeviceStore (062)', () => {
  it('stores one signed JSON object per device on the Scaleway endpoint', async () => {
    const store = new S3DeviceStore(new S3Json({ bucket: 'atomic-test', region: 'fr-par', accessKeyId: 'AK', secretAccessKey: 'SK' }));
    await store.put(device('tok1'));
    await store.put(device('tok2'));
    expect(await store.list()).toEqual(['tok1', 'tok2']);
    expect((await store.get('tok1'))?.timezone).toBe('Europe/Athens');
    expect(await store.get('nope')).toBeNull();
    await store.delete('tok1');
    expect(await store.list()).toEqual(['tok2']);
    expect(s3.calls.every((c) => c.signed && c.url.startsWith('https://s3.fr-par.scw.cloud/atomic-test'))).toBe(true);
    expect([...s3.objects.keys()]).toEqual(['devices/tok2.json']);
  });
});
