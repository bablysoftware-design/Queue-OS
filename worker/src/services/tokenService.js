// ============================================================
// services/tokenService.js — Queue token management
// ============================================================

import { checkSubscriptionValid } from './subscriptionService.js';
import { sendMessage }            from './whatsappService.js';

async function countTodayTokens(db, shopId) {
  const today = new Date().toISOString().split('T')[0];
  const rows  = await db.select('tokens', `shop_id=eq.${shopId}&created_at=gte.${today}T00:00:00&select=id`);
  return rows.length;
}

async function countWaitingTokens(db, shopId) {
  const rows = await db.select('tokens', `shop_id=eq.${shopId}&status=eq.waiting&select=id`);
  return rows.length;
}

/**
 * Create a new token for a customer.
 */
export async function createToken(db, shopId, customerPhone) {
  const shops = await db.select('shops', `id=eq.${shopId}`);
  if (!shops.length) throw new Error('دکان نہیں ملی۔');

  const shop = shops[0];

  if (!shop.is_active) throw new Error('آپ کا فری ٹرائل ختم ہو گیا ہے۔ پلان لیں۔');
  if (!shop.is_open)   throw new Error(`${shop.name} ابھی بند ہے۔ بعد میں آئیں۔`);

  const { valid, reason, sub } = await checkSubscriptionValid(db, shopId);
  if (!valid) {
    if (reason === 'expired') throw new Error('سبسکرپشن ختم ہو گئی۔ پلان لیں۔');
    throw new Error('سبسکرپشن فعال نہیں ہے۔');
  }

  const [todayCount, waitingCount] = await Promise.all([
    countTodayTokens(db, shopId),
    countWaitingTokens(db, shopId),
  ]);

  if (todayCount >= sub.max_tokens_per_day) throw new Error('آج کے ٹوکن کی حد پوری ہو گئی۔');
  if (waitingCount >= sub.max_queue_size)   throw new Error('قطار بھری ہوئی ہے۔ تھوڑی دیر بعد آئیں۔');

  // Duplicate check
  const existing = await db.select('tokens', `shop_id=eq.${shopId}&customer_phone=eq.${customerPhone}&status=eq.waiting`);
  if (existing.length) throw new Error(`آپ پہلے سے قطار میں ہیں۔ آپ کا ٹوکن: ${existing[0].token_number}`);

  const nextNumber = shop.current_token + 1;

  const [token] = await db.insert('tokens', {
    shop_id:        shopId,
    customer_phone: customerPhone,
    token_number:   nextNumber,
    status:         'waiting',
  });

  await db.update('shops', `id=eq.${shopId}`, { current_token: nextNumber });

  const estimatedWaitMins = waitingCount * shop.avg_service_time_mins;

  return { token, position: waitingCount + 1, estimatedWaitMins, shopName: shop.name };
}

/**
 * Advance queue: complete current → call next.
 * Sends WhatsApp notification to next customer.
 */
export async function advanceQueue(db, shopId, env) {
  // Complete current called token
  const called = await db.select('tokens', `shop_id=eq.${shopId}&status=eq.called&limit=1`);
  if (called.length) {
    await db.update('tokens', `id=eq.${called[0].id}`, {
      status:       'completed',
      completed_at: new Date().toISOString(),
    });
  }

  // Get next waiting
  const waiting = await db.select('tokens', `shop_id=eq.${shopId}&status=eq.waiting&order=token_number.asc&limit=1`);
  if (!waiting.length) return null;

  const next = waiting[0];
  const [calledToken] = await db.update('tokens', `id=eq.${next.id}`, {
    status:    'called',
    called_at: new Date().toISOString(),
  });

  // How many still waiting after this one
  const remaining = await db.select('tokens', `shop_id=eq.${shopId}&status=eq.waiting&select=id`);

  // WhatsApp notification to customer
  if (env?.WHATSAPP_TOKEN && env.WHATSAPP_TOKEN !== 'placeholder') {
    const shops = await db.select('shops', `id=eq.${shopId}&select=name`);
    const shopName = shops[0]?.name ?? 'آپ کی دکان';
    await sendMessage(
      next.customer_phone,
      `🔔 *آپ کی باری آ گئی!*\n\n` +
      `🏪 دکان: ${shopName}\n` +
      `🎫 آپ کا ٹوکن: *${next.token_number}*\n` +
      `⏱️ ابھی آئیں!\n\n` +
      `_Saf Queue_`,
      env
    );
  }

  return { ...calledToken, remaining: remaining.length };
}

/**
 * Mark current called token as no-show, call next.
 */
export async function markNoShow(db, shopId, env) {
  const called = await db.select('tokens', `shop_id=eq.${shopId}&status=eq.called&limit=1`);

  if (called.length) {
    await db.update('tokens', `id=eq.${called[0].id}`, { status: 'no_show' });
  }

  // Call next waiting token
  return advanceQueue(db, shopId, env);
}

/**
 * Get full queue state for dashboard.
 */
export async function getQueueState(db, shopId) {
  const [shops, waiting, called] = await Promise.all([
    db.select('shops', `id=eq.${shopId}`),
    db.select('tokens', `shop_id=eq.${shopId}&status=eq.waiting&order=token_number.asc`),
    db.select('tokens', `shop_id=eq.${shopId}&status=eq.called&limit=1`),
  ]);

  return {
    shop:             shops[0],
    currentlyServing: called[0] ?? null,
    queue:            waiting,
    queueLength:      waiting.length,
  };
}

/**
 * Get today's stats for a shop.
 */
export async function getShopStats(db, shopId) {
  return db.rpc('get_shop_stats', { p_shop_id: shopId });
}

/**
 * Get customer token position by phone.
 */
export async function getCustomerPosition(db, shopId, customerPhone) {
  const waiting = await db.select('tokens', `shop_id=eq.${shopId}&status=eq.waiting&order=token_number.asc`);
  const idx     = waiting.findIndex(t => t.customer_phone === customerPhone);

  if (idx === -1) {
    // Check if called
    const called = await db.select('tokens', `shop_id=eq.${shopId}&customer_phone=eq.${customerPhone}&status=eq.called`);
    if (called.length) return { status: 'called', token: called[0] };
    return { status: 'not_found' };
  }

  const shops = await db.select('shops', `id=eq.${shopId}&select=avg_service_time_mins`);
  const avgTime = shops[0]?.avg_service_time_mins ?? 10;

  return {
    status:          'waiting',
    token:           waiting[idx],
    position:        idx + 1,
    estimatedWait:   idx * avgTime,
    totalWaiting:    waiting.length,
  };
}

/**
 * Reset daily tokens — called by cron at midnight.
 */
export async function resetDailyTokens(db) {
  return db.rpc('reset_daily_tokens');
}
