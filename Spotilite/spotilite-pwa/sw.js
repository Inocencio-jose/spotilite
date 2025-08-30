// Simple cache-first Service Worker for app shell
const CACHE_NAME = 'spotilite-shell-v1';
const ASSETS = [
  './',
  './index.html',
  './about.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-192.png',
  './icons/orion logo.jpg',
  './icons/eu.jpg',
  './icons/ritchie2.jpg',
  './icons/profile.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // App shell: cache-first
  if (ASSETS.includes(url.pathname) || url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req))
    );
    return;
  }
  // For external requests (like images), network-first fallback to cache
  event.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      return res;
    }).catch(() => caches.match(req))
  );
});
