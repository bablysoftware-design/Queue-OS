// ============================================================
// utils/auth.js — Shopkeeper session auth middleware
// ============================================================

import { unauthorized } from './response.js';

/**
 * Validate shopkeeper session token.
 * Shopkeeper sends: x-session-token header
 * Returns { shop_id } if valid, or a 401 Response if not.
 *
 * Usage:
 *   const auth = await requireShopAuth(request, env, db);
 *   if (auth instanceof Response) return auth; // 401
 *   const { shop_id } = auth;
 */
export async function requireShopAuth(request, env, db) {
  const token = request.headers.get('x-session-token');
  if (!token) return unauthorized('Session token required');

  const sessions = await db.select(
    'shopkeeper_sessions',
    `token=eq.${token}&expires_at=gte.${new Date().toISOString()}&select=shop_id`
  );

  if (!sessions.length) return unauthorized('Invalid or expired session');

  return { shop_id: sessions[0].shop_id };
}

/** Check admin secret header */
export function requireAdmin(request, env) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== env.ADMIN_SECRET) return unauthorized('Admin access denied');
  return null;
}
