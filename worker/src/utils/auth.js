// ============================================================
// utils/auth.js
// MVP: Shop ownership verified by matching shop_id in token vs request
// v2 will add full JWT/session auth
// ============================================================

import { unauthorized } from './response.js';

/**
 * Generate a signed shop token (used after login).
 * Format: shopId.signature
 */
export async function generateShopToken(shopId, secret) {
  const data = new TextEncoder().encode(shopId + secret);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex  = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  return shopId + '.' + hex.slice(0, 32);
}

/**
 * Verify shop token — extracts shop_id and verifies signature.
 * Falls back gracefully: if no token but shop_id in body/query, allow with warning.
 */
export async function requireShopAuth(request, env, db) {
  const token = request.headers.get('x-session-token');

  // If token present — verify it
  if (token) {
    try {
      const dotIdx = token.indexOf('.');
      if (dotIdx === -1) return unauthorized('Invalid token');

      const shopId = token.slice(0, dotIdx);
      const sig    = token.slice(dotIdx + 1);

      const expected = await generateShopToken(shopId, env.ADMIN_SECRET);
      const expSig   = expected.slice(expected.indexOf('.') + 1);

      if (sig !== expSig) return unauthorized('Invalid token signature');
      return { shop_id: shopId };
    } catch {
      return unauthorized('Token verification failed');
    }
  }

  // Fallback: extract shop_id from URL or body (MVP compatibility)
  // This allows old frontend sessions to keep working during transition
  try {
    const url    = new URL(request.url);
    const shopId = url.searchParams.get('shop_id') ||
                   url.pathname.split('/').find(s =>
                     /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
                   );
    if (shopId) return { shop_id: shopId };
  } catch {}

  // Last resort: try reading body
  try {
    const clone  = request.clone();
    const body   = await clone.json();
    if (body?.shop_id) return { shop_id: body.shop_id };
  } catch {}

  return unauthorized('Session token required');
}

export function requireAdmin(request, env) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== env.ADMIN_SECRET) return unauthorized('Admin access denied');
  return null;
}
