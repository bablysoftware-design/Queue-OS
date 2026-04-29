// ============================================================
// routes/payments.js — Payment webhooks (Easypaisa / JazzCash)
// Ready to wire up — just add real verification logic per provider
// ============================================================

import { assignPlan }    from '../services/subscriptionService.js';
import { createClient }  from '../utils/db.js';
import { ok, badRequest, serverError } from '../utils/response.js';

/**
 * POST /payments/easypaisa
 * Easypaisa will POST to this URL after payment confirmation.
 * Wire up real HMAC verification once you have live credentials.
 */
export async function easypaisaWebhook(request, env) {
  try {
    const body = await request.json();

    // ── TODO: verify Easypaisa signature ──────────────────
    // const sig = request.headers.get('x-easypaisa-signature');
    // if (!verifyEasypaisaSig(sig, body, env.EASYPAISA_SECRET)) return badRequest('Invalid signature');

    const { shop_id, plan_name, transaction_id, status } = body;

    if (status !== 'SUCCESS') return ok({ message: 'Payment not successful, ignored' });
    if (!shop_id || !plan_name) return badRequest('shop_id and plan_name required');

    const db = createClient(env);
    const sub = await assignPlan(db, shop_id, plan_name);

    console.log(`✅ Easypaisa payment: shop=${shop_id} plan=${plan_name} txn=${transaction_id}`);
    return ok({ message: 'Plan assigned', subscription: sub });
  } catch (err) {
    return serverError(err.message);
  }
}

/**
 * POST /payments/jazzcash
 * JazzCash payment callback.
 */
export async function jazzcashWebhook(request, env) {
  try {
    const body = await request.json();

    // ── TODO: verify JazzCash HMAC ─────────────────────────
    // const pp_SecureHash = body.pp_SecureHash;
    // if (!verifyJazzCashHMAC(body, env.JAZZCASH_INTEGRITY_SALT)) return badRequest('Invalid hash');

    const { shop_id, plan_name, pp_ResponseCode } = body;

    if (pp_ResponseCode !== '000') return ok({ message: 'JazzCash payment failed, ignored' });
    if (!shop_id || !plan_name)    return badRequest('shop_id and plan_name required');

    const db  = createClient(env);
    const sub = await assignPlan(db, shop_id, plan_name);

    console.log(`✅ JazzCash payment: shop=${shop_id} plan=${plan_name}`);
    return ok({ message: 'Plan assigned', subscription: sub });
  } catch (err) {
    return serverError(err.message);
  }
}

/**
 * POST /payments/manual
 * Admin manually confirms a payment (interim until gateway is live).
 * Protected by admin secret.
 */
export async function manualPayment(request, env) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { shop_id, plan_name } = await request.json();
    if (!shop_id || !plan_name) return badRequest('shop_id and plan_name required');

    const db  = createClient(env);
    const sub = await assignPlan(db, shop_id, plan_name);
    return ok({ message: `Plan "${plan_name}" manually assigned`, subscription: sub });
  } catch (err) {
    return serverError(err.message);
  }
}
