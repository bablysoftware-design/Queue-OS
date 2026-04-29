// ============================================================
// utils/db.js — Supabase REST client wrapper
// ============================================================

export function createClient(env) {
  const url  = env.SUPABASE_URL.trim();
  const key  = env.SUPABASE_KEY.trim();
  const base = `${url}/rest/v1`;

  const readHeaders = {
    'apikey':        key,
    'Authorization': `Bearer ${key}`,
    'Content-Type':  'application/json',
  };

  const writeHeaders = {
    ...readHeaders,
    'Prefer': 'return=representation',
  };

  async function select(table, query = '') {
    const endpoint = `${base}/${table}${query ? '?' + query : ''}`;
    const res = await fetch(endpoint, { headers: readHeaders });
    if (!res.ok) throw new Error(`DB select error [${res.status}]: ${await res.text()}`);
    return res.json();
  }

  async function insert(table, data) {
    const res = await fetch(`${base}/${table}`, {
      method:  'POST',
      headers: writeHeaders,
      body:    JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`DB insert error [${res.status}]: ${await res.text()}`);
    return res.json();
  }

  async function update(table, query, data) {
    const res = await fetch(`${base}/${table}?${query}`, {
      method:  'PATCH',
      headers: writeHeaders,
      body:    JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`DB update error [${res.status}]: ${await res.text()}`);
    return res.json();
  }

  async function rpc(fn, params = {}) {
    const res = await fetch(`${base}/rpc/${fn}`, {
      method:  'POST',
      headers: writeHeaders,
      body:    JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`DB rpc error [${res.status}]: ${await res.text()}`);
    return res.json();
  }

  return { select, insert, update, rpc };
}
