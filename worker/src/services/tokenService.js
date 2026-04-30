// ============================================================
// services/tokenService.js — Queue token management
// Fixes: #1/#26 (atomic), #5 (reset), #6 (dedup), #8 (name), #14 (cancel), #22 (close notify)
// ============================================================

import { checkSubscriptionValid } from './subscriptionService.js';
import { sendMessage }            from './whatsappService.js';

/** Count today's tokens for a customer in a shop (Fix #6) */
async function countCustomerTodayTokens(db, shopId, customerPhone) {
  try {
    const result = await db.rpc('count_customer_tokens_today', {
      p_shop_id: shopId, p_customer_phone: customerPhone
    });
    return result ?? 0;
  } catch { return 0; }
}

async function countWaitingTokens(db, shopId) {
  const rows = await db.select('tokens', `shop_id=eq.${shopId}&status=eq.waiting&select=id`);
  return rows.length;
}

/**
 * FIX #1/#26: Create token using atomic DB increment.
 * FIX #8: Store customer_name.
 * FIX #6: Prevent same customer getting multiple tokens per day.
 */
export async function createToken(db, shopId, customerPhone, customerName = null) {
  const shops = await db.select('shops', `id=eq.${shopId}`);
  if (!shops.length) throw new Error('دکان نہیں ملی۔');

  const shop = shops[0];

  if (!shop.is_active) throw new Error('آپ کا فری ٹرائل ختم ہو گیا ہے۔ پلان لیں۔');
  if (!shop.is_open)   throw new Error(`${shop.name} ابھی بند ہے۔ بعد میں آئیں۔`);

  // Subscription check
  const { valid, reason, sub } = await checkSubscriptionValid(db, shopId);
  if (!valid) {
    throw new Error(reason === 'expired'
      ? 'سبسکرپشن ختم ہو گئی۔ پلان لیں۔'
      : 'سبسکرپشن فعال نہیں ہے۔');
  }

  // Plan limits
  const waitingCount = await countWaitingTokens(db, shopId);
  if (waitingCount >= sub.max_queue_size) throw new Error('قطار بھری ہوئی ہے۔ تھوڑی دیر بعد آئیں۔');

  // FIX #6: Prevent same customer getting multiple tokens today (real phone only)
  const isRealPhone = /^\d{10,13}$/.test(customerPhone);
  if (isRealPhone) {
    const todayCount = await countCustomerTodayTokens(db, shopId, customerPhone);
    if (todayCount > 0) {
      const existing = await db.select('tokens',
        `shop_id=eq.${shopId}&customer_phone=eq.${customerPhone}&status=in.(waiting,called)`
      );
      if (existing.length) {
        throw new Error(`آپ پہلے سے قطار میں ہیں۔ آپ کا ٹوکن: ${existing[0].token_number}`);
      }
    }
  }

  // Also check daily plan limit
  const today = new Date().toISOString().split('T')[0];
  const todayTotal = await db.select('tokens',
    `shop_id=eq.${shopId}&created_at=gte.${today}T00:00:00&select=id`
  );
  if (todayTotal.length >= sub.max_tokens_per_day) {
    throw new Error('آج کے ٹوکن کی حد پوری ہو گئی۔');
  }

  // FIX #1/#26: Atomic increment via DB RPC
  const nextNumber = await db.rpc('increment_token', { p_shop_id: shopId });

  // Insert token with customer_name (FIX #8)
  const [token] = await db.insert('tokens', {
    shop_id:        shopId,
    customer_phone: customerPhone,
    customer_name:  customerName || null,
    token_number:   nextNumber,
    status:         'waiting',
  });

  const estimatedWaitMins = waitingCount * shop.avg_service_time_mins;

  return { token, position: waitingCount + 1, estimatedWaitMins, shopName: shop.name };
}

/**
 * Advance queue: complete current → call next.
 * Sends WhatsApp notification to next customer.
 */
export async function advanceQueue(db, shopId, env) {
  const called = await db.select('tokens', `shop_id=eq.${shopId}&status=eq.called&limit=1`);
  if (called.length) {
    await db.update('tokens', `id=eq.${called[0].id}`, {
      status:       'completed',
      completed_at: new Date().toISOString(),
    });
  }

  const waiting = await db.select('tokens',
    `shop_id=eq.${shopId}&status=eq.waiting&order=token_number.asc&limit=1`
  );
  if (!waiting.length) return null;

  const next = waiting[0];
  const [calledToken] = await db.update('tokens', `id=eq.${next.id}`, {
    status:    'called',
    called_at: new Date().toISOString(),
  });

  const remaining = await db.select('tokens',
    `shop_id=eq.${shopId}&status=eq.waiting&select=id`
  );

  // WhatsApp notification
  if (env?.WHATSAPP_TOKEN && env.WHATSAPP_TOKEN !== 'placeholder') {
    const shops    = await db.select('shops', `id=eq.${shopId}&select=name`);
    const shopName = shops[0]?.name ?? 'آپ کی دکان';
    const name     = next.customer_name ? `${next.customer_name}، ` : '';
    await sendMessage(
      next.customer_phone,
      `🔔 *${name}آپ کی باری آ گئی!*\n\n` +
      `🏪 دکان: ${shopName}\n` +
      `🎫 آپ کا ٹوکن: *${next.token_number}*\n` +
      `⏱️ ابھی آئیں!\n\n_Saf Queue_`,
      env
    );
  }

  return { ...calledToken, remaining: remaining.length };
}

