// ============================================================
// utils/sanitize.js — Input sanitization (Fix #4)
// ============================================================

/**
 * Sanitize a value for safe use in PostgREST query strings.
 * Strips characters that could manipulate query parameters.
 */
export function sanitizeParam(value) {
  if (!value) return '';
  return String(value)
    .replace(/[&=<>"'%;(){}[\]\\]/g, '') // strip special chars
    .trim()
    .slice(0, 100); // max length
}

/** Sanitize free-text search (less strict) */
export function sanitizeSearch(value) {
  if (!value) return '';
  return String(value)
    .replace(/[<>"'%;]/g, '')
    .trim()
    .slice(0, 100);
}

/** Sanitize customer name for DB storage */
export function sanitizeName(value) {
  if (!value) return '';
  return String(value)
    .replace(/[<>"]/g, '') // strip XSS vectors
    .trim()
    .slice(0, 80);
}

// ── Simple rate limiter (in-memory, resets on worker restart) ──────────────
const _rateBuckets = new Map();

/**
 * Check if IP has exceeded rate limit.
 * @param {string} key   — unique key e.g. "join:1.2.3.4:shopId"
 * @param {number} max   — max requests
 * @param {number} windowMs — time window in ms
 * @returns {boolean} true if rate limit exceeded
 */
export function isRateLimited(key, max = 5, windowMs = 60_000) {
  const now    = Date.now();
  const bucket = _rateBuckets.get(key) || { count: 0, reset: now + windowMs };

  if (now > bucket.reset) {
    // Window expired — reset
    bucket.count = 1;
    bucket.reset = now + windowMs;
  } else {
    bucket.count++;
  }

  _rateBuckets.set(key, bucket);

  // Cleanup old buckets periodically (every 500 calls)
  if (_rateBuckets.size > 500) {
    for (const [k, v] of _rateBuckets) {
      if (now > v.reset) _rateBuckets.delete(k);
    }
  }

  return bucket.count > max;
}
