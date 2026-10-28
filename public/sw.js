// Service worker for the installed app: the game keeps working offline, and
// a new version reaches players by itself, with no reinstall.
//
// - The page (index.html) is fetched from the network first, so every time
//   the app opens online it gets the newest deploy; offline it falls back to
//   the cached copy.
// - Everything else (the game script, icons) is cached as it is first used.
//   The build gives the script a new file name every release, so an old
//   cached script is never mistaken for a new one.
// - Old caches are dropped when a new worker takes over.
const CACHE = 'atc-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon-192.png', './icon-512.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('./', copy));
      return res;
    }).catch(() => caches.match('./')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
