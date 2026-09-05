import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import app from '../src/worker.js';

console.log('================================================================');
console.log('  GEELARK FLOWS: CUSTOM AUTOMATION REQUEST COMPREHENSIVE SUITE   ');
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
// IN-MEMORY MOCK D1 DATABASE WITH AUDIT LOGGING & SESSIONS
// ----------------------------------------------------------------

function createMockDb() {
  const customRequests = new Map();
  const auditLogs = [];

  function createStatement(query, boundArgs = []) {
    return {
      bind: (...args) => createStatement(query, args),
      first: async () => {
        if (query.includes('FROM custom_automation_requests') && query.includes('COUNT(*)')) {
          if (query.includes('internal_notification_status')) {
            let attentionCount = 0;
            for (const req of customRequests.values()) {
              if (['failed', 'skipped'].includes(req.internal_notification_status)) attentionCount++;
            }
            return { count: attentionCount };
          }
          const [ipHash] = boundArgs;
          let count = 0;
          for (const req of customRequests.values()) {
            if (ipHash && req.ip_hash === ipHash) {
              count++;
            }
          }
          return { count, total: customRequests.size };
        }
        if (query.includes('FROM custom_automation_requests WHERE id = ?')) {
          const [id] = boundArgs;
          const found = customRequests.get(id);
          return found ? { ...found } : null;
        }
        if (query.includes('admin_sessions')) {
          return {
            session_id: 'sess_1',
            token_hash: 'mock_token_hash',
            user_id: 'usr_1',
            role: 'ADMIN',
            name: 'Admin User',
            email: 'admin@geelarkflows.com',
            last_active_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          };
        }
        return null;
      },
      run: async () => {
        if (query.includes('INSERT INTO custom_automation_requests')) {
          const [id, customer_name, customer_email, request_type, details, ip_hash, initial_notif_status] = boundArgs;
          customRequests.set(id, {
            id,
            customer_name,
            customer_email,
            request_type,
            details,
            status: 'new',
            ip_hash,
            internal_notification_status: initial_notif_status || 'pending',
            created_at: new Date().toISOString(),
          });
        } else if (query.includes('UPDATE custom_automation_requests')) {
          if (query.includes('SET internal_notification_status')) {
            const [status, error, id] = boundArgs;
            const req = customRequests.get(id);
            if (req) {
              req.internal_notification_status = status;
              req.internal_notification_error = error;
            }
          } else if (query.includes('SET status = ?')) {
            const [status, id] = boundArgs;
            const req = customRequests.get(id);
            if (req) {
              req.status = status;
            }
          }
        } else if (query.includes('INSERT INTO audit_logs')) {
          const [id, adminId, adminEmail, ip, userAgent, action, entityType, entityId, prevState, newState, reason, metadata] = boundArgs;
          auditLogs.push({ id, adminId, adminEmail, action, entityType, entityId, prevState, newState });
        }
        return { success: true };
      },
      all: async () => {
        let list = Array.from(customRequests.values());
        if (query.includes('WHERE status = ?')) {
          const [statusFilter] = boundArgs;
          list = list.filter((r) => r.status === statusFilter);
        }
        return { results: list };
      },
    };
  }

  return {
    customRequests,
    auditLogs,
    prepare: (query) => createStatement(query),
  };
}

const mockResendApiKey = 're_mock_test_key_12345678';

