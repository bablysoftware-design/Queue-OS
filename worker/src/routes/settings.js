// ============================================================
// routes/settings.js — App settings (contact support, etc)
// ============================================================
import { createClient }  from '../utils/db.js';
import { requireAdmin }  from '../utils/auth.js';
import { ok, badRequest, serverError } from '../utils/response.js';

/** GET /public/settings — fetch public settings (no auth) */
export async function getPublicSettings(request, env) {
  try {
    const db   = createClient(env);
    const rows = await db.select('app_settings', '');
    const out  = {};
    rows.forEach(r => { out[r.key] = r.value; });
    return ok(out);
  } catch(err) {
    // Return defaults if table doesn't exist yet
    return ok({
      support_whatsapp: '',
      support_email:    '',
      support_message:  'Need help? Contact us!',
    });
  }
}

/** PATCH /admin/settings — update settings (admin only) */
export async function updateSettings(request, env) {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    const body = await request.json();
    const db   = createClient(env);
    const allowed = ['support_whatsapp','support_email','support_message'];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        await db.upsert('app_settings', { key, value: String(body[key]), updated_at: new Date().toISOString() }, 'key');
      }
    }
    return ok({ message: 'Settings updated' });
  } catch(err) { return serverError(err.message); }
}
