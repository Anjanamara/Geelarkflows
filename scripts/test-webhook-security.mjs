import { strict as assert } from 'node:assert';
import crypto from 'node:crypto';
import app from '../src/worker.js';

console.log('================================================================');
console.log('  GEELARK FLOWS: FAIL-CLOSED WEBHOOK SECURITY TEST SUITE        ');
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

// ----------------------------------------------------------------
// HELPER SIGNATURE GENERATORS FOR TESTING
// ----------------------------------------------------------------

function generateNowPaymentsHmac(payload, secretKey) {
  const sortedKeys = Object.keys(payload).sort();
  const sortedObj = {};
  for (const key of sortedKeys) {
    sortedObj[key] = payload[key];
  }
  const dataString = JSON.stringify(sortedObj);
  return crypto.createHmac('sha512', secretKey).update(dataString).digest('hex');
}

function generateSvixSignature(svixId, svixTimestamp, rawBody, secret) {
  let keyBuffer;
  if (secret.startsWith('whsec_')) {
    keyBuffer = Buffer.from(secret.substring(6), 'base64');
  } else {
    keyBuffer = Buffer.from(secret, 'utf8');
  }
  const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
  const sigBase64 = crypto.createHmac('sha256', keyBuffer).update(toSign).digest('base64');
  return `v1,${sigBase64}`;
}

function createNowPaymentsPayload(paymentStatus = 'finished', overrides = {}) {
  return {
    payment_id: 'pay_sec_test_001',
    order_id: 'ord_3a8b9f12',
    payment_status: paymentStatus,
    pay_currency: 'usdttrc20',
    pay_amount: '1000',
    actually_paid: '1000',
    price_amount: 1000,
    price_currency: 'usd',
    ...overrides,
  };
}

// ----------------------------------------------------------------
// IN-MEMORY MOCK D1 DATABASE
// ----------------------------------------------------------------

