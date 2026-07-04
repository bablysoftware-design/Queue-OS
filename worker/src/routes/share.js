// ── Share Routes ──────────────────────────────────────────────
import { createClient }        from '../utils/db.js';
import { ok, notFound, badRequest, serverError } from '../utils/response.js';
import { buildShareLink, generateShareMessage, buildWhatsAppUrl } from '../services/shareService.js';
import { generateQRCodeUrl }   from '../services/qrService.js';
import { sanitizeParam }       from '../utils/sanitize.js';

/**
 * GET /shops/:id/share-link
 * Returns share link + prebuilt WhatsApp message for a shop
 */
export async function getShareLink(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = sanitizeParam(url.pathname.split('/')[2]);

    const db   = createClient(env);
    // Try with slug first; fall back gracefully if slug column missing
    let rows;
    try {
      rows = await db.select('shops', `select=id,name,slug,area,category&id=eq.${shopId}&limit=1`);
    } catch(e) {
      rows = await db.select('shops', `select=id,name,area,category&id=eq.${shopId}&limit=1`);
    }
    if (!rows?.length) return notFound('Shop not found');

    const shop    = rows[0];
    const link    = buildShareLink(shop, env.SITE_URL);
    const message = generateShareMessage(shop, env.SITE_URL);
    const waUrl   = buildWhatsAppUrl(message);

    return ok({ link, message, whatsapp_url: waUrl });
  } catch(err) { return serverError(err.message); }
}

/**
 * GET /shops/by-slug/:slug
 * Resolve slug → shop details (used when customer arrives via /s/slug)
 */
export async function getShopBySlug(request, env) {
  try {
    const url  = new URL(request.url);
    const slug = sanitizeParam(url.pathname.split('/')[3]);
    if (!slug) return badRequest('slug required');

    const db   = createClient(env);
    const rows = await db.select('shops',
      `select=id,name,slug,category,area,address,description,opening_time,closing_time,is_open,is_active,current_token,avg_service_time_mins,token_mode,token_price&slug=eq.${slug}&is_active=eq.true&limit=1`
    );
    if (!rows?.length) return notFound('Shop not found');
    return ok(rows[0]);
  } catch(err) { return serverError(err.message); }
}

/**
 * GET /shops/:id/qr
 * Returns QR code URL pointing to shop's share link
 */
export async function getShopQR(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = sanitizeParam(url.pathname.split('/')[2]);

    const db   = createClient(env);
    let rows;
    try {
      rows = await db.select('shops', `select=id,name,slug&id=eq.${shopId}&limit=1`);
    } catch(e) {
      rows = await db.select('shops', `select=id,name&id=eq.${shopId}&limit=1`);
    }
    if (!rows?.length) return notFound('Shop not found');

    const shop   = rows[0];
    const link   = buildShareLink(shop, env.SITE_URL);
    const qrUrl  = await generateQRCodeUrl(link, 300);

    return ok({ qr_url: qrUrl, shop_link: link, shop_name: shop.name });
  } catch(err) { return serverError(err.message); }
}

/**
 * GET /shops/related?shop_id=xxx
 * Returns 3–5 shops in same city/area (growth loop)
 */
export async function getRelatedShops(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = sanitizeParam(url.searchParams.get('shop_id') || '');
    if (!shopId) return badRequest('shop_id required');

    const db   = createClient(env);
    const rows = await db.select('shops', `select=id,name,area&id=eq.${shopId}&limit=1`);
    if (!rows?.length) return notFound('Shop not found');

    const { area } = rows[0];
    if (!area) return ok({ shops: [] });

    // Get shops in same area, exclude self, limit 5
    const related = await db.select('shops',
      `select=id,name,slug,category,area,is_open,current_token,avg_service_time_mins&is_active=eq.true&area=ilike.*${encodeURIComponent(area)}*&id=neq.${shopId}&limit=5`
    );
    return ok({ shops: related || [] });
  } catch(err) { return serverError(err.message); }
}

/**
 * GET /public/shop-page/:idOrSlug
 * Full data for a business's public/shareable page.
 * Works for both claimed (active) and unclaimed shops.
 * Returns richer data than /public/shop/:id (which is queue-focused).
 */
export async function getShopPage(request, env) {
  try {
    const url      = new URL(request.url);
    const idOrSlug = sanitizeParam(url.pathname.split('/')[3]);
    if (!idOrSlug) return badRequest('shop id or slug required');

    const db = createClient(env);
    const isUUID = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const filter = isUUID
      ? `id=eq.${idOrSlug}`
      : `slug=eq.${idOrSlug}`;

    const rows = await db.select('shops',
      `select=id,name,slug,category,area,city,country,address,description,opening_hours,logo_url,is_open,is_active,is_claimed,current_token,avg_service_time_mins,token_mode,token_price,owner_phone&${filter}&limit=1`
    );
    if (!rows?.length) return notFound('Business not found');
    const shop = rows[0];

    // Mask owner_phone — only expose last 4 digits for contact display
    const maskedPhone = shop.owner_phone && !shop.owner_phone.startsWith('unclaimed-')
      ? '****' + shop.owner_phone.slice(-4)
      : null;

    // Get live queue stats if shop is active
    let queueStats = null;
    if (shop.is_active && shop.is_claimed) {
      try {
        const tokens = await db.select('tokens',
          `shop_id=eq.${shop.id}&status=eq.waiting&select=id`
        );
        queueStats = {
          waiting: tokens?.length || 0,
          current_token: shop.current_token,
          estimated_wait: (tokens?.length || 0) * (shop.avg_service_time_mins || 10),
        };
      } catch(e) { /* non-fatal */ }
    }

    return ok({
      ...shop,
      owner_phone:  maskedPhone,
      queue_stats:  queueStats,
      share_url:    buildShareLink(shop, env.SITE_URL),
    });
  } catch(err) { return serverError(err.message); }
}
