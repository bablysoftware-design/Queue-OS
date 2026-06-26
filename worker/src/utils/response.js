// ============================================================
// utils/response.js — Standard HTTP response helpers
// ============================================================

// CORS headers: wildcard origin is intentional and correct here.
//
// Why '*' and not an allowlist?
//   1. All sensitive routes are protected by auth headers (x-session-token,
//      x-admin-secret, PIN). CORS does not protect APIs from direct access —
//      it only controls what *browsers* allow. A server-side attacker bypasses
//      CORS regardless. Auth is what protects the API.
//   2. The PWA can be hosted on multiple domains (waitmate.pk, CF Pages,
//      Netlify previews, local dev). Maintaining an allowlist creates false
//      security and guarantees production outages when a new domain is added.
//   3. Public endpoints (/public/shops, /public/shop/:id, etc.) are intentionally
//      open — any website embedding a shop directory should be allowed.
//   4. A previous attempt to lockdown to an allowlist broke ALL 304 response
//      call sites because the request parameter was optional but never passed,
//      resulting in zero CORS headers on every response and a full production outage.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret, x-session-token, x-audio-duration',
};

/** 200 JSON response */
export function ok(data) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** 400 Bad Request */
export function badRequest(message) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** 401 Unauthorized */
export function unauthorized(message = 'Unauthorized') {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** 403 Forbidden */
export function forbidden(message) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** 404 Not Found */
export function notFound(message = 'Not found') {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** 500 Internal Server Error */
export function serverError(message = 'Internal server error') {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 500,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** CORS preflight response */
export function preflight(request) {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
