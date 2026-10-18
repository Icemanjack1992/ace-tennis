// Ace Tennis service worker: app shell works offline and opens instantly; data always goes to the network.
const CACHE = 'ace-v22';
const EXT = 'ace-ext-v1'; // supabase library from jsdelivr and fonts: saved once, then opened from the phone
const SHELL = [
  './', './index.html', './css/app.css', './js/config.js', './js/app.js', './js/ui.js', './js/views.js', './js/terms.js', './js/regions.js', './js/courts.js', './js/share.js',
  './js/rating.js', './js/logic.js', './js/booking.js', './js/store-demo.js', './js/store-supabase.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== EXT).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Shell: stale-while-revalidate. Supabase API: always network.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(EXT).then(async (cache) => {
      const cached = await cache.match(e.request);
      const fresh = fetch(e.request).then((res) => { if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone()); return res; }).catch(() => cached);
      return cached || fresh;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.txt')) return; // always from the network: tells the app about updates
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => cached);
    return cached || fresh;
  }));
});

// Push: a message about a booking, a challenge or a match. Tap → the app opens on the right screen.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Ace Tennis', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Ace Tennis', {
    body: d.body || '', icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: d.tag || undefined,
    data: { url: d.url || '#/home' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.url) || '#/home';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const base = self.registration.scope;
    for (const c of list) {
      if (c.url.startsWith(base)) { c.focus(); return c.navigate ? c.navigate(base + hash) : undefined; }
    }
    return self.clients.openWindow(base + hash);
  }));
});
