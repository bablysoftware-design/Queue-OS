// ============================================================
// service-worker.js — WaitMate PWA
// Version: v6 — aggressive cache invalidation
// ============================================================

const CACHE_VERSION = 'waitmate-v6';
const STATIC_FILES  = [
  '/',
  '/index.html',
  '/customer.html',
  '/admin.html',
  '/manifest.json',
  '/i18n.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// Install: cache static files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(STATIC_FILES).catch(() => {}))
      .then(() => self.skipWaiting()) // take over immediately
  );
});

// Activate: delete ALL old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim()) // take control of all tabs
  );
});

// Fetch strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET and non-http requests entirely
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // 2. API calls (Worker + Supabase) → ALWAYS network, never cache
  if (url.hostname.includes('workers.dev') ||
      url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(request));
    return;
  }

  // 3. HTML pages → Network first, fall back to cache
  //    This ensures users always get the latest HTML
  if (request.headers.get('Accept')?.includes('text/html') ||
      url.pathname === '/' ||
      url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then(c => c || caches.match('/index.html')))
    );
    return;
  }

  // 4. Static assets (JS, CSS, images) → Cache first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// Push notifications
self.addEventListener('push', event => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'WaitMate', {
        body:    data.body || '',
        icon:    '/icons/icon-192.png',
        badge:   '/icons/icon-192.png',
        tag:     data.tag || 'waitmate',
        data:    data,
        vibrate: [200, 100, 200],
      })
    );
  } catch(e) {}
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/customer.html'));
});
