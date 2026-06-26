// ============================================================
// utils/auth.js — Stateless shopkeeper authentication
//
// How it works:
//   Login  → server signs (shop_id + issuedAt) with ADMIN_SECRET → returns token
//   Request → client sends token in x-session-token header
//   Server  → verifies signature + checks expiry — no DB lookup needed
//
// Token format: <shopId>.<issuedAt_base36>.<sha256_sig_32chars>
// Token lifetime: TOKEN_TTL_DAYS (30 days). Older tokens are rejected.
// Old 2-part tokens (<shopId>.<sig>) are also rejected, forcing re-login.
// ============================================================

import { unauthorized } from './response.js';

const TOKEN_TTL_DAYS = 30;
const TOKEN_TTL_MS   = TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Generate a signed, time-limited token for a shop.
 * Signs SHA-256(shopId + "|" + issuedAt + "|" + secret).
 * issuedAt encoded as base-36 to keep the token compact.
 */
export async function generateShopToken(shopId, secret, issuedAt = Date.now()) {
  const iat  = issuedAt.toString(36); // compact base-36 timestamp
  const data = new TextEncoder().encode(`${shopId}|${iat}|${secret}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex  = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `${shopId}.${iat}.${hex.slice(0, 32)}`;
}

/**
 * Verify x-session-token header and return { shop_id }.
 * Returns a 401 Response if invalid or expired.
 */
export async function requireShopAuth(request, env) {
  const token = request.headers.get('x-session-token');

  if (!token) return unauthorized('لاگ ان ضروری ہے');

  const parts = token.split('.');

  // Legacy 2-part tokens (pre-expiry) are no longer accepted.
  // Shopkeepers will be prompted to log in again once — one-time cost.
  if (parts.length < 3) return unauthorized('Session expired — please login again');

  // New format: <shopId (may contain hyphens so multiple dots)>.<iat>.<sig>
  // shopId is a UUID (8-4-4-4-12) — 5 segments of hex separated by hyphens,
  // joined by hyphens not dots, so it never contains a dot.
  // Safe to split on last two dots.
  const sig     = parts[parts.length - 1];
  const iatStr  = parts[parts.length - 2];
  const shopId  = parts.slice(0, parts.length - 2).join('.');

  if (!shopId || sig.length !== 32 || !iatStr) {
    return unauthorized('Invalid token format');
  }

  // Expiry check BEFORE signature (fast rejection of stale tokens)
  const issuedAt = parseInt(iatStr, 36);
  if (isNaN(issuedAt) || Date.now() - issuedAt > TOKEN_TTL_MS) {
    return unauthorized('Session expired — please login again');
  }

  // Signature verification
  const expected = await generateShopToken(shopId, env.ADMIN_SECRET, issuedAt);
  const expSig   = expected.split('.').pop();

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
