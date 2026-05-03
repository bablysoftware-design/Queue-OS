// ── Manual Payment Routes ─────────────────────────────────────
import { createClient }  from '../utils/db.js';
import { createToken }   from '../services/tokenService.js';
import { requireAdmin }  from '../utils/auth.js';
import { sanitizeParam, sanitizeName } from '../utils/sanitize.js';
import { ok, badRequest, notFound, serverError, unauthorized } from '../utils/response.js';

/**
 * POST /public/payment-request
 * Customer submits payment proof for a paid-token shop
 * Body: { shop_id, customer_name, customer_phone, screenshot_url? }
 */
export async function submitPaymentRequest(request, env) {
  try {
    const body         = await request.json();
    const shop_id      = sanitizeParam(body.shop_id || '');
    const customer_name  = sanitizeName(body.customer_name || '');
    const customer_phone = sanitizeParam(body.customer_phone || '');
    const screenshot_url = body.screenshot_url || null;

    if (!shop_id)        return badRequest('shop_id ضروری ہے');
    if (!customer_name)  return badRequest('نام ضروری ہے');
    if (!customer_phone) return badRequest('فون نمبر ضروری ہے');

    const db = createClient(env);
    const shopRows = await db.select('shops',
      `select=id,name,token_mode,token_price&id=eq.${shop_id}&limit=1`
    );
    if (!shopRows?.length) return notFound('دکان نہیں ملی');
    const shop = shopRows[0];
    if (shop.token_mode !== 'paid') return badRequest('یہ دکان فری ٹوکن موڈ پر ہے');

    const pr = await db.insert('payment_requests', {
      shop_id,
      customer_name,
      customer_phone,
      amount: shop.token_price,
      screenshot_url,
      status: 'pending',
    });

    return ok({
      request_id:   pr.id,
      message:      `Payment request submit ho gayi. Shop approve karne ke baad aapko token mil jayega.`,
      amount:       shop.token_price,
      shop_name:    shop.name,
    });
  } catch(err) { return serverError(err.message); }
}

/**
 * GET /admin/payment-requests?shop_id=xxx
 * List pending payment requests for a shop
 */
export async function listPaymentRequests(request, env) {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    const url    = new URL(request.url);
    const shopId = sanitizeParam(url.searchParams.get('shop_id') || '');
    const filter = shopId
      ? `shop_id=eq.${shopId}&order=created_at.desc`
      : `order=created_at.desc`;
    const db = createClient(env);
    const rows = await db.select('payment_requests',
      `select=id,shop_id,customer_name,customer_phone,amount,screenshot_url,status,created_at,reviewed_at,token_id&${filter}&limit=50`
    );
    return ok(rows || []);
  } catch(err) { return serverError(err.message); }
}

/**
 * POST /admin/payment-requests/:id/approve
 * Approve payment → instantly create token and notify customer
 */
export async function approvePaymentRequest(request, env) {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    const url = new URL(request.url);
    const id  = sanitizeParam(url.pathname.split('/')[3]);
    const db  = createClient(env);

    const rows = await db.select('payment_requests',
      `select=*&id=eq.${id}&status=eq.pending&limit=1`
    );
    if (!rows?.length) return notFound('Request nahi mili ya already processed hai');
    const pr = rows[0];

    // Create token
    const result = await createToken(db, pr.shop_id, pr.customer_phone, pr.customer_name, env);

    // Update payment request
    await db.update('payment_requests', `id=eq.${id}`, {
      status:      'approved',
      token_id:    result.token.id,
      reviewed_at: new Date().toISOString(),
    });

    return ok({
      message:      'Payment approve ho gayi. Token issue ho gaya.',
      token_number: result.token.token_number,
      token_id:     result.token.id,
    });
  } catch(err) { return serverError(err.message); }
}

/**
 * POST /admin/payment-requests/:id/reject
 * Reject a payment request
 */
export async function rejectPaymentRequest(request, env) {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    const url = new URL(request.url);
    const id  = sanitizeParam(url.pathname.split('/')[3]);
    const db  = createClient(env);
    await db.update('payment_requests', `id=eq.${id}`, {
      status:      'rejected',
      reviewed_at: new Date().toISOString(),
    });
    return ok({ message: 'Payment request reject ho gayi.' });
  } catch(err) { return serverError(err.message); }
}
