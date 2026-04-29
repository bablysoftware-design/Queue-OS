// ============================================================
// src/index.js — Cloudflare Worker Entry Point
// Clean URL-based router. Add new routes here only.
// ============================================================

import { handleVerify, handleMessage }          from './routes/webhook.js';
import { createTokenHandler, nextTokenHandler,
         getQueueHandler }                      from './routes/tokens.js';
import { createShopHandler, loginShopHandler,
         toggleShopHandler, getShopHandler }    from './routes/shops.js';
import { assignPlanHandler, getSubscriptionHandler,
         listShopsAdminHandler }                from './routes/subscriptions.js';
import { expireStaleSubscriptions }             from './services/subscriptionService.js';
import { createClient }                         from './utils/db.js';
import { preflight, notFound }                  from './utils/response.js';

// ──────────────────────────────────────────────────────────────
// ROUTE TABLE
// Order matters: more specific paths first
// ──────────────────────────────────────────────────────────────
const ROUTES = [
  // WhatsApp Webhook
  { method: 'GET',   path: '/webhook',              handler: handleVerify },
  { method: 'POST',  path: '/webhook',              handler: handleMessage },

  // Tokens / Queue
  { method: 'POST',  path: '/tokens',               handler: createTokenHandler },
  { method: 'POST',  path: '/tokens/next',          handler: nextTokenHandler },
  { method: 'GET',   path: '/tokens/queue',         handler: getQueueHandler },

  // Shops
  { method: 'POST',  path: '/shops',                handler: createShopHandler },
  { method: 'POST',  path: '/shops/login',          handler: loginShopHandler },
  { method: 'PATCH', path: '/shops/:id/toggle',     handler: toggleShopHandler },
  { method: 'GET',   path: '/shops/:id',            handler: getShopHandler },

  // Subscriptions
  { method: 'GET',   path: '/subscriptions',        handler: getSubscriptionHandler },

  // Admin
  { method: 'POST',  path: '/admin/assign-plan',    handler: assignPlanHandler },
  { method: 'GET',   path: '/admin/shops',          handler: listShopsAdminHandler },
];

// ──────────────────────────────────────────────────────────────
// ROUTER
// ──────────────────────────────────────────────────────────────
function matchRoute(method, pathname) {
  for (const route of ROUTES) {
    if (route.method !== method) continue;

    // Convert pattern like /shops/:id/toggle → regex
    const pattern = route.path.replace(/:[^/]+/g, '[^/]+');
    const regex   = new RegExp(`^${pattern}$`);

    if (regex.test(pathname)) return route.handler;
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// FETCH HANDLER — HTTP requests
// ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url      = new URL(request.url);
    const method   = request.method;
    const pathname = url.pathname;

    // Handle CORS preflight
    if (method === 'OPTIONS') return preflight();

    const handler = matchRoute(method, pathname);
    if (!handler) return notFound(`Route not found: ${method} ${pathname}`);

    return handler(request, env, ctx);
  },

  // ──────────────────────────────────────────────────────────
  // SCHEDULED HANDLER — Runs daily via cron (wrangler.toml)
  // Expires stale subscriptions & deactivates shops
  // ──────────────────────────────────────────────────────────
  async scheduled(event, env, ctx) {
    console.log('⏰ Cron: expiring stale subscriptions...');
    const db = createClient(env);
    await expireStaleSubscriptions(db);
    console.log('✅ Cron: done');
  },
};