function createMockDb() {
  const orders = new Map();
  const payments = new Map();
  const inboundEmails = new Map();
  const fulfillmentLogs = [];

  // Seed sample order and payment record
  orders.set('ord_3a8b9f12', {
    id: 'ord_3a8b9f12',
    customer_email: 'buyer.sec@example.com',
    status: 'pending',
    fulfillment_status: 'not_ready',
    items: JSON.stringify([{ id: 'instagram-account-creation', title: 'Instagram Account Creation', price: 1000, quantity: 1 }]),
    total_usd: 1000,
    total_usd_cents: 100000,
    delivery_method: 'geelark_setup',
    workflow_subtotal: 1000,
    setup_fee: 0,
  });

  payments.set('ord_3a8b9f12', {
    id: 'pay_sec_test_001',
    order_id: 'ord_3a8b9f12',
    currency: 'USDT (TRC-20)',
    network_id: 'trc20',
    provider_currency: 'usdttrc20',
    pay_amount_crypto: 1000,
    pay_amount_crypto_text: '1000',
    expected_price_usd_cents: 100000,
    status: 'waiting',
  });

  return {
    orders,
    payments,
    inboundEmails,
    fulfillmentLogs,
    prepare: (query) => ({
      bind: (...args) => ({
        first: async () => {
          if (query.includes('FROM crypto_payments WHERE id = ? AND order_id = ?')) {
            const [paymentId, orderId] = args;
            const payment = payments.get(orderId);
            return payment?.id === paymentId ? payment : null;
          }
          if (query.includes('FROM orders WHERE id = ?') || query.includes('FROM orders WHERE LOWER(id) = ?')) {
            const [orderId] = args;
            for (const [k, v] of orders.entries()) {
              if (k.toLowerCase() === String(orderId).toLowerCase()) return v;
            }
            return null;
          }
          if (query.includes('FROM inbound_emails WHERE provider_email_id = ?')) {
            const [providerId] = args;
            for (const email of inboundEmails.values()) {
              if (email.provider_email_id === providerId) return email;
            }
            return null;
          }
          if (query.includes('FROM orders WHERE customer_email = ?')) {
            const [email] = args;
            for (const o of orders.values()) {
              if (o.customer_email === email) return o;
            }
            return null;
          }
          return null;
        },
        run: async () => {
          if (query.includes("SET status = 'review_required'")) {
            const rec = payments.get(args[1]);
            if (rec) rec.status = 'review_required';
          } else if (query.includes('UPDATE crypto_payments') && query.includes('SET status = ?')) {
            const [status] = args;
            const paymentId = args[args.length - 2];
            const orderId = args[args.length - 1];
            const rec = payments.get(orderId);
            if (rec) {
              rec.status = status;
              if (query.includes('tx_hash = ?')) {
                rec.tx_hash = args[1];
                rec.verification_source = args[2];
              }
            }
          } else if (query.includes('UPDATE orders SET status = ?, fulfillment_status = ?')) {
            const [status, fulfillmentStatus, orderId] = args;
            const rec = orders.get(orderId);
            if (rec) {
              rec.status = status;
              rec.fulfillment_status = fulfillmentStatus;
            }
          } else if (query.includes("UPDATE orders SET status = 'failed'")) {
            const rec = orders.get(args[0]);
            if (rec) rec.status = 'failed';
          } else if (query.includes("UPDATE orders SET status = 'refunded'")) {
            const rec = orders.get(args[0]);
            if (rec) rec.status = 'refunded';
          } else if (query.includes('INSERT INTO inbound_emails')) {
            const [
              id, provider_email_id, message_id, in_reply_to, references_header,
              from_address, from_name, to_addresses, cc_addresses, reply_to,
              subject, text_body, html_body, received_at, is_read, is_archived,
              order_id, customer_email
            ] = args;
            inboundEmails.set(id, {
              id, provider_email_id, from_address, subject, text_body, order_id, customer_email
            });
          }
          return { success: true };
        },
        all: async () => ({ results: [] }),
      }),
    }),
    batch: async (statements) => Promise.all(statements.map((statement) => statement.run())),
  };
}

const TEST_CRYPTO_SECRET = 'mock_crypto_webhook_secret_key_556677';
const TEST_RESEND_SECRET = 'whsec_Pdwo7zBV51ekoefNIN1PmkqInHLqJQW9';

// ================================================================
// PART 1: NOWPAYMENTS FAIL-CLOSED WEBHOOK SECURITY TESTS
// ================================================================

console.log('--- PART 1: NOWPayments Webhook Verification ---');

// 1. Signing secret missing on server -> rejected (500)
await runAsyncTest('NOWPayments Case 1: Missing server CRYPTO_WEBHOOK_SECRET returns 500 error', async () => {
  const db = createMockDb();
  const envWithoutSecret = { DB: db }; // No CRYPTO_WEBHOOK_SECRET

  const payload = createNowPaymentsPayload();
  const hmac = generateNowPaymentsHmac(payload, TEST_CRYPTO_SECRET);

  const req = new Request('https://geelarkflows.com/api/webhooks/crypto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': hmac },
    body: JSON.stringify(payload),
  });

  const res = await app.request(req, undefined, envWithoutSecret);
  assert.equal(res.status, 500);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.error, /signing configuration missing/);
  // Assert ZERO state changes in D1
  assert.equal(db.orders.get('ord_3a8b9f12').status, 'pending');
});

// 2. Signature header missing -> rejected (401)
await runAsyncTest('NOWPayments Case 2: Missing x-nowpayments-sig header returns 401 Unauthorized', async () => {
  const db = createMockDb();
  const env = { DB: db, CRYPTO_WEBHOOK_SECRET: TEST_CRYPTO_SECRET };

  const payload = createNowPaymentsPayload();

  const req = new Request('https://geelarkflows.com/api/webhooks/crypto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, // NO x-nowpayments-sig
    body: JSON.stringify(payload),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.error, /Missing x-nowpayments-sig signature header/);
  assert.equal(db.orders.get('ord_3a8b9f12').status, 'pending');
});

