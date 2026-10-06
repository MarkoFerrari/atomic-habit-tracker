// One IndexedDB database for the whole app (020). The service worker opens it too,
// so the upgrade steps live in src/sw/sw.js as well: keep both in step.
export const DB_NAME = 'atomic';
export const DB_VERSION = 1;

export type DiagnosticKind = 'record' | 'push' | 'notification' | 'persist';
export interface Diagnostic {
  id?: number;
  kind: DiagnosticKind;
  at: string; // ISO instant
  installed: boolean | null; // null when written by the service worker
  browser: string;
  note: string;
}
