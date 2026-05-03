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
    const rows = await db.select('shops', `select=id,name,slug,area,category&id=eq.${shopId}&limit=1`);
    if (!rows?.length) return notFound('Shop not found');

    const shop    = rows[0];
    const link    = buildShareLink(shop);
    const message = generateShareMessage(shop);
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
    const rows = await db.select('shops', `select=id,name,slug&id=eq.${shopId}&limit=1`);
    if (!rows?.length) return notFound('Shop not found');

    const shop   = rows[0];
    const link   = buildShareLink(shop);
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
