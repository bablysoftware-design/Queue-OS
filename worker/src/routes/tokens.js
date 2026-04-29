// ============================================================
// routes/tokens.js — Token + Queue API
// ============================================================

import { createToken, advanceQueue, getQueueState,
         markNoShow, getShopStats, getCustomerPosition } from '../services/tokenService.js';
import { createClient } from '../utils/db.js';
import { ok, badRequest, serverError, notFound } from '../utils/response.js';
import { isValidUUID } from '../utils/validation.js';

/** POST /tokens — create token */
export async function createTokenHandler(request, env) {
  try {
    const { shop_id, customer_phone } = await request.json();
    if (!isValidUUID(shop_id)) return badRequest('Invalid shop_id');
    if (!customer_phone)        return badRequest('customer_phone required');
    const db     = createClient(env);
    const result = await createToken(db, shop_id, customer_phone);
    return ok(result);
  } catch (err) { return badRequest(err.message); }
}

/** POST /tokens/next — advance queue */
export async function nextTokenHandler(request, env) {
  try {
    const { shop_id } = await request.json();
    if (!isValidUUID(shop_id)) return badRequest('Invalid shop_id');
    const db   = createClient(env);
    const next = await advanceQueue(db, shop_id, env);
    return ok({ next, empty: !next });
  } catch (err) { return serverError(err.message); }
}

/** POST /tokens/no-show — mark current as no-show, call next */
export async function noShowHandler(request, env) {
  try {
    const { shop_id } = await request.json();
    if (!isValidUUID(shop_id)) return badRequest('Invalid shop_id');
    const db   = createClient(env);
    const next = await markNoShow(db, shop_id, env);
    return ok({ next, empty: !next });
  } catch (err) { return serverError(err.message); }
}

/** GET /tokens/queue?shop_id=xxx — queue state */
export async function getQueueHandler(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = url.searchParams.get('shop_id');
    if (!isValidUUID(shopId)) return badRequest('Invalid shop_id');
    const db    = createClient(env);
    const state = await getQueueState(db, shopId);
    return ok(state);
  } catch (err) { return serverError(err.message); }
}

/** GET /tokens/stats?shop_id=xxx — today's stats */
export async function getStatsHandler(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = url.searchParams.get('shop_id');
    if (!isValidUUID(shopId)) return badRequest('Invalid shop_id');
    const db    = createClient(env);
    const stats = await getShopStats(db, shopId);
    return ok(stats);
  } catch (err) { return serverError(err.message); }
}

/** GET /tokens/position?shop_id=xxx&phone=xxx — customer position check */
export async function getPositionHandler(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = url.searchParams.get('shop_id');
    const phone  = url.searchParams.get('phone');
    if (!isValidUUID(shopId)) return badRequest('Invalid shop_id');
    if (!phone)                return badRequest('phone required');
    const db  = createClient(env);
    const pos = await getCustomerPosition(db, shopId, phone);
    return ok(pos);
  } catch (err) { return serverError(err.message); }
}
