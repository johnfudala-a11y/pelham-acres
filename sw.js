// Pelham Acres service worker: network-first so updates show up right away,
// with a cached copy so the game still opens offline.
const CACHE = 'pelham-acres-v40';
const FILES = ['./', 'index.html', 'css/style.css', 'js/main.js', 'js/game.js', 'js/render.js', 'js/data.js', 'js/audio.js', 'js/story.js', 'js/quests.js', 'js/expedition.js', 'js/nav.js', 'js/extras.js', 'js/cloud.js', 'js/roads.js', 'js/train.js','manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // music streams in pieces (range requests); leave it to the browser's own cache
  if (url.pathname.includes('/music/')) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
