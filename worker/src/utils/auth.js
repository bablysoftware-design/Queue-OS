// ============================================================
// utils/auth.js — Stateless shopkeeper authentication
//
// How it works:
//   Login  → server signs shop_id with ADMIN_SECRET → returns token
//   Request → client sends token in x-session-token header
//   Server  → verifies signature → extracts shop_id — no DB lookup
//
// Token format: <shopId>.<sha256_signature_32chars>
// ============================================================

import { unauthorized } from './response.js';

/**
 * Generate a signed token for a shop.
 * Uses SHA-256(shopId + ADMIN_SECRET) as signature.
 */
export async function generateShopToken(shopId, secret) {
  const data = new TextEncoder().encode(shopId + '|' + secret);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex  = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `${shopId}.${hex.slice(0, 32)}`;
}

/**
 * Verify x-session-token header and return { shop_id }.
 * Returns a 401 Response if invalid.
 */
export async function requireShopAuth(request, env) {
  const token = request.headers.get('x-session-token');

  if (!token || !token.includes('.')) {
    return unauthorized('لاگ ان ضروری ہے');
  }

  const lastDot = token.lastIndexOf('.');
  const shopId  = token.slice(0, lastDot);
  const sig     = token.slice(lastDot + 1);

  if (!shopId || sig.length !== 32) {
    return unauthorized('Invalid token format');
  }

  const expected = await generateShopToken(shopId, env.ADMIN_SECRET);
  const expSig   = expected.slice(expected.lastIndexOf('.') + 1);

  if (sig !== expSig) {
    return unauthorized('Invalid token — please login again');
  }

  return { shop_id: shopId };
}

/** Verify admin secret header */
export function requireAdmin(request, env) {
  const secret = request.headers.get('x-admin-secret');
  if (!secret || secret !== env.ADMIN_SECRET) {
    return unauthorized('Admin access denied');
  }
  return null;
}

/**
 * Allow either admin secret OR valid shop session token.
 * Returns null (ok) or an error Response.
 * Also returns the shop_id if authenticated via session token.
 */
export async function requireShopOrAdmin(request, env) {
  const adminSecret = request.headers.get('x-admin-secret');
  if (adminSecret && adminSecret === env.ADMIN_SECRET) return { shop_id: null, isAdmin: true };

  const auth = await requireShopAuth(request, env);
  if (auth instanceof Response) return auth; // 401
  return { shop_id: auth.shop_id, isAdmin: false };
}
