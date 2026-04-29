// ============================================================
// routes/tokens.js — Token + Queue API
// Used by: PWA Dashboard
// ============================================================

import { createToken, advanceQueue, getQueueState } from '../services/tokenService.js';
import { createClient } from '../utils/db.js';
import { ok, badRequest, serverError, notFound } from '../utils/response.js';
import { isValidUUID, isValidPhone } from '../utils/validation.js';

/**
 * POST /tokens
 * Body: { shop_id, customer_phone }
 * Create a token (walk-in kiosk / manual entry by shopkeeper)
 */
export async function createTokenHandler(request, env) {
  try {
    const { shop_id, customer_phone } = await request.json();

    if (!isValidUUID(shop_id))      return badRequest('Invalid shop_id');
    if (!customer_phone)            return badRequest('customer_phone required');

    const db = createClient(env);
    const result = await createToken(db, shop_id, customer_phone);
    return ok(result);
  } catch (err) {
    return badRequest(err.message);
  }
}

/**
 * POST /tokens/next
 * Body: { shop_id }
 * Advance queue: complete current, call next
 */
export async function nextTokenHandler(request, env) {
  try {
    const { shop_id } = await request.json();
    if (!isValidUUID(shop_id)) return badRequest('Invalid shop_id');

    const db = createClient(env);
    const next = await advanceQueue(db, shop_id);
    return ok({ next, empty: !next });
  } catch (err) {
    return serverError(err.message);
  }
}

/**
 * GET /tokens/queue?shop_id=xxx
 * Get current queue state for dashboard
 */
export async function getQueueHandler(request, env) {
  try {
    const url     = new URL(request.url);
    const shopId  = url.searchParams.get('shop_id');

    if (!isValidUUID(shopId)) return badRequest('Invalid shop_id');

    const db = createClient(env);
    const state = await getQueueState(db, shopId);
    return ok(state);
  } catch (err) {
    return serverError(err.message);
  }
}