// 3. Malformed signature -> rejected (401)
await runAsyncTest('NOWPayments Case 3: Malformed signature string returns 401 Unauthorized', async () => {
  const db = createMockDb();
  const env = { DB: db, CRYPTO_WEBHOOK_SECRET: TEST_CRYPTO_SECRET };

  const payload = createNowPaymentsPayload();

  const req = new Request('https://geelarkflows.com/api/webhooks/crypto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': 'not-a-valid-hex-signature' },
    body: JSON.stringify(payload),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 401);
  assert.equal(db.orders.get('ord_3a8b9f12').status, 'pending');
});

// 4. Incorrect / mismatched signature -> rejected (401)
await runAsyncTest('NOWPayments Case 4: Incorrect signature signed with wrong secret returns 401', async () => {
  const db = createMockDb();
  const env = { DB: db, CRYPTO_WEBHOOK_SECRET: TEST_CRYPTO_SECRET };

  const payload = createNowPaymentsPayload();
  const forgedHmac = generateNowPaymentsHmac(payload, 'wrong_attacker_secret_999');

  const req = new Request('https://geelarkflows.com/api/webhooks/crypto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': forgedHmac },
    body: JSON.stringify(payload),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 401);
  assert.equal(db.orders.get('ord_3a8b9f12').status, 'pending');
});

// 5. Payload changed after signing -> rejected (401)
await runAsyncTest('NOWPayments Case 5: Tampered payload after signature generation returns 401', async () => {
  const db = createMockDb();
  const env = { DB: db, CRYPTO_WEBHOOK_SECRET: TEST_CRYPTO_SECRET };

  const originalPayload = createNowPaymentsPayload('waiting');
  const hmac = generateNowPaymentsHmac(originalPayload, TEST_CRYPTO_SECRET);

  // Attacker modifies payment_status to 'finished' without valid secret
  const tamperedPayload = { ...originalPayload, payment_status: 'finished' };

  const req = new Request('https://geelarkflows.com/api/webhooks/crypto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': hmac },
    body: JSON.stringify(tamperedPayload),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 401);
  assert.equal(db.orders.get('ord_3a8b9f12').status, 'pending');
});

// 6. Valid correctly signed payload -> accepted (200)
await runAsyncTest('NOWPayments Case 6: Valid correctly signed HMAC payload returns HTTP 200', async () => {
  const db = createMockDb();
  const env = { DB: db, CRYPTO_WEBHOOK_SECRET: TEST_CRYPTO_SECRET };

  const payload = createNowPaymentsPayload('finished', {
    outcome_tx_hash: '0xValidTxHash1234567890abcdef',
  });
  const hmac = generateNowPaymentsHmac(payload, TEST_CRYPTO_SECRET);

  const req = new Request('https://geelarkflows.com/api/webhooks/crypto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': hmac },
    body: JSON.stringify(payload),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.status, 'processed');
});

// 7. Invalid webhook performs ZERO order/payment state changes
await runAsyncTest('NOWPayments Case 7: Invalid webhook performs ZERO order/payment state changes', async () => {
  const db = createMockDb();
  const env = { DB: db, CRYPTO_WEBHOOK_SECRET: TEST_CRYPTO_SECRET };

  const payload = createNowPaymentsPayload();

  const req = new Request('https://geelarkflows.com/api/webhooks/crypto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': 'bad_sig' },
    body: JSON.stringify(payload),
  });

  await app.request(req, undefined, env);
  assert.equal(db.orders.get('ord_3a8b9f12').status, 'pending');
  assert.equal(db.orders.get('ord_3a8b9f12').fulfillment_status, 'not_ready');
  assert.equal(db.payments.get('ord_3a8b9f12').status, 'waiting');
});

