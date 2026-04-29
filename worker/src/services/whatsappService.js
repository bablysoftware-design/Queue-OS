// ============================================================
// services/whatsappService.js
// WhatsApp Cloud API message sending
// ============================================================

const WA_API_BASE = 'https://graph.facebook.com/v19.0';

/**
 * Send a text message via WhatsApp Cloud API.
 * @param {string} to   - recipient phone (international format, no +)
 * @param {string} text - message body
 * @param {object} env  - Worker env with WHATSAPP_TOKEN, WHATSAPP_PHONE_ID
 */
export async function sendMessage(to, text, env) {
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