/** Mark current called → no-show, call next */
export async function markNoShow(db, shopId, env) {
  const called = await db.select('tokens', `shop_id=eq.${shopId}&status=eq.called&limit=1`);
  if (called.length) {
    await db.update('tokens', `id=eq.${called[0].id}`, { status: 'no_show' });
  }
  return advanceQueue(db, shopId, env);
}

/**
 * FIX #14: Cancel a token by token_id.
 * Only waiting tokens can be cancelled.
 */
export async function cancelToken(db, tokenId, shopId) {
  const tokens = await db.select('tokens', `id=eq.${tokenId}&shop_id=eq.${shopId}`);
  if (!tokens.length) throw new Error('ٹوکن نہیں ملا');

  const token = tokens[0];
  if (token.status !== 'waiting') {
    throw new Error('صرف انتظار والے ٹوکن منسوخ ہو سکتے ہیں');
  }

  await db.update('tokens', `id=eq.${tokenId}`, {
    status:       'cancelled',
    cancelled_at: new Date().toISOString(),
  });

  return { cancelled: true, token_number: token.token_number };
}

/**
 * FIX #22: When shop closes, mark all waiting customers' tokens as shop_closed.
 * Tracker will show "shop closed" to customers polling for position.
 */
export async function notifyShopClosed(db, shopId, env) {
  // Get all waiting tokens
  const waiting = await db.select('tokens',
    `shop_id=eq.${shopId}&status=eq.waiting&select=id,customer_phone,customer_name,token_number`
  );

  if (!waiting.length) return;

  // Mark them all with shop_closed_notified flag
  await db.update('tokens', `shop_id=eq.${shopId}&status=eq.waiting`, {
    shop_closed_notified: true,
  });

  // Send WhatsApp to each if available
  if (env?.WHATSAPP_TOKEN && env.WHATSAPP_TOKEN !== 'placeholder') {
    const shops    = await db.select('shops', `id=eq.${shopId}&select=name,opening_time`);
    const shopName = shops[0]?.name ?? 'دکان';
    const opens    = shops[0]?.opening_time ?? 'کل';

    for (const t of waiting) {
      const isRealPhone = /^\d{10,13}$/.test(t.customer_phone);
      if (!isRealPhone) continue;
      await sendMessage(
        t.customer_phone,
        `😔 ${shopName} ابھی بند ہو گئی ہے۔\n` +
        `آپ کا ٹوکن #${t.token_number} منسوخ ہو گیا۔\n` +
        `اگلے وقت: ${opens}\n_Saf Queue_`,
        env
      ).catch(() => {});
    }
  }
}

/** Get full queue state for dashboard */
export async function getQueueState(db, shopId) {
  const [shops, waiting, called] = await Promise.all([
    db.select('shops', `id=eq.${shopId}`),
    db.select('tokens', `shop_id=eq.${shopId}&status=eq.waiting&order=token_number.asc&select=id,token_number,customer_phone,customer_name,created_at`),
    db.select('tokens', `shop_id=eq.${shopId}&status=eq.called&limit=1`),
  ]);

  return {
    shop:             shops[0],
    currentlyServing: called[0] ?? null,
    queue:            waiting,
    queueLength:      waiting.length,
  };
}

/** Get today's stats */
export async function getShopStats(db, shopId) {
  return db.rpc('get_shop_stats', { p_shop_id: shopId });
}

/** Get customer position by token_id */
export async function getCustomerPosition(db, shopId, customerPhone) {
  const waiting = await db.select('tokens',
    `shop_id=eq.${shopId}&status=eq.waiting&order=token_number.asc`
  );
  const idx = waiting.findIndex(t => t.customer_phone === customerPhone);

  if (idx === -1) {
    const called = await db.select('tokens',
      `shop_id=eq.${shopId}&customer_phone=eq.${customerPhone}&status=eq.called`
    );
    if (called.length) return { status: 'called', token: called[0] };
    return { status: 'not_found' };
  }

  const shops   = await db.select('shops', `id=eq.${shopId}&select=avg_service_time_mins`);
  const avgTime = shops[0]?.avg_service_time_mins ?? 10;

  return {
    status:        'waiting',
    token:         waiting[idx],
    position:      idx + 1,
    estimatedWait: idx * avgTime,
    totalWaiting:  waiting.length,
  };
}

/** FIX #5: Reset daily tokens */
export async function resetDailyTokens(db) {
  return db.rpc('reset_daily_tokens');
}
