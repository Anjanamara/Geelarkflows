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
let nowPaymentsFetches = [];
let providerScenario = {};
const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, options) => {
  const urlStr = String(url);
  if (urlStr.includes('api.nowpayments.io')) {
    const isCreate = (options?.method || 'GET').toUpperCase() === 'POST';
    nowPaymentsFetches.push({ url: urlStr, method: isCreate ? 'POST' : 'GET' });
    if (options && options.body) {
      lastNowPaymentsPayload = JSON.parse(options.body);
    }
    const baseResponse = {
      payment_id: '998877',
      payment_status: 'waiting',
      pay_address: 'TMockReceivingAddress1234567890XYZ',
      price_amount: lastNowPaymentsPayload?.price_amount || 100,
      price_currency: 'usd',
      pay_amount: lastNowPaymentsPayload?.price_amount || 100,
      pay_currency: lastNowPaymentsPayload?.pay_currency || 'usdttrc20',
      order_id: lastNowPaymentsPayload?.order_id || 'ord_mock',
    };
    const responseBody = {
      ...baseResponse,
      ...(isCreate ? providerScenario.createOverrides : providerScenario.verifyOverrides),
    };
    const responseStatus = isCreate
      ? (providerScenario.createStatus || 200)
      : (providerScenario.verifyStatus || 200);
    return new Response(
      JSON.stringify(responseBody),
      { status: responseStatus, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return originalFetch(url, options);
};

// Mock D1 database to capture inserted orders and payments
let lastInsertedOrder = null;
let lastInsertedPayment = null;
let lastCouponRedemption = null;
let couponFixture = null;
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
                coupon_code: args[9],
                coupon_discount_usd: args[10],
                coupon_discount_cents: args[11],
                status: args[12],
                items: JSON.parse(args[13] || '[]'),
                fulfillment_status: args[14],
                status_token_hash: args[15],
              };
            }
            if (query.includes('INSERT INTO crypto_payments')) {
              lastInsertedPayment = {
                id: args[0],
                order_id: args[1],
                pay_address: args[5],
                pay_amount_crypto_text: args[7],
                verification_source: args[13],
              };
            }
            if (query.includes('INSERT INTO coupon_redemptions')) {
              lastCouponRedemption = {
                id: args[0],
                coupon_id: args[1],
                order_id: args[2],
                customer_email: args[3],
                discount_cents: args[4],
              };
            }
            return { success: true };
          },
          first: async () => query.includes('FROM coupon_codes') ? couponFixture : null,
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

