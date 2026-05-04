// ── Search Routes — locations + categories autocomplete ──────
import { createClient }  from '../utils/db.js';
import { ok, serverError } from '../utils/response.js';

/**
 * GET /search/locations?q=isl
 * Returns matching cities/areas for autocomplete
 */
export async function searchLocations(request, env) {
  try {
    const url = new URL(request.url);
    const q   = (url.searchParams.get('q') || '').trim().toLowerCase();
    const db  = createClient(env);

    const filter = q
      ? `or=(city.ilike.*${q}*,area.ilike.*${q}*,country.ilike.*${q}*)&limit=10&order=city.asc`
      : `limit=20&order=city.asc`;

    const rows = await db.select('locations', filter);
    return ok(rows || []);
  } catch(err) { return serverError(err.message); }
}

/**
 * GET /search/categories?q=bar
 * Returns matching categories
 */
export async function searchCategories(request, env) {
  try {
    const url = new URL(request.url);
    const q   = (url.searchParams.get('q') || '').trim().toLowerCase();
    const db  = createClient(env);

    const filter = q
      ? `name=ilike.*${q}*&limit=10&order=name.asc`
      : `limit=20&order=name.asc`;

    const rows = await db.select('categories', filter);
    return ok(rows || []);
  } catch(err) { return serverError(err.message); }
}
