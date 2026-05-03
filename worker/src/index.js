// ============================================================
// src/index.js — Cloudflare Worker Entry Point
// ============================================================

import { handleVerify, handleMessage }               from './routes/webhook.js';
import { createTokenHandler, nextTokenHandler,
         getQueueHandler, noShowHandler,
         getStatsHandler, getPositionHandler,
         cancelTokenHandler }                         from './routes/tokens.js';
import { createShopHandler, loginShopHandler,
         toggleShopHandler, getShopHandler,
         deleteShopHandler, activateShopHandler,
         updateShopSettingsHandler, changePinHandler } from './routes/shops.js';
import { assignPlanHandler, getSubscriptionHandler,
         listShopsAdminHandler }                      from './routes/subscriptions.js';
import { easypaisaWebhook, jazzcashWebhook,
         manualPayment }                              from './routes/payments.js';
import { submitRegistration, listRegistrations,
         approveRegistration, rejectRegistration }    from './routes/register.js';
import { subscribePush, unsubscribePush, requestDelay } from './routes/push.js';
import { getPublicShops, getPublicShop,
         joinQueue, checkPosition,
         publicCancelToken }                          from './routes/public.js';
import { getShareLink, getShopBySlug,
         getShopQR, getRelatedShops }                 from './routes/share.js';
import { submitPaymentRequest, listPaymentRequests,
         approvePaymentRequest, rejectPaymentRequest } from './routes/payments_manual.js';
import { expireStaleSubscriptions }                   from './services/subscriptionService.js';
import { resetDailyTokens }                           from './services/tokenService.js';
import { createClient }                               from './utils/db.js';
import { preflight, notFound, ok, serverError }                        from './utils/response.js';

const ROUTES = [
  // Health check
  { method: 'GET',    path: '/ping',    handler: async (req, env) => {
      const { ok } = await import('./utils/response.js');
      const token = req.headers.get('x-session-token');
      return ok({ pong: true, token_received: !!token, token_preview: token?.slice(0,20) || null });
  }},

  // WhatsApp
  { method: 'GET',    path: '/debug/shops',                      handler: debugShopsHandler },
  { method: 'GET',    path: '/webhook',                         handler: handleVerify },
  { method: 'POST',   path: '/webhook',                         handler: handleMessage },

  // Public (no auth)
  { method: 'GET',    path: '/public/shops',                    handler: getPublicShops },
  { method: 'GET',    path: '/public/shop/:id',                 handler: getPublicShop },
  { method: 'POST',   path: '/public/join',                     handler: joinQueue },
  { method: 'GET',    path: '/public/position',                 handler: checkPosition },
  { method: 'POST',   path: '/push/subscribe',                   handler: subscribePush },
  { method: 'DELETE', path: '/push/unsubscribe',                 handler: unsubscribePush },
  { method: 'POST',   path: '/push/delay',                       handler: requestDelay },
  { method: 'POST',   path: '/public/cancel',                   handler: publicCancelToken },

  // Share / QR / Slug (no auth) — specific paths before :id params
  { method: 'GET',    path: '/shops/related',                            handler: getRelatedShops },
  { method: 'GET',    path: '/shops/by-slug/:slug',                      handler: getShopBySlug },
  { method: 'GET',    path: '/shops/:id/share-link',                     handler: getShareLink },
  { method: 'GET',    path: '/shops/:id/qr',                             handler: getShopQR },

  // Manual payment (paid token mode)
  { method: 'POST',   path: '/public/payment-request',                   handler: submitPaymentRequest },
  { method: 'GET',    path: '/admin/payment-requests',                   handler: listPaymentRequests },
  { method: 'POST',   path: '/admin/payment-requests/:id/approve',       handler: approvePaymentRequest },
  { method: 'POST',   path: '/admin/payment-requests/:id/reject',        handler: rejectPaymentRequest },

  // Tokens (auth required)
  { method: 'POST',   path: '/tokens',                          handler: createTokenHandler },
  { method: 'POST',   path: '/tokens/next',                     handler: nextTokenHandler },
  { method: 'POST',   path: '/tokens/no-show',                  handler: noShowHandler },
  { method: 'POST',   path: '/tokens/cancel',                   handler: cancelTokenHandler },
  { method: 'GET',    path: '/tokens/queue',                    handler: getQueueHandler },
  { method: 'GET',    path: '/tokens/stats',                    handler: getStatsHandler },
  { method: 'GET',    path: '/tokens/position',                 handler: getPositionHandler },

  // Shops (auth required)
  { method: 'POST',   path: '/shops',                           handler: createShopHandler },
  { method: 'POST',   path: '/shops/login',                     handler: loginShopHandler },
  { method: 'PATCH',  path: '/shops/:id/toggle',                handler: toggleShopHandler },
  { method: 'GET',    path: '/shops/:id',                       handler: getShopHandler },
  { method: 'PATCH',  path: '/shops/:id/settings',              handler: updateShopSettingsHandler },
  { method: 'POST',   path: '/shops/:id/change-pin',            handler: changePinHandler },

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


// Debug handler - temporary
async function debugShopsHandler(request, env) {
  try {
    const db = createClient(env);
    const shops = await db.select('shops', 'is_active=eq.true&select=id,name,is_open&limit=5');
    return new Response(JSON.stringify({ success: true, count: shops.length, shops, supabase_url: env.SUPABASE_URL?.slice(0,40) }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch(err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

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
    await Promise.all([
      expireStaleSubscriptions(db),
      resetDailyTokens(db),
      db.rpc('cleanup_sessions'),
    ]);
  },
};