// Intercept outbound Resend fetch calls
let lastDispatchedEmail = null;
let simulateResendFailure = false;
let resendFailureMsg = 'Resend service temporary error';

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const urlStr = String(url);
  if (urlStr.includes('api.resend.com/emails')) {
    if (simulateResendFailure) {
      return new Response(JSON.stringify({ statusCode: 500, message: resendFailureMsg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (options && options.body) {
      lastDispatchedEmail = JSON.parse(options.body);
    }
    return new Response(JSON.stringify({ id: 'res_mock_lead_msg_9988' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return originalFetch(url, options);
};

// ================================================================
// SECTION 1: PUBLIC CUSTOM REQUEST SUBMISSION TESTS
// ================================================================

// 1. Valid request accepted (HTTP 200)
await runAsyncTest('Case 1: Valid request returns HTTP 200 and success response', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_API_KEY: mockResendApiKey };
  lastDispatchedEmail = null;

  const payload = {
    name: 'Sarah Connor',
    email: 'sarah@example.com',
    type: 'flow',
    details: 'Need a custom Instagram story publisher with automated hashtag generation and proxies.',
  };

  const req = new Request('https://geelarkflows.com/api/custom-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.request_id);
  assert.equal(data.customer_email, 'sarah@example.com');
});

// 2. Request receives opaque reference ID format (req_...)
await runAsyncTest('Case 2: Generates opaque reference ID starting with "req_"', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_API_KEY: mockResendApiKey };

  const req = new Request('https://geelarkflows.com/api/custom-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'John Doe',
      email: 'john@example.com',
      type: 'consulting',
      details: 'Looking for enterprise multi-account scaling consultation and architecture design.',
    }),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.match(data.request_id, /^req_[a-zA-Z0-9_-]{6,16}$/);
});

// 3. Valid request persisted into D1 table with data minimization (ip_hash, no user_agent)
await runAsyncTest('Case 3: Request is persisted into D1 with ip_hash and zero user_agent telemetry', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_API_KEY: mockResendApiKey };

  const payload = {
    name: 'Alex Vance',
    email: 'alex@blackmesa.com',
    type: 'flow',
    details: 'Custom TikTok live stream monitoring and alert dispatcher for 50 mobile profiles.',
  };

  const req = new Request('https://geelarkflows.com/api/custom-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-connecting-ip': '203.0.113.195',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sensitive Browser String',
    },
    body: JSON.stringify(payload),
  });

  const res = await app.request(req, undefined, env);
  const data = await res.json();
  assert.equal(db.customRequests.size, 1);
  const persisted = db.customRequests.get(data.request_id);
  assert.ok(persisted);
  assert.equal(persisted.customer_name, 'Alex Vance');
  assert.equal(persisted.customer_email, 'alex@blackmesa.com');
  assert.equal(persisted.request_type, 'flow');
  assert.equal(persisted.status, 'new');
  // Verify data minimization
  assert.equal(persisted.user_agent, undefined, 'User-Agent must not be stored in lead record');
  assert.ok(persisted.ip_hash, 'IP hash should be computed for rate limiting');
  assert.notEqual(persisted.ip_hash, '203.0.113.195', 'Raw IP must not be stored');
});

// 4. Invalid email format rejected
await runAsyncTest('Case 4: Invalid email format returns HTTP 400 Bad Request', async () => {
  const db = createMockDb();
  const env = { DB: db };

  for (const badEmail of ['notanemail', 'user@', '@domain.com', 'user@domain', '']) {
    const req = new Request('https://geelarkflows.com/api/custom-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: badEmail,
        type: 'flow',
        details: 'Valid project description for testing email validation.',
      }),
    });

    const res = await app.request(req, undefined, env);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /email/i);
  }
  assert.equal(db.customRequests.size, 0);
});

// 5. Missing required fields rejected
await runAsyncTest('Case 5: Missing required fields (name, email, details) return HTTP 400', async () => {
  const db = createMockDb();
  const env = { DB: db };

  const testCases = [
    { payload: { email: 'a@b.com', details: 'Valid requirements text.' }, missing: 'name' },
    { payload: { name: 'John', details: 'Valid requirements text.' }, missing: 'email' },
    { payload: { name: 'John', email: 'a@b.com' }, missing: 'details' },
  ];

  for (const tc of testCases) {
    const req = new Request('https://geelarkflows.com/api/custom-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tc.payload),
    });

    const res = await app.request(req, undefined, env);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
  }
  assert.equal(db.customRequests.size, 0);
});

// 6. Whitespace-only description rejected
await runAsyncTest('Case 6: Whitespace-only description returns HTTP 400', async () => {
  const db = createMockDb();
  const env = { DB: db };

  const req = new Request('https://geelarkflows.com/api/custom-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'John Doe',
      email: 'john@example.com',
      type: 'flow',
      details: '              \n\t   ',
    }),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 400);
  assert.equal(db.customRequests.size, 0);
});

// 7. Short description (< 10 chars) rejected
await runAsyncTest('Case 7: Description under 10 characters returns HTTP 400', async () => {
  const db = createMockDb();
  const env = { DB: db };

  const req = new Request('https://geelarkflows.com/api/custom-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'John Doe',
      email: 'john@example.com',
      type: 'flow',
      details: 'Too short', // 9 chars
    }),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 400);
  assert.equal(db.customRequests.size, 0);
});

