const STATIC_CACHE_NAME = 'cronometro-parlante-static-v2';
const DYNAMIC_CACHE_NAME = 'cronometro-parlante-dynamic-v2';

// Ahora solo necesitamos cachear el index.html y el manifest.json
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => {
      console.log('Precaching App Shell');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Para el app shell, ir a la caché primero.
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname === '/') {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        return cachedResponse || fetch(request).then(networkResponse => {
          // Si no está en caché (poco probable), cachearlo dinámicamente.
          return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Para todo lo demás (imágenes, fuentes, sonidos), usar una estrategia de "stale-while-revalidate".
  // Esto sirve desde la caché para velocidad, pero actualiza la caché en segundo plano.
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      const networkFetch = fetch(request).then(networkResponse => {
        return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
          cache.put(request, networkResponse.clone());
          return networkResponse;
        });
      });
      // Devolver la respuesta de la caché si existe, si no, esperar a la red.
      return cachedResponse || networkFetch;
    })
  );
});
