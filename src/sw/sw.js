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
// Same database as src/data/db.ts. The worker opens whatever version exists (no number), so it never
// blocks the app's upgrades; it only creates the diagnostics store on a brand-new install.
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('atomic');
    req.onupgradeneeded = (e) => {
      const database = req.result;
      if (e.oldVersion < 1 && !database.objectStoreNames.contains('diagnostics')) {
        const store = database.createObjectStore('diagnostics', { keyPath: 'id', autoIncrement: true });
        store.createIndex('at', 'at');
      }
    };
    req.onsuccess = () => {
      const database = req.result;
      database.onversionchange = () => database.close(); // let the app upgrade
      resolve(database);
    };
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
  test: { title: 'Atomic test', body: 'Push works. This arrived while the app was closed.' },
  reminder: { title: 'A habit starts now', body: 'Open Atomic to see it.' }, // only if decryption fails
};

// 021: reminder text arrives encrypted. The key lives only in this phone's IndexedDB, as raw bytes
// (src/push/reminders.ts makes it). Format: base64url(iv ‖ AES-GCM ciphertext) of { t, b, g }.
function fromB64Url(text) {
  const pad = '='.repeat((4 - (text.length % 4)) % 4);
  return Uint8Array.from(atob((text + pad).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
}
async function readReminder(ciphertext) {
  const database = await openDb();
  if (!database.objectStoreNames.contains('settings')) return null;
  const record = await new Promise((resolve, reject) => {
    const req = database.transaction('settings').objectStore('settings').get('reminder-key');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!record?.raw) return null;
  const key = await crypto.subtle.importKey('raw', record.raw, 'AES-GCM', false, ['decrypt']);
  const bytes = fromB64Url(ciphertext);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return JSON.parse(new TextDecoder().decode(plain));
}

async function notificationFor(kind, data) {
  if (kind !== 'reminder') return { ...COPY[kind], tag: kind };
  try {
    const text = typeof data.ciphertext === 'string' ? await readReminder(data.ciphertext) : null;
    if (text?.t) return { title: text.t, body: text.b ?? '', tag: text.g ?? 'reminder' };
  } catch { /* fall back to the generic copy */ }
  return { ...COPY.reminder, tag: 'reminder' };
}

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const kind = data.kind === 'recap' ? 'recap' : data.kind === 'reminder' ? 'reminder' : 'test';
  event.waitUntil(
    Promise.all([
      logArrival('push', `${kind} push received (sent ${data.sentAt ?? 'unknown'})`).catch(() => {}),
      notificationFor(kind, data).then((n) =>
        self.registration.showNotification(n.title, { body: n.body, icon: scopeUrl('icons/icon-192.png'), tag: n.tag, data: { kind, tag: n.tag } })),
    ]),
  );
});

// The recap notification opens the recap (F5); the app builds it from local data (025).
// A reminder opens its event (H29: "from any event or a reminder push"); a habit's opens Today.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data ?? {};
  const recap = data.kind === 'recap';
  const tag = data.kind === 'reminder' && typeof data.tag === 'string' && data.tag.includes('|') ? data.tag : null;
  const hash = recap ? '#recap' : tag ? `#event=${encodeURIComponent(tag)}` : '';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(self.registration.scope));
      if (open) {
        if (recap) open.postMessage({ type: 'open-recap' });
        if (tag) open.postMessage({ type: 'open-event', tag });
        return open.focus();
      }
      return self.clients.openWindow(self.registration.scope + hash);
    }),
  );
});