// 8. Oversized fields rejected (name > 100 or details > 5000)
await runAsyncTest('Case 8: Oversized fields return HTTP 400', async () => {
  const db = createMockDb();
  const env = { DB: db };

  const hugeNameReq = new Request('https://geelarkflows.com/api/custom-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'A'.repeat(105),
      email: 'john@example.com',
      type: 'flow',
      details: 'Valid project description.',
    }),
  });

  const res1 = await app.request(hugeNameReq, undefined, env);
  assert.equal(res1.status, 400);

  const hugeDetailsReq = new Request('https://geelarkflows.com/api/custom-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'John Doe',
      email: 'john@example.com',
      type: 'flow',
      details: 'X'.repeat(5005),
    }),
  });

  const res2 = await app.request(hugeDetailsReq, undefined, env);
  assert.equal(res2.status, 400);
  assert.equal(db.customRequests.size, 0);
});

// 9. Invalid enum type rejected
await runAsyncTest('Case 9: Invalid service type enum returns HTTP 400', async () => {
  const db = createMockDb();
  const env = { DB: db };

  const req = new Request('https://geelarkflows.com/api/custom-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'John Doe',
      email: 'john@example.com',
      type: 'hacked_service_type',
      details: 'Valid requirements description.',
    }),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 400);
  assert.equal(db.customRequests.size, 0);
});

// 10. Malformed JSON handled safely
await runAsyncTest('Case 10: Malformed JSON body returns HTTP 400 Bad Request', async () => {
  const db = createMockDb();
  const env = { DB: db };

  const req = new Request('https://geelarkflows.com/api/custom-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'this is not valid json {{{',
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 400);
  assert.equal(db.customRequests.size, 0);
});

// 11. Rate limiting prevents spam (5+ requests from same IP returns HTTP 429)
await runAsyncTest('Case 11: Rate limiting triggers HTTP 429 after 5 submissions from single IP', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_API_KEY: mockResendApiKey };

  const makeReq = () =>
    new Request('https://geelarkflows.com/api/custom-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.1' },
      body: JSON.stringify({
        name: 'Spammer',
        email: 'spammer@example.com',
        type: 'flow',
        details: 'Automated rapid fire submission text description.',
      }),
    });

  // First 5 should succeed
  for (let i = 0; i < 5; i++) {
    const res = await app.request(makeReq(), undefined, env);
    assert.equal(res.status, 200);
  }

  // 6th request from same IP should be rate-limited
  const res6 = await app.request(makeReq(), undefined, env);
  assert.equal(res6.status, 429);
  const data = await res6.json();
  assert.match(data.error, /too many requests/i);
});

// 12. Anti-DoS: Attacker using victim's email cannot lock out victim from victim's own IP
await runAsyncTest('Case 12: Anti-DoS: Submissions with victim email from attacker IP do not lock out victim IP', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_API_KEY: mockResendApiKey };

  // Attacker IP sends 5 submissions with innocent victim's email
  for (let i = 0; i < 5; i++) {
    const attackReq = new Request('https://geelarkflows.com/api/custom-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.99' },
      body: JSON.stringify({
        name: 'Attacker Spam',
        email: 'victim@company.com',
        type: 'flow',
        details: 'Spam attack attempting to lock victim out of custom requests.',
      }),
    });
    await app.request(attackReq, undefined, env);
  }

  // Legitimate victim submits from victim's real IP
  const victimReq = new Request('https://geelarkflows.com/api/custom-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '203.0.113.42' },
    body: JSON.stringify({
      name: 'Legitimate Victim',
      email: 'victim@company.com',
      type: 'flow',
      details: 'Legitimate custom automation requirements from genuine customer.',
    }),
  });

  const victimRes = await app.request(victimReq, undefined, env);
  assert.equal(victimRes.status, 200, 'Legitimate customer must not be locked out by third-party spam');
});

// 13. Database failure returns HTTP 500 without false success
await runAsyncTest('Case 13: Database failure returns HTTP 500 without showing false success', async () => {
  const envNoDb = {}; // No DB binding

  const req = new Request('https://geelarkflows.com/api/custom-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'John Doe',
      email: 'john@example.com',
      type: 'flow',
      details: 'Valid project requirements text.',
    }),
  });

  const res = await app.request(req, undefined, envNoDb);
  assert.equal(res.status, 500);
  const data = await res.json();
  assert.equal(data.success, false);
});

