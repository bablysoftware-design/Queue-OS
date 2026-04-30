// ============================================================
// src/index.js — Cloudflare Worker Entry Point
// ============================================================

import { handleVerify, handleMessage }               from './routes/webhook.js';
import { createTokenHandler, nextTokenHandler,
         getQueueHandler, noShowHandler,
         getStatsHandler, getPositionHandler }        from './routes/tokens.js';
import { createShopHandler, loginShopHandler,
         toggleShopHandler, getShopHandler,
         deleteShopHandler, activateShopHandler }     from './routes/shops.js';
import { assignPlanHandler, getSubscriptionHandler,
         listShopsAdminHandler }                      from './routes/subscriptions.js';
import { easypaisaWebhook, jazzcashWebhook,
         manualPayment }                              from './routes/payments.js';
import { submitRegistration, listRegistrations,
         approveRegistration, rejectRegistration }    from './routes/register.js';
import { getPublicShops, getPublicShop,
         joinQueue, checkPosition }                   from './routes/public.js';
import { expireStaleSubscriptions }                   from './services/subscriptionService.js';
import { resetDailyTokens }                           from './services/tokenService.js';
import { createClient }                               from './utils/db.js';
import { preflight, notFound }                        from './utils/response.js';

const ROUTES = [
  // WhatsApp
  { method: 'GET',    path: '/webhook',                         handler: handleVerify },
  { method: 'POST',   path: '/webhook',                         handler: handleMessage },

  // Public customer APIs (no auth)
  { method: 'GET',    path: '/public/shops',                    handler: getPublicShops },
  { method: 'GET',    path: '/public/shop/:id',                 handler: getPublicShop },
  { method: 'POST',   path: '/public/join',                     handler: joinQueue },
  { method: 'GET',    path: '/public/position',                 handler: checkPosition },

  // Tokens
  { method: 'POST',   path: '/tokens',                          handler: createTokenHandler },
  { method: 'POST',   path: '/tokens/next',                     handler: nextTokenHandler },
  { method: 'POST',   path: '/tokens/no-show',                  handler: noShowHandler },
  { method: 'GET',    path: '/tokens/queue',                    handler: getQueueHandler },
  { method: 'GET',    path: '/tokens/stats',                    handler: getStatsHandler },
  { method: 'GET',    path: '/tokens/position',                 handler: getPositionHandler },

  // Shops
  { method: 'POST',   path: '/shops',                           handler: createShopHandler },
  { method: 'POST',   path: '/shops/login',                     handler: loginShopHandler },
  { method: 'PATCH',  path: '/shops/:id/toggle',                handler: toggleShopHandler },
  { method: 'GET',    path: '/shops/:id',                       handler: getShopHandler },

  // Subscriptions
  { method: 'GET',    path: '/subscriptions',                   handler: getSubscriptionHandler },

  // Payments
  { method: 'POST',   path: '/payments/easypaisa',              handler: easypaisaWebhook },
  { method: 'POST',   path: '/payments/jazzcash',               handler: jazzcashWebhook },
  { method: 'POST',   path: '/payments/manual',                 handler: manualPayment },

  // Public registration
  { method: 'POST',   path: '/register',                        handler: submitRegistration },

  // Admin
  { method: 'POST',   path: '/admin/assign-plan',               handler: assignPlanHandler },
  { method: 'GET',    path: '/admin/shops',                     handler: listShopsAdminHandler },
  { method: 'DELETE', path: '/admin/shops/:id',                 handler: deleteShopHandler },
  { method: 'PATCH',  path: '/admin/shops/:id/activate',        handler: activateShopHandler },
  { method: 'GET',    path: '/admin/registrations',             handler: listRegistrations },
  { method: 'POST',   path: '/admin/registrations/:id/approve', handler: approveRegistration },
  { method: 'POST',   path: '/admin/registrations/:id/reject',  handler: rejectRegistration },
];

function matchRoute(method, pathname) {
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const pattern = route.path.replace(/:[^/]+/g, '[^/]+');
    if (new RegExp(`^${pattern}$`).test(pathname)) return route.handler;
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const { method }   = request;
    const { pathname } = new URL(request.url);
    if (method === 'OPTIONS') return preflight();
    const handler = matchRoute(method, pathname);
    if (!handler) return notFound(`Route not found: ${method} ${pathname}`);
    return handler(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    const db = createClient(env);
    await Promise.all([expireStaleSubscriptions(db), resetDailyTokens(db)]);
  },
};