// 8. Duplicate valid webhook does not duplicate state changes
await runAsyncTest('NOWPayments Case 8: Duplicate valid webhook idempotently succeeds', async () => {
  const db = createMockDb();
  const env = { DB: db, CRYPTO_WEBHOOK_SECRET: TEST_CRYPTO_SECRET };

  const payload = createNowPaymentsPayload();
  const hmac = generateNowPaymentsHmac(payload, TEST_CRYPTO_SECRET);

  const sendWebhook = () =>
    app.request(
      new Request('https://geelarkflows.com/api/webhooks/crypto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': hmac },
        body: JSON.stringify(payload),
      }),
      undefined,
      env
    );

  const res1 = await sendWebhook();
  assert.equal(res1.status, 200);
  assert.equal(db.orders.get('ord_3a8b9f12').status, 'paid');

  const res2 = await sendWebhook();
  assert.equal(res2.status, 200);
  assert.equal(db.orders.get('ord_3a8b9f12').status, 'paid');
});

// 9. Existing valid payment transition still works (GeeLark Setup -> setup_pending)
await runAsyncTest('NOWPayments Case 9: GeeLark Setup order transitions to setup_pending on paid', async () => {
  const db = createMockDb();
  const env = { DB: db, CRYPTO_WEBHOOK_SECRET: TEST_CRYPTO_SECRET };

  const payload = createNowPaymentsPayload('finished', {
    outcome_tx_hash: '0xHash8899',
  });
  const hmac = generateNowPaymentsHmac(payload, TEST_CRYPTO_SECRET);

  const req = new Request('https://geelarkflows.com/api/webhooks/crypto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': hmac },
    body: JSON.stringify(payload),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 200);
  assert.equal(db.orders.get('ord_3a8b9f12').status, 'paid');
  assert.equal(db.orders.get('ord_3a8b9f12').fulfillment_status, 'setup_pending');
  assert.equal(db.payments.get('ord_3a8b9f12').status, 'finished');
});

// 10. Invalid status/event does not mark an order paid
await runAsyncTest('NOWPayments Case 10: Failed/expired status closes the unpaid order without marking it paid', async () => {
  const db = createMockDb();
  const env = { DB: db, CRYPTO_WEBHOOK_SECRET: TEST_CRYPTO_SECRET };

  const payload = createNowPaymentsPayload('expired');
  const hmac = generateNowPaymentsHmac(payload, TEST_CRYPTO_SECRET);

  const req = new Request('https://geelarkflows.com/api/webhooks/crypto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': hmac },
    body: JSON.stringify(payload),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 200);
  assert.equal(db.orders.get('ord_3a8b9f12').status, 'failed');
  assert.equal(db.payments.get('ord_3a8b9f12').status, 'expired');
});

await runAsyncTest('NOWPayments Case 11: Signed underpayment is quarantined for manual review', async () => {
  const db = createMockDb();
  const env = { DB: db, CRYPTO_WEBHOOK_SECRET: TEST_CRYPTO_SECRET };
  const payload = createNowPaymentsPayload('finished', { actually_paid: '999.99' });
  const hmac = generateNowPaymentsHmac(payload, TEST_CRYPTO_SECRET);
  const res = await app.request(new Request('https://geelarkflows.com/api/webhooks/crypto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': hmac },
    body: JSON.stringify(payload),
  }), undefined, env);

  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'manual_review');
  assert.equal(db.orders.get('ord_3a8b9f12').status, 'pending');
  assert.equal(db.payments.get('ord_3a8b9f12').status, 'review_required');
});

// ================================================================
// PART 2: RESEND INBOUND EMAIL FAIL-CLOSED SECURITY TESTS
// ================================================================

console.log('\n--- PART 2: Resend Inbound Email Webhook Verification ---');

