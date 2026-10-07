// Scaleway Object Storage (S3 API) as the function's memory (062): one small JSON file per phone.
import { AwsClient } from 'aws4fetch';
import type { Device, Store } from './core';

export interface S3Config { bucket: string; region: string; accessKeyId: string; secretAccessKey: string }

export class S3Json {
  private readonly client: AwsClient;
  private readonly base: string;

  constructor(cfg: S3Config) {
    this.client = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, service: 's3', region: cfg.region });
    this.base = `https://s3.${cfg.region}.scw.cloud/${cfg.bucket}`;
  }

  private url(key: string) { return `${this.base}/${key.split('/').map(encodeURIComponent).join('/')}`; }

  async get<T>(key: string): Promise<T | null> {
    const res = await this.client.fetch(this.url(key));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Storage read failed (${res.status})`);
    return (await res.json()) as T;
  }

  async put(key: string, value: unknown): Promise<void> {
    const res = await this.client.fetch(this.url(key), {
      method: 'PUT', body: JSON.stringify(value), headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Storage write failed (${res.status})`);
  }

  async delete(key: string): Promise<void> {
    const res = await this.client.fetch(this.url(key), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`Storage delete failed (${res.status})`);
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const params = new URLSearchParams({ 'list-type': '2', prefix });
      if (token) params.set('continuation-token', token);
      const res = await this.client.fetch(`${this.base}?${params}`);
      if (!res.ok) throw new Error(`Storage list failed (${res.status})`);
      const xml = await res.text();
      for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(decodeXml(m[1]!));
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? decodeXml(/<NextContinuationToken>([^<]+)</.exec(xml)?.[1] ?? '') || undefined : undefined;
    } while (token);
    return keys;
  }
}

function decodeXml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

const PREFIX = 'devices/';

export class S3DeviceStore implements Store {
  constructor(private readonly s3: S3Json) {}
  get(token: string) { return this.s3.get<Device>(`${PREFIX}${token}.json`); }
  put(device: Device) { return this.s3.put(`${PREFIX}${device.token}.json`, device); }
  delete(token: string) { return this.s3.delete(`${PREFIX}${token}.json`); }
  async list() {
    return (await this.s3.list(PREFIX)).filter((k) => k.endsWith('.json')).map((k) => k.slice(PREFIX.length, -'.json'.length));
  }
}
