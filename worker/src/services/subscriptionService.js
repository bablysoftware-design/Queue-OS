// ============================================================
// services/subscriptionService.js
// All subscription + plan logic lives here
// ============================================================

/**
 * Get the active subscription for a shop.
 * Returns null if none found.
 */
export async function getActiveSubscription(db, shopId) {
  const rows = await db.select(
    'subscriptions',
    `shop_id=eq.${shopId}&status=eq.active&order=created_at.desc&limit=1`
  );
  return rows[0] ?? null;
}

/**
 * Check if a shop's subscription is valid RIGHT NOW.
 * Also handles auto-expiry if end_date has passed.
 * Returns { valid: bool, reason: string }
 */
export async function checkSubscriptionValid(db, shopId) {
  const sub = await getActiveSubscription(db, shopId);

  if (!sub) {
    return { valid: false, reason: 'no_subscription' };
  }

  const today = new Date().toISOString().split('T')[0];

  if (sub.end_date < today) {
    // Auto-expire: update subscription + deactivate shop
    await db.update('subscriptions', `id=eq.${sub.id}`, { status: 'expired' });
    await db.update('shops', `id=eq.${shopId}`, { is_active: false });
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, sub };
}

/**
 * Assign a paid plan to a shop.
 * Creates a new active subscription, cancels the old one.
 * Designed to be called by admin or payment webhook later.
 */
export async function assignPlan(db, shopId, planName) {
  // Fetch plan limits
  const plans = await db.select('plans', `name=eq.${planName}`);
  if (!plans.length) throw new Error(`Plan not found: ${planName}`);
  const plan = plans[0];

  // Calculate new dates
  const start = new Date();
  const end   = new Date();
  end.setDate(end.getDate() + plan.duration_days);

  const fmt = (d) => d.toISOString().split('T')[0];

  // Cancel current active subscriptions
  await db.update(
    'subscriptions',
    `shop_id=eq.${shopId}&status=eq.active`,
    { status: 'cancelled' }
  );

  // Create new subscription
  const [newSub] = await db.insert('subscriptions', {
    shop_id:            shopId,
    plan_name:          planName,
    status:             'active',
    start_date:         fmt(start),
    end_date:           fmt(end),
    max_tokens_per_day: plan.max_tokens_per_day,
    max_queue_size:     plan.max_queue_size,
  });

  // Re-activate shop
  await db.update('shops', `id=eq.${shopId}`, { is_active: true });

  return newSub;
}

/**
 * Expire all subscriptions past their end_date.
 * Called by the scheduled Worker (cron).
 */
export async function expireStaleSubscriptions(db) {
  // Use the SQL function we defined in the schema
  return db.rpc('expire_subscriptions');
}
