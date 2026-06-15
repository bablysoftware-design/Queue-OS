// ============================================================
// routes/subscriptions.js — Subscription + Admin APIs
// ============================================================

import { assignPlan, getActiveSubscription } from '../services/subscriptionService.js';
import { createClient } from '../utils/db.js';
import { ok, badRequest, serverError, unauthorized, notFound } from '../utils/response.js';
import { isValidPlan, isValidUUID } from '../utils/validation.js';

// ──────────────────────────────────────────────────────────────
// ADMIN MIDDLEWARE — checks x-admin-secret header
// ──────────────────────────────────────────────────────────────
function requireAdmin(request, env) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== env.ADMIN_SECRET) return unauthorized('Admin access denied');
  return null; // null = allowed
}

/**
 * POST /admin/assign-plan
 * Assigns a plan to a shop. Called by admin or future payment webhook.
 * Body: { shop_id, plan_name }
 * Headers: x-admin-secret: <secret>
 *
 * Future: Replace header auth with Easypaisa/JazzCash payment callback
 */
export async function assignPlanHandler(request, env) {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  try {
    const { shop_id, plan_name } = await request.json();

    if (!isValidUUID(shop_id))   return badRequest('Invalid shop_id');
    if (!isValidPlan(plan_name)) return badRequest('Invalid plan. Use: free, basic, pro');

    const db  = createClient(env);
    const sub = await assignPlan(db, shop_id, plan_name);

    return ok({
      message: `Plan "${plan_name}" assign ho gaya!`,
      subscription: sub,
    });
  } catch (err) {
    return serverError(err.message);
  }
}

/**
 * GET /subscriptions?shop_id=xxx
 * Get current subscription status for a shop
 */
export async function getSubscriptionHandler(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = url.searchParams.get('shop_id');
    if (!isValidUUID(shopId)) return badRequest('Invalid shop_id');

    const db  = createClient(env);
    const sub = await getActiveSubscription(db, shopId);
    if (!sub) return notFound('No active subscription');

    return ok(sub);
  } catch (err) {
    return serverError(err.message);
  }
}

/**
 * GET /admin/shops
 * List all shops with their subscription status.
 * Headers: x-admin-secret
 */
export async function listShopsAdminHandler(request, env) {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  try {
    const db    = createClient(env);
    const shops = await db.select(
      'shops',
      'select=id,name,owner_phone,area,city,country,category,is_active,is_open,current_token,status,token_mode,created_at&order=created_at.desc'
    );

    // Batch fetch all "active" subscriptions in one query instead of N+1.
    // A shop may (in theory) have more than one status='active' row;
    // mirror getActiveSubscription()'s tie-break (newest created_at wins)
    // by ordering and keeping only the first row seen per shop_id.
    const allSubs = await db.select(
      'subscriptions',
      'select=shop_id,plan_name,end_date,max_tokens_per_day,max_queue_size,custom_label,created_at&status=eq.active&order=created_at.desc'
    ).catch(() => []);

    const subMap = {};
    for (const s of (allSubs || [])) {
      if (!subMap[s.shop_id]) subMap[s.shop_id] = s; // first = newest, due to order above
    }

    const result = (shops || []).map(s => ({
      ...s,
      sub: subMap[s.id] || null,
    }));

    return ok(result);
  } catch (err) {
    return serverError(err.message);
  }
}
