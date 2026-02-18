/**
 * GasMask Ops — Service Worker
 * Caches static assets only. No API caching, no background sync.
 * Fail-safe: app works normally if SW fails.
 */

const CACHE_NAME = 'gasmask-ops-v1';
const STATIC_ASSETS = [
  '/portal',
  '/manifest.json',
];

// Install: pre-cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Listen for skip waiting message from PwaUpdateToast
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: network-first for everything, fall back to cache for static assets only
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls or Supabase requests
  if (
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.includes('supabase')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
