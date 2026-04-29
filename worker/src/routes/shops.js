// ============================================================
// routes/shops.js — Shop management API
// ============================================================

import { createClient } from '../utils/db.js';
import { ok, badRequest, serverError, notFound, unauthorized } from '../utils/response.js';
import { isValidPhone, isValidPin, isValidUUID } from '../utils/validation.js';

/**
 * POST /shops
 * Register a new shop + auto-provision free trial (via DB trigger)
 * Body: { name, category, area, owner_phone, pin }
 */
export async function createShopHandler(request, env) {
  try {
    const { name, category, area, owner_phone, pin } = await request.json();

    if (!name)                    return badRequest('name required');
    if (!owner_phone)             return badRequest('owner_phone required');
    if (!isValidPin(pin))         return badRequest('PIN must be 4 digits');

    const db = createClient(env);

    // Check if phone already registered
    const existing = await db.select('shops', `owner_phone=eq.${owner_phone}`);
    if (existing.length) return badRequest('Is number se pehle se dukan registered hai.');

    // Create shop (trigger auto-provisions free trial)
    const [shop] = await db.insert('shops', { name, category, area, owner_phone });

    // Create shopkeeper PIN
    await db.insert('shopkeepers', { shop_id: shop.id, pin: String(pin) });

    return ok({ shop, message: '30 din ka free trial shuru ho gaya!' });
  } catch (err) {
    return serverError(err.message);
  }
}

/**
 * POST /shops/login
 * PIN-based login for dashboard
 * Body: { owner_phone, pin }
 * Returns: { shop_id, shop_name } — store in localStorage
 */
export async function loginShopHandler(request, env) {
  try {
    const { owner_phone, pin } = await request.json();

    if (!owner_phone || !pin) return badRequest('Phone aur PIN chahiye');

    const db = createClient(env);

    const shops = await db.select('shops', `owner_phone=eq.${owner_phone}`);
    if (!shops.length) return notFound('Dukan nahi mili');

    const shop = shops[0];

    const keepers = await db.select(
      'shopkeepers',
      `shop_id=eq.${shop.id}&pin=eq.${String(pin)}`
    );
    if (!keepers.length) return unauthorized('Galat PIN');

    return ok({ shop_id: shop.id, shop_name: shop.name, is_open: shop.is_open });
  } catch (err) {
    return serverError(err.message);
  }
}

/**
 * PATCH /shops/:id/toggle
 * Toggle shop open/closed
 * Body: { is_open }
 */
export async function toggleShopHandler(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = url.pathname.split('/')[2];
    if (!isValidUUID(shopId)) return badRequest('Invalid shop_id');

    const { is_open } = await request.json();
    const db = createClient(env);

    await db.update('shops', `id=eq.${shopId}`, { is_open });
    return ok({ is_open });
  } catch (err) {
    return serverError(err.message);
  }
}

/**
 * GET /shops/:id
 * Get shop details (for dashboard)
 */
export async function getShopHandler(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = url.pathname.split('/')[2];
    if (!isValidUUID(shopId)) return badRequest('Invalid shop_id');

    const db = createClient(env);
    const shops = await db.select('shops', `id=eq.${shopId}`);
    if (!shops.length) return notFound('Shop not found');

    return ok(shops[0]);
  } catch (err) {
    return serverError(err.message);
  }
}
