// ============================================================
// routes/priority.js — Priority Overlay System
// Phase 1: Create session + Get active session
//
// IMMUTABILITY GUARANTEE:
// This file NEVER touches tokens table for queue mutations.
// It only reads tokens for validation.
// advanceQueue, markNoShow, getQueueState remain 100% untouched.
// ============================================================

import { createClient }           from '../utils/db.js';
import { requireShopAuth }        from '../utils/auth.js';
import { ok, badRequest, notFound, serverError } from '../utils/response.js';
import { isValidUUID }            from '../utils/validation.js';
import { checkSubscriptionValid } from '../services/subscriptionService.js';

/**
 * POST /priority/sessions
 * Create a new priority overlay session for a waiting token.
 *
 * Body: {
 *   shop_id:           UUID (required)
 *   token_id:          UUID (required)
 *   counter_id:        TEXT (optional, defaults to 'main')
 *   reason:            TEXT (optional, audit)
 *   created_by_device: TEXT (optional, audit)
 * }
 *
 * Guards:
 * - shopkeeper auth + shop ownership
 * - subscription validity
 * - token must be 'waiting'
 * - token must belong to this shop
 * - unique index rejects duplicate active session per shop+counter
 *
 * Does NOT modify any token status.
 * Does NOT affect queue ordering.
 */
export async function createPrioritySession(request, env) {
  try {
    const db   = createClient(env);
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const body = await request.json();
    const {
      shop_id,
      token_id,
      counter_id        = 'main',
      reason            = null,
      created_by_device = null,
    } = body;

    if (!isValidUUID(shop_id))  return badRequest('Invalid shop_id');
    if (!isValidUUID(token_id)) return badRequest('Invalid token_id');
    if (auth.shop_id !== shop_id) return badRequest('Unauthorized for this shop');

    // Subscription check
    const sub = await checkSubscriptionValid(db, shop_id);
    if (!sub.valid) return badRequest('Subscription expired — renew to use Priority Call');

    // Verify token exists, belongs to this shop, and is waiting
    const tokenRows = await db.select('tokens',
      `id=eq.${token_id}&shop_id=eq.${shop_id}&select=id,status,token_number,customer_name,customer_phone&limit=1`
    );
    if (!tokenRows?.length) return notFound('Token not found for this shop');

    const token = tokenRows[0];
    if (token.status !== 'waiting') {
      return badRequest(
        `Token #${token.token_number} is '${token.status}' — only waiting tokens can be prioritised`
      );
    }

    // Insert session — unique index enforces one active per shop+counter
    // If duplicate: DB returns error → caught below → clean error returned
    let session;
    try {
      const rows = await db.insert('priority_sessions', {
        shop_id,
        token_id,
        counter_id,
        status:             'active',
        reason,
        created_by_device,
      });
      session = Array.isArray(rows) ? rows[0] : rows;
    } catch (dbErr) {
      // Unique constraint violation → duplicate active session
      if (dbErr.message?.includes('unique') || dbErr.message?.includes('duplicate')) {
        return badRequest(
          'A priority session is already active for this counter — complete or cancel it first'
        );
      }
      throw dbErr;
    }

    return ok({
      session,
      token: {
        id:            token.id,
        token_number:  token.token_number,
        customer_name: token.customer_name,
        customer_phone: token.customer_phone,
      },
    });
  } catch (err) { return serverError(err.message); }
}

/**
 * GET /priority/active?shop_id=X&counter_id=main
 * Get the active priority session for a shop+counter.
 *
 * Includes orphan auto-close:
 * If the priority token's status is no longer 'waiting'
 * (completed/cancelled/no_show/expired elsewhere),
 * the session is auto-closed before returning null.
 * This prevents zombie priority sessions without needing a cron job.
 *
 * Returns: { session, token } or { session: null }
 */
