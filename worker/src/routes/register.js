// ============================================================
// routes/register.js — Public shop self-registration
// ============================================================

import { hashPin }         from '../utils/crypto.js';
import { createClient }    from '../utils/db.js';
import { assignPlan }      from '../services/subscriptionService.js';
import { ok, badRequest, serverError, unauthorized } from '../utils/response.js';
import { isValidPin }      from '../utils/validation.js';

export async function submitRegistration(request, env) {
  try {
    const body = await request.json();
    const { name, owner_phone, category, area, city, country, pin,
            token_mode, token_price } = body;

    if (!name)            return badRequest('نام ضروری ہے');
    if (!owner_phone)     return badRequest('فون نمبر ضروری ہے');
    if (!isValidPin(pin)) return badRequest('PIN 4 ہندسوں کا ہونا چاہیے');

    const cleanPhone = String(owner_phone).replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      return badRequest('فون نمبر درست نہیں ہے');
    }

    const db = createClient(env);

    const existing = await db.select('shops', `owner_phone=eq.${owner_phone}`);
    if (existing.length) return badRequest('اس نمبر سے پہلے سے دکان رجسٹر ہے');

    const pending = await db.select('shop_registrations',
      `owner_phone=eq.${owner_phone}&status=eq.pending`);
    if (pending.length) return badRequest('آپ کی درخواست زیر غور ہے');

    const pinHash = await hashPin(String(pin)).catch(() => String(pin));

    // Only insert columns that definitely exist
    const regData = {
      name,
      owner_phone,
      category:    category    || null,
      area:        area        || null,
      city:        city        || null,
      country:     country     || 'Pakistan',
      token_mode:  token_mode  || 'free',
      token_price: token_price || 0,
      pin:         pinHash,
      status:      'pending',
    };

    const [reg] = await db.insert('shop_registrations', regData);
    return ok({ message: 'درخواست موصول ہو گئی! ایڈمن جلد منظوری دے گا۔', id: reg.id });
  } catch (err) {
    return serverError(err.message);
  }
}

export async function listRegistrations(request, env) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== env.ADMIN_SECRET) {
    return unauthorized('Unauthorized');
  }
  try {
    const db   = createClient(env);
    const regs = await db.select('shop_registrations', 'status=eq.pending&order=created_at.desc');
    return ok(regs);
  } catch (err) { return serverError(err.message); }
}

export async function approveRegistration(request, env) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== env.ADMIN_SECRET) {
    return unauthorized('Unauthorized');
  }
  try {
    const regId = new URL(request.url).pathname.split('/')[3];
    const db    = createClient(env);
    const regs  = await db.select('shop_registrations', `id=eq.${regId}`);
    if (!regs.length) return badRequest('درخواست نہیں ملی');

    const reg = regs[0];

    const [shop] = await db.insert('shops', {
      name:        reg.name,
      owner_phone: reg.owner_phone,
      category:    reg.category    || null,
      area:        reg.area        || null,
      city:        reg.city        || null,
      country:     reg.country     || 'Pakistan',
      token_mode:  reg.token_mode  || 'free',
      token_price: reg.token_price || 0,
      is_active:   true,
    });

    // pin from registrations is already hashed
    await db.insert('shopkeepers', {
      shop_id:  shop.id,
      pin:      '',
      pin_hash: reg.pin,
    });

    try { await assignPlan(db, shop.id, 'free'); } catch(e) {}
    await db.update('shop_registrations', `id=eq.${regId}`, { status: 'approved' });

    return ok({ message: 'دکان رجسٹر ہو گئی اور 30 دن کا فری ٹرائل شروع', shop });
  } catch (err) { return serverError(err.message); }
}

export async function rejectRegistration(request, env) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== env.ADMIN_SECRET) {
    return unauthorized('Unauthorized');
  }
  try {
    const regId = new URL(request.url).pathname.split('/')[3];
    const db    = createClient(env);
    await db.update('shop_registrations', `id=eq.${regId}`, { status: 'rejected' });
    return ok({ message: 'درخواست رد کر دی گئی' });
  } catch (err) { return serverError(err.message); }
}
