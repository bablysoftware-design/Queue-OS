// ============================================================
// utils/response.js — Standard HTTP response helpers
// ============================================================

// Allowed origins — the PWA frontends that may call this worker.
// '*' (wildcard) removed: locking down prevents other websites from
// using your worker as a proxy and abusing rate limits / API quota.
// Add your production domain here when you get a custom domain.
const ALLOWED_ORIGINS = new Set([
  'https://saf-queue-worker.byker-software.workers.dev', // worker itself (health checks)
  'https://waitmate.netlify.app',   // production Netlify deploy (update to your domain)
  'https://waitmate.pages.dev',     // Cloudflare Pages deploy
  'http://localhost:3000',          // local dev
  'http://localhost:8788',          // wrangler dev
  'http://127.0.0.1:5500',          // VS Code Live Server
]);

function getCorsHeaders(request) {
  const origin = request?.headers?.get('Origin') || '';
  // If the request comes from an allowed origin, echo it back.
  // Otherwise return no ACAO header — browser will block the request.
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret, x-session-token, x-audio-duration',
    'Vary': 'Origin',
  };
}

// Legacy constant kept for preflight() which doesn't have a request object
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret, x-session-token, x-audio-duration',
};

/** 200 JSON response */
export function ok(data, request) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
  });
}

/** 400 Bad Request */
export function badRequest(message, request) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
  });
}

/** 401 Unauthorized */
export function unauthorized(message = 'Unauthorized', request) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
  });
}

/** 403 Forbidden */
export function forbidden(message, request) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
  });
}

/** 404 Not Found */
export function notFound(message = 'Not found', request) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
  });
}

/** 500 Internal Server Error */
export function serverError(message = 'Internal server error', request) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 500,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
  });
}

/** CORS preflight — must allow all origins at OPTIONS stage so browser
 *  sends the actual request; ACAO for the real request is then validated. */
export function preflight(request) {
  const origin = request?.headers?.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : '*';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  allowed,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret, x-session-token, x-audio-duration',
      'Vary': 'Origin',
    },
  });
}