// 1. Signing secret missing on server -> rejected (500)
await runAsyncTest('Resend Case 1: Missing server RESEND_WEBHOOK_SECRET returns 500 error', async () => {
  const db = createMockDb();
  const envWithoutSecret = { DB: db }; // No RESEND_WEBHOOK_SECRET

  const svixId = `msg_${Date.now()}`;
  const svixTimestamp = Math.floor(Date.now() / 1000).toString();
  const bodyObj = { type: 'email.received', data: { email_id: 'resend_01', from: 'test@example.com', subject: 'Hello' } };
  const rawBody = JSON.stringify(bodyObj);
  const svixSig = generateSvixSignature(svixId, svixTimestamp, rawBody, TEST_RESEND_SECRET);

  const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSig,
    },
    body: rawBody,
  });

  const res = await app.request(req, undefined, envWithoutSecret);
  assert.equal(res.status, 500);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.error, /signing configuration missing/);
  assert.equal(db.inboundEmails.size, 0);
});

// 2. Missing svix-id -> rejected (401)
await runAsyncTest('Resend Case 2: Missing svix-id header returns 401 Unauthorized', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_WEBHOOK_SECRET: TEST_RESEND_SECRET };

  const rawBody = JSON.stringify({ type: 'email.received', data: { email_id: 'resend_02' } });

  const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
      'svix-signature': 'v1,some_signature',
    },
    body: rawBody,
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 401);
  assert.equal(db.inboundEmails.size, 0);
});

// 3. Missing svix-timestamp -> rejected (401)
await runAsyncTest('Resend Case 3: Missing svix-timestamp header returns 401 Unauthorized', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_WEBHOOK_SECRET: TEST_RESEND_SECRET };

  const rawBody = JSON.stringify({ type: 'email.received', data: { email_id: 'resend_03' } });

  const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': 'msg_123',
      'svix-signature': 'v1,some_signature',
    },
    body: rawBody,
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 401);
  assert.equal(db.inboundEmails.size, 0);
});

// 4. Missing svix-signature -> rejected (401)
await runAsyncTest('Resend Case 4: Missing svix-signature header returns 401 Unauthorized', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_WEBHOOK_SECRET: TEST_RESEND_SECRET };

  const rawBody = JSON.stringify({ type: 'email.received', data: { email_id: 'resend_04' } });

  const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': 'msg_123',
      'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
    },
    body: rawBody,
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 401);
  assert.equal(db.inboundEmails.size, 0);
});

// 5. Invalid signature -> rejected (401)
await runAsyncTest('Resend Case 5: Invalid Svix signature returns 401 Unauthorized', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_WEBHOOK_SECRET: TEST_RESEND_SECRET };

  const svixId = `msg_${Date.now()}`;
  const svixTimestamp = Math.floor(Date.now() / 1000).toString();
  const rawBody = JSON.stringify({ type: 'email.received', data: { email_id: 'resend_05' } });
  const forgedSig = generateSvixSignature(svixId, svixTimestamp, rawBody, 'whsec_WrongAttackerSecretKey123456');

  const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': forgedSig,
    },
    body: rawBody,
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 401);
  assert.equal(db.inboundEmails.size, 0);
});

// 6. Tampered body -> rejected (401)
await runAsyncTest('Resend Case 6: Tampered body after signature creation returns 401 Unauthorized', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_WEBHOOK_SECRET: TEST_RESEND_SECRET };

  const svixId = `msg_${Date.now()}`;
  const svixTimestamp = Math.floor(Date.now() / 1000).toString();
  const originalBody = JSON.stringify({ type: 'email.received', data: { email_id: 'resend_06', text: 'Original message' } });
  const validSig = generateSvixSignature(svixId, svixTimestamp, originalBody, TEST_RESEND_SECRET);

  const tamperedBody = JSON.stringify({ type: 'email.received', data: { email_id: 'resend_06', text: 'Injected spoofed message' } });

  const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': validSig,
    },
    body: tamperedBody,
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 401);
  assert.equal(db.inboundEmails.size, 0);
});