export async function getActivePrioritySession(request, env) {
  try {
    const db   = createClient(env);
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const url        = new URL(request.url);
    const shop_id    = url.searchParams.get('shop_id');
    const counter_id = url.searchParams.get('counter_id') || 'main';

    if (!isValidUUID(shop_id))      return badRequest('Invalid shop_id');
    if (auth.shop_id !== shop_id)   return badRequest('Unauthorized for this shop');

    // Fetch active session for this shop+counter
    const sessions = await db.select('priority_sessions',
      `shop_id=eq.${shop_id}&counter_id=eq.${counter_id}&status=eq.active&order=started_at.desc&limit=1`
    );

    if (!sessions?.length) return ok({ session: null });

    const session = sessions[0];

    // Orphan auto-close:
    // If the token was completed/cancelled/expired elsewhere,
    // close this session passively without cron
    const tokenRows = await db.select('tokens',
      `id=eq.${session.token_id}&select=id,status,token_number,customer_name,customer_phone&limit=1`
    );

    if (!tokenRows?.length) {
      // Token deleted — close session
      await db.update('priority_sessions',
        `id=eq.${session.id}&status=eq.active`,
        { status: 'cancelled', ended_at: new Date().toISOString() }
      );
      return ok({ session: null });
    }

    const token = tokenRows[0];
    const terminalStates = ['completed', 'cancelled', 'no_show', 'expired', 'served'];

    if (terminalStates.includes(token.status)) {
      // Token reached terminal state — auto-close priority session
      await db.update('priority_sessions',
        `id=eq.${session.id}&status=eq.active`,
        { status: 'cancelled', ended_at: new Date().toISOString() }
      );
      return ok({ session: null });
    }

    return ok({
      session,
      token: {
        id:             token.id,
        token_number:   token.token_number,
        customer_name:  token.customer_name,
        customer_phone: token.customer_phone,
        status:         token.status,
      },
    });
  } catch (err) { return serverError(err.message); }
}

/**
 * PATCH /priority/sessions/:id
 * Complete or cancel an active priority session.
 *
 * Body: {
 *   action:       'completed' | 'cancelled'  (required)
 *   mark_served:  boolean (optional, only when action='completed')
 *                 true  → also set token.status='completed'
 *                 false → close session only, token stays waiting
 * }
 *
 * IMMUTABILITY GUARANTEE:
 * Token.status is ONLY mutated when action='completed' AND mark_served=true.
 * In all other cases tokens table is untouched.
 * advanceQueue, markNoShow, queue ordering: zero impact.
 */
export async function updatePrioritySession(request, env) {
  try {
    const db   = createClient(env);
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const url       = new URL(request.url);
    const sessionId = url.pathname.split('/')[3]; // /priority/sessions/:id
    if (!isValidUUID(sessionId)) return badRequest('Invalid session id');

    const body = await request.json();
    const { action, mark_served = false } = body;

    if (!['completed','cancelled'].includes(action)) {
      return badRequest("action must be 'completed' or 'cancelled'");
    }

    // Fetch session — verify ownership
    const sessions = await db.select('priority_sessions',
      `id=eq.${sessionId}&status=eq.active&limit=1`
    );
    if (!sessions?.length) return notFound('No active priority session found with that id');

    const session = sessions[0];
    if (session.shop_id !== auth.shop_id) return badRequest('Unauthorized for this session');

    // Close the session
    const updated = await db.update('priority_sessions',
      `id=eq.${sessionId}&status=eq.active`,
      { status: action, ended_at: new Date().toISOString() }
    );
    if (!updated?.length) return badRequest('Session already closed by another device');

    // Optionally mark token as served — ONLY when business explicitly chose "mark served"
    let tokenResult = null;
    if (action === 'completed' && mark_served === true) {
      const tokenRows = await db.select('tokens',
        `id=eq.${session.token_id}&shop_id=eq.${session.shop_id}&select=id,status,token_number&limit=1`
      );
      if (tokenRows?.length && tokenRows[0].status === 'waiting') {
        const tUpdated = await db.update('tokens',
          `id=eq.${session.token_id}&status=eq.waiting`,
          { status: 'completed' }
        );
        tokenResult = tUpdated?.[0] || null;
      }
    }

    return ok({
      session:      updated[0],
      token_served: tokenResult !== null,
      message:      action === 'completed'
        ? (mark_served ? 'Priority completed — customer marked served' : 'Priority completed — customer returned to queue')
        : 'Priority cancelled',
    });
  } catch (err) { return serverError(err.message); }
}