// 14. Notification failure follows Choice A policy (lead safely preserved in D1, 200 returned)
await runAsyncTest('Case 14: Internal email notification failure does not drop persisted lead (Choice A)', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_API_KEY: mockResendApiKey };

  simulateResendFailure = true;
  resendFailureMsg = 'Resend service temporary 503 error';

  const req = new Request('https://geelarkflows.com/api/custom-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Resilient Lead',
      email: 'resilient@example.com',
      type: 'consulting',
      details: 'Lead must not be lost if Resend email service has temporary issues.',
    }),
  });

  const res = await app.request(req, undefined, env);
  simulateResendFailure = false;

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.request_id);

  // Assert D1 record is preserved with failed notification status
  const persisted = db.customRequests.get(data.request_id);
  assert.ok(persisted);
  assert.equal(persisted.internal_notification_status, 'failed');
  assert.match(persisted.internal_notification_error, /Resend API Error/);
});

// 15. Notification error is sanitized and bounded without exposing secrets
await runAsyncTest('Case 15: Notification error message sanitizes API keys and bounds error size', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_API_KEY: mockResendApiKey };

  simulateResendFailure = true;
  // Simulate provider error containing an accidental leaked secret and long response
  resendFailureMsg = 'Unauthorized: re_secret_live_key_999999999 ' + 'X'.repeat(400);

  const req = new Request('https://geelarkflows.com/api/custom-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Security Test',
      email: 'sec@example.com',
      type: 'flow',
      details: 'Checking error message sanitization in database.',
    }),
  });

  const res = await app.request(req, undefined, env);
  simulateResendFailure = false;

  const data = await res.json();
  const persisted = db.customRequests.get(data.request_id);
  assert.ok(persisted);
  assert.ok(!persisted.internal_notification_error.includes('re_secret_live_key_999999999'), 'Leaked API key must be redacted');
  assert.ok(persisted.internal_notification_error.includes('[REDACTED_API_KEY]'));
  assert.ok(persisted.internal_notification_error.length <= 250, 'Error message must be bounded in length');
});

