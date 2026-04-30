// ============================================================
// utils/auth.js — Shopkeeper auth
// Simple approach: sign shop_id with ADMIN_SECRET, verify on each request
// No DB lookup needed — stateless
// ============================================================

import { unauthorized } from './response.js';

/**
 * Generate a simple signed token: base64(shop_id):signature
 * Signature = first 16 chars of hex(SHA256(shop_id + secret))
 */
export async function generateShopToken(shopId, secret) {
  const data   = new TextEncoder().encode(shopId + secret);
  const hash   = await crypto.subtle.digest('SHA-256', data);
  const hex    = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  const sig    = hex.slice(0, 32);
  return btoa(shopId) + '.' + sig;
}

/**
 * Verify a shop token. Returns { shop_id } or a 401 Response.
 */
export async function requireShopAuth(request, env, db) {
  const token = request.headers.get('x-session-token');
  if (!token) return unauthorized('Session token required');

  try {
    const [encodedId, sig] = token.split('.');
    if (!encodedId || !sig) return unauthorized('Invalid token format');

    const shopId   = atob(encodedId);
    const expected = await generateShopToken(shopId, env.ADMIN_SECRET);
    const [, expectedSig] = expected.split('.');

    if (sig !== expectedSig) return unauthorized('Invalid token signature');

    return { shop_id: shopId };
  } catch {
    return unauthorized('Invalid token');
  }
}

/** Admin secret check */
export function requireAdmin(request, env) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== env.ADMIN_SECRET) return unauthorized('Admin access denied');
  return null;
}
