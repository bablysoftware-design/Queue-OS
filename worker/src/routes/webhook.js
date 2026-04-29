// ============================================================
// routes/webhook.js — WhatsApp Cloud API Webhook
// Handles: verification + incoming messages
// ============================================================

import { extractIncomingMessage, sendMessage } from '../services/whatsappService.js';
import { createToken } from '../services/tokenService.js';
import { createClient } from '../utils/db.js';
import { ok, badRequest } from '../utils/response.js';

/**
 * GET /webhook — Meta verification challenge
 */
export async function handleVerify(request, env) {
  const url    = new URL(request.url);
  const mode   = url.searchParams.get('hub.mode');
  const token  = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

/**
 * POST /webhook — Incoming WhatsApp messages
 *
 * Conversation flow:
 *   "hi"    → list open shops
 *   "1","2" → join that shop's queue
 */
export async function handleMessage(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return ok({});   // Always return 200 to Meta

  const msg = extractIncomingMessage(body);
  if (!msg) return ok({});    // Not a text message, ignore

  const db = createClient(env);

  try {
    await routeMessage(db, msg, env);
  } catch (err) {
    console.error('Webhook handler error:', err);
    // Don't let errors propagate — Meta would retry if we returned non-200
  }

  return ok({});
}

// ──────────────────────────────────────────────────────────────
// INTERNAL: conversation router
// ──────────────────────────────────────────────────────────────

async function routeMessage(db, { from, text }, env) {
  const lower = text.toLowerCase();

  // Greeting → show available shops
  if (['hi', 'hello', 'salam', 'hii', 'hey'].includes(lower)) {
    return sendShopList(db, from, env);
  }

  // Numeric input → join queue
  const num = parseInt(text, 10);
  if (!isNaN(num) && num > 0) {
    return handleJoinQueue(db, from, num, env);
  }

  // Default
  await sendMessage(
    from,
    'Salaam! 👋 Queue join karne ke liye *hi* likhein.',
    env
  );
}

async function sendShopList(db, from, env) {
  const shops = await db.select('shops', 'is_active=eq.true&is_open=eq.true&select=id,name,area,category,current_token');

  if (!shops.length) {
    await sendMessage(from, 'Abhi koi dukan available nahi hai. Baad mein try karein.', env);
    return;
  }

  let msg = '*Saf Queue* 🏪\nAvailable Dukanein:\n\n';
  shops.forEach((shop, i) => {
    msg += `*${i + 1}.* ${shop.name}\n`;
    msg += `   📍 ${shop.area ?? 'N/A'} | 🏷️ ${shop.category ?? 'N/A'}\n`;
    msg += `   🔢 Current Token: ${shop.current_token}\n\n`;
  });
  msg += 'Number likhein queue join karne ke liye (jaise: *1*)';

  // Temporarily store the shop list in a simple KV-like approach:
  // Since we have no session, we use a lightweight trick — store last shown list
  // in a tokens table trick. For MVP, re-fetch on number input.
  // For production: use Cloudflare KV sessions.

  // Store mapping in env context (this is per-request, stateless)
  // We pass the shop index implicitly — customers send "1", "2" etc.
  // We resolve by re-fetching sorted shops on next message.

  await sendMessage(from, msg, env);
}

async function handleJoinQueue(db, customerPhone, shopIndex, env) {
  // Re-fetch the same sorted list
  const shops = await db.select(
    'shops',
    'is_active=eq.true&is_open=eq.true&select=id,name,area,avg_service_time_mins'
  );

  const shop = shops[shopIndex - 1];
  if (!shop) {
    await sendMessage(customerPhone, 'Galat number. Dobara *hi* likhein aur list dekhein.', env);
    return;
  }

  try {
    const { token, position, estimatedWaitMins, shopName } = await createToken(
      db, shop.id, customerPhone
    );

    const msg =
      `✅ *Queue Join Ho Gaya!*\n\n` +
      `🏪 Dukan: ${shopName}\n` +
      `🎫 Aapka Token: *${token.token_number}*\n` +
      `📍 Position: ${position}\n` +
      `⏱️ Est. Wait: ~${estimatedWaitMins} min\n\n` +
      `Apni baari ka intizaar karein. Shukriya!`;

    await sendMessage(customerPhone, msg, env);
  } catch (err) {
    // err.message is already user-friendly (Urdu)
    await sendMessage(customerPhone, `❌ ${err.message}`, env);
  }
}
