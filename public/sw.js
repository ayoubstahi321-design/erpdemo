// Kill-switch service worker: clears all stale caches and stops intercepting requests.
// The previous SW (azmol-erp-v1) was caching JS bundles indefinitely, preventing new
// code from loading after deploys. This SW removes all those caches and does nothing else.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// No fetch handler — all HTTP requests go through the browser normally.
// Cache-Control headers from vercel.json now control freshness directly.
