// ============================================================
// routes/plans.js — Plan pricing management + upgrade requests
// ============================================================
import { createClient }  from '../utils/db.js';
import { requireAdmin, requireShopAuth }  from '../utils/auth.js';
import { ok, badRequest, notFound, serverError } from '../utils/response.js';
import { isValidUUID }   from '../utils/validation.js';

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
 * Set a custom price override for a specific shop's subscription.
 * Body: { custom_price, note? }
 */
export async function setCustomPlan(request, env) {
  try {
    const authErr = requireAdmin(request, env);
    if (authErr) return authErr;
    const url    = new URL(request.url);
    const shopId = url.pathname.split('/')[3];
    if (!isValidUUID(shopId)) return badRequest('Invalid shop_id');
    const { plan_name, custom_price, duration_days, note } = await request.json();
    if (!plan_name) return badRequest('plan_name required');
    const db    = createClient(env);
    // Update subscription with custom price
    const subs = await db.select('subscriptions',
      `shop_id=eq.${shopId}&is_active=eq.true&limit=1`
    );
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (duration_days || 30));
    if (subs?.length) {
      const updated = await db.update('subscriptions',
        `shop_id=eq.${shopId}&is_active=eq.true`,
        { plan_name, end_date: endDate.toISOString().split('T')[0], updated_at: new Date().toISOString() }
      );
      return ok({ updated: updated?.[0], custom_price, note });
    } else {
      const inserted = await db.insert('subscriptions', {
        shop_id: shopId, plan_name,
        start_date: new Date().toISOString().split('T')[0],
        end_date:   endDate.toISOString().split('T')[0],
        is_active:  true
      });
      return ok({ inserted: inserted?.[0], custom_price, note });
    }
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
      const subs = await db.select('subscriptions', `shop_id=eq.${req.shop_id}&is_active=eq.true&limit=1`);
      if (subs?.length) {
        await db.update('subscriptions', `shop_id=eq.${req.shop_id}&is_active=eq.true`,
          { plan_name: req.requested_plan, end_date: endDate.toISOString().split('T')[0] }
        );
      } else {
        await db.insert('subscriptions', {
          shop_id: req.shop_id, plan_name: req.requested_plan,
          start_date: new Date().toISOString().split('T')[0],
          end_date:   endDate.toISOString().split('T')[0],
          is_active:  true
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
