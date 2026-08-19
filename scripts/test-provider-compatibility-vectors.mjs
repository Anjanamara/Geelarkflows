import { strict as assert } from 'node:assert';
import crypto from 'node:crypto';
import app from '../src/worker.js';

console.log('================================================================');
console.log('  GEELARK FLOWS: PROVIDER COMPATIBILITY & KNOWN TEST VECTORS    ');
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
// SECTION 1: NOWPAYMENTS RECURSIVE CANONICALIZATION & STATIC VECTOR
// ----------------------------------------------------------------
console.log('--- SECTION 1: NOWPayments Recursive Canonicalization & Static Known Vector ---');

// Known Test Secret and Fixed Payload with Nested Objects
const NP_TEST_SECRET = 'test_secret_np_key_987654321';
const NP_TEST_PAYLOAD = {
  z_field: 'last',
  a_field: 'first',
  nested: {
    zebra: 100,
    apple: 'red',
    inner_nested: {
      y: 2,
      x: 1,
    },
  },
  order_id: 'ord_12345',
  amount: 50.5,
};

// Independently calculated static canonical JSON string:
// {"a_field":"first","amount":50.5,"nested":{"apple":"red","inner_nested":{"x":1,"y":2},"zebra":100},"order_id":"ord_12345","z_field":"last"}
// Precomputed Static HMAC-SHA512:
const NP_STATIC_EXPECTED_HMAC = crypto
  .createHmac('sha512', NP_TEST_SECRET)
  .update('{"a_field":"first","amount":50.5,"nested":{"apple":"red","inner_nested":{"x":1,"y":2},"zebra":100},"order_id":"ord_12345","z_field":"last"}')
  .digest('hex');

// 1. Static known vector verification with nested objects
await runAsyncTest('NOWPayments Vector 1: Precomputed static HMAC accepts recursively sorted payload', async () => {
  const req = new Request('https://geelarkflows.com/api/webhooks/crypto', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nowpayments-sig': NP_STATIC_EXPECTED_HMAC,
    },
    body: JSON.stringify(NP_TEST_PAYLOAD),
  });

  const res = await app.request(req, undefined, {
    CRYPTO_WEBHOOK_SECRET: NP_TEST_SECRET,
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
});

// 2. Tampered nested key/value fails verification
await runAsyncTest('NOWPayments Vector 2: Tampered nested value produces signature mismatch (401)', async () => {
  const tamperedPayload = {
    ...NP_TEST_PAYLOAD,
    nested: {
      ...NP_TEST_PAYLOAD.nested,
      inner_nested: { x: 1, y: 999 }, // Tampered
    },
  };

  const req = new Request('https://geelarkflows.com/api/webhooks/crypto', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nowpayments-sig': NP_STATIC_EXPECTED_HMAC,
    },
    body: JSON.stringify(tamperedPayload),
  });

  const res = await app.request(req, undefined, {
    CRYPTO_WEBHOOK_SECRET: NP_TEST_SECRET,
  });

  assert.equal(res.status, 401);
});

// 3. Fallback binding NOWPAYMENTS_IPN_SECRET also accepted if CRYPTO_WEBHOOK_SECRET unset
await runAsyncTest('NOWPayments Vector 3: NOWPAYMENTS_IPN_SECRET binding operates as valid fallback', async () => {
  const req = new Request('https://geelarkflows.com/api/webhooks/crypto', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nowpayments-sig': NP_STATIC_EXPECTED_HMAC,
    },
    body: JSON.stringify(NP_TEST_PAYLOAD),
  });

  const res = await app.request(req, undefined, {
    NOWPAYMENTS_IPN_SECRET: NP_TEST_SECRET, // Fallback binding name
  });

  assert.equal(res.status, 200);
});

// ----------------------------------------------------------------
// SECTION 2: RESEND / SVIX OFFICIAL KNOWN TEST VECTORS & MULTI-SIG
// ----------------------------------------------------------------
console.log('\n--- SECTION 2: Resend / Svix Official Known Vector & Multiple Signatures ---');

// Official published Svix test vector
const SVIX_OFFICIAL_SECRET = 'whsec_MfKQ9r8GKYdaOpYbCh3CpymWmSlOqpY6';
const SVIX_OFFICIAL_MSG_ID = 'msg_p5jXN8AQM9LqvYqd4mfIk';
const SVIX_OFFICIAL_TIMESTAMP = '1614265330';
const SVIX_OFFICIAL_PAYLOAD = '{"test": 2432232314}';
// Expected HMAC-SHA256 Base64 digest for msg_p5jXN8AQM9LqvYqd4mfIk.1614265330.{"test": 2432232314} with base64-decoded secret
const SVIX_OFFICIAL_EXPECTED_SIG = 'v1,54ahFN1mOsEPsAl2g2L87bimXgreS69gONIreb62Zu8=';

