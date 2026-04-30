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
