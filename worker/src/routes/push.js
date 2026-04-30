// ============================================================
// routes/push.js — Push subscription management
// ============================================================

import { createClient } from '../utils/db.js';
import { ok, badRequest, serverError } from '../utils/response.js';

/**
 * POST /push/subscribe
 * Customer registers their push subscription.
 * Body: { token_id, shop_id, subscription: { endpoint, keys: { p256dh, auth } } }
 */
export async function subscribePush(request, env) {
  try {
    const { token_id, shop_id, subscription } = await request.json();
    if (!token_id || !shop_id || !subscription?.endpoint) {
      return badRequest('token_id, shop_id and subscription required');
    }

    const db = createClient(env);

    // Upsert subscription (replace if exists for same token)
    const existing = await db.select('push_subscriptions', `token_id=eq.${token_id}`);

    if (existing.length) {
      await db.update('push_subscriptions', `token_id=eq.${token_id}`, {
        endpoint: subscription.endpoint,
        p256dh:   subscription.keys.p256dh,
        auth:     subscription.keys.auth,
      });
    } else {
      await db.insert('push_subscriptions', {
        token_id,
        shop_id,
        endpoint: subscription.endpoint,
        p256dh:   subscription.keys.p256dh,
        auth:     subscription.keys.auth,
      });
    }

    return ok({ subscribed: true });
  } catch (err) { return serverError(err.message); }
}

/**
 * DELETE /push/unsubscribe
 * Body: { token_id }
 */
export async function unsubscribePush(request, env) {
  try {
    const { token_id } = await request.json();
    if (!token_id) return badRequest('token_id required');
    const db = createClient(env);
    await db.delete('push_subscriptions', `token_id=eq.${token_id}`);
    return ok({ unsubscribed: true });
  } catch (err) { return serverError(err.message); }
}

/**
 * POST /push/delay — customer requests 2 min delay (grace extension)
 * Body: { token_id, shop_id }
 */
export async function requestDelay(request, env) {
  try {
    const { token_id, shop_id } = await request.json();
    const db     = createClient(env);
    const tokens = await db.select('tokens', `id=eq.${token_id}&shop_id=eq.${shop_id}&status=eq.called`);
    if (!tokens.length) return badRequest('Token not found or not currently called');

    // Extend grace — mark as "delay requested" so shopkeeper sees it
    await db.update('tokens', `id=eq.${token_id}`, {
      grace_started_at: new Date().toISOString(),
    });

    return ok({ delayed: true, message: '2 minute extension noted' });
  } catch (err) { return serverError(err.message); }
}
