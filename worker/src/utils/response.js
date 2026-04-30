// ============================================================
// utils/response.js — Standard HTTP response helpers
// ============================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret, x-session-token',
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
export function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
