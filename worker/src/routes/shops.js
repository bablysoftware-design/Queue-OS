// ============================================================
// routes/shops.js — Shop management
// ============================================================

import { createClient }         from '../utils/db.js';
import { hashPin, verifyPin }   from '../utils/crypto.js';
import { generateShopToken }    from '../utils/auth.js';
import { requireShopAuth, requireAdmin } from '../utils/auth.js';
import { ok, badRequest, serverError, notFound, unauthorized } from '../utils/response.js';
import { isValidPin, isValidUUID } from '../utils/validation.js';
import { notifyShopClosed }     from '../services/tokenService.js';
import { assignPlan, getActiveSubscription, getLastSubscription } from '../services/subscriptionService.js';

/** POST /shops — create shop (admin only) */
export async function createShopHandler(request, env) {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    const { name, category, area, owner_phone, pin,
            opening_time, closing_time, description, address } = await request.json();
    if (!name)            return badRequest('name required');
    if (!owner_phone)     return badRequest('owner_phone required');
    if (!isValidPin(pin)) return badRequest('PIN must be 4 digits');

    const db       = createClient(env);
    const existing = await db.select('shops', `owner_phone=eq.${owner_phone}`);
    if (existing.length) return badRequest('اس نمبر سے پہلے سے دکان رجسٹر ہے');

    const [shop] = await db.insert('shops', {
      name, category, area, owner_phone,
      opening_time: opening_time || '09:00',
      closing_time: closing_time || '21:00',
      description:  description  || null,
      address:      address      || null,
    });

    // Store PIN hashed only — never store plain text PINs.
    // If hashing fails, throw rather than fall back to plain storage.
    const pinHash = await hashPin(String(pin));
    await db.insert('shopkeepers', {
      shop_id:  shop.id,
      pin:      '',         // always blank — login checks pin_hash only
      pin_hash: pinHash,
    });

    // Assign free trial plan — mirrors register.js approval flow.
    // Without this, the shop has no subscription row and customers
    // get "free trial khatam" error immediately on joining.
    try { await assignPlan(db, shop.id, 'free'); } catch(e) {
      console.error('[createShop] assignPlan failed:', e.message);
    }

    return ok({ shop, message: '30 din ka free trial shuru ho gaya!' });
  } catch (err) { return serverError(err.message); }
}

/** POST /shops/login */
export async function loginShopHandler(request, env) {
  try {
    const { owner_phone, pin } = await request.json();
    if (!owner_phone || !pin) return badRequest('Phone aur PIN chahiye');

    const db    = createClient(env);
    const shops = await db.select('shops', `owner_phone=eq.${owner_phone}`);
    if (!shops.length) return notFound('دکان نہیں ملی');

    const shop    = shops[0];
    const keepers = await db.select('shopkeepers', `shop_id=eq.${shop.id}`);
    if (!keepers.length) return unauthorized('Shopkeeper not found');

    const keeper   = keepers[0];
    const pinStr   = String(pin);
    let pinValid   = false;

    // Try hashed PIN first, fall back to plain
    if (keeper.pin_hash) {
      pinValid = await verifyPin(pinStr, keeper.pin_hash).catch(() => false);
    }
    // Always also try plain comparison (covers migration period)
    if (!pinValid && keeper.pin) {
      pinValid = (keeper.pin === pinStr);
      // If plain match succeeds, migrate to hash silently
      if (pinValid) {
        const newHash = await hashPin(pinStr).catch(() => null);
        if (newHash) {
          db.update('shopkeepers', `shop_id=eq.${shop.id}`, { pin_hash: newHash, pin: '' })
            .catch(() => {});
        }
      }
    }

    if (!pinValid) return unauthorized('Galat PIN');

    const sessionToken = await generateShopToken(shop.id, env.ADMIN_SECRET);
    return ok({
      shop_id:       shop.id,
      shop_name:     shop.name,
      is_open:       shop.is_open,
      session_token: sessionToken,
    });
  } catch (err) { return serverError(err.message); }
}

/** PATCH /shops/:id/toggle */
export async function toggleShopHandler(request, env) {
  try {
    const db   = createClient(env);
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const shopId = new URL(request.url).pathname.split('/')[2];
    if (!isValidUUID(shopId))        return badRequest('Invalid shop_id');
    if (auth.shop_id !== shopId)     return unauthorized('این دکان آپ کی نہیں');

    const { is_open } = await request.json();
    await db.update('shops', `id=eq.${shopId}`, { is_open });
    if (!is_open) notifyShopClosed(db, shopId, env).catch(() => {});
    return ok({ is_open });
  } catch (err) { return serverError(err.message); }
}

/** GET /shops/:id */
export async function getShopHandler(request, env) {
  try {
    const db     = createClient(env);
    const auth   = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const shopId = new URL(request.url).pathname.split('/')[2];
    if (!isValidUUID(shopId))    return badRequest('Invalid shop_id');
    if (auth.shop_id !== shopId) return unauthorized('این دکان آپ کی نہیں');

    const shops = await db.select('shops', `id=eq.${shopId}`);
    if (!shops.length) return notFound('Shop not found');
    return ok(shops[0]);
  } catch (err) { return serverError(err.message); }
}

