/**
 * Queue OS — API Service
 * Single source of truth for all worker API calls.
 * Used by shop.html, customer.html, index.html, admin.html
 */

const WORKER_URL = 'https://saf-queue-worker.byker-software.workers.dev';

/**
 * Fetch a public shop's full page data (name, address, queue stats, etc.)
 * @param {string} idOrSlug — UUID or slug
 */
export async function fetchShopPage(idOrSlug) {
  const res = await fetch(`${WORKER_URL}/public/shop-page/${encodeURIComponent(idOrSlug)}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to load business');
  return json.data;
}

/**
 * Submit a business claim request
 * @param {string} shopId
 * @param {{phone:string, pin:string, note?:string}} payload
 */
export async function submitClaim(shopId, payload) {
  const res = await fetch(`${WORKER_URL}/public/shops/${shopId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Claim submission failed');
  return json.data;
}

/**
 * Fetch public shop directory
 */
export async function fetchDirectory({ city, category, area, search, limit = 200, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (city)     params.set('city', city);
  if (category) params.set('category', category);
  if (area)     params.set('area', area);
  if (search)   params.set('search', search);
  params.set('limit', limit);
  params.set('offset', offset);
  const res = await fetch(`${WORKER_URL}/public/shops?${params}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to load directory');
  return json.data;
}

export { WORKER_URL };
