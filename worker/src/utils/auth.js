// ============================================================
// utils/auth.js — Shopkeeper session auth middleware
// ============================================================

import { unauthorized } from './response.js';

export async function requireShopAuth(request, env, db) {
  const token = request.headers.get('x-session-token');
  if (!token) return unauthorized('Session token required');

  const sessions = await db.select(
    'shopkeeper_sessions',
    `token=eq.${token}&select=shop_id,expires_at`
  );

  if (!sessions.length) return unauthorized('Invalid or expired session');

  // Check expiry in application code (avoids URL encoding issues)
  const session = sessions[0];
  if (new Date(session.expires_at) < new Date()) {
    return unauthorized('Session expired — please login again');
  }

  return { shop_id: session.shop_id };
}

export function requireAdmin(request, env) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== env.ADMIN_SECRET) return unauthorized('Admin access denied');
  return null;
}