/** PATCH /shops/:id/settings */
export async function updateShopSettingsHandler(request, env) {
  try {
    const db   = createClient(env);
    const auth = await requireShopAuth(request, env);

    // ── DIAGNOSTIC: log auth result type ──────────────────────

    if (auth instanceof Response) return auth;

    const shopId = new URL(request.url).pathname.split('/')[2];

    // ── DIAGNOSTIC: log exact ID values and comparison ────────

    if (!isValidUUID(shopId))    return badRequest('Invalid shop_id');
    if (auth.shop_id !== shopId) return unauthorized('این دکان آپ کی نہیں');

    const body    = await request.json();
    const allowed = [
      'opening_time',
      'closing_time',
      'opening_hours',
      'avg_service_time_mins',
      'description',
      'address',
      'token_mode',
      'token_price',
    ];
    const update  = {};
    allowed.forEach(k => { if (body[k] !== undefined) update[k] = body[k]; });

    // ── DIAGNOSTIC: log body and built update object ───────────

    if (!Object.keys(update).length) return badRequest('Nothing to update');
    if (update.avg_service_time_mins) {
      const t = parseInt(update.avg_service_time_mins, 10);
      if (isNaN(t) || t < 1 || t > 120) return badRequest('Service time must be 1-120 minutes');
      update.avg_service_time_mins = t;
    }
    if (update.token_mode && !['free','paid'].includes(update.token_mode)) {
      return badRequest('Invalid token mode');
    }
    if (update.token_price !== undefined) {
      const p = parseInt(update.token_price, 10);
      if (isNaN(p) || p < 0 || p > 100000) {
        return badRequest('Invalid token price');
      }
      update.token_price = p;
    }

    await db.update('shops', `id=eq.${shopId}`, update);

    return ok({ message: 'Settings saved', updated: update });
  } catch (err) {
    return serverError(err.message);
  }
}

/** POST /shops/:id/change-pin */
export async function changePinHandler(request, env) {
  try {
    const db   = createClient(env);
    const auth = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;

    const shopId = new URL(request.url).pathname.split('/')[2];
    if (!isValidUUID(shopId))    return badRequest('Invalid shop_id');
    if (auth.shop_id !== shopId) return unauthorized('این دکان آپ کی نہیں');

    const { current_pin, new_pin } = await request.json();
    if (!isValidPin(new_pin)) return badRequest('نیا PIN 4 ہندسوں کا ہونا چاہیے');

    const keepers = await db.select('shopkeepers', `shop_id=eq.${shopId}`);
    if (!keepers.length) return notFound('Shopkeeper not found');

    const keeper     = keepers[0];
    let currentValid = false;
    if (keeper.pin_hash) {
      currentValid = await verifyPin(String(current_pin), keeper.pin_hash).catch(() => false);
    }
    if (!currentValid && keeper.pin) {
      currentValid = (keeper.pin === String(current_pin));
    }
    if (!currentValid) return unauthorized('موجودہ PIN غلط ہے');

    const newHash = await hashPin(String(new_pin));
    await db.update('shopkeepers', `shop_id=eq.${shopId}`, { pin: '', pin_hash: newHash });
    return ok({ message: 'PIN تبدیل ہو گیا' });
  } catch (err) { return serverError(err.message); }
}

/** DELETE /admin/shops/:id */
export async function deleteShopHandler(request, env) {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    const shopId = new URL(request.url).pathname.split('/')[3];
    if (!isValidUUID(shopId)) return badRequest('Invalid shop_id');
    const db = createClient(env);
    await db.delete('tokens',        `shop_id=eq.${shopId}`);
    await db.delete('shopkeepers',   `shop_id=eq.${shopId}`);
    await db.delete('subscriptions', `shop_id=eq.${shopId}`);
    await db.delete('shops',         `id=eq.${shopId}`);
    return ok({ message: 'Shop deleted' });
  } catch (err) { return serverError(err.message); }
}

