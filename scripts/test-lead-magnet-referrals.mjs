import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import app from '../src/worker.js';

function createD1Adapter() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(fs.readFileSync('schema.sql', 'utf8'));

  const db = {
    sqlite,
    prepare(query) {
      let values = [];
      return {
        bind(...boundValues) {
          values = boundValues;
          return this;
        },
        async first() {
          return sqlite.prepare(query).get(...values) || null;
        },
        async all() {
          return { results: sqlite.prepare(query).all(...values) };
        },
        async run() {
          const result = sqlite.prepare(query).run(...values);
          return { meta: { changes: result.changes }, changes: result.changes };
        },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };

  return db;
}

function leadRequest(body, ip = '203.0.113.41') {
  const request = new Request('https://geelarkflows.com/api/leads/preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
      'CF-IPCountry': 'IN',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
      Referer: 'https://www.bing.com/',
    },
    body: JSON.stringify({
      visitor_id: 'visitor_lead_test_1234567890',
      selected_product_id: 'instagram-account-creation',
      product_ids: ['instagram-account-creation'],
      page_path: '/flows/instagram-account-creation',
      landing_referrer_host: 'bing.com',
      marketing_consent: false,
      company_website: '',
      ...body,
    }),
  });
  Object.defineProperty(request, 'cf', {
    value: { country: 'IN', region: 'Telangana', city: 'Hyderabad' },
  });
  return request;
}

function adminRequest(path, token) {
  return new Request(`https://geelarkflows.com${path}`, {
    headers: { Cookie: `gf_admin_session=${token}` },
  });
}

