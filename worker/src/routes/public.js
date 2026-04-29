// ============================================================
// routes/public.js — Public customer-facing APIs (no auth)
// ============================================================

import { createClient }   from '../utils/db.js';
import { createToken }    from '../services/tokenService.js';
import { ok, badRequest, notFound, serverError } from '../utils/response.js';

/**
 * GET /public/shop/:id
 * Returns shop info safe for public display
 */
export async function getPublicShop(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = url.pathname.split('/')[3];
    const db     = createClient(env);

    const shops = await db.select('shops', `id=eq.${shopId}&select=id,name,category,area,is_open,is_active,current_token,avg_service_time_mins`);
    if (!shops.length) return notFound('دکان نہیں ملی');

    const shop = shops[0];

    // Get waiting count
    const waiting = await db.select('tokens', `shop_id=eq.${shopId}&status=eq.waiting&select=id`);
    const called  = await db.select('tokens', `shop_id=eq.${shopId}&status=eq.called&select=token_number`);

    return ok({
      ...shop,
      queue_length:     waiting.length,
      current_serving:  called[0]?.token_number ?? null,
      estimated_wait:   waiting.length * shop.avg_service_time_mins,
    });
  } catch (err) { return serverError(err.message); }
}

/**
 * POST /public/join
 * Customer joins the queue
 * Body: { shop_id, customer_name, customer_phone }
 */
export async function joinQueue(request, env) {
  try {
    const { shop_id, customer_name, customer_phone } = await request.json();

    if (!shop_id)      return badRequest('shop_id ضروری ہے');
    if (!customer_name && !customer_phone) return badRequest('نام یا نمبر ضروری ہے');

    // Use name as phone if no phone (walk-in style)
    const phone = customer_phone?.trim() ||
      `name-${encodeURIComponent(customer_name?.trim())}-${Date.now()}`;

    const db     = createClient(env);
    const result = await createToken(db, shop_id, phone);

    return ok({
      token_number:   result.token.token_number,
      token_id:       result.token.id,
      position:       result.position,
      estimated_wait: result.estimatedWaitMins,
      shop_name:      result.shopName,
      customer_name:  customer_name || 'مہمان',
    });
  } catch (err) { return badRequest(err.message); }
}

/**
 * GET /public/position?shop_id=xxx&token_id=xxx
 * Customer checks their live position
 */
export async function checkPosition(request, env) {
  try {
    const url     = new URL(request.url);
    const shopId  = url.searchParams.get('shop_id');
    const tokenId = url.searchParams.get('token_id');

    if (!shopId || !tokenId) return badRequest('shop_id اور token_id ضروری ہیں');

    const db = createClient(env);

    // Get this token
    const tokens = await db.select('tokens', `id=eq.${tokenId}&shop_id=eq.${shopId}`);
    if (!tokens.length) return notFound('ٹوکن نہیں ملا');

    const myToken = tokens[0];

    if (myToken.status === 'completed') return ok({ status: 'completed', token: myToken });
    if (myToken.status === 'no_show')   return ok({ status: 'no_show',   token: myToken });
    if (myToken.status === 'called') {
      return ok({ status: 'called', token: myToken, message: '🔔 آپ کی باری آ گئی! ابھی آئیں۔' });
    }

    // Count people ahead
    const ahead = await db.select(
      'tokens',
      `shop_id=eq.${shopId}&status=eq.waiting&token_number=lt.${myToken.token_number}&select=id`
    );

    const shops = await db.select('shops', `id=eq.${shopId}&select=avg_service_time_mins,current_token,name`);
    const shop  = shops[0];

    return ok({
      status:         'waiting',
      token:          myToken,
      position:       ahead.length + 1,
      people_ahead:   ahead.length,
      estimated_wait: ahead.length * (shop?.avg_service_time_mins ?? 10),
      current_serving: shop?.current_token,
      shop_name:       shop?.name,
    });
  } catch (err) { return serverError(err.message); }
}
