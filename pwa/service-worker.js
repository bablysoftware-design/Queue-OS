// ============================================================
// service-worker.js — Saf Queue PWA v6
// Handles: caching + push notifications + notification actions
// ============================================================

const CACHE   = 'saf-queue-v7';
const STATIC  = ['/', '/index.html', '/admin.html', '/customer.html', '/manifest.json', '/i18n.js', '/icons/icon-192.png', '/icons/icon-512.png'];
const WORKER_HOST = 'saf-queue-worker.byker-software.workers.dev';

self.addEventListener('install',  e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {}))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Never intercept API calls or non-http
  if (url.hostname === WORKER_HOST || url.hostname.includes('supabase') || !url.protocol.startsWith('http')) return;
  if (e.request.method !== 'GET') return;

  // For HTML page navigations: network-first so ?shop= params and fresh pages always work
  const isHTMLNav = e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').includes('text/html');

  if (isHTMLNav) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok && url.origin === self.location.origin) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => {
        // Network failed — serve from cache if available, else index
        return caches.match(e.request)
          .then(cached => cached || caches.match(url.pathname))
          .then(cached => cached || caches.match('/index.html'));
      })
    );
    return;
  }

  // For all other assets: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && url.origin === self.location.origin) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      });
    }).catch(() => null)
  );
});

// ── PUSH NOTIFICATION HANDLER ─────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;

  let data;
  try { data = e.data.json(); }
  catch { data = { title: 'Saf Queue', body: e.data.text() }; }

  const options = {
    body:               data.body,
    icon:               data.icon  || '/icons/icon-192.png',
    badge:              data.badge || '/icons/icon-192.png',
    tag:                data.tag   || 'saf-queue',
    requireInteraction: data.requireInteraction || false,
    vibrate:            data.vibrate || [200, 100, 200],
    data:               data.data  || {},
    actions:            data.actions || [],
    silent:             false,
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── NOTIFICATION CLICK HANDLER ────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();

  const action  = e.action;
  const payload = e.notification.data || {};

  // Handle action buttons
  if (action === 'on_way' || action === 'arriving') {
    // Just close — customer acknowledged
    return;
  }

  if (action === 'delay') {
    // Send delay request to worker
    if (payload.tokenId && payload.shopId) {
      fetch(`https://${WORKER_HOST}/push/delay`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token_id: payload.tokenId, shop_id: payload.shopId }),
      }).catch(() => {});
    }
    return;
  }

  // Default: open customer tracking page
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const target = `/customer.html${payload.shopId ? '?shop=' + payload.shopId : ''}`;
      for (const client of clientList) {
        if (client.url.includes('customer.html') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});

// ── NOTIFICATION CLOSE HANDLER ────────────────────────────────
self.addEventListener('notificationclose', () => {
  // Could track dismissals in analytics later
});