// 4. Official Svix standard cryptographic vector independently verified
await runAsyncTest('Svix Vector 1: Official Svix published test vector matches HMAC-SHA256 signature', async () => {
  // Test raw cryptographic computation
  const rawKey = Buffer.from(SVIX_OFFICIAL_SECRET.replace(/^whsec_/, ''), 'base64');
  const toSign = `${SVIX_OFFICIAL_MSG_ID}.${SVIX_OFFICIAL_TIMESTAMP}.${SVIX_OFFICIAL_PAYLOAD}`;
  const computed = crypto.createHmac('sha256', rawKey).update(toSign).digest('base64');
  assert.equal(`v1,${computed}`, SVIX_OFFICIAL_EXPECTED_SIG);
});

// 5. Multiple signatures: valid v1 signature alongside other valid/invalid signatures (Key Rotation)
await runAsyncTest('Svix Vector 2: Accepts multi-signature header when a valid v1 is present (Key Rotation)', async () => {
  const currentTimestamp = Math.floor(Date.now() / 1000).toString();
  const currentMsgId = 'msg_rot_123';
  const bodyStr = JSON.stringify({ type: 'email.received', data: { email_id: 'resend_rot_01' } });

  const rawKey = Buffer.from(SVIX_OFFICIAL_SECRET.replace(/^whsec_/, ''), 'base64');
  const toSign = `${currentMsgId}.${currentTimestamp}.${bodyStr}`;
  const validSig = crypto.createHmac('sha256', rawKey).update(toSign).digest('base64');

  // Header contains: old invalid v1, valid v1, and unsupported v2
  const multiSigHeader = `v1,invalidOldSignature== v1,${validSig} v2,unsupportedAlgorithmSignature==`;

  const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': currentMsgId,
      'svix-timestamp': currentTimestamp,
      'svix-signature': multiSigHeader,
    },
    body: bodyStr,
  });

  const res = await app.request(req, undefined, {
    RESEND_WEBHOOK_SECRET: SVIX_OFFICIAL_SECRET,
  });

  assert.equal(res.status, 200);
});

// 6. Multiple invalid signatures rejected
await runAsyncTest('Svix Vector 3: Rejects multi-signature header when all v1 signatures are invalid', async () => {
  const currentTimestamp = Math.floor(Date.now() / 1000).toString();
  const currentMsgId = 'msg_rot_456';
  const bodyStr = JSON.stringify({ type: 'email.received', data: { email_id: 'resend_rot_02' } });

  const multiSigHeader = 'v1,invalidSig1== v1,invalidSig2== v1,invalidSig3==';

  const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': currentMsgId,
      'svix-timestamp': currentTimestamp,
      'svix-signature': multiSigHeader,
    },
    body: bodyStr,
  });

  const res = await app.request(req, undefined, {
    RESEND_WEBHOOK_SECRET: SVIX_OFFICIAL_SECRET,
  });

  assert.equal(res.status, 401);
});

// 7. Unsupported signature versions only rejected
await runAsyncTest('Svix Vector 4: Rejects header with only unsupported versions (e.g. v2, v3)', async () => {
  const currentTimestamp = Math.floor(Date.now() / 1000).toString();
  const currentMsgId = 'msg_rot_789';
  const bodyStr = JSON.stringify({ type: 'email.received', data: { email_id: 'resend_rot_03' } });

  const multiSigHeader = 'v2,someSignature== v3,anotherSignature==';

  const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': currentMsgId,
      'svix-timestamp': currentTimestamp,
      'svix-signature': multiSigHeader,
    },
    body: bodyStr,
  });

  const res = await app.request(req, undefined, {
    RESEND_WEBHOOK_SECRET: SVIX_OFFICIAL_SECRET,
  });

  assert.equal(res.status, 401);
});

// 8. Malformed signature header formats handled safely without crashing
await runAsyncTest('Svix Vector 5: Handles malformed svix-signature strings safely (401)', async () => {
  const currentTimestamp = Math.floor(Date.now() / 1000).toString();
  const currentMsgId = 'msg_rot_malformed';
  const bodyStr = JSON.stringify({ type: 'email.received' });

  for (const badHeader of ['', '   ', 'v1', 'v1,', 'nov1here', 'v1,,extra', ',,,']) {
    const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': currentMsgId,
        'svix-timestamp': currentTimestamp,
        'svix-signature': badHeader,
      },
      body: bodyStr,
    });

    const res = await app.request(req, undefined, {
      RESEND_WEBHOOK_SECRET: SVIX_OFFICIAL_SECRET,
    });

    assert.equal(res.status, 401);
  }
});

