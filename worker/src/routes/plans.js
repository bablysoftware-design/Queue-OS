// ============================================================
// routes/plans.js — Plan pricing management + upgrade requests
// ============================================================
import { createClient }  from '../utils/db.js';
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
    return ok(updated[0]);
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
    return ok(rows || []);
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
    // If approved — assign plan
    if (action === 'approved') {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      // Find the governing subscription using the same rule as
      // getActiveSubscription(): status='active', newest first.
      const subs = await db.select('subscriptions',
        `shop_id=eq.${req.shop_id}&status=eq.active&order=created_at.desc&limit=1`
      );
      if (subs?.length) {
        // Update the existing active row in place — no new
        // status='active' row created, index unaffected.
        await db.update('subscriptions', `id=eq.${subs[0].id}`,
          { plan_name: req.requested_plan, end_date: endDate.toISOString().split('T')[0] }
        );
      } else {
        // No status='active' row exists for this shop, so inserting
        // one cannot violate idx_subscriptions_one_active_per_shop.
        await db.insert('subscriptions', {
          shop_id: req.shop_id, plan_name: req.requested_plan,
          status:     'active',
          start_date: new Date().toISOString().split('T')[0],
          end_date:   endDate.toISOString().split('T')[0],
        });
      }
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
    const { shop_id, requested_plan, payment_ref, note, payment_method } = body;
    if (!shop_id || !requested_plan) return badRequest('shop_id and requested_plan required');
    if (auth.shop_id !== shop_id) return badRequest('Unauthorized');
    if (!['basic','pro'].includes(requested_plan)) return badRequest('Invalid plan');
    const db  = createClient(env);
    const row = await db.insert('upgrade_requests', {
      shop_id, requested_plan, payment_ref: payment_ref || null,
      payment_method: payment_method || null, note: note || null,
    });
    return ok(Array.isArray(row) ? row[0] : row);
  } catch(e) { return serverError(e.message); }
}