/** PATCH /admin/shops/:id/activate */
export async function activateShopHandler(request, env) {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    const shopId    = new URL(request.url).pathname.split('/')[3];
    if (!isValidUUID(shopId)) return badRequest('Invalid shop_id');
    const body       = await request.json();
    const is_active  = body.is_active;
    const bodyPlan   = body.plan_name   || null;   // optional admin override
    const bodyDays   = body.duration_days != null
                         ? parseInt(body.duration_days, 10)
                         : null;                   // optional duration override
    const db = createClient(env);

    if (is_active) {
      // Activating: ensure a valid (non-expired) subscription exists.
      // assignPlan() already sets shops.is_active=true at the end of
      // its own execution, so no separate write is needed on those paths.

      // BUG FIX: Use getActiveSubscription for the "still valid" check,
      // but fall back to getLastSubscription (any status) to recover the
      // previous plan_name and custom duration when reactivating an expired
      // or cancelled subscription. Without this, getActiveSubscription()
      // returns null for expired subs and we incorrectly fall through to
      // the "no subscription" branch, assigning a free plan and losing
      // any Pro/Basic/custom-period the admin had set.
      const active = await getActiveSubscription(db, shopId);
      const today  = new Date().toISOString().split('T')[0];

      // Only take the "already valid, do nothing" shortcut when the admin
      // did NOT explicitly request a plan/duration override. If the admin
      // opened the activation modal and chose a plan + duration, that is
      // deliberate intent and must always be honored — even if a
      // technically-still-valid subscription already exists (e.g. it
      // expires in a few days and the admin is proactively renewing it
      // for a fresh period). Previously this branch unconditionally
      // short-circuited on any future-dated end_date, silently discarding
      // the admin's explicit duration_days/plan_name selection.
      const hasExplicitOverride = (bodyDays != null && bodyDays >= 1 && bodyDays <= 366)
                                || (bodyPlan && ['free','basic','pro'].includes(bodyPlan));

      if (active && active.end_date >= today && !hasExplicitOverride) {
        // Valid, future-dated subscription already exists and admin did not
        // request a specific renewal — do not touch subscriptions at all,
        // just unhide the shop.
        await db.update('shops', `id=eq.${shopId}`, { is_active: true });
        return ok({ is_active: true });
      }

      // No active/valid subscription — check history for plan + period info.
      // getLastSubscription() returns the most recent row regardless of status
      // (expired, cancelled, or even the stale active row that passed end_date).
      const last = await getLastSubscription(db, shopId);

      if (!last) {
        // Shop has never had any subscription — provision a fresh free trial.
        await assignPlan(db, shopId, 'free');
        return ok({ is_active: true, subscription_created: true });
      }

      // Renew using the same plan and, crucially, the SAME duration the
      // admin originally set. This preserves custom periods (e.g. 60 days)
      // so reactivating a Pro business doesn't silently downgrade it to
      // the plan table's default 30-day window.
      const planName     = last.plan_name || 'free';
      const lastStart    = last.start_date ? new Date(last.start_date) : null;
      const lastEnd      = last.end_date   ? new Date(last.end_date)   : null;
      let   durationDays = null;

      if (lastStart && lastEnd && !isNaN(lastStart) && !isNaN(lastEnd)) {
        const msPerDay = 86400000;
        durationDays = Math.round((lastEnd - lastStart) / msPerDay);
        // Clamp to a sane range: at least 1 day, at most 366 days.
        if (durationDays < 1 || durationDays > 366) durationDays = null;
      }

      // Admin UI override — if the admin explicitly chose a duration and/or
      // plan in the activation modal, those take precedence over the auto-
      // detected values from the subscription history.
      const finalPlan = (bodyPlan && ['free','basic','pro'].includes(bodyPlan))
                          ? bodyPlan
                          : planName;
      const finalDays = (bodyDays != null && bodyDays >= 1 && bodyDays <= 366)
                          ? bodyDays
                          : durationDays;

      await assignPlan(db, shopId, finalPlan, finalDays);
      return ok({ is_active: true, subscription_renewed: true, plan: finalPlan, duration_days: finalDays });
    }

    // Deactivation path — unchanged. Only toggles shops.is_active.
    await db.update('shops', `id=eq.${shopId}`, { is_active: false });
    return ok({ is_active: false });
  } catch (err) { return serverError(err.message); }
}

/** POST /admin/shops/:id/reset-pin — Admin resets a business PIN */
export async function adminResetPinHandler(request, env) {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    const shopId  = new URL(request.url).pathname.split('/')[3];
    if (!isValidUUID(shopId)) return badRequest('Invalid shop_id');
    const { new_pin } = await request.json();
    if (!isValidPin(new_pin)) return badRequest('PIN must be 4 digits');

    const db      = createClient(env);
    const newHash = await hashPin(String(new_pin));
    await db.update('shopkeepers', `shop_id=eq.${shopId}`, {
      pin:      '',          // clear any legacy plain-text PIN
      pin_hash: newHash,
    });
    return ok({ message: 'PIN reset successfully' });
  } catch (err) { return serverError(err.message); }
}


/** GET /shops/:id/scan-stats — scan counts for business dashboard */
export async function getScanStats(request, env) {
  const zero = { today: 0, week: 0, total: 0 };
  try {
    const auth   = await requireShopAuth(request, env);
    if (auth instanceof Response) return auth;
    // Path: /shops/:id/scan-stats  →  ['','shops',UUID,'scan-stats']
    const shopId = new URL(request.url).pathname.split('/')[2];
    if (!isValidUUID(shopId))    return badRequest('Invalid shop_id');
    if (auth.shop_id !== shopId) return unauthorized('Not your shop');

    const db     = createClient(env);
    const rows   = await db.rpc('get_shop_scan_counts', { p_shop_id: shopId });
    // RPC returns a JSON object (not array) via PostgREST scalar function
    const result = Array.isArray(rows) ? rows[0] : rows;
    return ok(result || zero);
  } catch(err) {
    return ok(zero); // shop_scans table may not exist yet — always return safely
  }
}
