// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// SpeedCurrency service worker: opens instantly and works on bad connections.
// App files: show the cached copy right away, refresh it in the background.
// Data, sign-in, AI and payments always go to the network.
const CACHE = 'sc-v39';
const SHELL = ['./', './index.html', './style.css', './app.js', './ready.js', './currency-picker.js', './journal-rope.js', './journal-memory.js', './home-hero.js', './explore-map.js', './explore-swipe.js', './town-guide.js', './profile.js', './news-cover.js', './town-finder.js', './trends.js', './chat-fab.js', './journey-studio.js', './journey-replay.js', './place-comments.js', './admin-plus.js', './avatars.js', './schedule.js', './been-here.js', './journal-thread.js', './shared.js', './postcard.js', './themes.js', './headsups.js', './business.js', './nami-faq.js', './here.js', './journey-pulse.js', './chat-wa.js', './security.js', './onboard.js', './config.js', './icon.svg', './manifest.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const sameOrigin = url.origin === self.location.origin;
  const staticCdn = /(^|\.)(jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname) && !url.pathname.includes('currency-api');
  if (!sameOrigin && !staticCdn) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: sameOrigin });
    const net = fetch(e.request).then((res) => { if (res.ok) c.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
