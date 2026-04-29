// ============================================================
// utils/db.js — Supabase REST client wrapper
// ============================================================

export function createClient(env) {
  const url  = env.SUPABASE_URL.trim();
  const key  = env.SUPABASE_KEY.trim();
  const base = `${url}/rest/v1`;

  const baseHeaders = {
    'apikey':        key,
    'Authorization': `Bearer ${key}`,
  };

  async function select(table, query = '') {
    const endpoint = `${base}/${table}${query ? '?' + query : ''}`;
    const res = await fetch(endpoint, { headers: baseHeaders });
    if (!res.ok) throw new Error(`DB select error [${res.status}]: ${await res.text()}`);
    return res.json();
  }

  async function insert(table, data) {
    const res = await fetch(`${base}/${table}`, {
      method:  'POST',
      headers: { ...baseHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body:    JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`DB insert error [${res.status}]: ${await res.text()}`);
    return res.json();
  }

  async function update(table, query, data) {
    const res = await fetch(`${base}/${table}?${query}`, {
      method:  'PATCH',
      headers: { ...baseHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body:    JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`DB update error [${res.status}]: ${await res.text()}`);
    return res.json();
  }

  async function del(table, query) {
    const res = await fetch(`${base}/${table}?${query}`, {
      method:  'DELETE',
      headers: { ...baseHeaders, 'Prefer': 'return=representation' },
    });
    if (!res.ok) throw new Error(`DB delete error [${res.status}]: ${await res.text()}`);
    return res.json();
  }

  async function rpc(fn, params = {}) {
    const res = await fetch(`${base}/rpc/${fn}`, {
      method:  'POST',
      headers: { ...baseHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body:    JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`DB rpc error [${res.status}]: ${await res.text()}`);
    return res.json();
  }

  return { select, insert, update, delete: del, rpc };
}