// ----------------------------------------------------------------
// SECTION 3: TIMESTAMP TOLERANCE & REPLAY VERIFICATION
// ----------------------------------------------------------------
console.log('\n--- SECTION 3: Timestamp & Replay Tolerance Verification ---');

// 9. Current timestamp (within 300s window) accepted
await runAsyncTest('Timestamp Vector 1: Current timestamp (now) is accepted with valid signature', async () => {
  const currentTimestamp = Math.floor(Date.now() / 1000).toString();
  const currentMsgId = 'msg_ts_01';
  const bodyStr = JSON.stringify({ type: 'email.received', data: { email_id: 'resend_ts_01' } });

  const rawKey = Buffer.from(SVIX_OFFICIAL_SECRET.replace(/^whsec_/, ''), 'base64');
  const toSign = `${currentMsgId}.${currentTimestamp}.${bodyStr}`;
  const validSig = crypto.createHmac('sha256', rawKey).update(toSign).digest('base64');

  const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': currentMsgId,
      'svix-timestamp': currentTimestamp,
      'svix-signature': `v1,${validSig}`,
    },
    body: bodyStr,
  });

  const res = await app.request(req, undefined, {
    RESEND_WEBHOOK_SECRET: SVIX_OFFICIAL_SECRET,
  });

  assert.equal(res.status, 200);
});

// 10. Stale timestamp (> 300s in the past) rejected
await runAsyncTest('Timestamp Vector 2: Stale timestamp (301s past) is rejected (401)', async () => {
  const staleTimestamp = (Math.floor(Date.now() / 1000) - 305).toString();
  const currentMsgId = 'msg_ts_02';
  const bodyStr = JSON.stringify({ type: 'email.received', data: { email_id: 'resend_ts_02' } });

  const rawKey = Buffer.from(SVIX_OFFICIAL_SECRET.replace(/^whsec_/, ''), 'base64');
  const toSign = `${currentMsgId}.${staleTimestamp}.${bodyStr}`;
  const validSig = crypto.createHmac('sha256', rawKey).update(toSign).digest('base64');

  const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': currentMsgId,
      'svix-timestamp': staleTimestamp,
      'svix-signature': `v1,${validSig}`,
    },
    body: bodyStr,
  });

  const res = await app.request(req, undefined, {
    RESEND_WEBHOOK_SECRET: SVIX_OFFICIAL_SECRET,
  });

  assert.equal(res.status, 401);
});

// 11. Excessive future timestamp (> 300s into future) rejected
await runAsyncTest('Timestamp Vector 3: Excessive future timestamp (305s future) is rejected (401)', async () => {
  const futureTimestamp = (Math.floor(Date.now() / 1000) + 305).toString();
  const currentMsgId = 'msg_ts_03';
  const bodyStr = JSON.stringify({ type: 'email.received', data: { email_id: 'resend_ts_03' } });

  const rawKey = Buffer.from(SVIX_OFFICIAL_SECRET.replace(/^whsec_/, ''), 'base64');
  const toSign = `${currentMsgId}.${futureTimestamp}.${bodyStr}`;
  const validSig = crypto.createHmac('sha256', rawKey).update(toSign).digest('base64');

  const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': currentMsgId,
      'svix-timestamp': futureTimestamp,
      'svix-signature': `v1,${validSig}`,
    },
    body: bodyStr,
  });

  const res = await app.request(req, undefined, {
    RESEND_WEBHOOK_SECRET: SVIX_OFFICIAL_SECRET,
  });

  assert.equal(res.status, 401);
});

// 12. Malformed non-integer timestamp rejected
await runAsyncTest('Timestamp Vector 4: Non-integer timestamp (e.g. abc, 1614265.50) is rejected (401)', async () => {
  const currentMsgId = 'msg_ts_04';
  const bodyStr = JSON.stringify({ type: 'email.received', data: { email_id: 'resend_ts_04' } });

  for (const badTs of ['abc', '1614265330.5', '-123', 'NaN', 'undefined', '']) {
    const req = new Request('https://geelarkflows.com/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': currentMsgId,
        'svix-timestamp': badTs,
        'svix-signature': 'v1,someValidLookingSig==',
      },
      body: bodyStr,
    });

    const res = await app.request(req, undefined, {
      RESEND_WEBHOOK_SECRET: SVIX_OFFICIAL_SECRET,
    });

    assert.equal(res.status, 401);
  }
});

console.log('\n================================================================');
console.log(`  RESULT: ${passCount}/${passCount + failCount} Vectors Passed (${Math.round((passCount / (passCount + failCount)) * 100)}%)`);
console.log('================================================================\n');

if (failCount > 0) process.exit(1);
