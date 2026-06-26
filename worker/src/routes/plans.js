// ============================================================
// routes/plans.js — Plan pricing management + upgrade requests
// ============================================================
import { createClient }  from '../utils/db.js';
import { assignPlan }    from '../services/subscriptionService.js';
import { requireAdmin, requireShopAuth }  from '../utils/auth.js';
import { ok, badRequest, notFound, serverError } from '../utils/response.js';
import { isValidUUID }   from '../utils/validation.js';

/** GET /public/plans — public plan pricing for upgrade dropdown (no auth) */
export async function listPublicPlans(request, env) {
  try {
    const db    = createClient(env);
    const plans = await db.select('plans',
      'select=name,display_name,price,description&order=price.asc'
    );
    // Return only paid plans (exclude free) for the upgrade dropdown
    const paid = (plans || []).filter(p => p.name !== 'free');
    return ok(paid);
  } catch(e) { return serverError(e.message); }
}

/** GET /admin/plans — list all plans with features */
export async function listPlans(request, env) {
  try {
    const authErr = requireAdmin(request, env);
    if (authErr) return authErr;
    const db    = createClient(env);
    const plans = await db.select('plans', 'order=price.asc');
    return ok(plans);
  } catch(e) { return serverError(e.message); }
}

/**
 * PATCH /admin/plans/:name — update plan price or limits
 * Body: { price?, max_tokens_per_day?, max_queue_size?,
 *         allow_priority_call?, allow_paid_tokens?,
 *         allow_voice_notes?, allow_analytics? }
 */
export async function updatePlan(request, env) {
  try {
    const authErr = requireAdmin(request, env);
    if (authErr) return authErr;
    const url      = new URL(request.url);
    const planName = url.pathname.split('/')[3]; // /admin/plans/:name
    if (!planName) return badRequest('Plan name required');
    const body    = await request.json();
    const allowed = ['price','max_tokens_per_day','max_queue_size',
                     'allow_priority_call','allow_paid_tokens',
                     'allow_voice_notes','allow_analytics','allow_poster',
                     'max_devices','description'];
    const update = {};
    for (const k of allowed) {
      if (body[k] !== undefined) update[k] = body[k];
    }
    if (!Object.keys(update).length) return badRequest('Nothing to update');
    const db      = createClient(env);
    const updated = await db.update('plans', `name=eq.${planName}`, update);
    if (!updated?.length) return notFound('Plan not found');

    // Optional: propagate new token/queue limits to existing active
    // subscriptions on this plan. Off by default — admin must pass
    // apply_to_existing:true explicitly, since subscriptions.max_*
    // fields are an intentional per-row snapshot (this is what makes
    // Custom Plan per-business overrides possible — propagating
    // unconditionally on every plan edit would silently erase those
    // overrides). Only touches limit fields, never plan_name, status,
    // dates, or feature-override columns — those remain untouched.
    let subscriptionsUpdated = 0;
    if (body.apply_to_existing === true) {
      const limitUpdate = {};
      if (update.max_tokens_per_day !== undefined) limitUpdate.max_tokens_per_day = update.max_tokens_per_day;
      if (update.max_queue_size     !== undefined) limitUpdate.max_queue_size     = update.max_queue_size;
      if (Object.keys(limitUpdate).length) {
        const rows = await db.update('subscriptions',
          `plan_name=eq.${planName}&status=eq.active`,
          limitUpdate
        );
        subscriptionsUpdated = rows?.length || 0;
      }
    }

    return ok({ ...updated[0], subscriptions_updated: subscriptionsUpdated });
  } catch(e) { return serverError(e.message); }
}

/**
 * PATCH /admin/shops/:id/custom-plan
 * Set a fully custom plan for a specific business.
 * Any field not provided inherits from the plan defaults.
 * Body: {
 *   plan_name, duration_days?,
 *   max_tokens_per_day?, max_queue_size?,
 *   allow_priority_call?, allow_paid_tokens?,
 *   allow_voice_notes?, allow_analytics?, allow_poster?,
 *   custom_label?, custom_price?, admin_note?
 * }
 */
