const CACHE_NAME = 'secretx-v1';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/firebase.js',
  './js/auth.js',
  './js/chat.js',
  './js/groups.js',
  './assets/images/icon-192.png',
  './assets/images/icon-512.png'
];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
