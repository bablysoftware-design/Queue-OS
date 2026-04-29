// ============================================================
// routes/public.js — Public customer-facing APIs
// ============================================================

import { createClient }  from '../utils/db.js';
import { createToken }   from '../services/tokenService.js';
import { ok, badRequest, notFound, serverError } from '../utils/response.js';

/**
 * GET /public/shops?category=&area=&search=&lat=&lng=
 * Returns all active shops with live queue data
 */
export async function getPublicShops(request, env) {
  try {
    const url      = new URL(request.url);
    const category = url.searchParams.get('category') || '';
    const area     = url.searchParams.get('area')     || '';
    const search   = url.searchParams.get('search')   || '';
    const lat      = parseFloat(url.searchParams.get('lat')) || null;
    const lng      = parseFloat(url.searchParams.get('lng')) || null;

    const db = createClient(env);

    // Fetch all active shops
    let shops = await db.select('shops',
      'is_active=eq.true&select=id,name,category,area,address,is_open,current_token,avg_service_time_mins,opening_time,closing_time,description,latitude,longitude,avg_rating&order=name.asc'
    );

    // Get waiting counts for all shops in one go
    const waitingCounts = await db.select('tokens',
      `status=eq.waiting&select=shop_id`
    );

    const countMap = {};
    waitingCounts.forEach(t => {
      countMap[t.shop_id] = (countMap[t.shop_id] || 0) + 1;
    });

    // Enrich shops
    shops = shops.map(shop => {
      const queueLen  = countMap[shop.id] || 0;
      const estWait   = queueLen * (shop.avg_service_time_mins || 10);
      const queueLoad = queueLen >= 15 ? 'heavy' : queueLen >= 7 ? 'medium' : 'light';

      // Distance calc if coords provided
      let distance = null;
      if (lat && lng && shop.latitude && shop.longitude) {
        const R  = 6371;
        const dLat = (shop.latitude  - lat)  * Math.PI / 180;
        const dLng = (shop.longitude - lng)  * Math.PI / 180;
        const a  = Math.sin(dLat/2)**2 +
                   Math.cos(lat * Math.PI/180) * Math.cos(shop.latitude * Math.PI/180) *
                   Math.sin(dLng/2)**2;
        distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      }

      return { ...shop, queue_length: queueLen, estimated_wait: estWait, queue_load: queueLoad, distance };
    });

    // Apply filters
    if (category) shops = shops.filter(s => s.category?.toLowerCase() === category.toLowerCase());
    if (area)     shops = shops.filter(s => s.area?.toLowerCase().includes(area.toLowerCase()));
    if (search)   shops = shops.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.area?.toLowerCase().includes(search.toLowerCase()) ||
      s.category?.toLowerCase().includes(search.toLowerCase())
    );

    // Sort: nearby first if location given, else open first
    shops.sort((a, b) => {
      if (lat && lng) {
        if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      }
      if (a.is_open !== b.is_open) return a.is_open ? -1 : 1;
      return a.queue_length - b.queue_length;
    });

    // Build suggestions (alternatives for heavy-queue or closed shops)
    const suggestions = shops
      .filter(s => s.is_open && s.queue_load === 'light')
      .slice(0, 3);

    return ok({ shops, suggestions, total: shops.length });
  } catch (err) { return serverError(err.message); }
}

/**
 * GET /public/shop/:id
 */
export async function getPublicShop(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = url.pathname.split('/')[3];
    const db     = createClient(env);

    const shops = await db.select('shops',
      `id=eq.${shopId}&select=id,name,category,area,address,is_open,is_active,current_token,avg_service_time_mins,opening_time,closing_time,description,avg_rating`
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
    });
  } catch (err) { return serverError(err.message); }
}

/**
 * POST /public/join
 */
export async function joinQueue(request, env) {
  try {
    const { shop_id, customer_name, customer_phone } = await request.json();
    if (!shop_id)    return badRequest('shop_id ضروری ہے');
    if (!customer_name && !customer_phone) return badRequest('نام ضروری ہے');

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
    if (myToken.status === 'completed') return ok({ status: 'completed', token: myToken });
    if (myToken.status === 'no_show')   return ok({ status: 'no_show',   token: myToken });
    if (myToken.status === 'called')    return ok({ status: 'called',    token: myToken, message: '🔔 آپ کی باری آ گئی!' });

    const ahead = await db.select('tokens',
      `shop_id=eq.${shopId}&status=eq.waiting&token_number=lt.${myToken.token_number}&select=id`
    );
    const shops = await db.select('shops', `id=eq.${shopId}&select=avg_service_time_mins,current_token,name`);
    const shop  = shops[0];

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

/**
 * GET /public/categories
 * Returns distinct categories with counts
 */
export async function getCategories(request, env) {
  try {
    const db    = createClient(env);
    const shops = await db.select('shops', 'is_active=eq.true&select=category');
    const counts = {};
    shops.forEach(s => { if (s.category) counts[s.category] = (counts[s.category]||0)+1; });
    const cats = Object.entries(counts).map(([name,count]) => ({name,count})).sort((a,b)=>b.count-a.count);
    return ok(cats);
  } catch (err) { return serverError(err.message); }
}
