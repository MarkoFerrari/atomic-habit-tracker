import type { Device, Store } from './core';

/** In-memory store for tests and local runs. */
export class MemoryStore implements Store {
  readonly devices = new Map<string, Device>();
  async get(token: string) { const d = this.devices.get(token); return d ? structuredClone(d) : null; }
  async put(device: Device) { this.devices.set(device.token, structuredClone(device)); }
  async delete(token: string) { this.devices.delete(token); }
  async list() { return [...this.devices.keys()]; }
}
