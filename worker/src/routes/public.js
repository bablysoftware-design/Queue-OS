// ============================================================
// routes/public.js — Public customer APIs (no auth)
// Fixes: #3 (N+1 via RPC), #4 (sanitization), #18 (hours),
//        #19 (address/description), #22 (shop_closed status),
//        #24 (pagination)
// ============================================================

import { createClient }  from '../utils/db.js';
import { createToken }   from '../services/tokenService.js';
import { checkSubscriptionValid } from '../services/subscriptionService.js';
import { sanitizeParam, sanitizeSearch, sanitizeName, isRateLimited } from '../utils/sanitize.js';
import { ok, badRequest, notFound, serverError }       from '../utils/response.js';

/**
 * FIX #3: GET /public/shops — single RPC call instead of N+1
 * FIX #4: sanitized params
 * FIX #24: pagination support
 */
export async function getPublicShops(request, env) {
  try {
    const url      = new URL(request.url);
    const area     = sanitizeParam(url.searchParams.get('area'));
    const category = sanitizeParam(url.searchParams.get('category'));
    const search   = sanitizeSearch(url.searchParams.get('search'));
    const limit    = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const offset   = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    const db = createClient(env);
    let shops = [], areas = [], total = 0;

    // Try RPC first (fast, single query)
    try {
      const result = await db.rpc('get_public_shops', {
        p_area: area || null, p_category: category || null,
        p_limit: limit, p_offset: offset,
      });
      const r = Array.isArray(result) ? result[0] : result;
      if (r?.shops && Array.isArray(r.shops)) {
        shops = r.shops;
        areas = r.areas || [];
        total = r.total || shops.length;
      }
    } catch(rpcErr) {
      // RPC not created yet — fast fallback (no N+1)
      let query = `is_active=eq.true&select=id,name,category,area,city,country,address,description,opening_time,closing_time,is_open,current_token,avg_service_time_mins,token_mode,token_price,owner_phone&order=is_open.desc,name.asc&limit=${limit}&offset=${offset}`;
      if (area)     query += `&area=ilike.*${encodeURIComponent(area)}*`;
      if (category) query += `&category=eq.${category}`;

      const rawShops = await db.select('shops', query);

      // Get ALL today's tokens in ONE query (not N+1)
      const today    = new Date().toISOString().split('T')[0];
      let allTokens  = [];
      try {
        allTokens = await db.select('tokens',
          `created_at=gte.${today}T00:00:00&status=in.(waiting,called)&select=shop_id,status,token_number`
        );
      } catch(e) {}

      shops = rawShops.map(sh => {
        const shopTokens = allTokens.filter(t => t.shop_id === sh.id);
        const waiting    = shopTokens.filter(t => t.status === 'waiting').length;
        const called     = shopTokens.find(t => t.status === 'called');
        return {
          ...sh,
          queue_length:    waiting,
          current_serving: called?.token_number ?? null,
          estimated_wait:  waiting * (sh.avg_service_time_mins || 10),
          is_busy:         waiting >= 15,
        };
      });

      // Normalize areas: INITCAP, extract city if area contains '/'
const rawAreas = rawShops.map(s => s.area).filter(Boolean);
const normAreas = rawAreas.map(a => {
  let clean = a.includes('/') ? a.split('/')[0] : a;
  clean = clean.trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
});
areas = [...new Set(normAreas)].sort();
      total = shops.length;
    }

    // Search filter
    if (search && shops.length) {
      const s = search.toLowerCase();
      shops = shops.filter(sh =>
        sh.name.toLowerCase().includes(s) ||
        (sh.area || '').toLowerCase().includes(s) ||
        (sh.category || '').toLowerCase().includes(s)
      );
    }

    return ok({ shops, areas, total, limit, offset });
  } catch(err) {
    return serverError(err.message);
  }
}


