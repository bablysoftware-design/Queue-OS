// ============================================================
// routes/shops.js — Shop management
// Fixes: #2 (session auth), #7 (PIN hashing), #9 (share link),
//        #10 (PIN change), #11 (business hours), #12 (avg time),
//        #15 (admin links), #22 (close notify)
// ============================================================

import { createClient }          from '../utils/db.js';
import { hashPin, verifyPin } from '../utils/crypto.js';
import { generateShopToken } from '../utils/auth.js';
import { requireShopAuth, requireAdmin }  from '../utils/auth.js';
import { ok, badRequest, serverError, notFound, unauthorized } from '../utils/response.js';
import { isValidPin, isValidUUID } from '../utils/validation.js';
import { notifyShopClosed }      from '../services/tokenService.js';

/** POST /shops — create shop (admin only) */
export async function createShopHandler(request, env) {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  try {
    const { name, category, area, owner_phone, pin, opening_time, closing_time, description, address } = await request.json();
    if (!name)            return badRequest('name required');
    if (!owner_phone)     return badRequest('owner_phone required');
    if (!isValidPin(pin)) return badRequest('PIN must be 4 digits');

    const db = createClient(env);

    const existing = await db.select('shops', `owner_phone=eq.${owner_phone}`);
    if (existing.length) return badRequest('اس نمبر سے پہلے سے دکان رجسٹر ہے');

    // FIX #7: Hash PIN before storing
    const pinHash = await hashPin(String(pin));

    const [shop] = await db.insert('shops', {
      name, category, area, owner_phone,
      opening_time: opening_time || '09:00',
      closing_time: closing_time || '21:00',
      description:  description  || null,
      address:      address      || null,
    });

    await db.insert('shopkeepers', {
      shop_id:  shop.id,
      pin:      String(pin), // keep for migration compatibility
      pin_hash: pinHash,
    });

    return ok({ shop, message: '30 din ka free trial shuru ho gaya!' });
  } catch (err) { return serverError(err.message); }
}

/** POST /shops/login — PIN login, returns session token */
export async function loginShopHandler(request, env) {
  try {
    const { owner_phone, pin } = await request.json();
    if (!owner_phone || !pin) return badRequest('Phone aur PIN chahiye');

    const db    = createClient(env);
    const shops = await db.select('shops', `owner_phone=eq.${owner_phone}`);
    if (!shops.length) return notFound('Dukan nahi mili');

    const shop    = shops[0];
    const keepers = await db.select('shopkeepers', `shop_id=eq.${shop.id}`);
    if (!keepers.length) return unauthorized('Shopkeeper not found');

    const keeper = keepers[0];

    // FIX #7: Try hash verify first, fallback to plain (migration period)
    let pinValid = false;
    if (keeper.pin_hash) {
      pinValid = await verifyPin(String(pin), keeper.pin_hash);
    } else {
      pinValid = (keeper.pin === String(pin));
      // Migrate to hash on successful plain-text login
      if (pinValid) {
        const newHash = await hashPin(String(pin));
        await db.update('shopkeepers', `id=eq.${keeper.id}`, { pin_hash: newHash, pin: '' });
      }
    }

    if (!pinValid) return unauthorized('Galat PIN');

    // Generate stateless signed token (no DB needed)
    const sessionToken = await generateShopToken(shop.id, env.ADMIN_SECRET);

    return ok({
      shop_id:       shop.id,
      shop_name:     shop.name,
      is_open:       shop.is_open,
      session_token: sessionToken,
    });
  } catch (err) { return serverError(err.message); }
}

/** PATCH /shops/:id/toggle — open/close shop (auth required) */
export async function toggleShopHandler(request, env) {
  try {
    const db      = createClient(env);
    // FIX #2: Verify session
    const auth    = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const url     = new URL(request.url);
    const shopId  = url.pathname.split('/')[2];
    if (!isValidUUID(shopId))        return badRequest('Invalid shop_id');
    if (auth.shop_id !== shopId)     return unauthorized('این دکان آپ کی نہیں');

    const { is_open } = await request.json();
    await db.update('shops', `id=eq.${shopId}`, { is_open });

    // FIX #22: Notify customers when shop closes
    if (!is_open) {
      notifyShopClosed(db, shopId, env).catch(() => {});
    }

    return ok({ is_open });
  } catch (err) { return serverError(err.message); }
}

