// ============================================================
// service-worker.js — Saf Queue PWA Service Worker
// Strategy: Cache-First for assets, Network-First for API
// ============================================================

const CACHE_NAME   = 'saf-queue-v1';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

// ── Install: cache static shell ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: route strategy ─────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls → Network-First (don't cache API responses)
  if (url.pathname.startsWith('/tokens') ||
      url.pathname.startsWith('/shops')  ||
      url.pathname.startsWith('/subscriptions')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets → Cache-First
  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    return caches.match(request) || new Response(
      JSON.stringify({ success: false, error: 'Offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
