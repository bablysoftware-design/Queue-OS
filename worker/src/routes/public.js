// ============================================================
// routes/public.js — Public customer APIs (no auth)
// Fixes: #3 (N+1 via RPC), #4 (sanitization), #18 (hours),
//        #19 (address/description), #22 (shop_closed status),
//        #24 (pagination)
// ============================================================

import { createClient }  from '../utils/db.js';
import { createToken }   from '../services/tokenService.js';
import { sanitizeParam, sanitizeSearch, sanitizeName } from '../utils/sanitize.js';
import { ok, badRequest, notFound, serverError }       from '../utils/response.js';

/**
 * FIX #3: GET /public/shops — single RPC call instead of N+1
 * FIX #4: sanitized params
 * FIX #24: pagination support
 */
export async function getPublicShops(request, env) {
  try {
    const url      = new URL(request.url);
    // FIX #4: Sanitize all inputs
    const area     = sanitizeParam(url.searchParams.get('area'));
    const category = sanitizeParam(url.searchParams.get('category'));
    const search   = sanitizeSearch(url.searchParams.get('search'));
    const limit    = Math.min(parseInt(url.searchParams.get('limit')  || '50', 10),  100);
    const offset   = Math.max(parseInt(url.searchParams.get('offset') || '0',  10), 0);

    const db = createClient(env);

    // FIX #3: Single RPC call — no N+1
    const result = await db.rpc('get_public_shops', {
      p_area:     area     || null,
      p_category: category || null,
      p_limit:    limit,
      p_offset:   offset,
    });

    let { shops, total, areas } = result;

    // Client-side search (fast, already small result set)
    if (search && shops?.length) {
      const s = search.toLowerCase();
      shops = shops.filter(sh =>
        sh.name.toLowerCase().includes(s) ||
        (sh.area        || '').toLowerCase().includes(s) ||
        (sh.category    || '').toLowerCase().includes(s) ||
        (sh.description || '').toLowerCase().includes(s)
      );
    }

    return ok({ shops: shops || [], areas: areas || [], total, limit, offset });
  } catch (err) { return serverError(err.message); }
}

/** GET /public/shop/:id — single shop with hours, address (FIX #18, #19) */
export async function getPublicShop(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = sanitizeParam(url.pathname.split('/')[3]);
    const db     = createClient(env);

    const shops = await db.select('shops',
      `id=eq.${shopId}&select=id,name,category,area,address,description,opening_time,closing_time,is_open,is_active,current_token,avg_service_time_mins`
    );
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
 * FIX #8: pass customer_name to createToken
 * FIX #6: dedup handled in tokenService
 */
export async function joinQueue(request, env) {
  try {
    const body = await request.json();
    const { shop_id } = body;
    // FIX #4: Sanitize inputs
    const customer_name  = sanitizeName(body.customer_name);
    const customer_phone = sanitizeParam(body.customer_phone);

    if (!shop_id)                          return badRequest('shop_id ضروری ہے');
    if (!customer_name && !customer_phone) return badRequest('نام یا نمبر ضروری ہے');

    const phone = customer_phone || `web-${Date.now()}`;
    const db    = createClient(env);
    const result = await createToken(db, shop_id, phone, customer_name);

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
 * FIX #22: return shop_closed status
 */
export async function checkPosition(request, env) {
  try {
    const url     = new URL(request.url);
    const shopId  = sanitizeParam(url.searchParams.get('shop_id'));
    const tokenId = sanitizeParam(url.searchParams.get('token_id'));
    if (!shopId || !tokenId) return badRequest('shop_id اور token_id ضروری ہیں');

    const db     = createClient(env);
    const tokens = await db.select('tokens', `id=eq.${tokenId}&shop_id=eq.${shopId}`);
    if (!tokens.length) return notFound('ٹوکن نہیں ملا');

    const myToken = tokens[0];

    // FIX #22: shop closed notification
    if (myToken.shop_closed_notified) {
      return ok({ status: 'shop_closed', token: myToken });
    }

    if (myToken.status === 'cancelled') return ok({ status: 'cancelled', token: myToken });
    if (['completed','no_show','expired'].includes(myToken.status)) {
      return ok({ status: myToken.status, token: myToken });
    }
    if (myToken.status === 'called') return ok({ status: 'called', token: myToken });

    const ahead = await db.select('tokens',
      `shop_id=eq.${shopId}&status=eq.waiting&token_number=lt.${myToken.token_number}&select=id`
    );
    const shops = await db.select('shops', `id=eq.${shopId}&select=avg_service_time_mins,current_token,name,is_open`);
    const shop  = shops[0];

    // If shop is now closed mid-queue
    if (shop && !shop.is_open && myToken.status === 'waiting') {
      return ok({ status: 'shop_closed', token: myToken });
    }

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

/** POST /public/cancel — customer cancels token (FIX #14) */
export async function publicCancelToken(request, env) {
  try {
    const { token_id, shop_id } = await request.json();
    if (!token_id || !shop_id) return badRequest('token_id اور shop_id ضروری ہیں');
    const db = createClient(env);
    const tokens = await db.select('tokens', `id=eq.${token_id}&shop_id=eq.${shop_id}`);
    if (!tokens.length) return notFound('ٹوکن نہیں ملا');
    if (tokens[0].status !== 'waiting') return badRequest('صرف انتظار والا ٹوکن منسوخ ہو سکتا ہے');
    await db.update('tokens', `id=eq.${token_id}`, {
      status: 'cancelled', cancelled_at: new Date().toISOString()
    });
    return ok({ cancelled: true });
  } catch (err) { return serverError(err.message); }
}
