import { hashPin } from '../utils/crypto.js';
// ============================================================
// routes/register.js — Public shop self-registration
// ============================================================

import { createClient } from '../utils/db.js';
import { ok, badRequest, serverError } from '../utils/response.js';
import { isValidPin } from '../utils/validation.js';

/**
 * POST /register — public shop registration request
 * Creates a pending registration (admin approves via dashboard)
 */
export async function submitRegistration(request, env) {
  try {
    const { name, owner_phone, category, area, pin } = await request.json();

    if (!name)            return badRequest('نام ضروری ہے');
    if (!owner_phone)     return badRequest('فون نمبر ضروری ہے');
    if (!isValidPin(pin)) return badRequest('پن 4 ہندسوں کا ہونا چاہیے');
    // FIX #17: Basic phone format validation
    const cleanPhone = String(owner_phone).replace(/\D/g,'');
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      return badRequest('فون نمبر درست نہیں ہے');
    }

    const db = createClient(env);

    // Check not already registered
    const existing = await db.select('shops', `owner_phone=eq.${owner_phone}`);
    if (existing.length) return badRequest('اس نمبر سے پہلے سے دکان رجسٹر ہے');

    // Check not already pending
    const pending = await db.select('shop_registrations', `owner_phone=eq.${owner_phone}&status=eq.pending`);
    if (pending.length) return badRequest('آپ کی درخواست زیر غور ہے');

    // FIX #16: Hash PIN before storing in registrations
    const pinHash = await hashPin(String(pin));
    const [reg] = await db.insert('shop_registrations', {
      name, owner_phone, category, area, pin: pinHash, status: 'pending'
    });

    return ok({ message: 'درخواست موصول ہو گئی! ایڈمن جلد منظوری دے گا۔', id: reg.id });
  } catch (err) {
    return serverError(err.message);
  }
}

/**
 * GET /admin/registrations — list pending registrations (admin only)
 */
export async function listRegistrations(request, env) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const db   = createClient(env);
    const regs = await db.select('shop_registrations', 'status=eq.pending&order=created_at.desc');
    return ok(regs);
  } catch (err) { return serverError(err.message); }
}

/**
 * POST /admin/registrations/:id/approve — approve a registration
 * Creates the actual shop + free trial
 */
export async function approveRegistration(request, env) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const url   = new URL(request.url);
    const regId = url.pathname.split('/')[3];

    const db   = createClient(env);
    const regs = await db.select('shop_registrations', `id=eq.${regId}`);
    if (!regs.length) return badRequest('درخواست نہیں ملی');

    const reg = regs[0];

    // Create shop (trigger auto-provisions free trial)
    const [shop] = await db.insert('shops', {
      name:        reg.name,
      owner_phone: reg.owner_phone,
      category:    reg.category,
      area:        reg.area,
    });

    // Create shopkeeper PIN
    await db.insert('shopkeepers', { shop_id: shop.id, pin: reg.pin });

    // Mark registration approved
    await db.update('shop_registrations', `id=eq.${regId}`, { status: 'approved' });

    return ok({ message: 'دکان رجسٹر ہو گئی اور 30 دن کا فری ٹرائل شروع', shop });
  } catch (err) { return serverError(err.message); }
}

/**
 * POST /admin/registrations/:id/reject
 */
export async function rejectRegistration(request, env) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const url   = new URL(request.url);
    const regId = url.pathname.split('/')[3];
    const db    = createClient(env);
    await db.update('shop_registrations', `id=eq.${regId}`, { status: 'rejected' });
    return ok({ message: 'درخواست رد کر دی گئی' });
  } catch (err) { return serverError(err.message); }
}
