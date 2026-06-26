// ============================================================
// services/whatsappService.js
// WhatsApp Cloud API message sending with rate limiting
// ============================================================

const WA_API_BASE = 'https://graph.facebook.com/v19.0';

// ── Rate limiting ──────────────────────────────────────────────
// In-memory buckets (per worker isolate). Resets on cold start but
// that's fine — the goal is preventing burst floods, not perfect accounting.
//
// Per-recipient: at most 1 message per phone per shop per 60 seconds.
// This prevents a rapid Next→Next→Next from spamming one customer.
//
// Global: at most 30 messages per 60 seconds across all sends.
// Meta's WhatsApp Cloud API has a per-number rate limit; staying well
// under it avoids quality rating drops and number bans.

const _waRecipientBucket = new Map(); // key: `${shopId}:${phone}` → last sent ms
const _waGlobalWindow    = { count: 0, windowStart: 0 };
const WA_PER_RECIPIENT_MS  = 60_000; // 1 message per recipient per minute
const WA_GLOBAL_MAX        = 30;     // max messages per minute globally
const WA_GLOBAL_WINDOW_MS  = 60_000;

function waRateLimited(shopId, to) {
  const now = Date.now();

  // Global window
  if (now - _waGlobalWindow.windowStart > WA_GLOBAL_WINDOW_MS) {
    _waGlobalWindow.count = 0;
    _waGlobalWindow.windowStart = now;
  }
  if (_waGlobalWindow.count >= WA_GLOBAL_MAX) {
    console.warn('[WA] Global rate limit reached — suppressing send');
    return true;
  }

  // Per-recipient
  const key  = `${shopId}:${to}`;
  const last = _waRecipientBucket.get(key) || 0;
  if (now - last < WA_PER_RECIPIENT_MS) {
    console.warn(`[WA] Per-recipient rate limit for ${to} — suppressing`);
    return true;
  }

  // Passed both checks — record send
  _waGlobalWindow.count++;
  _waRecipientBucket.set(key, now);

  // Prune bucket every 500 entries to avoid unbounded memory growth
  if (_waRecipientBucket.size > 500) {
    const cutoff = now - WA_PER_RECIPIENT_MS;
    for (const [k, v] of _waRecipientBucket) {
      if (v < cutoff) _waRecipientBucket.delete(k);
    }
  }

  return false;
}

/**
 * Send a text message via WhatsApp Cloud API.
 * @param {string} to     - recipient phone (international format, no +)
 * @param {string} text   - message body
 * @param {object} env    - Worker env with WHATSAPP_TOKEN, WHATSAPP_PHONE_ID
 * @param {string} shopId - shop UUID (used for per-recipient rate limiting)
 */
export async function sendMessage(to, text, env, shopId = 'global') {
  // Skip if WA not configured
  if (!env?.WHATSAPP_TOKEN || env.WHATSAPP_TOKEN === 'placeholder') return false;

  // Skip if not a real phone number
  if (!to || !/^\d{10,15}$/.test(to)) return false;

  // Rate limit check
  if (waRateLimited(shopId, to)) return false;

  const res = await fetch(`${WA_API_BASE}/${env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`WhatsApp send failed [${res.status}]:`, err);
    // Don't throw — failing to send a WA message shouldn't crash the flow
  }

  return res.ok;
}

/**
 * Extract the first text message from a WhatsApp webhook payload.
 * Returns { from, text } or null if not a text message.
 */
export function extractIncomingMessage(body) {
  try {
    const entry   = body?.entry?.[0];
    const change  = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message || message.type !== 'text') return null;

    return {
      from: message.from,             // sender's phone number
      text: message.text.body.trim(), // message content
      messageId: message.id,
    };
  } catch {
    return null;
  }
}