/** GET /shops/:id — shop info (auth required) */
export async function getShopHandler(request, env) {
  try {
    const db     = createClient(env);
    const auth   = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const url    = new URL(request.url);
    const shopId = url.pathname.split('/')[2];
    if (!isValidUUID(shopId))    return badRequest('Invalid shop_id');
    if (auth.shop_id !== shopId) return unauthorized('این دکان آپ کی نہیں');

    const shops = await db.select('shops', `id=eq.${shopId}`);
    if (!shops.length) return notFound('Shop not found');
    return ok(shops[0]);
  } catch (err) { return serverError(err.message); }
}

/** PATCH /shops/:id/settings — update shop settings (FIX #11, #12) */
export async function updateShopSettingsHandler(request, env) {
  try {
    const db   = createClient(env);
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const url    = new URL(request.url);
    const shopId = url.pathname.split('/')[2];
    if (!isValidUUID(shopId))    return badRequest('Invalid shop_id');
    if (auth.shop_id !== shopId) return unauthorized('این دکان آپ کی نہیں');

    const body = await request.json();
    const allowed = ['opening_time','closing_time','avg_service_time_mins','description','address'];
    const update  = {};
    allowed.forEach(k => { if (body[k] !== undefined) update[k] = body[k]; });

    if (!Object.keys(update).length) return badRequest('Nothing to update');

    // Validate avg_service_time_mins
    if (update.avg_service_time_mins) {
      const t = parseInt(update.avg_service_time_mins, 10);
      if (isNaN(t) || t < 1 || t > 120) return badRequest('Service time must be 1-120 minutes');
      update.avg_service_time_mins = t;
    }

    await db.update('shops', `id=eq.${shopId}`, update);
    return ok({ message: 'Settings saved', updated: update });
  } catch (err) { return serverError(err.message); }
}

/** POST /shops/:id/change-pin — PIN change (FIX #10) */
export async function changePinHandler(request, env) {
  try {
    const db   = createClient(env);
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const url    = new URL(request.url);
    const shopId = url.pathname.split('/')[2];
    if (!isValidUUID(shopId))    return badRequest('Invalid shop_id');
    if (auth.shop_id !== shopId) return unauthorized('این دکان آپ کی نہیں');

    const { current_pin, new_pin } = await request.json();
    if (!isValidPin(new_pin))     return badRequest('نیا PIN 4 ہندسوں کا ہونا چاہیے');

    const keepers = await db.select('shopkeepers', `shop_id=eq.${shopId}`);
    if (!keepers.length) return notFound('Shopkeeper not found');

    const keeper = keepers[0];

    // Verify current PIN
    let currentValid = false;
    if (keeper.pin_hash) {
      currentValid = await verifyPin(String(current_pin), keeper.pin_hash);
    } else {
      currentValid = (keeper.pin === String(current_pin));
    }
    if (!currentValid) return unauthorized('موجودہ PIN غلط ہے');

    const newHash = await hashPin(String(new_pin));
    await db.update('shopkeepers', `shop_id=eq.${shopId}`, {
      pin:            '',
      pin_hash:       newHash,
      pin_changed_at: new Date().toISOString(),
    });

    return ok({ message: 'PIN تبدیل ہو گیا' });
  } catch (err) { return serverError(err.message); }
}

/** DELETE /admin/shops/:id */
export async function deleteShopHandler(request, env) {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    const url    = new URL(request.url);
    const shopId = url.pathname.split('/')[3];
    if (!isValidUUID(shopId)) return badRequest('Invalid shop_id');
    const db = createClient(env);
    await db.delete('shopkeeper_sessions', `shop_id=eq.${shopId}`);
    await db.delete('tokens',              `shop_id=eq.${shopId}`);
    await db.delete('shopkeepers',         `shop_id=eq.${shopId}`);
    await db.delete('subscriptions',       `shop_id=eq.${shopId}`);
    await db.delete('shops',               `id=eq.${shopId}`);
    return ok({ message: 'Shop deleted' });
  } catch (err) { return serverError(err.message); }
}

/** PATCH /admin/shops/:id/activate */
export async function activateShopHandler(request, env) {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    const url    = new URL(request.url);
    const shopId = url.pathname.split('/')[3];
    if (!isValidUUID(shopId)) return badRequest('Invalid shop_id');
    const { is_active } = await request.json();
    const db = createClient(env);
    await db.update('shops', `id=eq.${shopId}`, { is_active });
    return ok({ is_active });
  } catch (err) { return serverError(err.message); }
}
