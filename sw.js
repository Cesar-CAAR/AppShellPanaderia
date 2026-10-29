const CACHE_NAME = 'panaderia-v1';
const assets = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json'
];

// Instalar el Service Worker y guardar en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(assets))
  );
});

// Interceptar peticiones y servir desde caché si no hay red
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});