// ============================================================
// utils/db.js — Supabase REST client wrapper
// Lightweight fetch-based client (no npm needed)
// ============================================================

/**
 * Creates a minimal Supabase REST client using fetch.
 * Keeps the Worker dependency-free.
 */
export function createClient(env) {
  const base = `${env.SUPABASE_URL}/rest/v1`;
  const headers = {
    'apikey': env.SUPABASE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  /**
   * SELECT rows from a table.
   * @param {string} table
   * @param {string} query - PostgREST query string e.g. "id=eq.xxx&status=eq.active"
   */
  async function select(table, query = '') {
    const url = `${base}/${table}${query ? '?' + query : ''}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`DB select error [${res.status}]: ${await res.text()}`);
    return res.json();
  }

  /**
   * INSERT a row.
   * @param {string} table
   * @param {object} data
   */
  async function insert(table, data) {
    const res = await fetch(`${base}/${table}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`DB insert error [${res.status}]: ${await res.text()}`);
    return res.json();
  }

  /**
   * UPDATE rows matching a query.
   * @param {string} table
   * @param {string} query - PostgREST filter e.g. "id=eq.xxx"
   * @param {object} data
   */
  async function update(table, query, data) {
    const url = `${base}/${table}?${query}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`DB update error [${res.status}]: ${await res.text()}`);
    return res.json();
  }

  /**
   * RPC — call a Postgres function.
   * @param {string} fn - function name
   * @param {object} params
   */
  async function rpc(fn, params = {}) {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`DB rpc error [${res.status}]: ${await res.text()}`);
    return res.json();
  }

  return { select, insert, update, rpc };
}