async function executeCheckoutRoute(payload, scenario = {}) {
  lastNowPaymentsPayload = null;
  nowPaymentsFetches = [];
  providerScenario = scenario;
  lastInsertedOrder = null;
  lastInsertedPayment = null;
  lastCouponRedemption = null;
  couponFixture = scenario.coupon || null;

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
  assert.equal(nowPaymentsFetches.length, 2);
  assert.deepEqual(nowPaymentsFetches.map(({ method }) => method), ['POST', 'GET']);
  assert.equal(data.data.addressVerified, true);
  assert.equal(data.data.verificationSource, 'nowpayments_api_double_verified');
  assert.equal(lastInsertedPayment.verification_source, 'nowpayments_api_double_verified');
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

await runAsyncTest('Case 16: Checkout fails closed when the second NOWPayments lookup disagrees with the created invoice', async () => {
  const mismatches = [
    { payment_id: '998878' },
    { order_id: 'ord_wrong' },
    { payment_status: 'unknown' },
    { pay_address: 'TDifferentProviderAddress987654321XYZ' },
    { pay_currency: 'usdterc20' },
    { price_amount: 1001 },
    { pay_amount: 999 },
  ];

  for (const verifyOverrides of mismatches) {
    const { status, data } = await executeCheckoutRoute({
      email: 'double-check@example.com',
      delivery_method: 'download_package',
      network: 'trc20',
      cart: [{ id: 'instagram-account-creation', quantity: 1 }],
    }, { verifyOverrides });

    assert.equal(status, 502);
    assert.equal(data.success, false);
    assert.equal(data.data, undefined);
    assert.equal(lastInsertedOrder, null);
    assert.equal(lastInsertedPayment, null);
    assert.equal(nowPaymentsFetches.length, 2);
    assert.doesNotMatch(JSON.stringify(data), /TMockReceivingAddress|TDifferentProviderAddress/);
  }
});

await runAsyncTest('Case 17: Checkout reveals no address when the provider verification lookup is unavailable', async () => {
  const { status, data } = await executeCheckoutRoute({
    email: 'provider-down@example.com',
    delivery_method: 'download_package',
    network: 'trc20',
    cart: [{ id: 'instagram-account-creation', quantity: 1 }],
  }, { verifyStatus: 503 });

  assert.equal(status, 502);
  assert.equal(data.success, false);
  assert.equal(lastInsertedPayment, null);
  assert.doesNotMatch(JSON.stringify(data), /TMockReceivingAddress/);
});

await runAsyncTest('Case 18: Checkout rejects a non-provider placeholder payment ID before displaying an address', async () => {
  const { status, data } = await executeCheckoutRoute({
    email: 'no-placeholder@example.com',
    delivery_method: 'download_package',
    network: 'trc20',
    cart: [{ id: 'instagram-account-creation', quantity: 1 }],
  }, { createOverrides: { payment_id: 'pay_placeholder_123' } });

  assert.equal(status, 502);
  assert.equal(data.success, false);
  assert.equal(nowPaymentsFetches.length, 1);
  assert.equal(lastInsertedPayment, null);
  assert.doesNotMatch(JSON.stringify(data), /TMockReceivingAddress/);
});

await runAsyncTest('Case 19: Percentage coupon discounts authoritative catalog subtotal and gateway amount', async () => {
  const { status, data } = await executeCheckoutRoute({
    email: 'coupon@example.com',
    delivery_method: 'download_package',
    network: 'trc20',
    coupon_code: 'save10',
    cart: [{ id: 'instagram-account-creation', price: 1, quantity: 1 }],
  }, {
    coupon: {
      id: 'cpn_save10', code: 'SAVE10', active: 1, discount_type: 'percentage', discount_value: 10,
      min_subtotal_cents: 0, max_redemptions: null, redemption_count: 2, has_started: 1, has_not_expired: 1,
    },
  });

  assert.equal(status, 200);
  assert.equal(data.data.workflowSubtotal, 1000);
  assert.equal(data.data.couponCode, 'SAVE10');
  assert.equal(data.data.couponDiscount, 100);
  assert.equal(data.data.totalUsd, 900);
  assert.equal(lastNowPaymentsPayload.price_amount, 900);
  assert.equal(lastInsertedOrder.coupon_code, 'SAVE10');
  assert.equal(lastInsertedOrder.coupon_discount_cents, 10000);
  assert.equal(lastCouponRedemption.coupon_id, 'cpn_save10');
  assert.equal(lastCouponRedemption.discount_cents, 10000);
});

await runAsyncTest('Case 20: Coupon minimum spend is calculated from authoritative prices', async () => {
  const { status, data } = await executeCheckoutRoute({
    email: 'minimum@example.com',
    delivery_method: 'geelark_setup',
    network: 'trc20',
    coupon_code: 'MIN500',
    cart: [{ id: 'instagram-profile-edits', price: 9999, quantity: 1 }],
  }, {
    coupon: {
      id: 'cpn_min500', code: 'MIN500', active: 1, discount_type: 'fixed_amount', discount_value: 2500,
      min_subtotal_cents: 50000, max_redemptions: null, redemption_count: 0, has_started: 1, has_not_expired: 1,
    },
  });

  assert.equal(status, 400);
  assert.equal(data.success, false);
  assert.match(data.error, /at least \$500\.00/);
  assert.equal(lastNowPaymentsPayload, null);
});

await runAsyncTest('Case 21: Inactive or unknown coupons fail before payment provider contact', async () => {
  const { status, data } = await executeCheckoutRoute({
    email: 'invalid-coupon@example.com',
    delivery_method: 'download_package',
    network: 'trc20',
    coupon_code: 'NOTREAL',
    cart: [{ id: 'instagram-account-creation', quantity: 1 }],
  });

  assert.equal(status, 400);
  assert.equal(data.success, false);
  assert.match(data.error, /invalid|inactive/i);
  assert.equal(lastNowPaymentsPayload, null);
  assert.equal(lastInsertedOrder, null);
});

console.log('\n================================================================');
console.log(`  RESULT: ${passCount}/${passCount + failCount} Scenarios Passed (${Math.round((passCount / (passCount + failCount)) * 100)}%)`);
console.log('================================================================\n');

if (failCount > 0) process.exit(1);
