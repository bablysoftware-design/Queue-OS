// ============================================================
// routes/tokens.js — Token + Queue API
// Fixes: #2 (auth on next/no-show), #14 (cancel)
// ============================================================

import { createToken, advanceQueue, getQueueState,
         markNoShow, getShopStats, getCustomerPosition,
         cancelToken }            from '../services/tokenService.js';
import { createClient }           from '../utils/db.js';
import { requireShopAuth }        from '../utils/auth.js';
import { ok, badRequest, serverError } from '../utils/response.js';
import { isValidUUID }            from '../utils/validation.js';

/** POST /tokens — manual token creation (auth required) */
export async function createTokenHandler(request, env) {
  try {
    const db   = createClient(env);
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const { shop_id, customer_phone, customer_name } = await request.json();
    if (!isValidUUID(shop_id))   return badRequest('Invalid shop_id');
    if (auth.shop_id !== shop_id) return badRequest('Unauthorized for this shop');

    const result = await createToken(db, shop_id, customer_phone || `walkin-${Date.now()}`, customer_name, env);
    return ok(result);
  } catch (err) { return badRequest(err.message); }
}

/** POST /tokens/next — advance queue (auth required) */
export async function nextTokenHandler(request, env) {
  try {
    const db   = createClient(env);
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const { shop_id } = await request.json();
    if (!isValidUUID(shop_id))    return badRequest('Invalid shop_id');
    if (auth.shop_id !== shop_id) return badRequest('Unauthorized for this shop');

    const next = await advanceQueue(db, shop_id, env);
    return ok({ next, empty: !next });
  } catch (err) { return serverError(err.message); }
}

/** POST /tokens/no-show (auth required) */
export async function noShowHandler(request, env) {
  try {
    const db   = createClient(env);
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const { shop_id } = await request.json();
    if (!isValidUUID(shop_id))    return badRequest('Invalid shop_id');
    if (auth.shop_id !== shop_id) return badRequest('Unauthorized for this shop');

    const next = await markNoShow(db, shop_id, env);
    return ok({ next, empty: !next });
  } catch (err) { return serverError(err.message); }
}

/** GET /tokens/queue?shop_id=xxx (auth required) */
export async function getQueueHandler(request, env) {
  try {
    const db   = createClient(env);
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const url    = new URL(request.url);
    const shopId = url.searchParams.get('shop_id');
    if (!isValidUUID(shopId))    return badRequest('Invalid shop_id');
    if (auth.shop_id !== shopId) return badRequest('Unauthorized for this shop');

    const state = await getQueueState(db, shopId);
    return ok(state);
  } catch (err) { return serverError(err.message); }
}

/** GET /tokens/stats?shop_id=xxx (auth required) */
export async function getStatsHandler(request, env) {
  try {
    const db   = createClient(env);
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const url    = new URL(request.url);
    const shopId = url.searchParams.get('shop_id');
    if (!isValidUUID(shopId))    return badRequest('Invalid shop_id');
    if (auth.shop_id !== shopId) return badRequest('Unauthorized for this shop');

    const stats = await getShopStats(db, shopId);
    return ok(stats);
  } catch (err) { return serverError(err.message); }
}

/** GET /tokens/analytics?shop_id=xxx (auth required) */
export async function getAnalyticsHandler(request, env) {
  try {
    const db   = createClient(env);
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const url    = new URL(request.url);
    const shopId = url.searchParams.get('shop_id');
    if (!isValidUUID(shopId))    return badRequest('Invalid shop_id');
    if (auth.shop_id !== shopId) return badRequest('Unauthorized for this shop');

    const data = await getShopAnalytics(db, shopId);
    return ok(data);
  } catch (err) { return serverError(err.message); }
}

/** GET /tokens/position?shop_id=xxx&phone=xxx (public) */
export async function getPositionHandler(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = url.searchParams.get('shop_id');
    const phone  = url.searchParams.get('phone');
    if (!isValidUUID(shopId)) return badRequest('Invalid shop_id');
    if (!phone)               return badRequest('phone required');
    const db  = createClient(env);
    const pos = await getCustomerPosition(db, shopId, phone);
    return ok(pos);
  } catch (err) { return serverError(err.message); }
}

/** POST /tokens/cancel — customer cancels their token (FIX #14) */
export async function cancelTokenHandler(request, env) {
  try {
    const { token_id, shop_id } = await request.json();
    if (!isValidUUID(token_id)) return badRequest('Invalid token_id');
    if (!isValidUUID(shop_id))  return badRequest('Invalid shop_id');
    const db     = createClient(env);
    const result = await cancelToken(db, token_id, shop_id, env);
    return ok(result);
  } catch (err) { return badRequest(err.message); }
}

/**
 * POST /tokens/:id/call-now
 * Manually call a specific waiting token (emergency/VIP/walk-in).
 * Does NOT affect queue ordering, positions, or estimated waits.
 * Stores call_method='manual' for auditability.
 * Auth: shopkeeper must own the token's shop.
 */
export async function callNowHandler(request, env) {
  try {
    const db   = createClient(env);
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const url     = new URL(request.url);
    const tokenId = url.pathname.split('/')[2]; // /tokens/:id/call-now
    if (!isValidUUID(tokenId)) return badRequest('Invalid token_id');

    // Fetch token — verify ownership and current status
    const rows = await db.select('tokens',
      `id=eq.${tokenId}&select=id,shop_id,status,token_number,customer_name,customer_phone`
    );
    if (!rows?.length) return badRequest('Token not found');

    const token = rows[0];

    // Verify shopkeeper owns this token's shop
    if (token.shop_id !== auth.shop_id) return badRequest('Unauthorized for this token');

    // Only waiting tokens can be manually called
    const terminal = ['called','served','completed','cancelled','expired','no_show'];
    if (terminal.includes(token.status)) {
      return badRequest(`Token is already ${token.status} — cannot call now`);
    }
    if (token.status !== 'waiting') {
      return badRequest(`Token status '${token.status}' cannot be called`);
    }

    // Atomic update: filter on status=eq.waiting prevents race condition
    // If two devices click simultaneously, second finds no matching row
    const updated = await db.update(
      'tokens',
      `id=eq.${tokenId}&status=eq.waiting`,
      {
        status:      'called',
        called_at:   new Date().toISOString(),
        call_method: 'manual',
      }
    );

    if (!updated?.length) {
      return badRequest('Token was already called or modified by another device');
    }

    return ok({
      token:   updated[0],
      message: `Token #${token.token_number} called manually`,
    });
  } catch (err) { return serverError(err.message); }
}
