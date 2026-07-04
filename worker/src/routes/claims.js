/**
 * claims.js — Unclaimed business claim flow
 *
 * POST /public/shops/:id/claim    — submit a claim request
 * GET  /admin/claim-requests      — admin lists pending claims
 * POST /admin/claim-requests/:id/approve — admin approves
 * POST /admin/claim-requests/:id/reject  — admin rejects
 */

import { createClient }  from '../utils/db.js';
import { ok, badRequest, notFound, serverError } from '../utils/response.js';
import { requireAdmin }  from '../utils/auth.js';
import { assignPlan }    from '../services/subscriptionService.js';
import { hashPin }       from '../utils/crypto.js';

/** POST /public/shops/:id/claim */
export async function submitClaimRequest(request, env) {
  try {
    const url    = new URL(request.url);
    const shopId = url.pathname.split('/')[3];
    const body   = await request.json();
    const { phone, pin, note } = body;

    if (!shopId) return badRequest('shop_id required');
    if (!phone)  return badRequest('Phone number required');
    if (!pin || String(pin).length !== 4) return badRequest('4-digit PIN required');

    const db = createClient(env);

    // Verify shop exists and is unclaimed
    const shops = await db.select('shops', `id=eq.${shopId}&limit=1`);
    if (!shops?.length) return notFound('Shop not found');
    const shop = shops[0];
    if (shop.is_claimed) return badRequest('This business has already been claimed');

    // Check no pending claim already exists for this shop
    const existing = await db.select('claim_requests',
      `shop_id=eq.${shopId}&status=eq.pending&limit=1`);
    if (existing?.length) return badRequest('A claim request for this business is already pending');

    // Check phone not already registered
    const phoneConflict = await db.select('shops',
      `owner_phone=eq.${phone}&limit=1`);
    if (phoneConflict?.length) return badRequest('This phone number is already registered to another business');

    const pin_hash = await hashPin(String(pin));

    const row = await db.insert('claim_requests', {
      shop_id: shopId,
      phone,
      pin_hash,
      note: note || null,
    });

    return ok({ submitted: true, request_id: (Array.isArray(row) ? row[0] : row)?.id });
  } catch(e) { return serverError(e.message); }
}

/** GET /admin/claim-requests */
export async function listClaimRequests(request, env) {
  try {
    const authErr = requireAdmin(request, env);
    if (authErr) return authErr;
    const db   = createClient(env);
    const rows = await db.select('claim_requests', 'order=created_at.desc&limit=100');
    if (!rows?.length) return ok([]);

    // Batch-fetch shop names
    const shopIds = [...new Set(rows.map(r => r.shop_id))];
    const shops   = await db.select('shops',
      `id=in.(${shopIds.join(',')})&select=id,name,area,city,category`).catch(() => []);
    const shopMap = {};
    for (const s of (shops || [])) shopMap[s.id] = s;

    return ok(rows.map(r => ({
      ...r,
      pin_hash:  undefined, // never expose
      shop_name: shopMap[r.shop_id]?.name || r.shop_id.slice(0,8),
      shop_area: shopMap[r.shop_id]?.area || '',
      shop_city: shopMap[r.shop_id]?.city || '',
      shop_cat:  shopMap[r.shop_id]?.category || '',
    })));
  } catch(e) { return serverError(e.message); }
}

/** POST /admin/claim-requests/:id/approve */
export async function approveClaimRequest(request, env) {
  try {
    const authErr = requireAdmin(request, env);
    if (authErr) return authErr;
    const id = new URL(request.url).pathname.split('/')[3];
    const db = createClient(env);

    const rows = await db.select('claim_requests', `id=eq.${id}&limit=1`);
    if (!rows?.length) return notFound('Claim request not found');
    const req = rows[0];
    if (req.status !== 'pending') return badRequest('Already reviewed');

    // Verify shop still unclaimed (race-condition guard)
    const shops = await db.select('shops', `id=eq.${req.shop_id}&limit=1`);
    if (!shops?.length) return notFound('Shop not found');
    if (shops[0].is_claimed) return badRequest('Shop was already claimed');

    // Update shop: set real owner_phone, is_claimed, is_active
    await db.update('shops', `id=eq.${req.shop_id}`, {
      owner_phone: req.phone,
      is_claimed:  true,
      claimed_at:  new Date().toISOString(),
      is_active:   true,
    });

    // Create shopkeeper PIN record
    await db.insert('shopkeepers', {
      shop_id:  req.shop_id,
      pin:      req.pin_hash,
    });

    // Mark claim request approved
    await db.update('claim_requests', `id=eq.${id}`, {
      status:      'approved',
      reviewed_at: new Date().toISOString(),
    });

    // Provision 30-day free trial
    await assignPlan(db, req.shop_id, 'free');

    return ok({ approved: true, shop_id: req.shop_id });
  } catch(e) { return serverError(e.message); }
}

/** POST /admin/claim-requests/:id/reject */
export async function rejectClaimRequest(request, env) {
  try {
    const authErr = requireAdmin(request, env);
    if (authErr) return authErr;
    const id   = new URL(request.url).pathname.split('/')[3];
    const body = await request.json().catch(() => ({}));
    const db   = createClient(env);

    const rows = await db.select('claim_requests', `id=eq.${id}&limit=1`);
    if (!rows?.length) return notFound('Claim request not found');
    if (rows[0].status !== 'pending') return badRequest('Already reviewed');

    await db.update('claim_requests', `id=eq.${id}`, {
      status:      'rejected',
      reviewed_at: new Date().toISOString(),
      note:        body.note || rows[0].note,
    });

    return ok({ rejected: true });
  } catch(e) { return serverError(e.message); }
}