// 16. Customer content is safely HTML-escaped in email templates (XSS prevention)
await runAsyncTest('Case 16: Customer content is safely escaped in notification emails (XSS prevention)', async () => {
  const db = createMockDb();
  const env = { DB: db, RESEND_API_KEY: mockResendApiKey };
  lastDispatchedEmail = null;

  const maliciousPayload = {
    name: '<script>alert("xss")</script>',
    email: 'hacker@example.com',
    type: 'flow',
    details: '<img src=x onerror=alert(1)> & "quotes" and <tags>',
  };

  const req = new Request('https://geelarkflows.com/api/custom-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(maliciousPayload),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 200);
  assert.ok(lastDispatchedEmail);
  assert.ok(!lastDispatchedEmail.html.includes('<script>'));
  assert.ok(!lastDispatchedEmail.html.includes('<img src=x'));
  assert.ok(lastDispatchedEmail.html.includes('&lt;script&gt;'));
  assert.ok(lastDispatchedEmail.html.includes('&lt;img src=x'));
});

// ================================================================
// SECTION 2: ADMIN AUTHENTICATION, RBAC & MUTATION SECURITY
// ================================================================

// 17. GET /api/admin/custom-requests rejects unauthenticated requests (401)
await runAsyncTest('Case 17: GET /api/admin/custom-requests rejects unauthenticated request (401)', async () => {
  const db = createMockDb();
  const env = { DB: db };

  const req = new Request('https://geelarkflows.com/api/admin/custom-requests', {
    method: 'GET',
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 401);
});

// 18. GET /api/admin/custom-requests retrieves lead list with authenticated session (200)
await runAsyncTest('Case 18: GET /api/admin/custom-requests returns paginated leads with valid admin session', async () => {
  const db = createMockDb();
  const env = { DB: db };

  db.customRequests.set('req_001', {
    id: 'req_001',
    customer_name: 'Lead 1',
    customer_email: 'lead1@example.com',
    request_type: 'flow',
    details: 'First test lead description.',
    status: 'new',
    created_at: new Date().toISOString(),
  });

  const req = new Request('https://geelarkflows.com/api/admin/custom-requests', {
    method: 'GET',
    headers: { 'Cookie': 'gf_admin_session=valid_admin_token' },
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.length, 1);
  assert.equal(data.data[0].id, 'req_001');
});

// 19. PATCH /api/admin/custom-requests/:id rejects unauthenticated requests (401)
await runAsyncTest('Case 19: PATCH /api/admin/custom-requests/:id rejects unauthenticated request (401)', async () => {
  const db = createMockDb();
  const env = { DB: db };

  const req = new Request('https://geelarkflows.com/api/admin/custom-requests/req_001', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-action': '1' },
    body: JSON.stringify({ status: 'in_review' }),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 401);
});

// 20. PATCH /api/admin/custom-requests/:id rejects missing X-Admin-Action header (403)
await runAsyncTest('Case 20: PATCH /api/admin/custom-requests/:id rejects missing X-Admin-Action header (403)', async () => {
  const db = createMockDb();
  const env = { DB: db };

  const req = new Request('https://geelarkflows.com/api/admin/custom-requests/req_001', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'gf_admin_session=valid_admin_token',
      // Missing 'x-admin-action': '1'
    },
    body: JSON.stringify({ status: 'in_review' }),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.match(data.error, /CSRF authorization header/i);
});

// 21. PATCH /api/admin/custom-requests/:id rejects invalid status enum (400)
await runAsyncTest('Case 21: PATCH /api/admin/custom-requests/:id rejects invalid status enum (400)', async () => {
  const db = createMockDb();
  const env = { DB: db };

  db.customRequests.set('req_001', {
    id: 'req_001',
    customer_name: 'Lead 1',
    customer_email: 'lead1@example.com',
    request_type: 'flow',
    details: 'First test lead.',
    status: 'new',
  });

  const req = new Request('https://geelarkflows.com/api/admin/custom-requests/req_001', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'gf_admin_session=valid_admin_token',
      'x-admin-action': '1',
    },
    body: JSON.stringify({ status: 'invalid_status_enum' }),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 400);
});

// 22. Valid PATCH updates status and writes append-only audit log
await runAsyncTest('Case 22: Valid PATCH updates status and writes append-only audit log', async () => {
  const db = createMockDb();
  const env = { DB: db };

  db.customRequests.set('req_001', {
    id: 'req_001',
    customer_name: 'Lead 1',
    customer_email: 'lead1@example.com',
    request_type: 'flow',
    details: 'First test lead.',
    status: 'new',
  });

  const req = new Request('https://geelarkflows.com/api/admin/custom-requests/req_001', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'gf_admin_session=valid_admin_token',
      'x-admin-action': '1',
    },
    body: JSON.stringify({ status: 'contacted', customer_email: 'hacked@email.com' }), // Attempted arbitrary field tampering
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.status, 'contacted');

  // Verify DB state
  const updated = db.customRequests.get('req_001');
  assert.equal(updated.status, 'contacted');
  assert.equal(updated.customer_email, 'lead1@example.com', 'Arbitrary field tampering must be ignored');

  // Verify Audit Log
  assert.equal(db.auditLogs.length, 1);
  assert.equal(db.auditLogs[0].action, 'CUSTOM_REQUEST_STATUS_UPDATED');
  assert.equal(db.auditLogs[0].entityId, 'req_001');
  assert.equal(db.auditLogs[0].prevState, 'new');
  assert.equal(db.auditLogs[0].newState, 'contacted');
});

// 23. GET /api/admin/dashboard surfaces failed custom request notifications as attention alert
await runAsyncTest('Case 23: Dashboard surfaces failed notifications in attention alerts', async () => {
  const db = createMockDb();
  const env = { DB: db };

  // Seed a request with failed notification
  db.customRequests.set('req_failed_01', {
    id: 'req_failed_01',
    customer_name: 'Lead With Failed Email',
    customer_email: 'lead_failed@example.com',
    request_type: 'flow',
    details: 'Valid requirements description.',
    status: 'new',
    internal_notification_status: 'failed',
    internal_notification_error: 'Resend API Error (500)',
    created_at: new Date().toISOString(),
  });

  const req = new Request('https://geelarkflows.com/api/admin/dashboard', {
    method: 'GET',
    headers: { 'Cookie': 'gf_admin_session=valid_admin_token' },
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  const alert = data.data.attention_alerts.find(a => a.id === 'alert_custom_requests_attention');
  assert.ok(alert, 'Failed custom request must surface in admin dashboard attention alerts');
  assert.match(alert.title, /1 Custom Request.*need attention/i);
});

// 24. Missing RESEND_API_KEY persists request as 'skipped' and surfaces in dashboard attention alerts
await runAsyncTest('Case 24: Missing RESEND_API_KEY persists lead as skipped and surfaces in dashboard attention alerts', async () => {
  const db = createMockDb();
  const envWithoutResend = { DB: db }; // No RESEND_API_KEY

  const req = new Request('https://geelarkflows.com/api/custom-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'No Resend Key Lead',
      email: 'no_key@example.com',
      type: 'flow',
      details: 'This lead must succeed and be marked skipped when RESEND_API_KEY is not configured.',
    }),
  });

  const res = await app.request(req, undefined, envWithoutResend);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);

  const persisted = db.customRequests.get(data.request_id);
  assert.ok(persisted);
  assert.equal(persisted.internal_notification_status, 'skipped');

  // Verify it surfaces in admin dashboard attention alerts
  const dashReq = new Request('https://geelarkflows.com/api/admin/dashboard', {
    method: 'GET',
    headers: { 'Cookie': 'gf_admin_session=valid_admin_token' },
  });
  const dashRes = await app.request(dashReq, undefined, envWithoutResend);
  const dashData = await dashRes.json();
  const alert = dashData.data.attention_alerts.find(a => a.id === 'alert_custom_requests_attention');
  assert.equal(alert.link, '/admin/custom-requests');
});

