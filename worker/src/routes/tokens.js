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
    const result = await cancelToken(db, token_id, shop_id);
    return ok(result);
  } catch (err) { return badRequest(err.message); }
}