const db = createD1Adapter();
const sentEmails = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  assert.equal(String(url), 'https://api.resend.com/emails');
  sentEmails.push(JSON.parse(String(init.body || '{}')));
  return new Response(JSON.stringify({ id: `email_${sentEmails.length}` }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

const env = {
  DB: db,
  RESEND_API_KEY: 're_test_key',
  SITE_URL: 'https://geelarkflows.com',
};

try {
  const invalid = await app.request(leadRequest({ email: 'not-an-email' }), undefined, env);
  assert.equal(invalid.status, 400, 'invalid email must be rejected');

  const referrerResponse = await app.request(leadRequest({
    email: 'referrer@example.test',
  }), undefined, env);
  assert.equal(referrerResponse.status, 201);
  const referrerPayload = await referrerResponse.json();
  assert.equal(referrerPayload.data.discount_percent, 10);
  assert.equal(referrerPayload.data.email_sent, true);
  assert(!JSON.stringify(referrerPayload).includes('START10-'), 'private coupon must not be returned in the public response');

  const referrer = db.sqlite.prepare('SELECT * FROM storefront_leads WHERE email = ?').get('referrer@example.test');
  assert.equal(referrer.marketing_consent, 0, 'marketing consent must default to off');
  assert.equal(referrer.ip_network, '203.0.113.0/24', 'only a masked network may be retained');
  assert.notEqual(referrer.visitor_hash, 'visitor_lead_test_1234567890');
  assert.equal(referrer.referrer_host, 'bing.com');
  assert.equal(referrer.city, 'Hyderabad');
  assert.match(referrer.referral_code, /^GF[A-F0-9]{10}$/);

  const welcomeCoupon = db.sqlite.prepare('SELECT * FROM coupon_codes WHERE id = ?').get(referrer.welcome_coupon_id);
  assert.equal(welcomeCoupon.discount_type, 'percentage');
  assert.equal(welcomeCoupon.discount_value, 10);
  assert.equal(welcomeCoupon.max_redemptions, 1);
  assert.equal(welcomeCoupon.active, 1);

  const visitorEmail = sentEmails.find((email) => email.to?.[0] === 'referrer@example.test');
  assert(visitorEmail, 'the requested preview email must be sent to the visitor');
assert(visitorEmail.html.includes(referrer.welcome_coupon_code));
assert(visitorEmail.html.includes('No purchase is required'));
assert(visitorEmail.html.includes('THIS EMAIL IS AUTOMATIC'));
assert(visitorEmail.html.includes('Request a free demo call'));
assert(visitorEmail.html.includes('Nothing is booked automatically'));
assert(visitorEmail.html.includes('Rewards are discounts, not cash'));
  assert(visitorEmail.html.includes('you were not added to optional marketing'));
  assert(sentEmails.some((email) => email.to?.[0] === 'support@geelarkflows.com'), 'the team must receive the volunteered lead');

  const tokenMatch = visitorEmail.html.match(/unsubscribe\?token=([a-f0-9]{48})/i);
  assert(tokenMatch, 'the visitor email must contain a private preference token');

  const reoptResponse = await app.request(leadRequest({
    email: 'referrer@example.test',
    marketing_consent: true,
  }), undefined, env);
  assert.equal(reoptResponse.status, 200);
  assert.equal(
    db.sqlite.prepare('SELECT marketing_consent FROM storefront_leads WHERE id = ?').get(referrer.id).marketing_consent,
    1,
    'an explicit checkbox selection may opt the visitor in',
  );

  const freshVisitorEmail = [...sentEmails].reverse().find((email) => email.to?.[0] === 'referrer@example.test');
  const freshTokenMatch = freshVisitorEmail.html.match(/unsubscribe\?token=([a-f0-9]{48})/i);
  const unsubscribeResponse = await app.request(new Request('https://geelarkflows.com/api/leads/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: freshTokenMatch[1] }),
  }), undefined, env);
  assert.equal(unsubscribeResponse.status, 200);
  const unsubscribed = db.sqlite.prepare('SELECT marketing_consent, unsubscribed_at FROM storefront_leads WHERE id = ?').get(referrer.id);
  assert.equal(unsubscribed.marketing_consent, 0);
  assert(unsubscribed.unsubscribed_at);

  const referredResponse = await app.request(leadRequest({
    email: 'friend@example.test',
    referred_by_code: referrer.referral_code,
    marketing_consent: false,
  }, '203.0.113.72'), undefined, env);
  assert.equal(referredResponse.status, 201);
  const friend = db.sqlite.prepare('SELECT * FROM storefront_leads WHERE email = ?').get('friend@example.test');
  assert.equal(friend.referred_by_code, referrer.referral_code);

  const selfReferral = await app.request(leadRequest({
    email: 'self@example.test',
  }, '203.0.113.93'), undefined, env);
  assert.equal(selfReferral.status, 201);
  const selfLead = db.sqlite.prepare('SELECT * FROM storefront_leads WHERE email = ?').get('self@example.test');
  await app.request(leadRequest({
    email: 'self@example.test',
    referred_by_code: selfLead.referral_code,
  }, '203.0.113.93'), undefined, env);
  assert.equal(
    db.sqlite.prepare('SELECT referred_by_code FROM storefront_leads WHERE id = ?').get(selfLead.id).referred_by_code,
    null,
    'a visitor cannot refer themself',
  );

  const publicAnalytics = await app.request('https://geelarkflows.com/api/admin/analytics?days=30', undefined, env);
  assert.equal(publicAnalytics.status, 401, 'lead details must not be public');

  const rawAdminToken = 'lead_admin_session_token';
  const adminTokenHash = crypto.createHash('sha256').update(rawAdminToken).digest('hex');
  db.sqlite.prepare("INSERT INTO admin_users (id, email, password_hash, role, name) VALUES (?, ?, ?, 'SUPER_ADMIN', ?)")
    .run('usr_leads', 'lead-admin@example.test', 'test_hash', 'Lead Admin');
  db.sqlite.prepare('INSERT INTO admin_sessions (id, token_hash, user_id, last_active_at, expires_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)')
    .run('ses_leads', adminTokenHash, 'usr_leads', '2099-01-01T00:00:00.000Z');

  const analyticsResponse = await app.request(
    adminRequest('/api/admin/analytics?days=30', rawAdminToken),
    undefined,
    env,
  );
  assert.equal(analyticsResponse.status, 200);
  const analytics = await analyticsResponse.json();
  assert.equal(analytics.data.metrics.contact_leads, 3);
  assert.equal(analytics.data.metrics.marketing_opt_ins, 0);
  assert.equal(analytics.data.contact_leads.length, 3);
  assert(analytics.data.contact_leads.some((lead) => lead.email === 'friend@example.test'));
  assert(!JSON.stringify(analytics.data.contact_leads).includes(referrer.unsubscribe_token_hash));

  const componentSource = fs.readFileSync('src/components/LeadMagnet.jsx', 'utf8');
  assert(componentSource.includes('See what you’re buying before you buy.'));
  assert(componentSource.includes('No account'));
  assert(componentSource.includes('Privacy and referral terms'));
  assert(componentSource.includes('checked={marketingConsent}'));
  assert(!componentSource.includes('defaultChecked'), 'optional marketing consent must never be preselected');
  assert(fs.readFileSync('src/pages/CheckoutPage.jsx', 'utf8').includes('referred_by_code: getStoredReferralCode()'));

  console.log('Lead magnet, consent, welcome coupon, referral, unsubscribe, and admin visibility tests passed.');
} finally {
  globalThis.fetch = originalFetch;
}