export async function getPublicShop(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = sanitizeParam(url.pathname.split('/')[3]);
    const db     = createClient(env);

    const shops = await db.select('shops',
      `id=eq.${shopId}&select=id,name,category,area,city,country,address,description,opening_time,closing_time,is_open,is_active,current_token,avg_service_time_mins,token_mode,token_price,owner_phone`
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

    // Rate limit: max 10 token joins per IP per minute
    const ip       = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateKey  = `join:${ip}:${shop_id}`;
    if (isRateLimited(rateKey, 10, 60_000)) {
      return badRequest('بہت زیادہ درخواستیں — ایک منٹ بعد کوشش کریں');
    }
    // customer_note: optional, max 200 chars, strip tags
    const raw_note          = typeof body.customer_note === 'string' ? body.customer_note : '';
    const customer_note     = raw_note.trim().replace(/<[^>]*>/g, '').slice(0, 200) || null;
    // Voice note — path is a filename from /public/voice-note upload, validated server-side
    const voice_note_path   = typeof body.voice_note_path === 'string' && /^[a-zA-Z0-9_.-]+$/.test(body.voice_note_path.trim())
                              ? body.voice_note_path.trim() : null;
    const voice_note_dur    = typeof body.voice_note_duration === 'number'
                              ? Math.min(Math.max(0, body.voice_note_duration), 15) : null;


    if (!shop_id)                          return badRequest('shop_id ضروری ہے');
    if (!customer_name && !customer_phone) return badRequest('نام یا نمبر ضروری ہے');

    const phone = customer_phone || `web-${Date.now()}`;
    const db    = createClient(env);

    // ── Subscription check ──────────────────────────────────
    const subCheck = await checkSubscriptionValid(db, shop_id);
    if (!subCheck.valid) {
      return badRequest('Aapka free trial khatam ho gaya hai. Continue karne ke liye plan khareed Lein. Shukria!');
    }

    // ── Shop details (open check + paid mode) ───────────────
    const shopRows = await db.select('shops',
      `select=id,name,is_open,is_active,token_mode,token_price&id=eq.${shop_id}&limit=1`
    );
    if (!shopRows?.length) return notFound('دکان نہیں ملی');
    const shop = shopRows[0];
    if (!shop.is_active) return badRequest('یہ دکان فعال نہیں ہے');
    if (!shop.is_open)   return badRequest('دکان ابھی بند ہے');

    // ── Paid token check ────────────────────────────────────
    if (shop.token_mode === 'paid') {
      return badRequest(
        `Token lene ke liye payment zaruri hai. Amount: Rs ${shop.token_price}. ` +
        `Payment screenshot apne naam aur phone number ke saath bhejein.`
      );
    }

   const result = await createToken(
  db,
  shop_id,
  customer_phone,
  customer_name,
  env,
  {},              // opts
  customer_note,
  voice_note_path,
  voice_note_dur
);
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

    let priority_active = false;
    let priority_session_id = null;
    try {
      const pRows = await db.select('priority_sessions',
        `token_id=eq.${tokenId}&status=eq.active&select=id&limit=1`
      );
      if (pRows?.length) {
        priority_active     = true;
        priority_session_id = pRows[0].id;
      }
    } catch(e) { /* non-critical */ }

    return ok({
      status:             'waiting',
      token:              myToken,
      position:           ahead.length + 1,
      people_ahead:       ahead.length,
      estimated_wait:     ahead.length * (shop?.avg_service_time_mins ?? 10),
      current_serving:    shop?.current_token,
      shop_name:          shop?.name,
      priority_active,
      priority_session_id,
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

/** GET /public/stats — global platform stats for landing page */
export async function getGlobalStats(request, env) {
  try {
    const db    = createClient(env);
    const today = new Date().toISOString().split('T')[0];

    // shops: small table, need is_open per row — full select is correct
    const shops = await db.select('shops', 'is_active=eq.true&select=id,is_open');

    // tokens: O(n) SELECT replaced with HEAD + Prefer:count=exact
    // PostgREST returns count in Content-Range header, zero body bytes transferred
    // Fallback to 0 on any failure — this is non-critical telemetry
    let tokensToday = 0;
    try {
      const countRes = await fetch(
        `${env.SUPABASE_URL.trim()}/rest/v1/tokens?created_at=gte.${today}T00:00:00`,
        {
          method:  'HEAD',
          headers: {
            'apikey':        env.SUPABASE_KEY.trim(),
            'Authorization': `Bearer ${env.SUPABASE_KEY.trim()}`,
            'Prefer':        'count=exact',
          },
        }
      );
      // Content-Range format: "0-49/247" or "*/247"
      const range = countRes.headers.get('Content-Range');
      if (range) {
        const parsed = parseInt(range.split('/')[1], 10);
        if (!isNaN(parsed)) tokensToday = parsed;
      }
    } catch(_) {
      // Non-critical — leave tokensToday = 0
    }

    // Response shape preserved exactly
    return ok({
      total_shops:  shops.length,
      open_shops:   shops.filter(s => s.is_open).length,
      tokens_today: tokensToday,
    });
  } catch(err) { return serverError(err.message); }
}

/**
 * POST /public/scan — record a meaningful customer shop visit
 * Fire-and-forget from client. Always returns 200.
 * Client deduplicates per session via sessionStorage.
 */
export async function recordScan(request, env) {
  try {
    const { shop_id, source = 'direct' } = await request.json();
    if (!shop_id) return ok({ recorded: false });

    const db = createClient(env);
    // Fire-and-forget insert — do not await to avoid slowing shop load
    db.insert('shop_scans', {
      shop_id,
      source: ['qr','link','direct'].includes(source) ? source : 'direct',
    }).catch(() => {}); // silent fail — never block customer flow

    return ok({ recorded: true });
  } catch(e) {
    return ok({ recorded: false }); // always 200 — client doesn't need to know
  }
}