export async function setCustomPlan(request, env) {
  try {
    const authErr = requireAdmin(request, env);
    if (authErr) return authErr;
    const url    = new URL(request.url);
    const shopId = url.pathname.split('/')[3];
    if (!isValidUUID(shopId)) return badRequest('Invalid shop_id');

    const body = await request.json();
    const {
      plan_name        = 'basic',
      duration_days    = 30,
      max_tokens_per_day,
      max_queue_size,
      allow_priority_call,
      allow_paid_tokens,
      allow_voice_notes,
      allow_analytics,
      allow_poster,
      custom_label,
      custom_price,
      admin_note,
    } = body;

    const db      = createClient(env);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration_days);
    const endStr  = endDate.toISOString().split('T')[0];

    // Build update object — only include fields that were explicitly provided
    const updateData = {
      plan_name,
      start_date: new Date().toISOString().split('T')[0], // FIX: reset start_date so duration is calculated from today, not original start
      end_date:   endStr,
      updated_at: new Date().toISOString(),
    };

    // Numeric overrides — fall back to plan defaults if not provided
    const plans = await db.select('plans', `name=eq.${plan_name}&limit=1`);
    const plan  = plans?.[0] || {};
    updateData.max_tokens_per_day = max_tokens_per_day ?? plan.max_tokens_per_day ?? 50;
    updateData.max_queue_size     = max_queue_size     ?? plan.max_queue_size     ?? 20;

    // Feature overrides — NULL means inherit from plan
    updateData.allow_priority_call = allow_priority_call ?? null;
    updateData.allow_paid_tokens   = allow_paid_tokens   ?? null;
    updateData.allow_voice_notes   = allow_voice_notes   ?? null;
    updateData.allow_analytics     = allow_analytics     ?? null;
    updateData.allow_poster        = allow_poster        ?? null;
    updateData.custom_label        = custom_label        || null;
    updateData.custom_price        = custom_price        ?? null;
    updateData.admin_note          = admin_note          || null;
    updateData.status               = 'active';

    // Find the governing subscription using the same rule as
    // getActiveSubscription(): status='active', newest first.
    const subs = await db.select('subscriptions',
      `shop_id=eq.${shopId}&status=eq.active&order=created_at.desc&limit=1`
    );

    let result;
    if (subs?.length) {
      // Update the existing active row in place — does not create a
      // second status='active' row, so the partial unique index
      // idx_subscriptions_one_active_per_shop is unaffected.
      result = await db.update('subscriptions',
        `id=eq.${subs[0].id}`,
        updateData
      );
    } else {
      // No status='active' row exists for this shop (subs.length === 0),
      // so inserting one with status='active' cannot violate
      // idx_subscriptions_one_active_per_shop.
      result = await db.insert('subscriptions', {
        ...updateData,
        shop_id:    shopId,
        start_date: new Date().toISOString().split('T')[0],
      });
    }

    // BUG FIX: Always re-activate the shop when a custom plan is set.
    // Previously, if a shop was deactivated (is_active=false) and the
    // admin used "Custom Plan" to assign a new period, the subscription
    // was updated but shops.is_active remained false — the shop stayed
    // invisible to customers even though it now has a valid subscription.
    await db.update('shops', `id=eq.${shopId}`, { is_active: true });

    return ok({ subscription: Array.isArray(result) ? result[0] : result });
  } catch(e) { return serverError(e.message); }
}

/** GET /admin/upgrade-requests — list pending upgrade requests */
export async function listUpgradeRequests(request, env) {
  try {
    const authErr = requireAdmin(request, env);
    if (authErr) return authErr;
    const db   = createClient(env);
    const rows = await db.select('upgrade_requests',
      'order=created_at.desc&limit=100'
    );
    if (!rows?.length) return ok([]);

    // Batch fetch shop names to avoid N+1
    const shopIds = [...new Set(rows.map(r => r.shop_id))];
    const shops   = await db.select('shops',
      `id=in.(${shopIds.join(',')})&select=id,name,owner_phone`
    ).catch(() => []);
    const shopMap = {};
    for (const s of (shops || [])) shopMap[s.id] = s;

    // Also batch fetch current subscription for each shop so admin
    // can see current_plan vs requested_plan (renewal vs upgrade)
    const subs = await db.select('subscriptions',
      `shop_id=in.(${shopIds.join(',')})&status=eq.active&order=created_at.desc`
    ).catch(() => []);
    const subMap = {};
    for (const s of (subs || [])) {
      if (!subMap[s.shop_id]) subMap[s.shop_id] = s;
    }

    const enriched = rows.map(r => ({
      ...r,
      shop_name:    shopMap[r.shop_id]?.name    || r.shop_id?.slice(0,8),
      shop_phone:   shopMap[r.shop_id]?.owner_phone || null,
      current_plan: subMap[r.shop_id]?.plan_name || 'free',
      request_type: (subMap[r.shop_id]?.plan_name || 'free') === r.requested_plan ? 'renewal' : 'upgrade',
    }));

    return ok(enriched);
  } catch(e) { return serverError(e.message); }
}