// 25. PATCH /api/admin/custom-requests/:id returns 404 for non-existent request ID
await runAsyncTest('Case 25: PATCH /api/admin/custom-requests/:id returns 404 for unknown request ID', async () => {
  const db = createMockDb();
  const env = { DB: db };

  const req = new Request('https://geelarkflows.com/api/admin/custom-requests/req_nonexistent_999', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'gf_admin_session=valid_admin_token',
      'x-admin-action': '1',
    },
    body: JSON.stringify({ status: 'in_review' }),
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.error, /not found/i);
});

// 26. GET /api/admin/custom-requests status filtering returns filtered subsets
await runAsyncTest('Case 26: GET /api/admin/custom-requests filters by status correctly', async () => {
  const db = createMockDb();
  const env = { DB: db };

  db.customRequests.set('req_new_01', {
    id: 'req_new_01',
    customer_name: 'New Lead',
    customer_email: 'new@example.com',
    request_type: 'flow',
    details: 'New lead requirements',
    status: 'new',
    created_at: new Date().toISOString(),
  });
  db.customRequests.set('req_rev_01', {
    id: 'req_rev_01',
    customer_name: 'Review Lead',
    customer_email: 'rev@example.com',
    request_type: 'consulting',
    details: 'Review lead requirements',
    status: 'in_review',
    created_at: new Date().toISOString(),
  });

  const req = new Request('https://geelarkflows.com/api/admin/custom-requests?status=in_review', {
    method: 'GET',
    headers: { 'Cookie': 'gf_admin_session=valid_admin_token' },
  });

  const res = await app.request(req, undefined, env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.data.every(r => r.status === 'in_review'));
});

// 27. Dedicated migration file verification
await runAsyncTest('Case 27: Dedicated migration scripts/migrate-custom-requests.sql is additive & safe', async () => {
  const migrationPath = path.resolve('scripts/migrate-custom-requests.sql');
  assert.ok(fs.existsSync(migrationPath), 'Dedicated migration file must exist');

  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS custom_automation_requests/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_custom_requests_created_at/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_custom_requests_email/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_custom_requests_status/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_custom_requests_ip_hash/i);

  // Destructive command safety checks
  assert.ok(!sql.match(/\bDROP\b/i), 'Migration must not contain DROP statements');
  assert.ok(!sql.match(/\bTRUNCATE\b/i), 'Migration must not contain TRUNCATE statements');
  assert.ok(!sql.match(/\bDELETE\b/i), 'Migration must not contain DELETE statements');
});

// 28. Inspect dialog uses the shared, correctly stacked modal structure
await runAsyncTest('Case 28: Admin Inspect dialog renders its card inside the modal overlay', async () => {
  const pagePath = path.resolve('src/admin/pages/AdminCustomRequests.jsx');
  const source = fs.readFileSync(pagePath, 'utf8');
  const overlayStart = source.indexOf('<div className="admin-modal-overlay" onClick={closeDetail}>');
  const cardStart = source.indexOf('className="admin-modal-card"', overlayStart);
  const dialogRole = source.indexOf('role="dialog"', cardStart);

  assert.ok(overlayStart >= 0, 'Inspect dialog must render the modal overlay');
  assert.ok(cardStart > overlayStart, 'Modal card must be nested inside the overlay stacking context');
  assert.ok(dialogRole > cardStart, 'Modal card must expose an accessible dialog role');
  assert.ok(!source.includes('className="admin-modal"'), 'Undefined admin-modal class must not be used');
});

console.log('\n================================================================');
console.log(`  RESULT: ${passCount}/${passCount + failCount} Scenarios Passed (${Math.round((passCount / (passCount + failCount)) * 100)}%)`);
console.log('================================================================\n');

if (failCount > 0) process.exit(1);
