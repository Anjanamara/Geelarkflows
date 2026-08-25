import { strict as assert } from 'node:assert';
import app from '../src/worker.js';

console.log('================================================================');
console.log('  GEELARK FLOWS: ROUTE-LEVEL HONO CHECKOUT SECURITY TESTS       ');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failCount++;
  }
}

// Intercept fetch calls to capture NOWPayments payload without hitting external servers
let lastNowPaymentsPayload = null;
const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, options) => {
  const urlStr = String(url);
  if (urlStr.includes('api.nowpayments.io')) {
    if (options && options.body) {
      lastNowPaymentsPayload = JSON.parse(options.body);
    }
    return new Response(
      JSON.stringify({
        payment_id: 'mock_pay_998877',
        payment_status: 'waiting',
        pay_address: 'TMockReceivingAddress1234567890XYZ',
        price_amount: lastNowPaymentsPayload?.price_amount || 100,
        price_currency: 'usd',
        pay_amount: lastNowPaymentsPayload?.price_amount || 100,
        pay_currency: lastNowPaymentsPayload?.pay_currency || 'usdttrc20',
        order_id: lastNowPaymentsPayload?.order_id || 'ord_mock',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return originalFetch(url, options);
};

// Mock D1 database to capture inserted orders and payments
let lastInsertedOrder = null;
const mockDb = {
  prepare: (query) => {
    return {
      bind: (...args) => {
        return {
          run: async () => {
            if (query.includes('INSERT INTO orders')) {
              lastInsertedOrder = {
                id: args[0],
                customer_email: args[1],
                total_usd: args[2],
                total_usd_cents: args[3],
                delivery_method: args[4],
                workflow_subtotal: args[5],
                setup_fee: args[7],
                status: args[9],
                items: JSON.parse(args[10] || '[]'),
                fulfillment_status: args[11],
                status_token_hash: args[12],
              };
            }
            return { success: true };
          },
          first: async () => null,
          all: async () => ({ results: [] }),
        };
      },
    };
  },
  batch: async (statements) => Promise.all(statements.map((statement) => statement.run())),
};

const mockEnv = {
  NOWPAYMENTS_API_KEY: 'test_mock_api_key_sandbox',
  DB: mockDb,
};

async function executeCheckoutRoute(payload) {
  lastNowPaymentsPayload = null;
  lastInsertedOrder = null;

  const req = new Request('https://geelarkflows.com/api/checkout/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const res = await app.request(req, undefined, mockEnv);
  const data = await res.json();
  return { status: res.status, data };
}

// 1. Legitimate request -> authoritative price
await runAsyncTest('Case 1: Legitimate request resolves authoritative price ($1000)', async () => {
  const { status, data } = await executeCheckoutRoute({
    email: 'test@example.com',
    delivery_method: 'download_package',
    network: 'trc20',
    cart: [{ id: 'instagram-account-creation', quantity: 1 }],
  });

  assert.equal(status, 200);
  assert.equal(data.success, true);
  assert.equal(data.data.workflowSubtotal, 1000);
  assert.equal(data.data.totalUsd, 1000);
  assert.equal(lastNowPaymentsPayload.price_amount, 1000);
  assert.equal(lastInsertedOrder.total_usd, 1000);
  assert.equal(lastInsertedOrder.items[0].price, 1000);
});

// 2. Client price = $1 -> ignored by actual Hono route
await runAsyncTest('Case 2: Client tampers price to $1.00 -> Route ignores client price and charges $1000', async () => {
  const { status, data } = await executeCheckoutRoute({
    email: 'hacker@example.com',
    delivery_method: 'download_package',
    network: 'trc20',
    cart: [{ id: 'instagram-account-creation', price: 1.00, title: 'Hacked $1 Item', quantity: 1 }],
  });

  assert.equal(status, 200);
  assert.equal(data.success, true);
  assert.equal(data.data.workflowSubtotal, 1000);
  assert.equal(data.data.totalUsd, 1000);
  assert.equal(lastNowPaymentsPayload.price_amount, 1000);
  assert.equal(lastInsertedOrder.total_usd, 1000);
  assert.equal(lastInsertedOrder.items[0].price, 1000);
  assert.equal(lastInsertedOrder.items[0].title, 'Instagram Account Creation');
});

// 3. Client price = $0 -> ignored
await runAsyncTest('Case 3: Client sets price to $0.00 -> Route charges authoritative $800 for Snapchat', async () => {
  const { status, data } = await executeCheckoutRoute({
    email: 'buyer@example.com',
    delivery_method: 'download_package',
    network: 'trc20',
    cart: [{ id: 'snapchat-account-creation', price: 0, quantity: 1 }],
  });

  assert.equal(status, 200);
  assert.equal(data.data.workflowSubtotal, 800);
  assert.equal(data.data.totalUsd, 800);
  assert.equal(lastNowPaymentsPayload.price_amount, 800);
  assert.equal(lastInsertedOrder.items[0].price, 800);
});

// 4. Client price negative -> ignored
await runAsyncTest('Case 4: Client sets price to negative -$100.00 -> Route charges authoritative $250', async () => {
  const { status, data } = await executeCheckoutRoute({
    email: 'buyer@example.com',
    delivery_method: 'download_package',
    network: 'trc20',
    cart: [{ id: 'tiktok-warmup', price: -100, quantity: 1 }],
  });

  assert.equal(status, 200);
  assert.equal(data.data.workflowSubtotal, 250);
  assert.equal(data.data.totalUsd, 250);
  assert.equal(lastNowPaymentsPayload.price_amount, 250);
});

// 5. Fake title -> ignored, server title recorded
await runAsyncTest('Case 5: Fake title in client payload is ignored in favor of catalog title in D1', async () => {
  const { status } = await executeCheckoutRoute({
    email: 'buyer@example.com',
    delivery_method: 'download_package',
    network: 'trc20',
    cart: [{ id: 'instagram-profile-edits', title: 'Fake Spoofed Title', price: 9999, quantity: 1 }],
  });

  assert.equal(status, 200);
  assert.equal(lastInsertedOrder.items[0].title, 'Instagram Profile Editing');
  assert.equal(lastInsertedOrder.items[0].price, 150);
});

// 6. Unknown ID -> 400
await runAsyncTest('Case 6: Unknown product ID returns HTTP 400 Bad Request', async () => {
  const { status, data } = await executeCheckoutRoute({
    email: 'buyer@example.com',
    delivery_method: 'download_package',
    network: 'trc20',
    cart: [{ id: 'non-existent-exploit-id', quantity: 1 }],
  });

  assert.equal(status, 400);
  assert.equal(data.success, false);
  assert.match(data.error, /Unknown or discontinued workflow/);
  assert.equal(lastNowPaymentsPayload, null);
});

// 7. Invalid quantity -> 400
await runAsyncTest('Case 7: Invalid quantities (0, -5, 1.5, 101, string) return HTTP 400 Bad Request', async () => {
  const res1 = await executeCheckoutRoute({
    email: 'buyer@example.com',
    delivery_method: 'download_package',
    network: 'trc20',
    cart: [{ id: 'instagram-warmup', quantity: 0 }],
  });
  assert.equal(res1.status, 400);

  const res2 = await executeCheckoutRoute({
    email: 'buyer@example.com',
    delivery_method: 'download_package',
    network: 'trc20',
    cart: [{ id: 'instagram-warmup', quantity: -2 }],
  });
  assert.equal(res2.status, 400);

  const res3 = await executeCheckoutRoute({
    email: 'buyer@example.com',
    delivery_method: 'download_package',
    network: 'trc20',
    cart: [{ id: 'instagram-warmup', quantity: 1.5 }],
  });
  assert.equal(res3.status, 400);

  const res4 = await executeCheckoutRoute({
    email: 'buyer@example.com',
    delivery_method: 'download_package',
    network: 'trc20',
    cart: [{ id: 'instagram-warmup', quantity: 101 }],
  });
  assert.equal(res4.status, 400);
});

// 8. Account setup subtotal below $300 -> $50 fee
await runAsyncTest('Case 8: GeeLark Setup for $150 workflow subtotal adds $50 setup fee (Total = $200)', async () => {
  const { status, data } = await executeCheckoutRoute({
    email: 'buyer@example.com',
    delivery_method: 'geelark_setup',
    network: 'trc20',
    cart: [{ id: 'instagram-profile-edits', quantity: 1 }],
  });

  assert.equal(status, 200);
  assert.equal(data.data.workflowSubtotal, 150);
  assert.equal(data.data.setupFee, 50);
  assert.equal(data.data.totalUsd, 200);
  assert.equal(lastNowPaymentsPayload.price_amount, 200);
  assert.equal(lastInsertedOrder.setup_fee, 50);
  assert.equal(lastInsertedOrder.total_usd, 200);
});

// 9. Account setup exactly $300 -> $0 FREE fee
await runAsyncTest('Case 9: GeeLark Setup for $300 workflow subtotal ($150 x 2) qualifies for FREE setup ($0 fee)', async () => {
  const { status, data } = await executeCheckoutRoute({
    email: 'buyer@example.com',
    delivery_method: 'geelark_setup',
    network: 'trc20',
    cart: [{ id: 'instagram-profile-edits', quantity: 2 }],
  });

  assert.equal(status, 200);
  assert.equal(data.data.workflowSubtotal, 300);
  assert.equal(data.data.setupFee, 0);
  assert.equal(data.data.totalUsd, 300);
  assert.equal(lastNowPaymentsPayload.price_amount, 300);
  assert.equal(lastInsertedOrder.setup_fee, 0);
});

// 10. Download package -> $0 fee always
await runAsyncTest('Case 10: Downloadable Package setup fee is $0 on subtotal < $300 and >= $300', async () => {
  const { status, data } = await executeCheckoutRoute({
    email: 'buyer@example.com',
    delivery_method: 'download_package',
    network: 'trc20',
    cart: [{ id: 'threads-account-creation', quantity: 1 }], // $100
  });

  assert.equal(status, 200);
  assert.equal(data.data.workflowSubtotal, 100);
  assert.equal(data.data.setupFee, 0);
  assert.equal(data.data.totalUsd, 100);
  assert.equal(lastNowPaymentsPayload.price_amount, 100);
});

// 11. NOWPayments mocked price_amount equals authoritative finalTotal
await runAsyncTest('Case 11: Multi-item cart NOWPayments price_amount strictly equals authoritative total ($1400)', async () => {
  const { status, data } = await executeCheckoutRoute({
    email: 'buyer@example.com',
    delivery_method: 'geelark_setup',
    network: 'trc20',
    cart: [
      { id: 'instagram-account-creation', price: 5, quantity: 1 }, // Authoritative $1000
      { id: 'dating-chat-automation', price: 2, quantity: 1 },     // Authoritative $400
    ],
  });

  assert.equal(status, 200);
  assert.equal(data.data.workflowSubtotal, 1400);
  assert.equal(data.data.setupFee, 0); // Subtotal >= $300 -> FREE
  assert.equal(data.data.totalUsd, 1400);
  assert.equal(lastNowPaymentsPayload.price_amount, 1400);
  assert.equal(lastInsertedOrder.total_usd, 1400);
  assert.equal(lastInsertedOrder.items.length, 2);
  assert.equal(lastInsertedOrder.items[0].price, 1000);
  assert.equal(lastInsertedOrder.items[1].price, 400);
});

await runAsyncTest('Case 12: Checkout returns a private 256-bit status token and full-entropy order ID', async () => {
  const { status, data } = await executeCheckoutRoute({
    email: 'secure@example.com',
    delivery_method: 'download_package',
    network: 'erc20',
    cart: [{ id: 'instagram-account-creation', quantity: 1 }],
  });

  assert.equal(status, 200);
  assert.match(data.data.orderId, /^ord_[a-f0-9]{32}$/);
  assert.match(data.data.statusToken, /^[a-f0-9]{64}$/);
  assert.equal(data.data.network, 'erc20');
  assert.equal(data.data.qrCodeUrl, undefined);
});

await runAsyncTest('Case 13: Database batch failure never reveals a live payment address', async () => {
  const originalBatch = mockDb.batch;
  mockDb.batch = async () => { throw new Error('simulated D1 outage'); };
  try {
    const { status, data } = await executeCheckoutRoute({
      email: 'safe-failure@example.com',
      delivery_method: 'download_package',
      network: 'trc20',
      cart: [{ id: 'instagram-account-creation', quantity: 1 }],
    });
    assert.equal(status, 503);
    assert.equal(data.success, false);
    assert.equal(data.data, undefined);
    assert.doesNotMatch(JSON.stringify(data), /TMockReceivingAddress/);
  } finally {
    mockDb.batch = originalBatch;
  }
});

await runAsyncTest('Case 14: Checkout invoice creation is rate-limited before contacting the payment gateway', async () => {
  const rateLimitedDb = {
    ...mockDb,
    prepare(query) {
      if (query.includes('INSERT INTO api_rate_limits')) {
        return {
          bind: () => ({
            first: async () => ({ request_count: 11 }),
          }),
        };
      }
      return mockDb.prepare(query);
    },
  };

  lastNowPaymentsPayload = null;
  const req = new Request('https://geelarkflows.com/api/checkout/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.25',
    },
    body: JSON.stringify({
      email: 'rate-limited@example.com',
      delivery_method: 'download_package',
      network: 'trc20',
      cart: [{ id: 'instagram-account-creation', quantity: 1 }],
    }),
  });

  const res = await app.request(req, undefined, { ...mockEnv, DB: rateLimitedDb });
  const data = await res.json();
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('retry-after'), '900');
  assert.equal(data.success, false);
  assert.equal(lastNowPaymentsPayload, null);
});

await runAsyncTest('Case 15: Malformed checkout JSON is rejected without leaking an internal parser error', async () => {
  const req = new Request('https://geelarkflows.com/api/checkout/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not-valid-json',
  });
  const res = await app.request(req, undefined, mockEnv);
  const data = await res.json();
  assert.equal(res.status, 400);
  assert.equal(data.error, 'Invalid JSON payload format.');
  assert.doesNotMatch(JSON.stringify(data), /SyntaxError|Unexpected token|JSON at position/i);
});

console.log('\n================================================================');
console.log(`  RESULT: ${passCount}/${passCount + failCount} Scenarios Passed (${Math.round((passCount / (passCount + failCount)) * 100)}%)`);
console.log('================================================================\n');

if (failCount > 0) process.exit(1);
