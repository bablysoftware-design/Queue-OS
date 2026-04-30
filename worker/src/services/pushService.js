// ============================================================
// services/pushService.js — Web Push Notifications
// Sends smart position-based alerts to customers
// ============================================================

const VAPID_PUBLIC_KEY  = 'BEhHj1q439bpBSggOfW14NI7PjtgL5GQpYX6Zvt4H1imsJgbpi6Aba4ziH4AqoQ9Htr6akwOncK7tkp8yTIaGOw';
const VAPID_SUBJECT     = 'mailto:admin@safqueue.com';

/**
 * Send a Web Push notification to a subscription.
 * Uses the Web Push protocol (RFC 8030) with VAPID auth.
 */
export async function sendPush(subscription, payload, env) {
  if (!subscription?.endpoint) return false;

  try {
    const body = JSON.stringify(payload);

    // Build VAPID auth headers
    const vapidHeaders = await buildVapidHeaders(
      subscription.endpoint,
      env.VAPID_PRIVATE_KEY,
      VAPID_PUBLIC_KEY
    );

    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/octet-stream',
        'Content-Length': body.length.toString(),
        'TTL':            '86400',
        ...vapidHeaders,
      },
      body,
    });

    return res.status === 201 || res.status === 200;
  } catch (e) {
    console.error('Push send error:', e);
    return false;
  }
}

/**
 * Build VAPID JWT authorization headers.
 * Lightweight implementation using Web Crypto API.
 */
async function buildVapidHeaders(endpoint, privateKeyB64, publicKeyB64) {
  const url      = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiry   = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header  = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64url(JSON.stringify({ aud: audience, exp: expiry, sub: VAPID_SUBJECT }));
  const sigInput = `${header}.${payload}`;

  // Import private key
  const keyBytes  = base64urlDecode(privateKeyB64);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const sig    = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, new TextEncoder().encode(sigInput));
  const sigB64 = base64urlEncode(new Uint8Array(sig));
  const token  = `${sigInput}.${sigB64}`;

  return {
    'Authorization': `vapid t=${token},k=${publicKeyB64}`,
  };
}

function b64url(str) {
  return base64urlEncode(new TextEncoder().encode(str));
}

function base64urlEncode(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded  = base64 + '==='.slice(0, (4 - base64.length % 4) % 4);
  const binary  = atob(padded);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ── Notification payload builders ─────────────────────────────

export function payloadTokenCreated(tokenNum, position, waitMins, shopName) {
  return {
    title: `Token #${tokenNum} — ${shopName}`,
    body:  position <= 2
      ? `You're #${position} in line. Head over now!`
      : `You're #${position} in line (~${waitMins} min). We'll alert you when to leave.`,
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag:   `token-${tokenNum}`,
    data:  { type: 'token_created', tokenNum, position, waitMins },
    vibrate: [100, 50, 100],
  };
}

export function payloadPositionAlert(tokenNum, position, shopName) {
  const isNext = position === 1;
  return {
    title: isNext ? `⚡ You're NEXT — ${shopName}` : `⏰ Almost your turn — ${shopName}`,
    body:  isNext
      ? `Token #${tokenNum}: Please be at the shop right now!`
      : `Token #${tokenNum}: ${position} customers ahead. Start heading over!`,
    icon:   '/icons/icon-192.png',
    badge:  '/icons/icon-192.png',
    tag:    `token-${tokenNum}-pos`,
    requireInteraction: true,
    data:   { type: 'position_alert', tokenNum, position },
    vibrate: isNext ? [300, 100, 300, 100, 500] : [200, 100, 200],
    actions: [
      { action: 'on_way', title: "I'm on my way 🏃" },
      { action: 'view',   title: 'View position' },
    ],
  };
}

export function payloadCalledNow(tokenNum, shopName) {
  return {
    title: `🔔 YOUR TURN NOW — ${shopName}`,
    body:  `Token #${tokenNum}: Please come to the counter immediately!`,
    icon:   '/icons/icon-192.png',
    badge:  '/icons/icon-192.png',
    tag:    `token-${tokenNum}-called`,
    requireInteraction: true,
    data:   { type: 'called', tokenNum },
    vibrate: [500, 200, 500, 200, 500, 200, 1000],
    actions: [
      { action: 'arriving', title: "Coming now! ✅" },
      { action: 'delay',    title: 'Need 2 more min ⏳' },
    ],
  };
}

export function payloadShopClosed(shopName, tokenNum) {
  return {
    title: `${shopName} has closed`,
    body:  `Sorry, Token #${tokenNum} has been cancelled. The shop closed for today.`,
    icon:  '/icons/icon-192.png',
    tag:   `token-${tokenNum}-closed`,
    data:  { type: 'shop_closed', tokenNum },
  };
}

/**
 * Smart notification trigger — called after queue advances.
 * Checks positions 3 and 1 ahead and sends appropriate alerts.
 */
export async function triggerPositionNotifications(db, shopId, env) {
  try {
    // Get all waiting tokens with their subscriptions
    const waiting = await db.select(
      'tokens',
      `shop_id=eq.${shopId}&status=eq.waiting&order=token_number.asc&select=id,token_number,notified_position`
    );

    if (!waiting.length) return;

    const shopRows = await db.select('shops', `id=eq.${shopId}&select=name`);
    const shopName = shopRows[0]?.name ?? 'Your shop';

    for (let i = 0; i < waiting.length; i++) {
      const token    = waiting[i];
      const position = i + 1; // 1-based position

      // Determine if we should notify
      let shouldNotify = false;
      let notifyLevel  = token.notified_position;

      if (position <= 1 && notifyLevel < 3) { shouldNotify = true; notifyLevel = 3; }
      else if (position <= 3 && notifyLevel < 2) { shouldNotify = true; notifyLevel = 2; }

      if (!shouldNotify) continue;

      // Get push subscription for this token
      const subs = await db.select('push_subscriptions', `token_id=eq.${token.id}`);
      if (!subs.length) {
        // Update notified_position even if no push (prevents re-check)
        await db.update('tokens', `id=eq.${token.id}`, { notified_position: notifyLevel });
        continue;
      }

      const sub     = subs[0];
      const payload = payloadPositionAlert(token.token_number, position, shopName);
      await sendPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload, env);
      await db.update('tokens', `id=eq.${token.id}`, { notified_position: notifyLevel });
    }
  } catch (e) {
    console.error('triggerPositionNotifications error:', e);
  }
}

/**
 * Send "your turn" notification to the called token.
 */
export async function notifyTokenCalled(db, token, shopName, env) {
  try {
    const subs = await db.select('push_subscriptions', `token_id=eq.${token.id}`);
    if (!subs.length) return;
    const sub     = subs[0];
    const payload = payloadCalledNow(token.token_number, shopName);
    await sendPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload, env);
  } catch (e) {
    console.error('notifyTokenCalled error:', e);
  }
}