// 7. Valid signed event -> accepted (200)
await runAsyncTest('Resend Case 7: Valid correctly signed Svix event returns HTTP 200', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_WEBHOOK_SECRET: TEST_RESEND_SECRET };

  const svixId = `msg_${Date.now()}`;
  const svixTimestamp = Math.floor(Date.now() / 1000).toString();
  const bodyObj = {
    type: 'email.received',
    data: {
      email_id: 'resend_valid_007',
      from: 'Customer <buyer.sec@example.com>',
      to: ['support@geelarkflows.com'],
      subject: 'Question regarding order ord_3a8b9f12',
      text: 'Can you help me setup the workflow on my profile?',
    },
  };
  const rawBody = JSON.stringify(bodyObj);
  const validSig = generateSvixSignature(svixId, svixTimestamp, rawBody, TEST_RESEND_SECRET);

  const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': validSig,
    },
    body: rawBody,
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.id);
  assert.equal(db.inboundEmails.size, 1);
});

// 8. Invalid event writes ZERO inbound email records
await runAsyncTest('Resend Case 8: Invalid event writes ZERO inbound email records in D1', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_WEBHOOK_SECRET: TEST_RESEND_SECRET };

  const rawBody = JSON.stringify({ type: 'email.received', data: { email_id: 'malicious_event_008' } });

  const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': 'msg_008',
      'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
      'svix-signature': 'v1,invalid_signature_hex',
    },
    body: rawBody,
  });

  await app.request(req, undefined, env);
  assert.equal(db.inboundEmails.size, 0);
});

// 9. Duplicate provider event remains deduplicated
await runAsyncTest('Resend Case 9: Duplicate provider event ID returns already_processed without duplicate insertion', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_WEBHOOK_SECRET: TEST_RESEND_SECRET };

  const svixId = `msg_${Date.now()}`;
  const svixTimestamp = Math.floor(Date.now() / 1000).toString();
  const bodyObj = {
    type: 'email.received',
    data: {
      email_id: 'resend_dedup_009',
      from: 'buyer.sec@example.com',
      to: ['support@geelarkflows.com'],
      subject: 'Inquiry',
      text: 'Testing deduplication',
    },
  };
  const rawBody = JSON.stringify(bodyObj);
  const validSig = generateSvixSignature(svixId, svixTimestamp, rawBody, TEST_RESEND_SECRET);

  const sendEvent = () =>
    app.request(
      new Request('https://geelarkflows.com/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': validSig,
        },
        body: rawBody,
      }),
      undefined,
      env
    );

  const res1 = await sendEvent();
  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.equal(data1.success, true);
  assert.equal(db.inboundEmails.size, 1);

  const res2 = await sendEvent();
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.status, 'already_processed');
  assert.equal(db.inboundEmails.size, 1);
});

// 10. Existing valid order matching remains functional
await runAsyncTest('Resend Case 10: Inbound email correctly matches order ID in subject', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_WEBHOOK_SECRET: TEST_RESEND_SECRET };

  const svixId = `msg_${Date.now()}`;
  const svixTimestamp = Math.floor(Date.now() / 1000).toString();
  const bodyObj = {
    type: 'email.received',
    data: {
      email_id: 'resend_matched_010',
      from: 'buyer.sec@example.com',
      to: ['support@geelarkflows.com'],
      subject: 'Order ord_3a8b9f12 inquiry',
      text: 'Hello support team',
    },
  };
  const rawBody = JSON.stringify(bodyObj);
  const validSig = generateSvixSignature(svixId, svixTimestamp, rawBody, TEST_RESEND_SECRET);

  const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': validSig,
    },
    body: rawBody,
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.order_id, 'ord_3a8b9f12');
});

console.log('\n================================================================');
console.log(`  RESULT: ${passCount}/${passCount + failCount} Scenarios Passed (${Math.round((passCount / (passCount + failCount)) * 100)}%)`);
console.log('================================================================\n');

if (failCount > 0) process.exit(1);
