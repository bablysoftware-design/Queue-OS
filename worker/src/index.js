// ============================================================
// src/index.js — Cloudflare Worker Entry Point
// ============================================================

import { handleVerify, handleMessage }               from './routes/webhook.js';
import { createTokenHandler, nextTokenHandler,
         getQueueHandler }                           from './routes/tokens.js';
import { createShopHandler, loginShopHandler,
         toggleShopHandler, getShopHandler,
         deleteShopHandler, activateShopHandler }    from './routes/shops.js';
import { assignPlanHandler, getSubscriptionHandler,
         listShopsAdminHandler }                     from './routes/subscriptions.js';
import { expireStaleSubscriptions }                  from './services/subscriptionService.js';
import { createClient }                              from './utils/db.js';
import { preflight, notFound }                       from './utils/response.js';

const ROUTES = [
  { method: 'GET',    path: '/webhook',                  handler: handleVerify },
  { method: 'POST',   path: '/webhook',                  handler: handleMessage },

  { method: 'POST',   path: '/tokens',                   handler: createTokenHandler },
  { method: 'POST',   path: '/tokens/next',              handler: nextTokenHandler },
  { method: 'GET',    path: '/tokens/queue',             handler: getQueueHandler },

  { method: 'POST',   path: '/shops',                    handler: createShopHandler },
  { method: 'POST',   path: '/shops/login',              handler: loginShopHandler },
  { method: 'PATCH',  path: '/shops/:id/toggle',         handler: toggleShopHandler },
  { method: 'GET',    path: '/shops/:id',                handler: getShopHandler },

  { method: 'GET',    path: '/subscriptions',            handler: getSubscriptionHandler },

  { method: 'POST',   path: '/admin/assign-plan',        handler: assignPlanHandler },
  { method: 'GET',    path: '/admin/shops',              handler: listShopsAdminHandler },
  { method: 'DELETE', path: '/admin/shops/:id',          handler: deleteShopHandler },
  { method: 'PATCH',  path: '/admin/shops/:id/activate', handler: activateShopHandler },
];

function matchRoute(method, pathname) {
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const pattern = route.path.replace(/:[^/]+/g, '[^/]+');
    const regex   = new RegExp(`^${pattern}$`);
    if (regex.test(pathname)) return route.handler;
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url      = new URL(request.url);
    const method   = request.method;
    const pathname = url.pathname;

    if (method === 'OPTIONS') return preflight();

    const handler = matchRoute(method, pathname);
    if (!handler) return notFound(`Route not found: ${method} ${pathname}`);

    return handler(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    const db = createClient(env);
    await expireStaleSubscriptions(db);
  },
};
