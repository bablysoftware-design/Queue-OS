// ============================================================
// routes/public.js — Public customer-facing APIs (no auth)
// ============================================================

import { createClient } from '../utils/db.js';
import { createToken }  from '../services/tokenService.js';
import { ok, badRequest, notFound, serverError } from '../utils/response.js';

/**
 * GET /public/shops?area=xxx&category=xxx&search=xxx
 * Returns all active shops with live queue status
 */
export async function getPublicShops(request, env) {
  try {
    const url      = new URL(request.url);
    const area     = url.searchParams.get('area');
    const category = url.searchParams.get('category');
    const search   = url.searchParams.get('search');

    const db = createClient(env);

    let query = 'is_active=eq.true&select=id,name,category,area,is_open,current_token,avg_service_time_mins&order=is_open.desc,name.asc';
    if (area)     query += `&area=ilike.*${area}*`;
    if (category) query += `&category=eq.${category}`;

    let shops = await db.select('shops', query);

    // Client-side search filter
    if (search) {
      const s = search.toLowerCase();
      shops = shops.filter(sh =>
        sh.name.toLowerCase().includes(s) ||
        (sh.area  || '').toLowerCase().includes(s) ||
        (sh.category || '').toLowerCase().includes(s)
      );
    }

    // Attach live queue counts
    const enriched = await Promise.all(shops.map(async sh => {
      try {
        const [waiting, called] = await Promise.all([
          db.select('tokens', `shop_id=eq.${sh.id}&status=eq.waiting&select=id`),
          db.select('tokens', `shop_id=eq.${sh.id}&status=eq.called&select=token_number`),
        ]);
        return {
          ...sh,
          queue_length:    waiting.length,
          current_serving: called[0]?.token_number ?? null,
          estimated_wait:  waiting.length * sh.avg_service_time_mins,
          is_busy:         waiting.length >= 15,
        };
      } catch { return { ...sh, queue_length: 0, estimated_wait: 0, is_busy: false }; }
    }));

    // Get unique areas for filter
    const areas = [...new Set(shops.map(s => s.area).filter(Boolean))].sort();

    return ok({ shops: enriched, areas });
  } catch (err) { return serverError(err.message); }
}

/**
 * GET /public/shop/:id — single shop info
 */
export async function getPublicShop(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = url.pathname.split('/')[3];
    const db     = createClient(env);

    const shops = await db.select('shops', `id=eq.${shopId}&select=id,name,category,area,is_open,is_active,current_token,avg_service_time_mins`);
    if (!shops.length) return notFound('دکان نہیں ملی');

    const shop    = shops[0];
    const waiting = await db.select('tokens', `shop_id=eq.${shopId}&status=eq.waiting&select=id`);
    const called  = await db.select('tokens', `shop_id=eq.${shopId}&status=eq.called&select=token_number`);

    return ok({
      ...shop,
      queue_length:    waiting.length,
      current_serving: called[0]?.token_number ?? null,
      estimated_wait:  waiting.length * shop.avg_service_time_mins,
      is_busy:         waiting.length >= 15,
    });
  } catch (err) { return serverError(err.message); }
}

/**
 * POST /public/join — customer joins queue
 */
export async function joinQueue(request, env) {
  try {
    const { shop_id, customer_name, customer_phone } = await request.json();
    if (!shop_id)    return badRequest('shop_id ضروری ہے');
    if (!customer_name && !customer_phone) return badRequest('نام یا نمبر ضروری ہے');

    const phone  = customer_phone?.trim() || `name-${encodeURIComponent(customer_name?.trim())}-${Date.now()}`;
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
 */
export async function checkPosition(request, env) {
  try {
    const url     = new URL(request.url);
    const shopId  = url.searchParams.get('shop_id');
    const tokenId = url.searchParams.get('token_id');
    if (!shopId || !tokenId) return badRequest('shop_id اور token_id ضروری ہیں');

    const db     = createClient(env);
    const tokens = await db.select('tokens', `id=eq.${tokenId}&shop_id=eq.${shopId}`);
    if (!tokens.length) return notFound('ٹوکن نہیں ملا');

    const myToken = tokens[0];
    if (['completed','no_show'].includes(myToken.status)) return ok({ status: myToken.status, token: myToken });
    if (myToken.status === 'called') return ok({ status: 'called', token: myToken });

    const ahead  = await db.select('tokens', `shop_id=eq.${shopId}&status=eq.waiting&token_number=lt.${myToken.token_number}&select=id`);
    const shops  = await db.select('shops', `id=eq.${shopId}&select=avg_service_time_mins,current_token,name`);
    const shop   = shops[0];

    return ok({
      status:          'waiting',
      token:           myToken,
      position:        ahead.length + 1,
      people_ahead:    ahead.length,
      estimated_wait:  ahead.length * (shop?.avg_service_time_mins ?? 10),
      current_serving: shop?.current_token,
      shop_name:       shop?.name,
    });
  } catch (err) { return serverError(err.message); }
}
