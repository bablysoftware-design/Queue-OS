import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPosition } from '../src/routes/public.js';

const shopId = '11111111-1111-4111-8111-111111111111';
const tokenId = '33333333-3333-4333-8333-333333333333';
const env = {
  SUPABASE_URL: 'https://queue-os-test.supabase.co',
  SUPABASE_KEY: 'test-key',
};

const privateToken = {
  id: tokenId,
  shop_id: shopId,
  token_number: 17,
  status: 'waiting',
  created_at: '2026-10-10T09:00:00.000Z',
  customer_name: 'Private Customer',
  customer_phone: '+923001234567',
  customer_note: 'Private medical note',
  voice_note_url: 'private-voice-note.mp3',
  voice_note_duration: 12,
  cancelled_at: null,
};

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('terminal position response preserves token summary but omits private customer fields', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input) => {
    assert.match(String(input), /\/rest\/v1\/tokens\?/);
    return jsonResponse([{ ...privateToken, status: 'completed' }]);
  };

  const request = new Request(
    `https://worker.test/public/position?shop_id=${shopId}&token_id=${tokenId}`
  );
  const response = await checkPosition(request, env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.status, 'completed');
  assert.deepEqual(body.data.token, {
    id: tokenId,
    token_number: 17,
    status: 'completed',
    created_at: '2026-10-10T09:00:00.000Z',
  });
  for (const field of ['customer_name', 'customer_phone', 'customer_note', 'voice_note_url', 'voice_note_duration', 'shop_id']) {
    assert.equal(field in body.data.token, false, `unexpected private field: ${field}`);
  }
});

test('waiting position response keeps queue fields and omits private customer fields', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/tokens') && url.searchParams.get('id') === `eq.${tokenId}`) {
      return jsonResponse([privateToken]);
    }
    if (url.pathname.endsWith('/tokens') && url.searchParams.get('token_number') === 'lt.17') {
      return jsonResponse([{ id: '44444444-4444-4444-8444-444444444444' }]);
    }
    if (url.pathname.endsWith('/shops')) {
      return jsonResponse([{ avg_service_time_mins: 10, current_token: 16, name: 'Test Shop', is_open: true }]);
    }
    if (url.pathname.endsWith('/priority_sessions')) return jsonResponse([]);
    throw new Error(`Unexpected mocked request: ${url}`);
  };

  const request = new Request(
    `https://worker.test/public/position?shop_id=${shopId}&token_id=${tokenId}`
  );
  const response = await checkPosition(request, env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.status, 'waiting');
  assert.equal(body.data.position, 2);
  assert.equal(body.data.people_ahead, 1);
  assert.equal(body.data.estimated_wait, 10);
  assert.deepEqual(body.data.token, {
    id: tokenId,
    token_number: 17,
    status: 'waiting',
    created_at: '2026-10-10T09:00:00.000Z',
  });
  assert.equal('customer_phone' in body.data.token, false);
  assert.equal('customer_note' in body.data.token, false);
});
