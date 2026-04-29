// ============================================================
// services/tokenService.js
// Queue token creation and management
// ============================================================

import { checkSubscriptionValid } from './subscriptionService.js';

/**
 * Count tokens created for a shop today.
 */
async function countTodayTokens(db, shopId) {
  const today = new Date().toISOString().split('T')[0];
  const rows = await db.select(
    'tokens',
    `shop_id=eq.${shopId}&created_at=gte.${today}T00:00:00&select=id`
  );
  return rows.length;
}

/**
 * Count currently waiting tokens for a shop.
 */
async function countWaitingTokens(db, shopId) {
  const rows = await db.select(
    'tokens',
    `shop_id=eq.${shopId}&status=eq.waiting&select=id`
  );
  return rows.length;
}

/**
 * Create a new token for a customer in a shop's queue.
 * Enforces all plan limits before creating.
 *
 * Returns { token, position, estimatedWaitMins } or throws with a user-friendly message.
 */
export async function createToken(db, shopId, customerPhone) {
  // ── 1. Fetch shop ──────────────────────────────────────────
  const shops = await db.select('shops', `id=eq.${shopId}`);
  if (!shops.length) throw new Error('Dukan nahi mili.');

  const shop = shops[0];

  if (!shop.is_active) {
    throw new Error('Aapka free trial khatam ho gaya hai. Continue karne ke liye plan lein.');
  }

  if (!shop.is_open) {
    throw new Error(`${shop.name} abhi band hai. Baad mein try karein.`);
  }

  // ── 2. Check subscription ──────────────────────────────────
  const { valid, reason, sub } = await checkSubscriptionValid(db, shopId);

  if (!valid) {
    if (reason === 'expired') {
      throw new Error('Aapka free trial khatam ho gaya hai. Continue karne ke liye plan lein.');
    }
    throw new Error('Is dukan ki subscription active nahi hai.');
  }

  // ── 3. Check plan limits ───────────────────────────────────
  const [todayCount, waitingCount] = await Promise.all([
    countTodayTokens(db, shopId),
    countWaitingTokens(db, shopId),
  ]);

  if (todayCount >= sub.max_tokens_per_day) {
    throw new Error('Aaj ke tokens ka limit pura ho gaya. Kal dobara try karein.');
  }

  if (waitingCount >= sub.max_queue_size) {
    throw new Error('Queue bhari hui hai. Thodi der baad try karein.');
  }

  // ── 4. Check for duplicate (same customer already waiting) ─
  const existing = await db.select(
    'tokens',
    `shop_id=eq.${shopId}&customer_phone=eq.${customerPhone}&status=eq.waiting`
  );
  if (existing.length) {
    const t = existing[0];
    throw new Error(
      `Aap pehle se queue mein hain. Aapka token number: ${t.token_number}`
    );
  }

  // ── 5. Get next token number ───────────────────────────────
  const nextNumber = shop.current_token + 1;

  // ── 6. Insert token ────────────────────────────────────────
  const [token] = await db.insert('tokens', {
    shop_id:        shopId,
    customer_phone: customerPhone,
    token_number:   nextNumber,
    status:         'waiting',
  });

  // Update shop's current_token counter
  await db.update('shops', `id=eq.${shopId}`, { current_token: nextNumber });

  // ── 7. Estimate wait time ──────────────────────────────────
  const estimatedWaitMins = waitingCount * shop.avg_service_time_mins;

  return {
    token,
    position: waitingCount + 1,
    estimatedWaitMins,
    shopName: shop.name,
  };
}

/**
 * Advance the queue: mark current called→completed, call the next waiting token.
 * Returns the newly called token or null if queue is empty.
 */
export async function advanceQueue(db, shopId) {
  // Mark any 'called' tokens as completed
  await db.update(
    'tokens',
    `shop_id=eq.${shopId}&status=eq.called`,
    { status: 'completed' }
  );

  // Get next waiting token (lowest token_number)
  const waiting = await db.select(
    'tokens',
    `shop_id=eq.${shopId}&status=eq.waiting&order=token_number.asc&limit=1`
  );

  if (!waiting.length) return null;

  const next = waiting[0];
  const [called] = await db.update(
    'tokens',
    `id=eq.${next.id}`,
    { status: 'called', called_at: new Date().toISOString() }
  );

  return called;
}

/**
 * Get full queue state for a shop (dashboard use).
 */
export async function getQueueState(db, shopId) {
  const [shops, waiting, called] = await Promise.all([
    db.select('shops', `id=eq.${shopId}`),
    db.select('tokens', `shop_id=eq.${shopId}&status=eq.waiting&order=token_number.asc`),
    db.select('tokens', `shop_id=eq.${shopId}&status=eq.called&limit=1`),
  ]);

  const shop = shops[0];
  return {
    shop,
    currentlyServing: called[0] ?? null,
    queue: waiting,
    queueLength: waiting.length,
  };
}
