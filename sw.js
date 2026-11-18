/* Magic, the Soloing — offline support.
   The game and its card data are kept on the device so it opens instantly and plays offline.
   A new version of the site replaces these caches the next time it is opened online. */
const VERSION = '20261118073844';
const CORE = 'core-' + VERSION;
const FONTS = 'fonts-v1';
const ART = 'art-v1';
const ART_MAX = 500;
const CORE_FILES = ['./', './index.html', './data.json', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CORE).then(c => c.addAll(CORE_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('core-') && k !== CORE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function cacheFirst(cacheName, request, fetchOpts) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreSearch: cacheName === CORE });
  if (hit) return hit;
  const res = await fetch(request, fetchOpts);
  if (res && (res.ok || res.type === 'opaque')) {
    cache.put(request, res.clone());
    if (cacheName === ART) trim(cache);
  }
  return res;
}
let trimming = false;
async function trim(cache) {
  if (trimming) return;
  trimming = true;
  try {
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - ART_MAX; i++) await cache.delete(keys[i]);
  } finally { trimming = false; }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // the page itself: from the device, falling back to the network
    if (req.mode === 'navigate') {
      event.respondWith(caches.open(CORE).then(c => c.match('./index.html')).then(hit => hit || fetch(req)).catch(() => caches.match('./index.html')));
      return;
    }
    if (/\.(json|webmanifest|png)$/.test(url.pathname)) { event.respondWith(cacheFirst(CORE, req)); return; }
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { event.respondWith(cacheFirst(FONTS, req)); return; }
  if (url.hostname === 'cards.scryfall.io') { event.respondWith(cacheFirst(ART, req)); return; }
  // Scryfall's search API is cached by the game itself
});
