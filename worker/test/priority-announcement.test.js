import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { announcePrioritySession } from '../src/routes/priority.js';
import { generateShopToken } from '../src/utils/auth.js';

globalThis.crypto ??= webcrypto;

const shopId = '11111111-1111-4111-8111-111111111111';
const otherShopId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const env = {
  SUPABASE_URL: 'https://queue-os-test.supabase.co',
  SUPABASE_KEY: 'test-key',
  ADMIN_SECRET: 'test-admin-secret',
};

async function requestFor(shop) {
  const token = await generateShopToken(shop, env.ADMIN_SECRET);
  return new Request(`https://worker.test/priority/sessions/${sessionId}/announce`, {
    method: 'PATCH',
    headers: { 'x-session-token': token },
  });
}

test('priority announcement update is scoped to the authenticated shop', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  let requestedUrl = '';
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify([{ id: sessionId }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const response = await announcePrioritySession(await requestFor(shopId), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { claimed: true });

  const url = new URL(requestedUrl);
  assert.equal(url.pathname, '/rest/v1/priority_sessions');
  assert.equal(url.searchParams.get('id'), `eq.${sessionId}`);
  assert.equal(url.searchParams.get('shop_id'), `eq.${shopId}`);
  assert.equal(url.searchParams.get('status'), 'eq.active');
  assert.equal(url.searchParams.get('priority_announced_at'), 'is.null');
});

test('a session not owned by the authenticated shop cannot be claimed', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  let requestedUrl = '';
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    // PostgREST returns no updated rows when the ownership filter does not match.
    return new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const response = await announcePrioritySession(await requestFor(shopId), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { claimed: false });

  const url = new URL(requestedUrl);
  assert.equal(url.searchParams.get('shop_id'), `eq.${shopId}`);
  assert.notEqual(url.searchParams.get('shop_id'), `eq.${otherShopId}`);
});
