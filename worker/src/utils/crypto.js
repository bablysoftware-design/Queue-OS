// ============================================================
// utils/crypto.js — PIN hashing using Web Crypto (no npm needed)
// ============================================================

const SALT = 'saf-queue-2024'; // static salt — add env var later for extra security

/** Hash a 4-digit PIN using SHA-256 */
export async function hashPin(pin) {
  const data    = new TextEncoder().encode(SALT + String(pin));
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Compare a raw PIN against a stored hash */
export async function verifyPin(pin, storedHash) {
  const hash = await hashPin(pin);
  return hash === storedHash;
}

/** Generate a secure session token */
export function generateSessionToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}
