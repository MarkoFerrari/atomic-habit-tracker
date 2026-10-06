/* ATOMIC service worker. Hand-written on purpose (CLAUDE.md §3): every cached file is listed. */
const PRECACHE = self.__PRECACHE__;
const VERSION = self.__VERSION__;
const CACHE = `atomic-${VERSION}`;
const scopeUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map(scopeUrl))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('atomic-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
  if (event.data === 'version') event.source?.postMessage({ version: VERSION });
});

// Offline first: same-origin GETs come from the cache, pages fall back to the cached app shell.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(scopeUrl('index.html'))));
    return;
  }
  event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
});

// --- Push (016, 021, 025, 027) ---------------------------------------------------------------
// Same database as src/data/db.ts. Keep the upgrade steps identical.
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('atomic', 1);
    req.onupgradeneeded = (e) => {
      const database = req.result;
      if (e.oldVersion < 1) {
        const store = database.createObjectStore('diagnostics', { keyPath: 'id', autoIncrement: true });
        store.createIndex('at', 'at');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function logArrival(kind, note) {
  const database = await openDb();
  await new Promise((resolve, reject) => {
    const tx = database.transaction('diagnostics', 'readwrite');
    tx.objectStore('diagnostics').add({ kind, at: new Date().toISOString(), installed: null, browser: 'service worker', note });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

const COPY = {
  recap: { title: 'Close the day', body: 'Answer today’s habits.' },
  test: { title: 'ATOMIC test', body: 'Push works. This arrived while the app was closed.' },
};

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const kind = data.kind === 'recap' ? 'recap' : data.kind === 'reminder' ? 'reminder' : 'test';
  const copy = kind === 'reminder' ? { title: 'Reminder', body: 'Open ATOMIC to see it.' } : COPY[kind]; // 021: decryption lands at M3
  event.waitUntil(
    Promise.all([
      logArrival('push', `${kind} push received (sent ${data.sentAt ?? 'unknown'})`),
      self.registration.showNotification(copy.title, { body: copy.body, icon: scopeUrl('icons/icon-192.png'), tag: kind, data: { kind } }),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow(self.registration.scope);
    }),
  );
});