/** PATCH /admin/upgrade-requests/:id — approve or reject */
export async function reviewUpgradeRequest(request, env) {
  try {
    const authErr = requireAdmin(request, env);
    if (authErr) return authErr;
    const url = new URL(request.url);
    const id  = url.pathname.split('/')[3];
    if (!isValidUUID(id)) return badRequest('Invalid id');
    const { action, note } = await request.json();
    if (!['approved','rejected'].includes(action)) return badRequest('action must be approved or rejected');
    const db  = createClient(env);
    const rows = await db.select('upgrade_requests', `id=eq.${id}&status=eq.pending&limit=1`);
    if (!rows?.length) return notFound('Request not found or already reviewed');
    const req = rows[0];
    await db.update('upgrade_requests', `id=eq.${id}`,
      { status: action, reviewed_at: new Date().toISOString(), note: note || null }
    );
    // If approved — assign plan using assignPlan() so duration is always
    // driven by the plan's duration_days (not hardcoded 30 days).
    // assignPlan() also handles the cancel-then-insert ordering required
    // by idx_subscriptions_one_active_per_shop and re-activates the shop.
    if (action === 'approved') {
      await assignPlan(db, req.shop_id, req.requested_plan);
    }
    return ok({ action, request_id: id });
  } catch(e) { return serverError(e.message); }
}

/**
 * POST /upgrade-requests — business submits upgrade request
 * Auth: shopkeeper session token
 */
export async function submitUpgradeRequestHandler(request, env) {
  try {
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;
    const body = await request.json();
    const { shop_id, requested_plan, payment_ref, note, payment_method, screenshot_url } = body;
    if (!shop_id || !requested_plan) return badRequest('shop_id and requested_plan required');
    if (auth.shop_id !== shop_id) return badRequest('Unauthorized');
    if (!['free','basic','pro'].includes(requested_plan)) return badRequest('Invalid plan');

    const db = createClient(env);

    // Determine if this is a renewal (same plan) or upgrade (different plan)
    const existing = await db.select('subscriptions',
      `shop_id=eq.${shop_id}&status=eq.active&order=created_at.desc&limit=1`
    );
    const currentPlan = existing?.[0]?.plan_name || 'free';
    const requestType = currentPlan === requested_plan ? 'renewal' : 'upgrade';

    const row = await db.insert('upgrade_requests', {
      shop_id,
      requested_plan,
      payment_ref:    payment_ref    || null,
      payment_method: payment_method || null,
      note:           note           || null,
      screenshot_url: screenshot_url || null,
      // Store request type in the note field with a prefix if no dedicated column
      // (schema already has all needed columns — note carries context)
      amount_paid:    null,
    });
    const inserted = Array.isArray(row) ? row[0] : row;
    return ok({ ...inserted, request_type: requestType, current_plan: currentPlan });
  } catch(e) { return serverError(e.message); }
}

/**
 * GET /upgrade-requests/status?shop_id=X
 * Business checks the status of its own most recent upgrade request.
 * Lets the dashboard replace the static 'submitted, review within
 * 24 hours' message with the real outcome once admin has acted —
 * that message previously had no way to ever update or clear.
 */
export async function getMyUpgradeRequestStatus(request, env) {
  try {
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;
    const url    = new URL(request.url);
    const shopId = url.searchParams.get('shop_id');
    if (!shopId) return badRequest('shop_id required');
    if (auth.shop_id !== shopId) return badRequest('Unauthorized');

    const db   = createClient(env);
    const rows = await db.select('upgrade_requests',
      `shop_id=eq.${shopId}&order=created_at.desc&limit=1`
    );
    if (!rows?.length) return ok({ request: null });
    return ok({ request: rows[0] });
  } catch(e) { return serverError(e.message); }
}
