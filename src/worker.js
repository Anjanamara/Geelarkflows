import { Hono } from 'hono';
import { buildPushPayload } from '@block65/webcrypto-web-push';
import { products } from './data/products.js';
import { DEFAULT_NETWORK_ID, USDT_NETWORKS, getNetworkConfig } from './data/paymentConfig.js';

const app = new Hono();

/**
 * Server-Authoritative Product Catalog Map (O(1) lookup)
 */
const AUTHORITATIVE_CATALOG_MAP = new Map(
  (products || []).map((product) => [
    product.id,
    {
      id: product.id,
      title: product.title,
      platform: product.platform,
      price: Number(product.price),
      category: product.details?.category || 'Automation',
    },
  ])
);

function resolvePaymentNetwork(networkInput) {
  return getNetworkConfig(networkInput || DEFAULT_NETWORK_ID);
}

// ----------------------------------------------------
// SECURITY & CRYPTO HELPERS (WebCrypto Native)
// ----------------------------------------------------

// Cloudflare Workers rejects PBKDF2 iteration counts above 100,000.
// Keep generated hashes within that runtime limit so bootstrap and login use
// the same portable format documented in schema.sql.
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_MAX_ITERATIONS = 100000;
const HASH_ALGO_PREFIX = 'pbkdf2_sha256';

class UnsupportedPasswordHashError extends Error {
  constructor() {
    super('Stored password hash exceeds this runtime\'s PBKDF2 limit.');
    this.name = 'UnsupportedPasswordHashError';
  }
}

function uint8ArrayToHex(buffer) {
  return Array.from(buffer).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToUint8Array(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function sha256Hex(str) {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(str));
  return uint8ArrayToHex(new Uint8Array(buf));
}

async function hmacSha256Hex(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return uint8ArrayToHex(new Uint8Array(signature));
}

function maskIpNetwork(value) {
  const ip = String(value || '').split(',')[0].trim();
  const ipv4 = ip.split('.');
  if (ipv4.length === 4 && ipv4.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) {
    return `${ipv4[0]}.${ipv4[1]}.${ipv4[2]}.0/24`;
  }

  if (ip.includes(':')) {
    const groups = ip.split(':').filter(Boolean).slice(0, 3);
    if (groups.length >= 2 && groups.every((part) => /^[a-f0-9]{1,4}$/i.test(part))) {
      return `${groups.join(':')}::/48`;
    }
  }
  return null;
}

function classifyUserAgent(value) {
  const userAgent = String(value || '').slice(0, 500);
  const isBot = /bot|crawler|spider|slurp|headless/i.test(userAgent);
  const deviceType = isBot
    ? 'Bot'
    : /ipad|tablet|kindle/i.test(userAgent)
      ? 'Tablet'
      : /mobile|iphone|android/i.test(userAgent)
        ? 'Mobile'
        : 'Desktop';

  const browserFamily = /edg\//i.test(userAgent)
    ? 'Edge'
    : /opr\//i.test(userAgent)
      ? 'Opera'
      : /samsungbrowser/i.test(userAgent)
        ? 'Samsung Internet'
        : /firefox|fxios/i.test(userAgent)
          ? 'Firefox'
          : /chrome|crios/i.test(userAgent)
            ? 'Chrome'
            : /safari/i.test(userAgent)
              ? 'Safari'
              : 'Other';

  const osFamily = /windows/i.test(userAgent)
    ? 'Windows'
    : /iphone|ipad|ios/i.test(userAgent)
      ? 'iOS'
      : /android/i.test(userAgent)
        ? 'Android'
        : /mac os|macintosh/i.test(userAgent)
          ? 'macOS'
          : /linux/i.test(userAgent)
            ? 'Linux'
            : 'Other';

  return { deviceType, browserFamily, osFamily };
}

function normalizeAnalyticsPath(value) {
  const path = String(value || '').split('?')[0].slice(0, 200);
  return path.startsWith('/') && !/[\u0000-\u001f]/.test(path) ? path : '/';
}

function validStorefrontClientId(value) {
  return /^[a-zA-Z0-9_-]{16,80}$/.test(String(value || ''));
}

function normalizeInternalCtaUrl(value, fallback = '/') {
  const url = String(value || '').trim().slice(0, 200);
  if (!url) return fallback;
  return /^\/(?!\/)[^\u0000-\u001f]*$/.test(url) ? url : null;
}

const TRUSTED_WEB_PUSH_HOSTS = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
];

function isTrustedWebPushEndpoint(endpoint) {
  try {
    const url = new URL(String(endpoint || ''));
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false;
    const hostname = url.hostname.toLowerCase();
    return TRUSTED_WEB_PUSH_HOSTS.includes(hostname)
      || hostname.endsWith('.push.services.mozilla.com')
      || hostname.endsWith('.push.apple.com')
      || hostname.endsWith('.notify.windows.com');
  } catch {
    return false;
  }
}

function normalizeWebPushSubscription(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const endpoint = String(value.endpoint || '').trim();
  const p256dh = String(value.keys?.p256dh || '').trim();
  const auth = String(value.keys?.auth || '').trim();
  const validBase64Url = /^[A-Za-z0-9_-]+$/;
  if (endpoint.length > 2048 || !isTrustedWebPushEndpoint(endpoint)
    || p256dh.length < 40 || p256dh.length > 200 || !validBase64Url.test(p256dh)
    || auth.length < 8 || auth.length > 100 || !validBase64Url.test(auth)) return null;
  return {
    endpoint,
    expirationTime: Number.isFinite(Number(value.expirationTime)) ? Number(value.expirationTime) : null,
    keys: { p256dh, auth },
  };
}

function webPushConfigured(env) {
  return Boolean(env?.VAPID_PUBLIC_KEY && env?.VAPID_PRIVATE_KEY && env?.VAPID_SUBJECT);
}

async function enforcePushSubscriptionRateLimit(db, ipHash) {
  const key = `push_subscribe:${ipHash}`;
  const row = await db.prepare(`
    INSERT INTO api_rate_limits (key, window_started_at, request_count)
    VALUES (?, CURRENT_TIMESTAMP, 1)
    ON CONFLICT(key) DO UPDATE SET
      request_count = CASE
        WHEN window_started_at <= datetime('now', '-15 minutes') THEN 1
        ELSE request_count + 1
      END,
      window_started_at = CASE
        WHEN window_started_at <= datetime('now', '-15 minutes') THEN CURRENT_TIMESTAMP
        ELSE window_started_at
      END
    RETURNING request_count
  `).bind(key).first();
  return Number(row?.request_count || 0) <= 20;
}

function getReferrerHost(requestUrl, referrerValue) {
  if (!referrerValue) return 'Direct';
  try {
    const requestHost = new URL(requestUrl).hostname;
    const referrerHost = new URL(referrerValue).hostname;
    return referrerHost === requestHost ? 'Internal' : referrerHost.slice(0, 120);
  } catch {
    return 'Direct';
  }
}

function getAnalyticsReferrerHost(requestUrl, clientValue, headerValue) {
  const fallback = getReferrerHost(requestUrl, headerValue);
  const raw = String(clientValue || '').trim();
  if (!raw) return fallback;
  if (/^direct$/i.test(raw)) return 'Direct';
  if (/^internal$/i.test(raw)) return 'Internal';

  const hostname = raw.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  const validHostname = hostname.length <= 253
    && !hostname.includes('..')
    && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(hostname);
  if (!validHostname) return fallback;

  try {
    const requestHost = new URL(requestUrl).hostname.toLowerCase().replace(/^www\./, '');
    return hostname === requestHost ? 'Internal' : hostname;
  } catch {
    return fallback;
  }
}

function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function hashPassword(password, saltHex = null) {
  const encoder = new TextEncoder();
  const salt = saltHex ? hexToUint8Array(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const saltHexStr = saltHex || uint8ArrayToHex(salt);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );

  const hashHex = uint8ArrayToHex(new Uint8Array(derivedBits));
  return `${HASH_ALGO_PREFIX}$${PBKDF2_ITERATIONS}$${saltHexStr}$${hashHex}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash || !password) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;
  const [algorithm, iterStr, saltHex, expectedHashHex] = parts;
  if (algorithm !== HASH_ALGO_PREFIX || !/^\d+$/.test(iterStr)) return false;

  const iterations = Number(iterStr);
  if (!Number.isSafeInteger(iterations) || iterations < 1) return false;
  if (iterations > PBKDF2_MAX_ITERATIONS) throw new UnsupportedPasswordHashError();
  if (!/^[a-f0-9]{32}$/i.test(saltHex) || !/^[a-f0-9]{64}$/i.test(expectedHashHex)) return false;

  const encoder = new TextEncoder();
  const salt = hexToUint8Array(saltHex);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );

  const computedHashHex = uint8ArrayToHex(new Uint8Array(derivedBits));
  return constantTimeCompare(computedHashHex, expectedHashHex);
}

function generateSecureToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return uint8ArrayToHex(bytes);
}

function isValidEmail(value) {
  if (typeof value !== 'string' || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function usdToCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function normalizeCurrency(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function decimalToScaledBigInt(value, scale = 18) {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  const normalizedFraction = `${fraction}${'0'.repeat(scale)}`.slice(0, scale);
  return (BigInt(whole) * (10n ** BigInt(scale))) + BigInt(normalizedFraction || '0');
}

function isDecimalAtLeast(actual, expected) {
  const actualScaled = decimalToScaledBigInt(actual);
  const expectedScaled = decimalToScaledBigInt(expected);
  return actualScaled !== null && expectedScaled !== null && actualScaled >= expectedScaled;
}

function verifyProviderInvoiceSnapshot(payload, expected) {
  if (!payload || !expected) {
    return { valid: false, reason: 'NOWPayments returned an empty verification response.' };
  }

  if (String(payload.payment_id || '') !== String(expected.paymentId || '')) {
    return { valid: false, reason: 'NOWPayments payment identifier mismatch.' };
  }

  if (String(payload.order_id || '') !== String(expected.orderId || '')) {
    return { valid: false, reason: 'NOWPayments order identifier mismatch.' };
  }

  const providerStatus = String(payload.payment_status || '').toLowerCase();
  const validProviderStatuses = new Set([
    'waiting', 'confirming', 'confirmed', 'sending', 'partially_paid',
    'finished', 'paid', 'failed', 'refunded', 'expired',
  ]);
  if (!validProviderStatuses.has(providerStatus)) {
    return { valid: false, reason: 'NOWPayments returned an invalid payment status.' };
  }

  const providerAddress = String(payload.pay_address || '').trim();
  const expectedAddress = String(expected.payAddress || '').trim();
  if (!providerAddress || !expectedAddress || providerAddress !== expectedAddress) {
    return { valid: false, reason: 'NOWPayments receiving address mismatch.' };
  }

  const providerCurrency = normalizeCurrency(payload.pay_currency);
  const expectedCurrency = normalizeCurrency(expected.providerCurrency);
  if (!providerCurrency || !expectedCurrency || providerCurrency !== expectedCurrency) {
    return { valid: false, reason: 'NOWPayments payment currency or blockchain mismatch.' };
  }

  const providerUsdCents = usdToCents(payload.price_amount);
  if (normalizeCurrency(payload.price_currency) !== 'usd' || providerUsdCents !== Number(expected.usdCents)) {
    return { valid: false, reason: 'NOWPayments USD invoice total mismatch.' };
  }

  const providerCryptoAmount = decimalToScaledBigInt(payload.pay_amount);
  const expectedCryptoAmount = decimalToScaledBigInt(expected.cryptoAmount);
  if (providerCryptoAmount === null || expectedCryptoAmount === null || providerCryptoAmount !== expectedCryptoAmount) {
    return { valid: false, reason: 'NOWPayments cryptocurrency amount mismatch.' };
  }

  return { valid: true };
}

const CONFIRMED_PROVIDER_STATUSES = new Set(['confirmed', 'finished', 'paid']);
const ACTIVE_PROVIDER_STATUSES = new Set(['waiting', 'confirming', 'sending', 'partially_paid']);
const SETTLED_ORDER_STATUSES = new Set(['paid', 'processing', 'completed']);

/**
 * Derive the order/fulfillment state from an authoritative gateway status
 * without regressing already-progressed fulfillment on duplicate callbacks.
 */
export function deriveOrderStateFromPayment({
  orderStatus,
  fulfillmentStatus = 'not_ready',
  paymentStatus,
  deliveryMethod = 'download_package',
}) {
  const currentOrderStatus = String(orderStatus || 'pending').toLowerCase();
  const currentFulfillmentStatus = String(fulfillmentStatus || 'not_ready');
  const providerStatus = String(paymentStatus || '').toLowerCase();
  let nextOrderStatus = currentOrderStatus;
  let nextFulfillmentStatus = currentFulfillmentStatus;

  if (CONFIRMED_PROVIDER_STATUSES.has(providerStatus)) {
    // Preserve lifecycle progress and completed/refunded history on duplicate
    // provider events. Any genuinely unpaid or cancelled order that receives
    // money must become paid so it cannot be silently abandoned.
    if (!SETTLED_ORDER_STATUSES.has(currentOrderStatus) && currentOrderStatus !== 'refunded') {
      nextOrderStatus = 'paid';
      nextFulfillmentStatus = deliveryMethod === 'geelark_setup' ? 'setup_pending' : 'fulfillment_pending';
    }
  } else if (providerStatus === 'refunded') {
    nextOrderStatus = 'refunded';
  } else if (['failed', 'expired'].includes(providerStatus)) {
    if (['pending', 'awaiting_payment', 'failed'].includes(currentOrderStatus)) {
      nextOrderStatus = 'failed';
    }
  } else if (ACTIVE_PROVIDER_STATUSES.has(providerStatus)) {
    // Recover legacy/manual false failures when the live invoice is still
    // active. Never reopen cancelled/refunded or regress paid fulfillment.
    if (['pending', 'failed'].includes(currentOrderStatus)) {
      nextOrderStatus = 'awaiting_payment';
      nextFulfillmentStatus = 'not_ready';
    }
  }

  return {
    orderStatus: nextOrderStatus,
    fulfillmentStatus: nextFulfillmentStatus,
    changed: nextOrderStatus !== currentOrderStatus || nextFulfillmentStatus !== currentFulfillmentStatus,
  };
}

function getSiteOrigin(env) {
  const configured = String(env?.SITE_URL || 'https://geelarkflows.com').trim();
  try {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    return url.origin;
  } catch (err) {
    throw new Error('SITE_URL must be configured as an absolute HTTP(S) origin.');
  }
}

function getFlowAssetKey(productId) {
  if (!AUTHORITATIVE_CATALOG_MAP.has(productId)) return null;
  return `flows/${productId}.zip`;
}

function reconcileProviderPayment(payload, payment, order) {
  if (!payment || !order) {
    return { valid: false, reason: 'The signed event does not match a stored invoice and order.' };
  }

  const network = resolvePaymentNetwork(payment.network_id || payment.provider_currency || payment.currency);
  const snapshotVerification = verifyProviderInvoiceSnapshot(payload, {
    paymentId: payment.id,
    orderId: order.id,
    payAddress: payment.pay_address,
    providerCurrency: payment.provider_currency || network?.nowpayments_currency,
    cryptoAmount: payment.pay_amount_crypto_text || payment.pay_amount_crypto,
    usdCents: Number(order.total_usd_cents ?? usdToCents(order.total_usd)),
  });
  if (!snapshotVerification.valid) {
    return snapshotVerification;
  }

  const expectedCrypto = payment.pay_amount_crypto_text || payment.pay_amount_crypto;
  const actualCrypto = payload.actually_paid;
  if (!isDecimalAtLeast(actualCrypto, expectedCrypto)) {
    return { valid: false, reason: 'The received cryptocurrency amount is below the stored invoice amount.' };
  }

  return { valid: true };
}

async function enforceCheckoutStatusRateLimit(db, statusTokenHash) {
  const key = `checkout_status:${statusTokenHash}`;
  const row = await db.prepare(
    `INSERT INTO api_rate_limits (key, window_started_at, request_count)
     VALUES (?, CURRENT_TIMESTAMP, 1)
     ON CONFLICT(key) DO UPDATE SET
       request_count = CASE
         WHEN window_started_at <= datetime('now', '-60 seconds') THEN 1
         ELSE request_count + 1
       END,
       window_started_at = CASE
         WHEN window_started_at <= datetime('now', '-60 seconds') THEN CURRENT_TIMESTAMP
         ELSE window_started_at
       END
     RETURNING request_count`
  ).bind(key).first();

  return Number(row?.request_count || 0) <= 12;
}

async function enforceCheckoutCreationRateLimit(db, ipHash) {
  const key = `checkout_create:${ipHash}`;
  const row = await db.prepare(
    `INSERT INTO api_rate_limits (key, window_started_at, request_count)
     VALUES (?, CURRENT_TIMESTAMP, 1)
     ON CONFLICT(key) DO UPDATE SET
       request_count = CASE
         WHEN window_started_at <= datetime('now', '-15 minutes') THEN 1
         ELSE request_count + 1
       END,
       window_started_at = CASE
         WHEN window_started_at <= datetime('now', '-15 minutes') THEN CURRENT_TIMESTAMP
         ELSE window_started_at
       END
     RETURNING request_count`
  ).bind(key).first();

  return Number(row?.request_count || 0) <= 10;
}

/**
 * Recursively sort object keys alphabetically for deterministic JSON canonicalization
 */
function sortObjectKeysRecursively(val) {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) {
    return val;
  }
  const sorted = {};
  const keys = Object.keys(val).sort();
  for (const key of keys) {
    sorted[key] = sortObjectKeysRecursively(val[key]);
  }
  return sorted;
}

/**
 * Web Crypto HMAC-SHA512 Verification for NOWPayments Webhooks
 */
async function verifyNowPaymentsSignature(payload, headerSignature, secretKey) {
  if (!headerSignature || typeof headerSignature !== 'string' || !secretKey || typeof secretKey !== 'string') {
    return false;
  }
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  try {
    const sortedObj = sortObjectKeysRecursively(payload);
    const dataString = JSON.stringify(sortedObj);

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(dataString));
    const computedHex = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return constantTimeCompare(computedHex.toLowerCase(), headerSignature.toLowerCase().trim());
  } catch (err) {
    console.error('NOWPayments HMAC calculation error:', err.message);
    return false;
  }
}

/**
 * Svix HMAC-SHA256 Signature Verification for Resend Inbound Webhooks
 */
async function verifyResendWebhookSignature(rawBody, headers, secret) {
  if (!secret || typeof secret !== 'string' || !headers || typeof rawBody !== 'string') {
    return false; // Fail closed
  }

  const svixId = headers['svix-id'];
  const svixTimestamp = headers['svix-timestamp'];
  const svixSignature = headers['svix-signature'];

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  // Enforce integer-only epoch timestamp format and 300s tolerance window
  const cleanTimestamp = String(svixTimestamp).trim();
  if (!/^\d+$/.test(cleanTimestamp)) {
    return false;
  }

  const timestampNum = parseInt(cleanTimestamp, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (isNaN(timestampNum) || Math.abs(nowSec - timestampNum) > 300) {
    return false;
  }

  try {
    let keyBytes;
    if (secret.startsWith('whsec_')) {
      const base64Key = secret.substring(6);
      try {
        const binaryStr = atob(base64Key);
        keyBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          keyBytes[i] = binaryStr.charCodeAt(i);
        }
      } catch (b64Err) {
        return false; // Malformed Base64 secret fails closed safely
      }
    } else {
      keyBytes = new TextEncoder().encode(secret);
    }

    const toSign = `${svixId}.${cleanTimestamp}.${rawBody}`;
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(toSign));
    const computedBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    const sigParts = svixSignature.split(' ').filter(Boolean);
    for (const part of sigParts) {
      const commaIdx = part.indexOf(',');
      if (commaIdx === -1) continue;
      const version = part.substring(0, commaIdx);
      const sig = part.substring(commaIdx + 1);
      if (version === 'v1' && constantTimeCompare(sig, computedBase64)) {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error('Svix signature error:', err.message);
    return false;
  }
}

/**
 * Deterministic Order Matching for Inbound Emails
 */
async function matchOrderForInboundEmail(db, fromAddress, subject = '', textBody = '', htmlBody = '') {
  if (!db) return { orderId: null, customerEmail: fromAddress };

  const combinedContent = `${subject} ${textBody} ${htmlBody}`;

  // 1. Explicit Order ID Pattern: ord_[a-zA-Z0-9]{5,12}
  const match = combinedContent.match(/ord_[a-zA-Z0-9]{5,12}/i);
  if (match) {
    const candidateId = match[0].toLowerCase();
    const order = await db.prepare('SELECT id, customer_email FROM orders WHERE LOWER(id) = ?').bind(candidateId).first();
    if (order) {
      return { orderId: order.id, customerEmail: order.customer_email };
    }
  }

  // 2. Exact Sender Email Lookup in orders table
  if (fromAddress) {
    const cleanFrom = fromAddress.toLowerCase().trim();
    const customerOrder = await db.prepare(
      'SELECT id, customer_email FROM orders WHERE LOWER(customer_email) = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(cleanFrom).first();

    if (customerOrder) {
      return { orderId: customerOrder.id, customerEmail: customerOrder.customer_email };
    }
  }

  return { orderId: null, customerEmail: fromAddress };
}

/**
 * HTML Character Escaper to prevent XSS in email templates
 */
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format Subject for Reply without accumulating "Re: Re: Re:"
 */
function formatReplySubject(subject = '') {
  const clean = (subject || '').trim();
  if (/^re:\s*/i.test(clean)) {
    return clean;
  }
  return `Re: ${clean || 'GeeLark Inquiry'}`;
}

/**
 * Fetch Inbound Email Content from Resend Receiving API
 */
async function fetchInboundEmailFromResend(apiKey, emailId) {
  if (!apiKey || !emailId) return null;

  try {
    // 1. Resend Receiving Email details endpoint: GET https://api.resend.com/emails/receiving/${emailId}
    let res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      // 2. Fallback to GET https://api.resend.com/emails/${emailId}
      res = await fetch(`https://api.resend.com/emails/${emailId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
    }

    if (!res.ok) {
      console.warn(`Resend email content fetch status ${res.status} for ${emailId}`);
      return null;
    }

    const data = await res.json();
    return data?.data || data;
  } catch (err) {
    console.error('Error fetching inbound email content from Resend:', err);
    return null;
  }
}

/**
 * Professional Dedicated GeeLark Support / Customer Reply Email Template
 */
function renderAdminSupportReplyEmail({
  customerName = '',
  adminMessage = '',
  orderId = null,
  originalSubject = '',
}) {
  const safeCustomerName = customerName ? escapeHtml(customerName) : 'there';
  const safeMessage = escapeHtml(adminMessage).replace(/\r\n/g, '\n').replace(/\n/g, '<br/>');
  const safeOrderId = orderId ? escapeHtml(orderId) : null;
  const safeSubject = escapeHtml(originalSubject);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GeeLark Customer Support</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0e0c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f0f3f1; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #0b0e0c; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #121714; border: 1px solid #232c26; border-radius: 10px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <!-- Header Bar -->
          <tr>
            <td style="padding: 24px 28px; background: linear-gradient(180deg, #18201a 0%, #121714 100%); border-bottom: 1px solid #232c26;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display: inline-block; background-color: #a7ff4f; color: #09100d; font-weight: 800; font-size: 13px; padding: 4px 8px; border-radius: 4px; letter-spacing: 0.5px;">GF</div>
                    <span style="color: #f0f3f1; font-size: 16px; font-weight: 700; margin-left: 10px; letter-spacing: -0.2px;">GeeLark Flows</span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: rgba(167, 255, 79, 0.12); color: #a7ff4f; border: 1px solid rgba(167, 255, 79, 0.25); font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Support Reply</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${safeOrderId ? `
          <!-- Order Reference Badge -->
          <tr>
            <td style="padding: 16px 28px 0 28px;">
              <div style="background-color: #17201a; border: 1px solid rgba(167, 255, 79, 0.2); border-radius: 6px; padding: 10px 14px; font-size: 12.5px; color: #9aa49e;">
                <span style="color: #a7ff4f; font-weight: 600;">📦 Order Reference:</span> <strong style="color: #f0f3f1; font-family: monospace;">#${safeOrderId}</strong>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Body Content -->
          <tr>
            <td style="padding: 24px 28px;">
              <p style="font-size: 14.5px; line-height: 1.5; color: #9aa49e; margin: 0 0 18px 0;">
                Hi <strong style="color: #f0f3f1;">${safeCustomerName}</strong>,
              </p>

              <!-- Admin Message Box -->
              <div style="background-color: #161c18; border-left: 3px solid #a7ff4f; border-radius: 4px; padding: 16px 18px; margin: 0 0 22px 0; font-size: 14px; line-height: 1.65; color: #f0f3f1; word-break: break-word;">
                ${safeMessage}
              </div>

              <p style="font-size: 12.5px; line-height: 1.5; color: #657069; margin: 0 0 20px 0;">
                If your message is related to an order or automation package, our team will continue assisting you through this email conversation.
              </p>

              <div style="border-top: 1px solid #232c26; padding-top: 16px;">
                <p style="font-size: 13px; line-height: 1.4; color: #9aa49e; margin: 0;">
                  Best regards,<br />
                  <strong style="color: #f0f3f1;">GeeLark Support Team</strong><br />
                  <a href="https://geelarkflows.com" style="color: #a7ff4f; text-decoration: none; font-weight: 600; font-size: 12px;">geelarkflows.com</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 28px; background-color: #0d110f; border-top: 1px solid #232c26; text-align: center;">
              <p style="font-size: 11px; color: #49544d; margin: 0; line-height: 1.4;">
                This message was sent by GeeLark Flows Customer Operations in response to your inquiry.<br />
                © ${new Date().getFullYear()} GeeLark Flows. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const plainText = `GeeLark Customer Support
--------------------------------------------------
${safeOrderId ? `Order Reference: #${orderId}\n\n` : ''}Hi ${customerName || 'there'},

${adminMessage}

--------------------------------------------------
If your message is related to an order or automation package, our team will continue assisting you through this email conversation.

Best regards,
GeeLark Support Team
https://geelarkflows.com
`;

  return { html, plainText };
}

/**
 * Resolves and validates client-submitted cart items against the authoritative server catalog.
 * - Rejects non-arrays or empty carts.
 * - Rejects unknown product IDs.
 * - Rejects non-integer, negative, zero, or excessive quantities.
 * - Resolves unit prices strictly from the server catalog (ignores client-submitted prices).
 * - Preserves server-resolved snapshot data for D1 order persistence.
 */
function resolveServerAuthoritativeCart(cartInput = []) {
  if (!Array.isArray(cartInput) || cartInput.length === 0) {
    return { error: 'Your cart is empty. Please add workflows to proceed.' };
  }

  if (cartInput.length > 50) {
    return { error: 'Cart exceeds maximum allowed item count.' };
  }

  const resolvedCart = [];

  for (let i = 0; i < cartInput.length; i++) {
    const item = cartInput[i];
    if (!item || typeof item !== 'object') {
      return { error: `Invalid item format at item index ${i + 1}.` };
    }

    const productId = String(item.id || '').trim();
    if (!productId) {
      return { error: `Missing product identifier at item ${i + 1}.` };
    }

    const catalogItem = AUTHORITATIVE_CATALOG_MAP.get(productId);
    if (!catalogItem) {
      return { error: `Unknown or discontinued workflow "${productId}".` };
    }

    // Validate quantity strictly as an integer between 1 and 100
    const rawQty = item.quantity !== undefined && item.quantity !== null ? item.quantity : 1;
    const numQty = Number(rawQty);

    if (!Number.isInteger(numQty) || numQty < 1 || numQty > 100) {
      return { error: `Invalid quantity "${rawQty}" for workflow "${catalogItem.title}". Quantity must be an integer between 1 and 100.` };
    }

    resolvedCart.push({
      id: catalogItem.id,
      title: catalogItem.title,
      platform: catalogItem.platform,
      category: catalogItem.category,
      price: catalogItem.price, // STRICT AUTHORITATIVE SERVER PRICE
      quantity: numQty,
    });
  }

  return { resolvedCart };
}

function normalizeCouponCode(value) {
  return String(value || '').trim().toUpperCase();
}

function isValidCouponCodeFormat(value) {
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(normalizeCouponCode(value));
}

async function resolveCouponDiscount(db, rawCode, workflowSubtotal) {
  const code = normalizeCouponCode(rawCode);
  if (!isValidCouponCodeFormat(code)) {
    return { valid: false, error: 'Coupon code is invalid.' };
  }

  const coupon = await db.prepare(`
    SELECT c.*,
           (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id) AS redemption_count,
           CASE WHEN c.starts_at IS NULL OR datetime(c.starts_at) <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS has_started,
           CASE WHEN c.expires_at IS NULL OR datetime(c.expires_at) > CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS has_not_expired
    FROM coupon_codes c
    WHERE c.code = ? COLLATE NOCASE
    LIMIT 1
  `).bind(code).first();

  if (!coupon || Number(coupon.active) !== 1) {
    return { valid: false, error: 'Coupon code is invalid or inactive.' };
  }
  if (Number(coupon.has_started) !== 1) {
    return { valid: false, error: 'This coupon is not active yet.' };
  }
  if (Number(coupon.has_not_expired) !== 1) {
    return { valid: false, error: 'This coupon has expired.' };
  }

  const redemptionCount = Number(coupon.redemption_count || 0);
  const maxRedemptions = coupon.max_redemptions === null || coupon.max_redemptions === undefined
    ? null
    : Number(coupon.max_redemptions);
  if (maxRedemptions !== null && redemptionCount >= maxRedemptions) {
    return { valid: false, error: 'This coupon has reached its usage limit.' };
  }

  const subtotalCents = usdToCents(workflowSubtotal);
  const minimumCents = Math.max(0, Number(coupon.min_subtotal_cents || 0));
  if (subtotalCents < minimumCents) {
    return {
      valid: false,
      error: `This coupon requires a workflow subtotal of at least $${(minimumCents / 100).toFixed(2)} USD.`,
    };
  }

  const storedValue = Number(coupon.discount_value || 0);
  const discountCents = coupon.discount_type === 'percentage'
    ? Math.round(subtotalCents * storedValue / 100)
    : storedValue;
  const cappedDiscountCents = Math.min(subtotalCents, Math.max(0, discountCents));
  if (cappedDiscountCents <= 0) {
    return { valid: false, error: 'This coupon does not apply to the current order.' };
  }

  return {
    valid: true,
    couponId: coupon.id,
    code,
    description: coupon.description || null,
    discountType: coupon.discount_type,
    discountValue: storedValue,
    discountCents: cappedDiscountCents,
    discountUsd: cappedDiscountCents / 100,
    discountLabel: coupon.discount_type === 'percentage'
      ? `${storedValue}% off workflows`
      : `$${(storedValue / 100).toFixed(2)} off workflows`,
  };
}

function calculateOrderTotals(resolvedCart = [], deliveryMethod = 'download_package', couponDiscountCents = 0) {
  const workflowSubtotal = (resolvedCart || []).reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 1;
    return sum + price * quantity;
  }, 0);

  let setupFee = 0;
  if (deliveryMethod === 'geelark_setup') {
    setupFee = workflowSubtotal >= 300 ? 0 : 50;
  }

  const workflowSubtotalCents = usdToCents(workflowSubtotal);
  const normalizedDiscountCents = Math.min(
    workflowSubtotalCents,
    Math.max(0, Number.isInteger(couponDiscountCents) ? couponDiscountCents : 0),
  );
  const couponDiscount = normalizedDiscountCents / 100;
  const finalTotal = workflowSubtotal + setupFee - couponDiscount;
  return {
    workflowSubtotal: Number(workflowSubtotal.toFixed(2)),
    setupFee: Number(setupFee.toFixed(2)),
    couponDiscount: Number(couponDiscount.toFixed(2)),
    finalTotal: Number(finalTotal.toFixed(2)),
    setupFeeLabel: deliveryMethod === 'geelark_setup' ? (setupFee === 0 ? 'FREE' : '$50') : 'Included',
  };
}

/**
 * Send Payment Confirmed & Processing Notification via Resend API (Outbound)
 */
async function sendPaymentConfirmationEmail({
  resendApiKey,
  customerEmail,
  orderId,
  networkLabel,
  items,
  deliveryMethod = 'download_package',
  workflowSubtotal = 0,
  setupFee = 0,
  couponCode = null,
  couponDiscount = 0,
  totalUsd = 0,
}) {
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY secret is missing. Skipping email dispatch.');
    return null;
  }

  const isSetup = deliveryMethod === 'geelark_setup';
  const deliveryLabel = isSetup ? 'GeeLark Account Setup' : 'Downloadable Package';
  const setupFeeDisplay = isSetup ? (setupFee === 0 ? 'FREE ($0.00)' : `$${setupFee.toFixed(2)} USD`) : 'Included ($0.00)';

  const fulfillmentTimeline = isSetup
    ? 'Our team will contact you within 24 hours to coordinate the setup on your GeeLark account. You do not need to provide your GeeLark account credentials during checkout; our team will collect any required configuration details separately through secure 1-on-1 communication.'
    : 'Your workflow package will be prepared and delivered to this email address within 24 hours.';

  const itemsHtml = items.map((i) => `
    <li style="margin-bottom: 8px; color: #e1e6e2;">
      <strong>${i.title}</strong> (${i.platform || 'GeeLark'}) — $${Number(i.price).toFixed(2)}
    </li>
  `).join('');

  const fromEmail = 'GeeLark Flows <noreply@geelarkflows.com>';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0f0d; color: #f1f3f1; padding: 32px 28px; border-radius: 8px; border: 1px solid #222924;">
      <div style="margin-bottom: 20px;">
        <span style="background: #a7ff4f; color: #000; font-weight: 800; font-size: 11px; padding: 3px 6px; border-radius: 4px; font-family: monospace;">GF</span>
        <span style="font-size: 14px; font-weight: 700; color: #f1f3f1; letter-spacing: 0.5px; margin-left: 6px;">GEELARK FLOWS</span>
      </div>

      <h2 style="color: #ffffff; margin-top: 0; font-size: 20px; font-weight: 700; border-bottom: 1px solid #1e2420; padding-bottom: 14px;">
        Payment confirmed — Order #${orderId}
      </h2>

      <p style="color: #c0c6c2; font-size: 14px; line-height: 1.6; margin: 16px 0;">
        Thank you for your order. Your cryptocurrency payment has been verified on the blockchain and your order is now being processed.
      </p>

      <div style="background: #141815; padding: 18px; border-radius: 6px; margin: 20px 0; border: 1px solid #232a25;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #c0c6c2;">
          <tr>
            <td style="padding: 4px 0; color: #828c85; font-family: monospace;">Order ID:</td>
            <td style="padding: 4px 0; text-align: right; font-family: monospace; font-weight: 700; color: #f1f3f1;">#${orderId}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #828c85; font-family: monospace;">Payment Method:</td>
            <td style="padding: 4px 0; text-align: right; font-family: monospace; color: #a7ff4f;">USDT (${networkLabel || 'TRC-20'})</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #828c85; font-family: monospace;">Delivery Method:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #ffffff;">${deliveryLabel}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #828c85; font-family: monospace;">Registered Email:</td>
            <td style="padding: 4px 0; text-align: right; font-family: monospace; color: #f1f3f1;">${escapeHtml(customerEmail)}</td>
          </tr>
        </table>

        <div style="border-top: 1px solid #232a25; margin-top: 12px; padding-top: 12px;">
          <span style="font-size: 11px; font-weight: 700; color: #828c85; letter-spacing: 0.5px; text-transform: uppercase; display: block; margin-bottom: 8px;">Purchased Workflows</span>
          <ul style="margin: 0; padding-left: 18px; font-size: 13px;">
            ${itemsHtml}
          </ul>
        </div>

        <div style="border-top: 1px solid #232a25; margin-top: 14px; padding-top: 12px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 3px 0; color: #828c85;">Workflow subtotal:</td>
              <td style="padding: 3px 0; text-align: right; font-family: monospace; color: #e1e6e2;">$${Number(workflowSubtotal).toFixed(2)} USD</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #828c85;">Delivery / Setup:</td>
              <td style="padding: 3px 0; text-align: right; font-family: monospace; color: ${setupFee === 0 ? '#a7ff4f' : '#e1e6e2'};">${setupFeeDisplay}</td>
            </tr>
            ${couponCode && Number(couponDiscount) > 0 ? `
            <tr>
              <td style="padding: 3px 0; color: #828c85;">Coupon (${couponCode}):</td>
              <td style="padding: 3px 0; text-align: right; font-family: monospace; color: #a7ff4f;">−$${Number(couponDiscount).toFixed(2)} USD</td>
            </tr>` : ''}
            <tr style="border-top: 1px solid #2e3831;">
              <td style="padding: 8px 0 0 0; font-weight: 700; color: #ffffff; font-size: 14px;">Total Paid:</td>
              <td style="padding: 8px 0 0 0; text-align: right; font-family: monospace; font-weight: 700; color: #a7ff4f; font-size: 15px;">$${Number(totalUsd).toFixed(2)} USD</td>
            </tr>
          </table>
        </div>
      </div>

      <div style="background: #101412; border-left: 3px solid #a7ff4f; padding: 14px 16px; border-radius: 0 6px 6px 0; margin: 20px 0;">
        <strong style="color: #ffffff; font-size: 13px; display: block; margin-bottom: 4px;">Fulfillment Next Steps</strong>
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #c0c6c2;">
          ${fulfillmentTimeline}
        </p>
      </div>

      <div style="font-size: 12px; color: #667269; margin-top: 28px; border-top: 1px solid #1e2420; padding-top: 16px; line-height: 1.5;">
        <p style="margin: 0 0 6px 0;">For support or questions regarding your order, contact <a href="mailto:support@geelarkflows.com" style="color: #a7ff4f; text-decoration: none;">support@geelarkflows.com</a>.</p>
        <p style="margin: 0; color: #4b544e; font-size: 11px;">GeeLark Flows — High-Performance Automation Systems</p>
      </div>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [customerEmail],
      subject: `Payment confirmed — Order #${orderId}`,
      html,
    }),
  });

  const resData = await response.json();
  if (!response.ok || resData.error || resData.statusCode >= 400) {
    const errorMsg = resData.message || resData.error?.message || JSON.stringify(resData);
    throw new Error(`Resend API Error (${response.status}): ${errorMsg}`);
  }

  return resData;
}

/**
 * Send secure per-product download links or setup onboarding via Resend.
 */
async function sendFulfillmentEmail({
  resendApiKey,
  customerEmail,
  orderId,
  networkLabel,
  items,
  downloadLinks = [],
  deliveryMethod = 'download_package',
}) {
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY secret is missing in Cloudflare Workers environment bindings.');
  }

  const itemsHtml = items.map((i) => `<li><strong>${i.title}</strong> (${i.platform || 'GeeLark'}) — $${i.price}</li>`).join('');
  const isSetup = deliveryMethod === 'geelark_setup';
  const linksHtml = downloadLinks.map((link) => `
    <p style="margin: 10px 0;">
      <a href="${link.url}" style="display: inline-block; background: #A7FF4F; color: #0c0f0d; padding: 10px 14px; border-radius: 6px; font-weight: 700; text-decoration: none;">
        Download ${link.title}
      </a>
    </p>
  `).join('');
  const fromEmail = 'GeeLark Flows <noreply@geelarkflows.com>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [customerEmail],
      subject: isSetup
        ? `Your GeeLark setup is being prepared (Order #${orderId})`
        : `Your GeeLark flow downloads (Order #${orderId})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0f0d; color: #f1f3f1; padding: 28px; border-radius: 8px; border: 1px solid #222924;">
          <h2 style="color: #A7FF4F; margin-top: 0; font-size: 20px;">${isSetup ? 'GeeLark Setup — Onboarding Started' : 'GeeLark Flows — Secure Delivery'}</h2>
          <p style="color: #c0c6c2; font-size: 14px; line-height: 1.5;">
            ${isSetup
              ? 'Your setup request is now in progress. Our team will contact you with the secure onboarding steps.'
              : 'Your purchased flows are available through the private links below. Links expire after seven days; the flows remain reusable after download.'}
          </p>
          <div style="background: #141815; padding: 16px; border-radius: 6px; margin: 20px 0; border: 1px solid #232a25;">
            <p style="margin: 0 0 6px 0; font-size: 12px; color: #828c85; font-family: monospace;">ORDER ID: <strong>${orderId}</strong></p>
            <p style="margin: 0 0 12px 0; font-size: 12px; color: #828c85; font-family: monospace;">PAYMENT METHOD: <strong style="color: #A7FF4F;">USDT (${networkLabel || 'TRC-20'})</strong></p>
            <ul style="margin: 0; padding-left: 20px; color: #e1e6e2; font-size: 14px;">
              ${itemsHtml}
            </ul>
          </div>
          ${isSetup ? '' : `<div style="margin: 20px 0;">${linksHtml}</div>`}
          <p style="color: #c0c6c2; font-size: 14px; line-height: 1.5;">
            For setup assistance or technical support, contact <a href="mailto:support@geelarkflows.com" style="color: #a7ff4f;">support@geelarkflows.com</a>.
          </p>
        </div>
      `,
    }),
  });

  const resData = await response.json();
  if (!response.ok || resData.error || resData.statusCode >= 400) {
    const errorMsg = resData.message || resData.error?.message || JSON.stringify(resData);
    throw new Error(`Resend API Error (${response.status}): ${errorMsg}`);
  }

  return resData;
}

/**
 * Send Internal Notification for New Custom Automation Request via Resend API (Outbound)
 */
async function sendCustomRequestNotificationEmail({
  resendApiKey,
  requestId,
  name,
  email,
  requestType,
  details,
}) {
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY secret is missing. Skipping internal email notification.');
    return null;
  }

  const isFlow = requestType === 'flow';
  const typeLabel = isFlow ? 'Custom Flow Creation' : 'Consulting & Strategy';
  const fromEmail = 'GeeLark Flows <noreply@geelarkflows.com>';
  const toEmail = 'support@geelarkflows.com';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0f0d; color: #f1f3f1; padding: 32px 28px; border-radius: 8px; border: 1px solid #222924;">
      <div style="margin-bottom: 20px;">
        <span style="background: #a7ff4f; color: #000; font-weight: 800; font-size: 11px; padding: 3px 6px; border-radius: 4px; font-family: monospace;">GF LEAD</span>
        <span style="font-size: 14px; font-weight: 700; color: #f1f3f1; letter-spacing: 0.5px; margin-left: 6px;">NEW CUSTOM REQUEST</span>
      </div>

      <h2 style="color: #ffffff; margin-top: 0; font-size: 20px; font-weight: 700; border-bottom: 1px solid #1e2420; padding-bottom: 14px;">
        ${escapeHtml(typeLabel)} — Ref #${escapeHtml(requestId)}
      </h2>

      <div style="background: #141815; padding: 18px; border-radius: 6px; margin: 20px 0; border: 1px solid #232a25;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #c0c6c2;">
          <tr>
            <td style="padding: 4px 0; color: #828c85; font-family: monospace;">Reference ID:</td>
            <td style="padding: 4px 0; text-align: right; font-family: monospace; font-weight: 700; color: #a7ff4f;">${escapeHtml(requestId)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #828c85;">Client Name:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #ffffff;">${escapeHtml(name)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #828c85;">Client Email:</td>
            <td style="padding: 4px 0; text-align: right; font-family: monospace; color: #a7ff4f;">
              <a href="mailto:${escapeHtml(email)}" style="color: #a7ff4f; text-decoration: none;">${escapeHtml(email)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #828c85;">Service Type:</td>
            <td style="padding: 4px 0; text-align: right; color: #ffffff;">${escapeHtml(typeLabel)}</td>
          </tr>
        </table>

        <div style="border-top: 1px solid #232a25; margin-top: 14px; padding-top: 12px;">
          <span style="font-size: 11px; font-weight: 700; color: #828c85; letter-spacing: 0.5px; text-transform: uppercase; display: block; margin-bottom: 8px;">Project Requirements</span>
          <div style="font-size: 13px; color: #e1e6e2; line-height: 1.6; white-space: pre-wrap; background: #0c0f0d; padding: 12px; border-radius: 4px; border: 1px solid #1e2420;">${escapeHtml(details)}</div>
        </div>
      </div>

      <div style="font-size: 12px; color: #667269; margin-top: 24px; border-top: 1px solid #1e2420; padding-top: 14px; line-height: 1.5;">
        <p style="margin: 0;">This lead was submitted via GeeLark Flows Custom Automation Form.</p>
      </div>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: email,
      subject: `New Custom Request: ${name} (${typeLabel}) [${requestId}]`,
      html,
    }),
  });

  const resData = await response.json();
  if (!response.ok || resData.error || resData.statusCode >= 400) {
    const errorMsg = resData.message || resData.error?.message || JSON.stringify(resData);
    throw new Error(`Resend API Error (${response.status}): ${errorMsg}`);
  }

  return resData;
}

// ----------------------------------------------------
// AUDIT LOGGING HELPER (Append-Only)
// ----------------------------------------------------

async function recordAuditLog(db, {
  adminId = null,
  adminEmail = 'system',
  ip = null,
  userAgent = null,
  action,
  entityType,
  entityId,
  previousState = null,
  newState = null,
  reason = null,
  metadata = null,
}) {
  if (!db) return;
  try {
    const auditId = 'aud_' + generateSecureToken(8);
    const metaStr = metadata ? JSON.stringify(metadata) : null;
    await db.prepare(
      `INSERT INTO audit_logs (id, actor_admin_id, actor_admin_email, actor_ip, actor_user_agent, action, entity_type, entity_id, previous_state, new_state, reason, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      auditId,
      adminId,
      adminEmail,
      ip,
      userAgent,
      action,
      entityType,
      entityId,
      previousState ? String(previousState) : null,
      newState ? String(newState) : null,
      reason,
      metaStr
    ).run();
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

// ----------------------------------------------------
// DUAL LOGIN RATE LIMITING (IP & Email)
// ----------------------------------------------------

async function checkLoginRateLimit(db, ip, email) {
  if (!db) return { allowed: false, statusCode: 503, reason: 'Login protection is temporarily unavailable.' };
  try {
    const keys = [];
    if (ip) keys.push(`ip:${ip}`);
    if (email) keys.push(`email:${email.toLowerCase().trim()}`);

    for (const key of keys) {
      const row = await db.prepare(
        'SELECT attempts, locked_until FROM login_rate_limits WHERE key = ?'
      ).bind(key).first();

      if (row && row.locked_until) {
        const lockTime = new Date(row.locked_until).getTime();
        const now = Date.now();
        if (now < lockTime) {
          const waitSeconds = Math.ceil((lockTime - now) / 1000);
          return { allowed: false, waitSeconds, reason: `Too many login attempts on ${key.startsWith('ip:') ? 'this network' : 'this account'}. Locked for ${waitSeconds}s.` };
        }
      }
    }
    return { allowed: true };
  } catch (err) {
    console.error('Rate limit check failed closed:', err.message);
    return { allowed: false, statusCode: 503, reason: 'Login protection is temporarily unavailable.' };
  }
}

async function recordFailedLogin(db, ip, email) {
  if (!db) return;
  try {
    const keys = [];
    if (ip) keys.push(`ip:${ip}`);
    if (email) keys.push(`email:${email.toLowerCase().trim()}`);

    for (const key of keys) {
      const row = await db.prepare('SELECT attempts FROM login_rate_limits WHERE key = ?').bind(key).first();
      const currentAttempts = (row?.attempts || 0) + 1;
      let lockedUntil = null;

      if (currentAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }

      await db.prepare(
        `INSERT INTO login_rate_limits (key, attempts, locked_until, last_attempt_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET attempts = ?, locked_until = ?, last_attempt_at = CURRENT_TIMESTAMP`
      ).bind(key, currentAttempts, lockedUntil, currentAttempts, lockedUntil).run();
    }
  } catch (err) {
    console.warn('Failed login record warning:', err.message);
  }
}

async function clearLoginRateLimit(db, ip, email) {
  if (!db) return;
  try {
    if (ip) await db.prepare('DELETE FROM login_rate_limits WHERE key = ?').bind(`ip:${ip}`).run();
    if (email) await db.prepare('DELETE FROM login_rate_limits WHERE key = ?').bind(`email:${email.toLowerCase().trim()}`).run();
  } catch (err) {}
}

function parseCookies(header) {
  const list = {};
  if (!header) return list;
  header.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return list;
}

// ----------------------------------------------------
// ADMIN AUTH & CSRF MIDDLEWARE
// ----------------------------------------------------

async function adminAuthMiddleware(c, next) {
  const method = c.req.method.toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const origin = c.req.header('origin');
    const fetchSite = c.req.header('sec-fetch-site');
    const requestOrigin = new URL(c.req.url).origin;
    if ((origin && origin !== requestOrigin) || fetchSite === 'cross-site') {
      return c.json({ success: false, error: 'Forbidden: Cross-origin admin action rejected.' }, 403);
    }

    const actionHeader = c.req.header('x-admin-action');
    if (actionHeader !== '1') {
      return c.json({ success: false, error: 'Forbidden: Missing or invalid CSRF authorization header (X-Admin-Action: 1 required).' }, 403);
    }
  }

  const cookieHeader = c.req.header('cookie');
  const cookies = parseCookies(cookieHeader);
  const rawToken = cookies['gf_admin_session'];

  if (!rawToken) {
    return c.json({ success: false, error: 'Unauthorized: No active admin session.' }, 401);
  }

  const tokenHash = await sha256Hex(rawToken);
  const db = c.env?.DB;

  if (!db) {
    return c.json({ success: false, error: 'Database binding missing in environment.' }, 500);
  }

  try {
    const session = await db.prepare(
      `SELECT s.id as session_id, s.token_hash, s.user_id, s.last_active_at, s.expires_at,
              u.id as user_id, u.email, u.name, u.role
       FROM admin_sessions s
       JOIN admin_users u ON s.user_id = u.id
       WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP`
    ).bind(tokenHash).first();

    if (!session) {
      return c.json({ success: false, error: 'Unauthorized: Session expired or invalid.' }, 401);
    }

    const lastActive = new Date(session.last_active_at || 0).getTime();
    if (Date.now() - lastActive > 5 * 60 * 1000) {
      db.prepare('UPDATE admin_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(session.session_id)
        .run()
        .catch(() => {});
    }

    c.set('adminUser', {
      id: session.user_id,
      email: session.email,
      name: session.name,
      role: session.role,
      sessionId: session.session_id,
    });

    await next();
  } catch (err) {
    console.error('Admin auth middleware error:', err);
    return c.json({ success: false, error: 'Internal Authentication Error' }, 500);
  }
}

function requireRole(requiredRole) {
  return async (c, next) => {
    const user = c.get('adminUser');
    if (!user) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    if (requiredRole === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
      return c.json({ success: false, error: 'Forbidden: SUPER_ADMIN role required for this action.' }, 403);
    }
    await next();
  };
}

// ----------------------------------------------------
// STATE MACHINE TRANSITION RULES
// ----------------------------------------------------

const ALLOWED_ORDER_TRANSITIONS = {
  pending: ['awaiting_payment', 'cancelled'],
  // Payment settlement/failure is gateway-controlled. Manual settlement must
  // use the separately audited Force Settle endpoint.
  awaiting_payment: ['cancelled'],
  paid: ['processing', 'refunded'],
  processing: ['completed', 'refunded'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
  failed: [],
};

const ALLOWED_FULFILLMENT_TRANSITIONS = {
  download_package: {
    not_ready: ['fulfillment_pending'],
    fulfillment_pending: ['package_preparing', 'failed'],
    package_preparing: ['package_delivered', 'failed'],
    package_delivered: [],
    failed: [],
  },
  geelark_setup: {
    not_ready: ['setup_pending'],
    setup_pending: ['setup_in_progress', 'failed'],
    setup_in_progress: ['setup_completed', 'failed'],
    setup_completed: [],
    failed: [],
  },
};

// ----------------------------------------------------
// CUSTOMER-FACING STOREFRONT APIS (PRESERVED)
// ----------------------------------------------------

// POST /api/coupons/validate — previews an authoritative coupon discount
app.post('/coupons/validate', async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Coupon validation is temporarily unavailable.' }, 503);

  try {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ success: false, error: 'Invalid coupon request.' }, 400);
    }

    const selectedDeliveryMethod = body.delivery_method || body.deliveryMethod || 'download_package';
    if (!['download_package', 'geelark_setup'].includes(selectedDeliveryMethod)) {
      return c.json({ success: false, error: 'Please select a valid delivery method.' }, 400);
    }

    const cartResolution = resolveServerAuthoritativeCart(body.cart || []);
    if (cartResolution.error) {
      return c.json({ success: false, error: cartResolution.error }, 400);
    }

    const baseTotals = calculateOrderTotals(cartResolution.resolvedCart, selectedDeliveryMethod);
    const coupon = await resolveCouponDiscount(db, body.coupon_code || body.couponCode, baseTotals.workflowSubtotal);
    if (!coupon.valid) {
      return c.json({ success: false, error: coupon.error }, 400);
    }

    const totals = calculateOrderTotals(cartResolution.resolvedCart, selectedDeliveryMethod, coupon.discountCents);
    return c.json({
      success: true,
      data: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountLabel: coupon.discountLabel,
        workflowSubtotal: totals.workflowSubtotal,
        setupFee: totals.setupFee,
        couponDiscount: totals.couponDiscount,
        totalUsd: totals.finalTotal,
      },
    });
  } catch (err) {
    console.error('Coupon validation error:', err.message);
    return c.json({ success: false, error: 'Coupon validation is temporarily unavailable.' }, 500);
  }
});

// POST /api/checkout/create
app.post('/checkout/create', async (c) => {
  try {
    const db = c.env?.DB;
    if (!db || typeof db.batch !== 'function') {
      return c.json({ success: false, error: 'Checkout is temporarily unavailable. Please try again shortly.' }, 503);
    }

    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
    try {
      const ipHash = await sha256Hex(clientIp || 'unknown');
      if (!(await enforceCheckoutCreationRateLimit(db, ipHash))) {
        c.header('Retry-After', '900');
        return c.json({
          success: false,
          error: 'Too many checkout attempts. Please wait a few minutes before creating another invoice.',
        }, 429);
      }
    } catch (rateErr) {
      console.error('Checkout creation rate limit failed closed:', rateErr.message);
      return c.json({
        success: false,
        error: 'Checkout protection is temporarily unavailable. Please try again shortly.',
      }, 503);
    }

    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON payload format.' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ success: false, error: 'Request body must be a JSON object.' }, 400);
    }
    const { email, network, payment_network, delivery_method, deliveryMethod, coupon_code, couponCode, cart = [] } = body;

    if (!isValidEmail(email)) {
      return c.json({ success: false, error: 'Please enter a valid email address.' }, 400);
    }
    const cleanEmail = email.toLowerCase().trim();

    const selectedDeliveryMethod = delivery_method || deliveryMethod;
    if (!selectedDeliveryMethod || !['download_package', 'geelark_setup'].includes(selectedDeliveryMethod)) {
      return c.json({
        success: false,
        error: 'Please select a delivery method (Downloadable Package or GeeLark Account Setup).',
      }, 400);
    }

    const requestedNetwork = network || payment_network || 'trc20';
    const networkConfig = resolvePaymentNetwork(requestedNetwork);

    if (!networkConfig) {
      return c.json({
        success: false,
        error: `Unsupported payment network "${requestedNetwork}". Supported USDT networks are: TRC-20, ERC-20, BEP-20, and SOL.`,
      }, 400);
    }

    // 1. Authoritative Server Catalog Resolution & Quantity Validation (Ignores client-submitted prices)
    const cartResolution = resolveServerAuthoritativeCart(cart);
    if (cartResolution.error) {
      return c.json({ success: false, error: cartResolution.error }, 400);
    }
    const resolvedCart = cartResolution.resolvedCart;

    // 2. Authoritative Server-Side Financial Calculation
    const baseTotals = calculateOrderTotals(resolvedCart, selectedDeliveryMethod);
    let appliedCoupon = null;
    const suppliedCouponCode = coupon_code || couponCode;
    if (suppliedCouponCode) {
      appliedCoupon = await resolveCouponDiscount(db, suppliedCouponCode, baseTotals.workflowSubtotal);
      if (!appliedCoupon.valid) {
        return c.json({ success: false, error: appliedCoupon.error }, 400);
      }
    }
    const { workflowSubtotal, setupFee, couponDiscount, finalTotal } = calculateOrderTotals(
      resolvedCart,
      selectedDeliveryMethod,
      appliedCoupon?.discountCents || 0,
    );

    if (finalTotal < networkConfig.min_amount_usd) {
      return c.json({
        success: false,
        error: `Minimum order amount for ${networkConfig.full_label} is $${networkConfig.min_amount_usd} USD. Please choose another network.`,
      }, 400);
    }

    const orderId = 'ord_' + generateSecureToken(16);
    const paymentId = 'pay_' + generateSecureToken(16);
    const statusToken = generateSecureToken(32);
    const statusTokenHash = await sha256Hex(statusToken);

    let payAddress = '';
    let payAmountCrypto = finalTotal.toFixed(2);
    let cryptoRate = '1';
    let actualPaymentId = paymentId;
    let gatewayError = null;

    const apiKey = c.env?.NOWPAYMENTS_API_KEY || c.env?.CRYPTO_GATEWAY_API_KEY;

    if (apiKey) {
      try {
        const requestOrigin = getSiteOrigin(c.env);

        const nowPayRes = await fetch('https://api.nowpayments.io/v1/payment', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            price_amount: finalTotal,
            price_currency: 'usd',
            pay_currency: networkConfig.nowpayments_currency,
            order_id: orderId,
            order_description: `GeeLark Flows Order ${orderId} (${networkConfig.full_label})`,
            ipn_callback_url: `${requestOrigin}/api/webhooks/crypto`,
          }),
        });

        const nowPayData = await nowPayRes.json();
        const providerAmount = decimalToScaledBigInt(nowPayData?.pay_amount);
        const providerCurrencyMatches = normalizeCurrency(nowPayData?.pay_currency) === normalizeCurrency(networkConfig.nowpayments_currency);
        if (nowPayRes.ok && nowPayData?.pay_address && nowPayData?.payment_id && providerAmount !== null && providerAmount > 0n && providerCurrencyMatches) {
          const candidatePaymentId = String(nowPayData.payment_id);
          const candidateAddress = String(nowPayData.pay_address).trim();
          const candidateCryptoAmount = String(nowPayData.pay_amount);

          if (!/^\d+$/.test(candidatePaymentId)) {
            gatewayError = 'Gateway returned an invalid payment identifier.';
          } else {
            const verifyRes = await fetch(`https://api.nowpayments.io/v1/payment/${candidatePaymentId}`, {
              headers: { 'x-api-key': apiKey },
            });
            const verifiedPayment = await verifyRes.json();
            const snapshotVerification = verifyProviderInvoiceSnapshot(verifiedPayment, {
              paymentId: candidatePaymentId,
              orderId,
              payAddress: candidateAddress,
              providerCurrency: networkConfig.nowpayments_currency,
              cryptoAmount: candidateCryptoAmount,
              usdCents: usdToCents(finalTotal),
            });

            if (!verifyRes.ok || !snapshotVerification.valid) {
              gatewayError = snapshotVerification.valid
                ? `Gateway verification returned HTTP ${verifyRes.status}.`
                : snapshotVerification.reason;
              console.error('NOWPayments invoice verification failed:', gatewayError);
            } else {
              payAddress = String(verifiedPayment.pay_address).trim();
              payAmountCrypto = String(verifiedPayment.pay_amount);
              cryptoRate = verifiedPayment.price_amount && verifiedPayment.pay_amount
                ? String(Number(verifiedPayment.price_amount) / Number(verifiedPayment.pay_amount))
                : '1';
              actualPaymentId = candidatePaymentId;
            }
          }
        } else if (nowPayData && (nowPayData.message || nowPayData.error)) {
          gatewayError = nowPayData.message || nowPayData.error;
          console.error('NOWPayments API Error:', gatewayError);
        } else {
          gatewayError = 'Gateway response did not contain a valid payment ID, network, amount, and receiving address.';
        }
      } catch (gateErr) {
        gatewayError = gateErr.message;
        console.error('NOWPayments API fetch failure:', gateErr.message);
      }
    } else {
      gatewayError = 'NOWPAYMENTS_API_KEY is not configured in Cloudflare Workers environment bindings.';
    }

    if (!payAddress) {
      return c.json({
        success: false,
        error: gatewayError ? `NOWPayments Gateway: ${gatewayError}` : 'Payment gateway failed to return a receiving address.',
      }, 502);
    }

    const expiresAtStr = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    try {
      const persistenceStatements = [
        db.prepare(
          `INSERT INTO orders
           (id, customer_email, total_usd, total_usd_cents, delivery_method, workflow_subtotal, workflow_subtotal_cents, setup_fee, setup_fee_cents,
            coupon_code, coupon_discount_usd, coupon_discount_cents, status, items, fulfillment_status, status_token_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          orderId,
          cleanEmail,
          finalTotal,
          usdToCents(finalTotal),
          selectedDeliveryMethod,
          workflowSubtotal,
          usdToCents(workflowSubtotal),
          setupFee,
          usdToCents(setupFee),
          appliedCoupon?.code || null,
          couponDiscount,
          usdToCents(couponDiscount),
          'awaiting_payment',
          JSON.stringify(resolvedCart),
          'not_ready',
          statusTokenHash,
        ),
        db.prepare(
          `INSERT INTO crypto_payments
           (id, order_id, currency, network_id, provider_currency, pay_address, pay_amount_crypto, pay_amount_crypto_text, exchange_rate_usd, exchange_rate_usd_text, expected_price_usd_cents, expires_at, status, verification_source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          actualPaymentId,
          orderId,
          networkConfig.display_currency,
          networkConfig.id,
          networkConfig.nowpayments_currency,
          payAddress,
          Number(payAmountCrypto),
          payAmountCrypto,
          Number(cryptoRate),
          cryptoRate,
          usdToCents(finalTotal),
          expiresAtStr,
          'waiting',
          'nowpayments_api_double_verified',
        ),
      ];

      if (appliedCoupon) {
        persistenceStatements.push(
          db.prepare(
            `INSERT INTO coupon_redemptions
             (id, coupon_id, order_id, customer_email, discount_cents)
             VALUES (?, ?, ?, ?, ?)`
          ).bind(
            'cpnred_' + generateSecureToken(10),
            appliedCoupon.couponId,
            orderId,
            cleanEmail,
            appliedCoupon.discountCents,
          ),
        );
      }

      await db.batch(persistenceStatements);
    } catch (dbErr) {
      console.error(`Checkout persistence failed for ${orderId}:`, dbErr.message);
      return c.json({
        success: false,
        error: 'We could not safely save this invoice. No payment should be sent; please create a new checkout.',
      }, 503);
    }

    return c.json({
      success: true,
      data: {
        orderId,
        paymentId: actualPaymentId,
        statusToken,
        asset: 'USDT',
        network: networkConfig.id,
        networkLabel: networkConfig.network,
        blockchain: networkConfig.blockchain,
        fullNetworkLabel: networkConfig.full_label,
        currency: networkConfig.display_currency,
        payCurrencyTicker: networkConfig.nowpayments_currency.toUpperCase(),
        deliveryMethod: selectedDeliveryMethod,
        workflowSubtotal,
        setupFee,
        couponCode: appliedCoupon?.code || null,
        couponDiscount,
        couponLabel: appliedCoupon?.discountLabel || null,
        totalUsd: finalTotal,
        payAmountCrypto,
        payAddress,
        addressVerified: true,
        verificationSource: 'nowpayments_api_double_verified',
        expiresAt: expiresAtStr,
        status: 'waiting',
        warning: `Send USDT on the ${networkConfig.full_label} network only. Sending other tokens or using a different network will result in permanent loss.`,
      },
    });
  } catch (err) {
    console.error('Checkout creation error:', err);
    return c.json({ success: false, error: 'Checkout could not be created. Please try again shortly.' }, 500);
  }
});

// POST /api/custom-request (Inbound Custom Automation Leads)
app.post('/custom-request', async (c) => {
  try {
    const db = c.env?.DB;
    if (!db) {
      return c.json({ success: false, error: 'Database service unavailable' }, 500);
    }

    let body;
    try {
      body = await c.req.json();
    } catch (parseErr) {
      return c.json({ success: false, error: 'Invalid JSON payload format' }, 400);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ success: false, error: 'Request body must be a JSON object' }, 400);
    }

    const { name, email, type, details } = body;

    // 1. Validate Full Name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ success: false, error: 'Full name is required' }, 400);
    }
    const cleanName = name.trim();
    if (cleanName.length > 100) {
      return c.json({ success: false, error: 'Name must not exceed 100 characters' }, 400);
    }

    // 2. Validate Email
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return c.json({ success: false, error: 'Email address is required' }, 400);
    }
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail) || cleanEmail.length > 254) {
      return c.json({ success: false, error: 'Please provide a valid email address' }, 400);
    }

    // 3. Validate Request Type Enum
    const cleanType = String(type || 'flow').trim().toLowerCase();
    if (!['flow', 'consulting'].includes(cleanType)) {
      return c.json({ success: false, error: "Service type must be 'flow' or 'consulting'" }, 400);
    }

    // 4. Validate Details / Requirements
    if (!details || typeof details !== 'string' || details.trim().length === 0) {
      return c.json({ success: false, error: 'Project requirements / details are required' }, 400);
    }
    const cleanDetails = details.trim();
    if (cleanDetails.length < 10) {
      return c.json({ success: false, error: 'Please provide at least 10 characters describing your project requirements' }, 400);
    }
    if (cleanDetails.length > 5000) {
      return c.json({ success: false, error: 'Project requirements must not exceed 5000 characters' }, 400);
    }

    // 5. Abuse / Rate Limiting Protection (Max 5 requests per IP in 15 minutes)
    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
    const ipHash = clientIp ? (await sha256Hex(clientIp)).slice(0, 32) : null;

    if (ipHash) {
      try {
        const recentAttempts = await db.prepare(`
          SELECT COUNT(*) as count FROM custom_automation_requests
          WHERE ip_hash = ? AND created_at > datetime('now', '-15 minutes')
        `).bind(ipHash).first();

        if (recentAttempts && recentAttempts.count >= 5) {
          return c.json({
            success: false,
            error: 'Too many requests submitted recently. Please wait a few minutes before submitting another request.',
          }, 429);
        }
      } catch (rateErr) {
        console.warn('Custom request rate limit check warning:', rateErr.message);
      }
    }

    // 6. Generate Opaque Reference ID (Non-authentication support reference)
    const requestId = 'req_' + generateSecureToken(6); // e.g. req_3f8a9e1b2c3d
    const initialNotificationStatus = c.env?.RESEND_API_KEY ? 'pending' : 'skipped';

    // 7. Authoritative D1 Lead Persistence (Data Minimized: zero user_agent, hashed IP)
    await db.prepare(`
      INSERT INTO custom_automation_requests (
        id, customer_name, customer_email, request_type, details,
        status, ip_hash, internal_notification_status
      ) VALUES (?, ?, ?, ?, ?, 'new', ?, ?)
    `).bind(
      requestId,
      cleanName,
      cleanEmail,
      cleanType,
      cleanDetails,
      ipHash,
      initialNotificationStatus
    ).run();

    // 8. Non-blocking Internal Email Notification (Choice A: Persistence is authoritative)
    let notificationStatus = 'skipped';
    let notificationError = null;

    if (c.env?.RESEND_API_KEY) {
      try {
        await sendCustomRequestNotificationEmail({
          resendApiKey: c.env.RESEND_API_KEY,
          requestId,
          name: cleanName,
          email: cleanEmail,
          requestType: cleanType,
          details: cleanDetails,
        });
        notificationStatus = 'sent';
      } catch (emailErr) {
        notificationStatus = 'failed';
        notificationError = String(emailErr?.message || 'Email dispatch failed')
          .replace(/re_[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]')
          .replace(/key-[a-zA-Z0-9_-]+/g, '[REDACTED_KEY]')
          .slice(0, 250);
        console.error('Custom request internal notification email warning:', notificationError);
      }

      // Record notification status update in D1
      try {
        await db.prepare(`
          UPDATE custom_automation_requests
          SET internal_notification_status = ?, internal_notification_error = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(notificationStatus, notificationError, requestId).run();
      } catch (updateErr) {
        console.warn('Failed to update notification status:', updateErr.message);
      }
    }

    return c.json({
      success: true,
      request_id: requestId,
      customer_email: cleanEmail,
      message: 'Your custom automation request has been received.',
    }, 200);
  } catch (err) {
    console.error('Custom request submission error:', err.message);
    return c.json({ success: false, error: 'An error occurred while saving your request. Please try again or contact support@geelarkflows.com.' }, 500);
  }
});

// POST /api/webhooks/crypto (NOWPayments IPN Callback)
app.post('/webhooks/crypto', async (c) => {
  try {
    // 1. Fail Closed: Server signing secret configuration check
    const secretKey = c.env?.CRYPTO_WEBHOOK_SECRET || c.env?.NOWPAYMENTS_IPN_SECRET;
    if (!secretKey || typeof secretKey !== 'string' || secretKey.trim().length === 0) {
      console.error('NOWPayments webhook rejected: missing server signing configuration.');
      return c.json({ success: false, error: 'Server webhook signing configuration missing.' }, 500);
    }

    // 2. Fail Closed: Signature header presence check
    const headerSig = c.req.header('x-nowpayments-sig');
    if (!headerSig || typeof headerSig !== 'string' || headerSig.trim().length === 0) {
      console.warn('NOWPayments webhook rejected: missing signature header.');
      return c.json({ success: false, error: 'Missing x-nowpayments-sig signature header.' }, 401);
    }

    // 3. Parse JSON Body
    const rawBody = await c.req.text();
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseErr) {
      return c.json({ success: false, error: 'Invalid JSON payload' }, 400);
    }

    // 4. Fail Closed: HMAC-SHA512 Signature verification
    const isValid = await verifyNowPaymentsSignature(payload, headerSig.trim(), secretKey.trim());
    if (!isValid) {
      console.warn('NOWPayments webhook rejected: invalid signature.');
      return c.json({ success: false, error: 'Invalid HMAC signature.' }, 401);
    }

    const {
      payment_id,
      payment_status,
      order_id,
      outcome_tx_hash,
      txid,
    } = payload;

    const normalizedStatus = String(payment_status || '').toLowerCase();
    const finalTxHash = outcome_tx_hash || txid || null;

    const db = c.env?.DB;
    if (!db || !order_id || !payment_id || !normalizedStatus) {
      return c.json({ success: false, error: 'Webhook is missing required invoice identifiers or status.' }, 400);
    }

    const paymentRec = await db.prepare(
      `SELECT id, order_id, currency, network_id, provider_currency, pay_address, status,
              pay_amount_crypto, pay_amount_crypto_text, expected_price_usd_cents
       FROM crypto_payments WHERE id = ? AND order_id = ?`
    ).bind(String(payment_id), String(order_id)).first();

    const orderRec = await db.prepare(
      `SELECT id, customer_email, status, items, total_usd, total_usd_cents,
               delivery_method, workflow_subtotal, setup_fee, fulfillment_status,
               coupon_code, coupon_discount_usd
       FROM orders WHERE id = ?`
    ).bind(String(order_id)).first();

    if (!paymentRec || !orderRec) {
      console.warn(`NOWPayments event did not match a stored invoice: order=${order_id}, payment=${payment_id}`);
      return c.json({ success: true, status: 'ignored_unmatched_invoice' });
    }

    const derivedState = deriveOrderStateFromPayment({
      orderStatus: orderRec.status,
      fulfillmentStatus: orderRec.fulfillment_status,
      paymentStatus: normalizedStatus,
      deliveryMethod: orderRec.delivery_method,
    });

    if (CONFIRMED_PROVIDER_STATUSES.has(normalizedStatus)) {
      const reconciliation = reconcileProviderPayment(payload, paymentRec, orderRec);
      if (!reconciliation.valid) {
        await db.prepare(
          `UPDATE crypto_payments
           SET status = 'review_required', verification_source = 'reconciliation_failed', updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND order_id = ?`
        ).bind(paymentRec.id, orderRec.id).run();
        console.error(`NOWPayments reconciliation failed for ${orderRec.id}: ${reconciliation.reason}`);
        return c.json({ success: true, status: 'manual_review' });
      }

      await db.batch([
        db.prepare(
          `UPDATE crypto_payments
           SET status = ?, tx_hash = ?, verification_source = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND order_id = ?`
        ).bind(normalizedStatus, finalTxHash, 'nowpayments_ipn', paymentRec.id, orderRec.id),
        db.prepare(
          `UPDATE orders SET status = ?, fulfillment_status = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).bind(derivedState.orderStatus, derivedState.fulfillmentStatus, orderRec.id),
      ]);

      if (derivedState.changed) {
        await recordAuditLog(db, {
          adminEmail: 'system:nowpayments',
          action: 'ORDER_STATUS_RECONCILED',
          entityType: 'order',
          entityId: orderRec.id,
          previousState: orderRec.status,
          newState: derivedState.orderStatus,
          reason: `NOWPayments reported ${normalizedStatus}`,
          metadata: { paymentId: paymentRec.id, source: 'webhook' },
        });
      }

      if (!SETTLED_ORDER_STATUSES.has(orderRec.status) && derivedState.orderStatus === 'paid') {
        let parsedItems = [];
        try {
          parsedItems = JSON.parse(orderRec.items || '[]');
        } catch (e) {}

        const idempotencyKey = `payment_confirmation_${orderRec.id}_${paymentRec.id}`;
        const logId = 'fl_' + generateSecureToken(8);
        let reserved = false;

        try {
          await db.prepare(
            `INSERT INTO order_fulfillment_logs
             (id, order_id, idempotency_key, triggered_by, recipient_email, status)
             VALUES (?, ?, ?, ?, ?, 'sending')`
          ).bind(logId, orderRec.id, idempotencyKey, 'system_webhook', orderRec.customer_email).run();
          reserved = true;
        } catch (reserveErr) {
          console.info(`Duplicate payment confirmation suppressed for ${orderRec.id}.`);
        }

        if (reserved) {
          try {
            await sendPaymentConfirmationEmail({
              resendApiKey: c.env.RESEND_API_KEY,
              customerEmail: orderRec.customer_email,
              orderId: orderRec.id,
              networkLabel: paymentRec.currency,
              items: parsedItems,
              deliveryMethod: orderRec.delivery_method || 'download_package',
              workflowSubtotal: orderRec.workflow_subtotal || orderRec.total_usd,
              setupFee: orderRec.setup_fee || 0,
              couponCode: orderRec.coupon_code || null,
              couponDiscount: orderRec.coupon_discount_usd || 0,
              totalUsd: orderRec.total_usd,
            });
            await db.prepare(
              `UPDATE order_fulfillment_logs SET status = 'dispatched', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
            ).bind(logId).run();
          } catch (emailErr) {
            console.error('Automated payment confirmation email failure:', emailErr.message);
            await db.prepare(
              `UPDATE order_fulfillment_logs
               SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
            ).bind(emailErr.message, logId).run();
          }
        }
      }
    } else {
      const allowedProviderStatuses = ['waiting', 'confirming', 'sending', 'partially_paid', 'failed', 'expired', 'refunded'];
      if (allowedProviderStatuses.includes(normalizedStatus)) {
        const updates = [
          db.prepare(
            `UPDATE crypto_payments SET status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND order_id = ?`
          ).bind(normalizedStatus, paymentRec.id, orderRec.id),
        ];
        if (derivedState.changed) {
          updates.push(
            db.prepare('UPDATE orders SET status = ?, fulfillment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .bind(derivedState.orderStatus, derivedState.fulfillmentStatus, orderRec.id)
          );
        }
        await db.batch(updates);
        if (derivedState.changed) {
          await recordAuditLog(db, {
            adminEmail: 'system:nowpayments',
            action: 'ORDER_STATUS_RECONCILED',
            entityType: 'order',
            entityId: orderRec.id,
            previousState: orderRec.status,
            newState: derivedState.orderStatus,
            reason: `NOWPayments reported ${normalizedStatus}`,
            metadata: { paymentId: paymentRec.id, source: 'webhook' },
          });
        }
      }
    }

    return c.json({ success: true, status: 'processed' });
  } catch (err) {
    console.error('NOWPayments webhook processing error:', err.message);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// POST /api/webhooks/resend (Resend Inbound Email Receiving)
app.post('/webhooks/resend', async (c) => {
  try {
    // 1. Fail Closed: Server signing secret configuration check
    const webhookSecret = c.env?.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret || typeof webhookSecret !== 'string' || webhookSecret.trim().length === 0) {
      console.error('Resend webhook rejected: missing server signing configuration.');
      return c.json({ success: false, error: 'Server webhook signing configuration missing.' }, 500);
    }

    // 2. Fail Closed: Svix header presence check
    const svixId = c.req.header('svix-id');
    const svixTimestamp = c.req.header('svix-timestamp');
    const svixSignature = c.req.header('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.warn('Resend webhook rejected: missing required Svix headers.');
      return c.json({ success: false, error: 'Missing required Svix signature headers (svix-id, svix-timestamp, svix-signature).' }, 401);
    }

    const svixHeaders = {
      'svix-id': svixId.trim(),
      'svix-timestamp': svixTimestamp.trim(),
      'svix-signature': svixSignature.trim(),
    };

    // 3. Fail Closed: Svix HMAC-SHA256 Signature verification
    const rawBody = await c.req.text();
    const isValid = await verifyResendWebhookSignature(rawBody, svixHeaders, webhookSecret.trim());
    if (!isValid) {
      console.warn('Resend webhook rejected: invalid Svix signature.');
      return c.json({ success: false, error: 'Invalid Svix webhook signature.' }, 401);
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseErr) {
      return c.json({ success: false, error: 'Invalid JSON payload' }, 400);
    }

    const eventType = payload.type || 'email.received';
    const emailData = payload.data || payload;

    // Extract Resend Provider Email ID
    const providerEmailId = emailData.email_id || emailData.id || emailData.message_id || `resend_${Date.now()}_${generateSecureToken(4)}`;
    const db = c.env?.DB;

    if (db) {
      // 1. Idempotency check: Deduplicate
      const existing = await db.prepare('SELECT id FROM inbound_emails WHERE provider_email_id = ?').bind(providerEmailId).first();
      if (existing) {
        return c.json({ success: true, status: 'already_processed', id: existing.id });
      }

      // 2. Parse Sender and Initial Metadata
      let rawFrom = emailData.from || 'Unknown Sender';
      let subject = emailData.subject || '(No Subject)';
      let textBody = emailData.text || '';
      let htmlBody = emailData.html || '';
      let headers = emailData.headers || {};
      let attachments = Array.isArray(emailData.attachments) ? emailData.attachments : [];

      // 3. If body is missing, fetch full content from Resend Receiving API
      if ((!textBody && !htmlBody) && c.env?.RESEND_API_KEY && providerEmailId) {
        try {
          const resendDetails = await fetchInboundEmailFromResend(c.env.RESEND_API_KEY, providerEmailId);
          if (resendDetails) {
            textBody = resendDetails.text || textBody;
            htmlBody = resendDetails.html || htmlBody;
            if (resendDetails.from && rawFrom === 'Unknown Sender') rawFrom = resendDetails.from;
            if (resendDetails.subject && subject === '(No Subject)') subject = resendDetails.subject;
            if (resendDetails.headers) headers = { ...headers, ...resendDetails.headers };
            if (Array.isArray(resendDetails.attachments) && resendDetails.attachments.length > 0) {
              attachments = resendDetails.attachments;
            }
          }
        } catch (fetchErr) {
          console.warn('Resend inbound email detail fetch warning:', fetchErr.message);
        }
      }

      let fromName = null;
      let fromAddress = rawFrom;
      const fromMatch = rawFrom.match(/^(.*?)\s*<([^>]+)>$/);
      if (fromMatch) {
        fromName = fromMatch[1].replace(/["']/g, '').trim();
        fromAddress = fromMatch[2].trim();
      }

      const toAddresses = Array.isArray(emailData.to) ? emailData.to : [emailData.to || 'support@geelarkflows.com'];
      const ccAddresses = Array.isArray(emailData.cc) ? emailData.cc : [];
      const replyTo = Array.isArray(emailData.reply_to) ? emailData.reply_to[0] : (emailData.reply_to || fromAddress);

      const messageId = headers['message-id'] || emailData.message_id || null;
      const inReplyTo = headers['in-reply-to'] || emailData.in_reply_to || null;
      const referencesHeader = headers['references'] || emailData.references || null;

      // 4. Deterministic Order Matching
      const matched = await matchOrderForInboundEmail(db, fromAddress, subject, textBody, htmlBody);
      const emailId = 'msg_' + generateSecureToken(8);
      const receivedAtStr = emailData.created_at || new Date().toISOString();

      // 5. Insert into inbound_emails
      await db.prepare(`
        INSERT INTO inbound_emails (
          id, provider_email_id, message_id, in_reply_to, references_header,
          from_address, from_name, to_addresses, cc_addresses, reply_to,
          subject, text_body, html_body, received_at, is_read, is_archived,
          order_id, customer_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
      `).bind(
        emailId,
        providerEmailId,
        messageId,
        inReplyTo,
        referencesHeader,
        fromAddress,
        fromName,
        JSON.stringify(toAddresses),
        JSON.stringify(ccAddresses),
        replyTo,
        subject,
        textBody,
        htmlBody,
        receivedAtStr,
        matched.orderId,
        matched.customerEmail
      ).run();

      // 6. Store Attachments Metadata
      for (const att of attachments) {
        const attId = 'att_' + generateSecureToken(8);
        await db.prepare(`
          INSERT INTO email_attachments (id, inbound_email_id, provider_attachment_id, filename, content_type, size_bytes, storage_reference)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          attId,
          emailId,
          att.id || null,
          att.filename || 'attachment',
          att.content_type || 'application/octet-stream',
          att.size || 0,
          att.download_url || null
        ).run();
      }

      await recordAuditLog(db, {
        action: 'INBOUND_EMAIL_RECEIVED',
        entityType: 'mail',
        entityId: emailId,
        metadata: {
          from: fromAddress,
          subject,
          matchedOrderId: matched.orderId,
        },
      });

      return c.json({ success: true, id: emailId, order_id: matched.orderId });
    }

    return c.json({ success: true, status: 'received_no_db' });
  } catch (err) {
    console.error('Resend inbound webhook error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// GET /api/checkout/status/:id
app.get('/checkout/status/:id', async (c) => {
  c.header('Cache-Control', 'no-store, private');
  c.header('Pragma', 'no-cache');
  c.header('X-Content-Type-Options', 'nosniff');

  try {
    const db = c.env?.DB;
    if (!db) {
      return c.json({ success: false, error: 'Payment status is temporarily unavailable.' }, 503);
    }

    const id = c.req.param('id');
    const statusToken = c.req.header('x-checkout-token');
    if (!id || !statusToken || statusToken.length < 32 || statusToken.length > 256) {
      return c.json({ success: false, error: 'Payment status not found.' }, 404);
    }

    const payment = await db.prepare(
      `SELECT id, order_id, currency, network_id, provider_currency, pay_address,
              COALESCE(pay_amount_crypto_text, CAST(pay_amount_crypto AS TEXT)) AS pay_amount_crypto,
              status, tx_hash, confirmations, required_confirmations
       FROM crypto_payments WHERE id = ? OR order_id = ?`
    ).bind(id, id).first();

    if (!payment) {
      return c.json({ success: false, error: 'Payment status not found.' }, 404);
    }

    const order = await db.prepare(
      `SELECT id, status, total_usd, total_usd_cents, delivery_method, workflow_subtotal,
               workflow_subtotal_cents, setup_fee, setup_fee_cents, coupon_code,
               coupon_discount_usd, coupon_discount_cents, fulfillment_status, status_token_hash
       FROM orders WHERE id = ?`
    ).bind(payment.order_id).first();

    const suppliedTokenHash = await sha256Hex(statusToken);
    if (!order?.status_token_hash || !constantTimeCompare(suppliedTokenHash, order.status_token_hash)) {
      return c.json({ success: false, error: 'Payment status not found.' }, 404);
    }

    if (!(await enforceCheckoutStatusRateLimit(db, suppliedTokenHash))) {
      c.header('Retry-After', '60');
      return c.json({ success: false, error: 'Too many status checks. Please wait before trying again.' }, 429);
    }

    const resolvedNetwork = resolvePaymentNetwork(payment.network_id || payment.provider_currency || payment.currency);
    if (!resolvedNetwork) {
      return c.json({ success: false, error: 'Stored payment network is invalid. Please contact support.' }, 500);
    }

    const currentStatus = payment.status || 'waiting';
    const orderStatus = order.status || 'awaiting_payment';
    const isConfirmed = ['confirmed', 'finished', 'paid'].includes(String(currentStatus).toLowerCase())
      || ['paid', 'processing', 'completed'].includes(orderStatus);
    const totalUsd = Number.isInteger(order.total_usd_cents)
      ? order.total_usd_cents / 100
      : Number(order.total_usd || 0);
    const workflowSubtotal = Number.isInteger(order.workflow_subtotal_cents)
      ? order.workflow_subtotal_cents / 100
      : Number(order.workflow_subtotal || totalUsd);
    const setupFee = Number.isInteger(order.setup_fee_cents)
      ? order.setup_fee_cents / 100
      : Number(order.setup_fee || 0);
    const couponDiscount = Number.isInteger(order.coupon_discount_cents)
      ? order.coupon_discount_cents / 100
      : Number(order.coupon_discount_usd || 0);

    return c.json({
      success: true,
      data: {
        id,
        orderId: order.id,
        paymentId: payment.id,
        status: currentStatus,
        orderStatus,
        isConfirmed,
        txHash: payment.tx_hash || null,
        asset: 'USDT',
        network: resolvedNetwork.id,
        networkLabel: resolvedNetwork.network,
        blockchain: resolvedNetwork.blockchain,
        fullNetworkLabel: resolvedNetwork.full_label,
        currency: resolvedNetwork.display_currency,
        payCurrency: resolvedNetwork.nowpayments_currency.toUpperCase(),
        deliveryMethod: order.delivery_method || 'download_package',
        workflowSubtotal,
        setupFee,
        couponCode: order.coupon_code || null,
        couponDiscount,
        totalUsd,
        payAmount: payment.pay_amount_crypto,
        payAddress: payment.pay_address,
        fulfillmentStatus: order.fulfillment_status || 'not_ready',
        confirmations: Number(payment.confirmations || (isConfirmed ? 2 : 0)),
        requiredConfirmations: Number(payment.required_confirmations || 2),
      },
    });
  } catch (routeErr) {
    console.error('Status route unhandled error:', routeErr);
    return c.json({ success: false, error: 'Payment status is temporarily unavailable.' }, 500);
  }
});

// GET /api/downloads/:token/:productId — private, expiring R2 delivery
app.get('/downloads/:token/:productId', async (c) => {
  c.header('Cache-Control', 'no-store, private');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Content-Type-Options', 'nosniff');

  const db = c.env?.DB;
  const bucket = c.env?.FLOWS_BUCKET;
  if (!db || !bucket) {
    return c.json({ success: false, error: 'Secure downloads are temporarily unavailable.' }, 503);
  }

  try {
    const rawToken = c.req.param('token');
    const productId = c.req.param('productId');
    if (!/^[a-f0-9]{64}$/i.test(rawToken || '') || !AUTHORITATIVE_CATALOG_MAP.has(productId)) {
      return c.json({ success: false, error: 'Download not found or expired.' }, 404);
    }

    const tokenHash = await sha256Hex(rawToken);
    const delivery = await db.prepare(
      `SELECT t.id AS token_id, t.order_id, o.items, o.status
       FROM order_download_tokens t
       JOIN orders o ON o.id = t.order_id
       WHERE t.token_hash = ?
         AND t.revoked_at IS NULL
         AND t.expires_at > CURRENT_TIMESTAMP`
    ).bind(tokenHash).first();

    if (!delivery || !['paid', 'processing', 'completed'].includes(delivery.status)) {
      return c.json({ success: false, error: 'Download not found or expired.' }, 404);
    }

    let purchasedItems = [];
    try {
      purchasedItems = JSON.parse(delivery.items || '[]');
    } catch (e) {}

    if (!purchasedItems.some((item) => item.id === productId)) {
      return c.json({ success: false, error: 'Download not found or expired.' }, 404);
    }

    const assetKey = getFlowAssetKey(productId);
    const object = await bucket.get(assetKey);
    if (!object) {
      console.error(`Purchased R2 asset is missing: ${assetKey}, order=${delivery.order_id}`);
      return c.json({ success: false, error: 'This flow is temporarily unavailable. Support has been notified.' }, 503);
    }

    await db.prepare(
      `UPDATE order_download_tokens
       SET download_count = download_count + 1, last_downloaded_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(delivery.token_id).run();

    const safeFilename = `${productId}.zip`;
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Content-Type', headers.get('Content-Type') || 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="${safeFilename}"`);
    headers.set('Cache-Control', 'no-store, private');
    headers.set('Referrer-Policy', 'no-referrer');
    headers.set('X-Content-Type-Options', 'nosniff');
    if (object.size) headers.set('Content-Length', String(object.size));

    return new Response(object.body, { status: 200, headers });
  } catch (err) {
    console.error('Secure download error:', err.message);
    return c.json({ success: false, error: 'Secure download could not be completed.' }, 500);
  }
});

// ----------------------------------------------------
// PRIVACY-CONSCIOUS STOREFRONT ANALYTICS
// ----------------------------------------------------

// POST /api/analytics/events
app.post('/analytics/events', async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Analytics unavailable.' }, 503);

  try {
    const body = await c.req.json();
    const eventType = String(body?.event_type || '');
    const visitorId = String(body?.visitor_id || '');
    const sessionId = String(body?.session_id || '');
    const eventId = String(body?.event_id || '');
    const productId = body?.product_id ? String(body.product_id) : null;
    const validClientId = (value) => /^[a-zA-Z0-9_-]{16,80}$/.test(value);

    if (!['page_view', 'cart_add'].includes(eventType)
      || !validClientId(visitorId)
      || !validClientId(sessionId)
      || !validClientId(eventId)) {
      return c.json({ success: false, error: 'Invalid analytics event.' }, 400);
    }

    if (eventType === 'cart_add' && (!productId || !AUTHORITATIVE_CATALOG_MAP.has(productId))) {
      return c.json({ success: false, error: 'Unknown storefront flow.' }, 400);
    }

    const pagePath = normalizeAnalyticsPath(body?.page_path);
    const visitorHash = await sha256Hex(`storefront-visitor:v1:${visitorId}`);
    const sessionHash = await sha256Hex(`storefront-session:v1:${sessionId}`);
    const dedupeMaterial = eventType === 'page_view'
      ? `${visitorHash}|${sessionHash}|${eventType}|${pagePath}`
      : `${visitorHash}|${eventType}|${eventId}`;
    const dedupeKey = await sha256Hex(dedupeMaterial);

    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
    const analyticsSecret = c.env?.ANALYTICS_HASH_SALT || c.env?.ADMIN_BOOTSTRAP_SECRET || '';
    const ipHash = analyticsSecret
      ? await hmacSha256Hex(analyticsSecret, `storefront-analytics-ip:v1:${clientIp}`)
      : null;

    const rateQuery = ipHash
      ? 'SELECT COUNT(*) AS count FROM storefront_analytics_events WHERE (visitor_hash = ? OR ip_hash = ?) AND created_at > datetime(\'now\', \'-10 minutes\')'
      : 'SELECT COUNT(*) AS count FROM storefront_analytics_events WHERE visitor_hash = ? AND created_at > datetime(\'now\', \'-10 minutes\')';
    const recentCount = ipHash
      ? await db.prepare(rateQuery).bind(visitorHash, ipHash).first()
      : await db.prepare(rateQuery).bind(visitorHash).first();
    if (Number(recentCount?.count || 0) >= 100) {
      return c.json({ success: false, error: 'Analytics rate limit exceeded.' }, 429);
    }

    const cf = c.req.raw?.cf || {};
    const { deviceType, browserFamily, osFamily } = classifyUserAgent(c.req.header('user-agent'));
    const eventRecordId = 'evt_' + generateSecureToken(12);
    const result = await db.prepare(`
      INSERT OR IGNORE INTO storefront_analytics_events
        (id, dedupe_key, event_type, visitor_hash, session_hash, product_id, page_path,
         referrer_host, ip_hash, ip_network, country_code, region, city,
         device_type, browser_family, os_family)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      eventRecordId,
      dedupeKey,
      eventType,
      visitorHash,
      sessionHash,
      productId,
      pagePath,
      getAnalyticsReferrerHost(c.req.url, body?.landing_referrer_host, c.req.header('referer')),
      ipHash,
      maskIpNetwork(clientIp),
      String(cf.country || c.req.header('cf-ipcountry') || '').slice(0, 2).toUpperCase() || null,
      String(cf.region || '').slice(0, 80) || null,
      String(cf.city || '').slice(0, 80) || null,
      deviceType,
      browserFamily,
      osFamily,
    ).run();

    // Enforce rolling retention whenever analytics receives traffic.
    await db.prepare("DELETE FROM storefront_analytics_events WHERE created_at < datetime('now', '-90 days')")
      .run()
      .catch(() => {});

    return c.json({ success: true, recorded: Number(result?.meta?.changes || result?.changes || 0) > 0 }, 202);
  } catch (err) {
    console.error('Storefront analytics error:', err);
    return c.json({ success: false, error: 'Analytics event could not be recorded.' }, 500);
  }
});

// POST /api/analytics/cart-state — keeps a privacy-conscious last-known cart
// snapshot so removals and cleared carts are reflected in the admin dashboard.
app.post('/analytics/cart-state', async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Analytics unavailable.' }, 503);

  try {
    const body = await c.req.json();
    const visitorId = String(body?.visitor_id || '');
    const sessionId = String(body?.session_id || '');
    const eventId = String(body?.event_id || '');
    const validClientId = (value) => /^[a-zA-Z0-9_-]{16,80}$/.test(value);
    const rawProductIds = Array.isArray(body?.product_ids) ? body.product_ids : null;

    if (!validClientId(visitorId) || !validClientId(sessionId) || !validClientId(eventId)
      || !rawProductIds || rawProductIds.length > 25) {
      return c.json({ success: false, error: 'Invalid cart analytics state.' }, 400);
    }

    const productIds = [...new Set(rawProductIds.map((value) => String(value || '').trim()).filter(Boolean))];
    if (productIds.length !== rawProductIds.length
      || productIds.some((productId) => !AUTHORITATIVE_CATALOG_MAP.has(productId))) {
      return c.json({ success: false, error: 'Unknown storefront flow in cart.' }, 400);
    }

    const visitorHash = await sha256Hex(`storefront-visitor:v1:${visitorId}`);
    const sessionHash = await sha256Hex(`storefront-session:v1:${sessionId}`);
    const pagePath = normalizeAnalyticsPath(body?.page_path);
    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
    const cf = c.req.raw?.cf || {};
    const { deviceType, browserFamily, osFamily } = classifyUserAgent(c.req.header('user-agent'));
    const cartValueCents = productIds.reduce(
      (sum, productId) => sum + Math.round(AUTHORITATIVE_CATALOG_MAP.get(productId).price * 100),
      0,
    );

    await db.prepare(`
      INSERT INTO storefront_cart_state
        (visitor_hash, session_hash, product_ids_json, item_count, cart_value_cents,
         page_path, referrer_host, ip_network, country_code, region, city,
         device_type, browser_family, os_family)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(visitor_hash) DO UPDATE SET
        session_hash = excluded.session_hash,
        product_ids_json = excluded.product_ids_json,
        item_count = excluded.item_count,
        cart_value_cents = excluded.cart_value_cents,
        page_path = excluded.page_path,
        referrer_host = COALESCE(excluded.referrer_host, storefront_cart_state.referrer_host),
        ip_network = excluded.ip_network,
        country_code = excluded.country_code,
        region = excluded.region,
        city = excluded.city,
        device_type = excluded.device_type,
        browser_family = excluded.browser_family,
        os_family = excluded.os_family,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      visitorHash,
      sessionHash,
      JSON.stringify(productIds),
      productIds.length,
      cartValueCents,
      pagePath,
      getAnalyticsReferrerHost(c.req.url, body?.landing_referrer_host, c.req.header('referer')),
      maskIpNetwork(clientIp),
      String(cf.country || c.req.header('cf-ipcountry') || '').slice(0, 2).toUpperCase() || null,
      String(cf.region || '').slice(0, 80) || null,
      String(cf.city || '').slice(0, 80) || null,
      deviceType,
      browserFamily,
      osFamily,
    ).run();

    await db.prepare("DELETE FROM storefront_cart_state WHERE updated_at < datetime('now', '-90 days')")
      .run()
      .catch(() => {});

    return c.json({ success: true, recorded: true }, 202);
  } catch (err) {
    console.error('Storefront cart-state analytics error:', err);
    return c.json({ success: false, error: 'Cart analytics state could not be recorded.' }, 500);
  }
});

// Browser Push opt-in. Permission is requested by the client only after a
// visitor presses the explicit enable button; this endpoint never prompts.
app.get('/push/config', async (c) => c.json({
  success: true,
  enabled: webPushConfigured(c.env),
  public_key: webPushConfigured(c.env) ? c.env.VAPID_PUBLIC_KEY : null,
}));

app.post('/push/subscribe', async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Push subscriptions are temporarily unavailable.' }, 503);
  if (!webPushConfigured(c.env)) return c.json({ success: false, error: 'Browser push is not configured.' }, 503);
  try {
    const body = await c.req.json().catch(() => null);
    const visitorId = body?.visitor_id;
    const subscription = normalizeWebPushSubscription(body?.subscription);
    if (!validStorefrontClientId(visitorId) || !subscription) {
      return c.json({ success: false, error: 'Invalid browser push subscription.' }, 400);
    }

    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
    const ipHash = await sha256Hex(`push-subscribe:v1:${clientIp}`);
    if (!(await enforcePushSubscriptionRateLimit(db, ipHash))) {
      return c.json({ success: false, error: 'Too many push subscription attempts. Please try again later.' }, 429);
    }

    const visitorHash = await sha256Hex(`storefront-visitor:v1:${visitorId}`);
    const endpointHash = await sha256Hex(`push-endpoint:v1:${subscription.endpoint}`);
    const existing = await db.prepare('SELECT id FROM storefront_push_subscriptions WHERE endpoint_hash = ?')
      .bind(endpointHash).first();
    const subscriptionId = existing?.id || `psh_${generateSecureToken(10)}`;

    await db.prepare(`
      INSERT INTO storefront_push_subscriptions
        (id, endpoint_hash, endpoint, p256dh_key, auth_key, visitor_hash, active, failure_count, revoked_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 0, NULL, CURRENT_TIMESTAMP)
      ON CONFLICT(endpoint_hash) DO UPDATE SET
        endpoint = excluded.endpoint,
        p256dh_key = excluded.p256dh_key,
        auth_key = excluded.auth_key,
        visitor_hash = excluded.visitor_hash,
        active = 1,
        failure_count = 0,
        revoked_at = NULL,
        last_seen_at = CURRENT_TIMESTAMP
    `).bind(
      subscriptionId,
      endpointHash,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
      visitorHash,
    ).run();

    return c.json({ success: true, subscribed: true });
  } catch (err) {
    console.error('Browser push subscription error:', err.message);
    return c.json({ success: false, error: 'Browser push could not be enabled.' }, 500);
  }
});

app.post('/push/unsubscribe', async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Push subscriptions are temporarily unavailable.' }, 503);
  try {
    const body = await c.req.json().catch(() => null);
    const visitorId = body?.visitor_id;
    const endpoint = String(body?.endpoint || '').trim();
    if (!validStorefrontClientId(visitorId) || !isTrustedWebPushEndpoint(endpoint)) {
      return c.json({ success: false, error: 'Invalid browser push subscription.' }, 400);
    }
    const visitorHash = await sha256Hex(`storefront-visitor:v1:${visitorId}`);
    const endpointHash = await sha256Hex(`push-endpoint:v1:${endpoint}`);
    await db.prepare(`
      UPDATE storefront_push_subscriptions
      SET active = 0, revoked_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP
      WHERE endpoint_hash = ? AND visitor_hash = ?
    `).bind(endpointHash, visitorHash).run();
    return c.json({ success: true, subscribed: false });
  } catch (err) {
    console.error('Browser push unsubscribe error:', err.message);
    return c.json({ success: false, error: 'Browser push could not be disabled.' }, 500);
  }
});

async function sendBrowserPushCampaign(db, env, notificationId) {
  if (!webPushConfigured(env)) return { sent: 0, failed: 0, gone: 0, skipped: 0 };
  const campaign = await db.prepare(`
    SELECT n.*, c.code AS coupon_code
    FROM storefront_notifications n
    LEFT JOIN coupon_codes c ON c.id = n.coupon_id
    WHERE n.id = ? AND n.push_enabled = 1 AND n.active = 1
  `).bind(notificationId).first();
  if (!campaign) return { sent: 0, failed: 0, gone: 0, skipped: 0 };

  const subscriptionRows = await db.prepare(`
    SELECT s.*, cs.product_ids_json, cs.item_count, cs.updated_at AS cart_updated_at
    FROM storefront_push_subscriptions s
    LEFT JOIN storefront_cart_state cs
      ON cs.visitor_hash = s.visitor_hash
      AND cs.updated_at > datetime('now', '-30 days')
    WHERE s.active = 1
    ORDER BY s.last_seen_at DESC
    LIMIT 500
  `).all();

  const eligible = (subscriptionRows?.results || []).filter((subscription) => {
    if (campaign.audience_type === 'active_cart') return Number(subscription.item_count || 0) > 0;
    if (campaign.audience_type === 'product_cart') {
      try {
        const productIds = JSON.parse(subscription.product_ids_json || '[]');
        return Array.isArray(productIds) && productIds.includes(campaign.product_id);
      } catch {
        return false;
      }
    }
    return true;
  });

  const stats = { sent: 0, failed: 0, gone: 0, skipped: 0 };
  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  let pushDestination = normalizeInternalCtaUrl(campaign.cta_url, campaign.coupon_code ? '/checkout' : '/') || '/';
  if (campaign.coupon_code && pushDestination.startsWith('/checkout')) {
    const separator = pushDestination.includes('?') ? '&' : '?';
    pushDestination = `${pushDestination}${separator}coupon=${encodeURIComponent(campaign.coupon_code)}`;
  }
  const pushData = JSON.stringify({
    title: campaign.title,
    body: campaign.message,
    url: pushDestination,
    couponCode: campaign.coupon_code || null,
    notificationId: campaign.id,
    tag: `geelark-${campaign.id}`,
  });

  const deliver = async (subscription) => {
    const deliveryId = `psd_${generateSecureToken(10)}`;
    const claimed = await db.prepare(`
      INSERT OR IGNORE INTO storefront_push_deliveries
        (id, notification_id, subscription_id, status)
      VALUES (?, ?, ?, 'pending')
    `).bind(deliveryId, campaign.id, subscription.id).run();
    const changes = Number(claimed?.meta?.changes ?? claimed?.changes ?? 0);
    if (changes === 0) {
      stats.skipped += 1;
      return;
    }

    try {
      const request = await buildPushPayload({ data: pushData, options: { ttl: 86400 } }, {
        endpoint: subscription.endpoint,
        expirationTime: null,
        keys: { p256dh: subscription.p256dh_key, auth: subscription.auth_key },
      }, vapid);
      const response = await fetch(subscription.endpoint, request);
      if (response.ok) {
        stats.sent += 1;
        await db.prepare(`
          UPDATE storefront_push_deliveries
          SET status = 'sent', response_status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(response.status, deliveryId).run();
        await db.prepare(`
          UPDATE storefront_push_subscriptions
          SET last_success_at = CURRENT_TIMESTAMP, failure_count = 0
          WHERE id = ?
        `).bind(subscription.id).run();
        return;
      }

      const gone = response.status === 404 || response.status === 410;
      stats[gone ? 'gone' : 'failed'] += 1;
      await db.prepare(`
        UPDATE storefront_push_deliveries
        SET status = ?, response_status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(gone ? 'gone' : 'failed', response.status, `Push service returned HTTP ${response.status}.`, deliveryId).run();
      await db.prepare(`
        UPDATE storefront_push_subscriptions
        SET active = CASE WHEN ? = 1 THEN 0 ELSE active END,
            revoked_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE revoked_at END,
            failure_count = failure_count + 1
        WHERE id = ?
      `).bind(gone ? 1 : 0, gone ? 1 : 0, subscription.id).run();
    } catch (err) {
      stats.failed += 1;
      console.error('Browser push delivery error:', err.message);
      await db.prepare(`
        UPDATE storefront_push_deliveries
        SET status = 'failed', error_message = 'Push encryption or delivery failed.', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(deliveryId).run();
      await db.prepare('UPDATE storefront_push_subscriptions SET failure_count = failure_count + 1 WHERE id = ?')
        .bind(subscription.id).run();
    }
  };

  for (let index = 0; index < eligible.length; index += 10) {
    await Promise.all(eligible.slice(index, index + 10).map(deliver));
  }
  await db.prepare('UPDATE storefront_notifications SET push_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(campaign.id).run();
  await db.prepare("DELETE FROM storefront_push_deliveries WHERE created_at < datetime('now', '-90 days')").run().catch(() => {});
  await db.prepare("DELETE FROM storefront_push_subscriptions WHERE active = 0 AND revoked_at < datetime('now', '-90 days')").run().catch(() => {});
  return stats;
}

// GET /api/notifications — anonymous, first-party in-site notification feed.
app.get('/notifications', async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Notifications are temporarily unavailable.' }, 503);

  try {
    const visitorId = c.req.query('visitor_id');
    if (!validStorefrontClientId(visitorId)) {
      return c.json({ success: false, error: 'A valid storefront visitor identifier is required.' }, 400);
    }

    const visitorHash = await sha256Hex(`storefront-visitor:v1:${visitorId}`);
    const cartState = await db.prepare(`
      SELECT product_ids_json, item_count, updated_at
      FROM storefront_cart_state
      WHERE visitor_hash = ?
        AND updated_at > datetime('now', '-30 days')
    `).bind(visitorHash).first();
    let productIds = [];
    try {
      productIds = cartState ? JSON.parse(cartState.product_ids_json || '[]') : [];
    } catch {
      productIds = [];
    }
    const cartProductIds = new Set(Array.isArray(productIds) ? productIds : []);
    const hasActiveCart = Number(cartState?.item_count || 0) > 0;

    const rows = await db.prepare(`
      SELECT n.*,
             c.code AS coupon_code,
             c.active AS coupon_active,
             c.starts_at AS coupon_starts_at,
             c.expires_at AS coupon_expires_at,
             c.max_redemptions AS coupon_max_redemptions,
             (SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id = c.id) AS coupon_redemptions,
             r.read_at,
             r.dismissed_at
      FROM storefront_notifications n
      LEFT JOIN coupon_codes c ON c.id = n.coupon_id
      LEFT JOIN storefront_notification_receipts r
        ON r.notification_id = n.id AND r.visitor_hash = ?
      WHERE n.active = 1
        AND (n.starts_at IS NULL OR datetime(n.starts_at) <= datetime('now'))
        AND (n.expires_at IS NULL OR datetime(n.expires_at) > datetime('now'))
      ORDER BY n.created_at DESC
      LIMIT 30
    `).bind(visitorHash).all();

    const now = Date.now();
    const notifications = (rows?.results || []).filter((row) => {
      if (row.dismissed_at) return false;
      if (row.audience_type === 'active_cart' && !hasActiveCart) return false;
      if (row.audience_type === 'product_cart' && !cartProductIds.has(row.product_id)) return false;
      if (row.coupon_id) {
        if (!row.coupon_code || Number(row.coupon_active) !== 1) return false;
        if (row.coupon_starts_at && Date.parse(row.coupon_starts_at) > now) return false;
        if (row.coupon_expires_at && Date.parse(row.coupon_expires_at) <= now) return false;
        if (row.coupon_max_redemptions !== null
          && Number(row.coupon_redemptions || 0) >= Number(row.coupon_max_redemptions)) return false;
      }
      return true;
    }).slice(0, 20).map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      coupon_code: row.coupon_code || null,
      cta_label: row.cta_label || null,
      cta_url: normalizeInternalCtaUrl(row.cta_url, row.coupon_code ? '/checkout' : '/') || '/',
      is_read: Boolean(row.read_at),
      created_at: row.created_at,
    }));

    for (const notification of notifications) {
      await db.prepare(`
        INSERT OR IGNORE INTO storefront_notification_receipts
          (notification_id, visitor_hash, delivered_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).bind(notification.id, visitorHash).run();
    }
    await db.prepare("DELETE FROM storefront_notification_receipts WHERE delivered_at < datetime('now', '-90 days')")
      .run()
      .catch(() => {});

    return c.json({
      success: true,
      notifications,
      unread_count: notifications.filter((notification) => !notification.is_read).length,
    });
  } catch (err) {
    console.error('Storefront notifications fetch error:', err.message);
    return c.json({ success: false, error: 'Notifications could not be loaded.' }, 500);
  }
});

async function updateNotificationReceipt(c, field) {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Notifications are temporarily unavailable.' }, 503);
  try {
    const body = await c.req.json().catch(() => null);
    const visitorId = body?.visitor_id;
    const notificationId = c.req.param('id');
    if (!validStorefrontClientId(visitorId) || !/^ntf_[a-zA-Z0-9_-]{8,80}$/.test(notificationId)) {
      return c.json({ success: false, error: 'Invalid notification receipt.' }, 400);
    }
    const exists = await db.prepare('SELECT id FROM storefront_notifications WHERE id = ?')
      .bind(notificationId).first();
    if (!exists) return c.json({ success: false, error: 'Notification not found.' }, 404);

    const visitorHash = await sha256Hex(`storefront-visitor:v1:${visitorId}`);
    const column = field === 'dismissed_at' ? 'dismissed_at' : 'read_at';
    await db.prepare(`
      INSERT INTO storefront_notification_receipts
        (notification_id, visitor_hash, delivered_at, ${column})
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(notification_id, visitor_hash) DO UPDATE SET
        ${column} = CURRENT_TIMESTAMP
    `).bind(notificationId, visitorHash).run();
    return c.json({ success: true, id: notificationId });
  } catch (err) {
    console.error('Storefront notification receipt error:', err.message);
    return c.json({ success: false, error: 'Notification state could not be updated.' }, 500);
  }
}

app.post('/notifications/:id/read', (c) => updateNotificationReceipt(c, 'read_at'));
app.post('/notifications/:id/dismiss', (c) => updateNotificationReceipt(c, 'dismissed_at'));

// ----------------------------------------------------
// ADMIN AUTHENTICATION APIS
// ----------------------------------------------------

// POST /api/admin/auth/bootstrap
app.post('/admin/auth/bootstrap', async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  try {
    if (c.env?.ADMIN_BOOTSTRAP_ENABLED !== 'true') {
      return c.json({ success: false, error: 'Bootstrap is disabled. Enable it only during one-time provisioning.' }, 403);
    }

    const countRow = await db.prepare('SELECT COUNT(*) as count FROM admin_users').first();
    if (countRow && countRow.count > 0) {
      return c.json({ success: false, error: 'Bootstrap disabled: Administrator account already exists.' }, 403);
    }

    const body = await c.req.json();
    const { email, password, bootstrapSecret, name = 'Primary Administrator' } = body;

    const expectedSecret = c.env?.ADMIN_BOOTSTRAP_SECRET;
    if (!expectedSecret || expectedSecret.length < 32) {
      return c.json({ success: false, error: 'Bootstrap secret is not securely configured.' }, 503);
    }

    const suppliedSecretHash = await sha256Hex(String(bootstrapSecret || ''));
    const expectedSecretHash = await sha256Hex(expectedSecret);
    if (!constantTimeCompare(suppliedSecretHash, expectedSecretHash)) {
      return c.json({ success: false, error: 'Invalid bootstrap authorization secret.' }, 403);
    }

    const strongPassword = typeof password === 'string'
      && password.length >= 12
      && /[a-z]/.test(password)
      && /[A-Z]/.test(password)
      && /\d/.test(password)
      && /[^A-Za-z0-9]/.test(password);
    if (!isValidEmail(email) || !strongPassword) {
      return c.json({
        success: false,
        error: 'Use a valid email and a password of at least 12 characters containing upper/lowercase letters, a number, and a symbol.',
      }, 400);
    }

    const passwordHash = await hashPassword(password);
    const userId = 'usr_' + generateSecureToken(8);

    await db.prepare(
      `INSERT INTO admin_users (id, email, password_hash, role, name)
       VALUES (?, ?, ?, 'SUPER_ADMIN', ?)`
    ).bind(userId, email.toLowerCase().trim(), passwordHash, name).run();

    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog(db, {
      adminId: userId,
      adminEmail: email.toLowerCase().trim(),
      ip: clientIp,
      userAgent: c.req.header('user-agent'),
      action: 'BOOTSTRAP_SUPER_ADMIN_CREATED',
      entityType: 'admin_user',
      entityId: userId,
      reason: 'Initial system provisioning',
    });

    return c.json({ success: true, message: 'Super Admin successfully provisioned. You may now log in.' });
  } catch (err) {
    console.error('Bootstrap error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// POST /api/admin/auth/login
app.post('/admin/auth/login', async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
  const userAgent = c.req.header('user-agent') || 'Unknown';

  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ success: false, error: 'Email and password are required.' }, 400);
    }

    const cleanEmail = email.toLowerCase().trim();

    const rateCheck = await checkLoginRateLimit(db, clientIp, cleanEmail);
    if (!rateCheck.allowed) {
      await recordAuditLog(db, {
        adminEmail: cleanEmail,
        ip: clientIp,
        userAgent,
        action: 'LOGIN_RATE_LIMITED',
        entityType: 'auth',
        entityId: cleanEmail,
        reason: rateCheck.reason,
      });
      return c.json({ success: false, error: rateCheck.reason }, rateCheck.statusCode || 429);
    }

    const user = await db.prepare(
      'SELECT id, email, password_hash, role, name FROM admin_users WHERE email = ?'
    ).bind(cleanEmail).first();

    if (!user) {
      await recordFailedLogin(db, clientIp, cleanEmail);
      await recordAuditLog(db, {
        adminEmail: cleanEmail,
        ip: clientIp,
        userAgent,
        action: 'LOGIN_FAILED_USER_NOT_FOUND',
        entityType: 'auth',
        entityId: cleanEmail,
      });
      return c.json({ success: false, error: 'Invalid email or password.' }, 401);
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      await recordFailedLogin(db, clientIp, cleanEmail);
      await recordAuditLog(db, {
        adminId: user.id,
        adminEmail: cleanEmail,
        ip: clientIp,
        userAgent,
        action: 'LOGIN_FAILED_INVALID_PASSWORD',
        entityType: 'auth',
        entityId: user.id,
      });
      return c.json({ success: false, error: 'Invalid email or password.' }, 401);
    }

    const storedIterations = Number(String(user.password_hash).split('$')[1] || 0);
    if (storedIterations > 0 && storedIterations < PBKDF2_ITERATIONS) {
      const upgradedHash = await hashPassword(password);
      await db.prepare('UPDATE admin_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(upgradedHash, user.id)
        .run();
    }

    await clearLoginRateLimit(db, clientIp, cleanEmail);

    await db.prepare('DELETE FROM admin_sessions WHERE expires_at <= CURRENT_TIMESTAMP').run();

    const rawSessionToken = generateSecureToken(32);
    const tokenHash = await sha256Hex(rawSessionToken);
    const sessionId = 'ses_' + generateSecureToken(8);
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    await db.prepare(
      `INSERT INTO admin_sessions (id, token_hash, user_id, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, tokenHash, user.id, clientIp, userAgent, expiresAt).run();

    await recordAuditLog(db, {
      adminId: user.id,
      adminEmail: cleanEmail,
      ip: clientIp,
      userAgent,
      action: 'LOGIN_SUCCESS',
      entityType: 'auth',
      entityId: sessionId,
      metadata: { role: user.role },
    });

    const isSecure = c.req.url.startsWith('https://');
    const cookieString = `gf_admin_session=${encodeURIComponent(rawSessionToken)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${isSecure ? '; Secure' : ''}`;

    c.header('Set-Cookie', cookieString);

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    if (err instanceof UnsupportedPasswordHashError) {
      return c.json({
        success: false,
        error: 'Administrator password reset required. Contact the site owner.',
      }, 503);
    }
    return c.json({ success: false, error: 'Server authentication error.' }, 500);
  }
});

// POST /api/admin/auth/logout
app.post('/admin/auth/logout', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  const user = c.get('adminUser');
  const cookieHeader = c.req.header('cookie');
  const cookies = parseCookies(cookieHeader);
  const rawToken = cookies['gf_admin_session'];

  if (db && rawToken) {
    const tokenHash = await sha256Hex(rawToken);
    await db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).run();

    await recordAuditLog(db, {
      adminId: user?.id,
      adminEmail: user?.email || 'unknown',
      ip: c.req.header('cf-connecting-ip') || '127.0.0.1',
      userAgent: c.req.header('user-agent'),
      action: 'LOGOUT',
      entityType: 'auth',
      entityId: user?.sessionId || 'session',
    });
  }

  const secureCookie = c.req.url.startsWith('https://') ? '; Secure' : '';
  c.header('Set-Cookie', `gf_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookie}`);
  return c.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/admin/auth/me
app.get('/admin/auth/me', adminAuthMiddleware, async (c) => {
  const user = c.get('adminUser');
  return c.json({ success: true, user });
});

// ----------------------------------------------------
// ADMIN DASHBOARD OVERVIEW
// ----------------------------------------------------

// GET /api/admin/dashboard
app.get('/admin/dashboard', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  try {
    const ordersSummary = await db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as count_pending,
        SUM(CASE WHEN status = 'awaiting_payment' THEN 1 ELSE 0 END) as count_awaiting,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as count_paid,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as count_processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as count_completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as count_cancelled,
        SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as count_refunded,
        SUM(CASE WHEN status IN ('paid', 'processing', 'completed') AND fulfillment_status NOT IN ('package_delivered', 'setup_completed') THEN 1 ELSE 0 END) as count_fulfillment_pending,
        SUM(CASE WHEN status IN ('paid', 'processing', 'completed') THEN total_usd ELSE 0 END) as gross_revenue,
        SUM(CASE WHEN status = 'refunded' THEN total_usd ELSE 0 END) as refunded_amount
      FROM orders
    `).first();

    const grossRev = Number(ordersSummary?.gross_revenue || 0);
    const refundedAmt = Number(ordersSummary?.refunded_amount || 0);
    const netRevenue = Math.max(0, grossRev - refundedAmt);

    const verifyingCountRow = await db.prepare(
      "SELECT COUNT(*) as count FROM crypto_payments WHERE status IN ('waiting', 'confirming')"
    ).first();

    const unreadEmailsRow = await db.prepare(
      "SELECT COUNT(*) as count FROM inbound_emails WHERE is_read = 0 AND is_archived = 0"
    ).first().catch(() => ({ count: 0 }));

    const networkBreakdown = await db.prepare(`
      SELECT p.currency, COUNT(*) as tx_count, SUM(o.total_usd) as total_volume
      FROM crypto_payments p
      JOIN orders o ON p.order_id = o.id
      WHERE o.status IN ('paid', 'processing', 'completed')
      GROUP BY p.currency
    `).all();

    const attentionAlerts = [];
    const unfulfilledCount = Number(ordersSummary?.count_fulfillment_pending || 0);
    if (unfulfilledCount > 0) {
      attentionAlerts.push({
        id: 'alert_unfulfilled',
        type: 'warning',
        title: `${unfulfilledCount} Paid order${unfulfilledCount === 1 ? '' : 's'} pending fulfillment`,
        link: '/admin/fulfillment',
      });
    }

    const unreadCount = Number(unreadEmailsRow?.count || 0);
    if (unreadCount > 0) {
      attentionAlerts.push({
        id: 'alert_unread_mail',
        type: 'info',
        title: `${unreadCount} Unread customer message${unreadCount === 1 ? '' : 's'} in Inbox`,
        link: '/admin/mail?filter=unread',
      });
    }

    // Check for custom automation requests needing notification attention (failed, skipped, or stale pending)
    try {
      const attnReqRow = await db.prepare(`
        SELECT COUNT(*) as count FROM custom_automation_requests
        WHERE internal_notification_status IN ('failed', 'skipped')
           OR (internal_notification_status = 'pending' AND created_at < datetime('now', '-5 minutes'))
      `).first();
      const attentionCount = Number(attnReqRow?.count || 0);
      if (attentionCount > 0) {
        attentionAlerts.push({
          id: 'alert_custom_requests_attention',
          type: 'warning',
          title: `${attentionCount} custom request notification${attentionCount === 1 ? '' : 's'} need attention.`,
          link: '/admin/custom-requests',
        });
      }
    } catch (e) {
      // Graceful fallback if table is not yet migrated
    }

    const recentOrders = await db.prepare(`
      SELECT o.id, o.customer_email, o.total_usd, o.status, o.fulfillment_status, o.created_at,
             p.currency as payment_currency, p.status as payment_status, p.tx_hash
      FROM orders o
      LEFT JOIN crypto_payments p ON o.id = p.order_id
      ORDER BY o.created_at DESC
      LIMIT 10
    `).all();

    return c.json({
      success: true,
      data: {
        metrics: {
          total_orders: Number(ordersSummary?.total_orders || 0),
          net_revenue: netRevenue,
          gross_revenue: grossRev,
          refunded_amount: refundedAmt,
          pending: Number(ordersSummary?.count_pending || 0),
          awaiting_payment: Number(ordersSummary?.count_awaiting || 0),
          verifying: Number(verifyingCountRow?.count || 0),
          paid: Number(ordersSummary?.count_paid || 0),
          processing: Number(ordersSummary?.count_processing || 0),
          completed: Number(ordersSummary?.count_completed || 0),
          fulfillment_pending: unfulfilledCount,
          unread_emails: unreadCount,
          cancelled: Number(ordersSummary?.count_cancelled || 0),
          refunded: Number(ordersSummary?.count_refunded || 0),
        },
        attention_alerts: attentionAlerts,
        network_distribution: networkBreakdown?.results || [],
        recent_orders: recentOrders?.results || [],
        synced_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Dashboard API error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// GET /api/admin/analytics
app.get('/admin/analytics', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  const requestedDays = Number.parseInt(c.req.query('days') || '30', 10);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const since = `-${days} days`;

  try {
    await db.prepare("DELETE FROM storefront_analytics_events WHERE created_at < datetime('now', '-90 days')").run();
    await db.prepare("DELETE FROM storefront_cart_state WHERE updated_at < datetime('now', '-90 days')").run();

    const metrics = await db.prepare(`
      SELECT
        COUNT(DISTINCT visitor_hash) AS unique_visitors,
        SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
        COUNT(DISTINCT CASE WHEN event_type = 'cart_add' THEN visitor_hash END) AS cart_visitors,
        SUM(CASE WHEN event_type = 'cart_add' THEN 1 ELSE 0 END) AS cart_additions
      FROM storefront_analytics_events
      WHERE created_at >= datetime('now', ?) AND COALESCE(device_type, '') <> 'Bot'
    `).bind(since).first();

    const dailyRows = await db.prepare(`
      SELECT
        date(created_at) AS day,
        COUNT(DISTINCT visitor_hash) AS unique_visitors,
        SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
        SUM(CASE WHEN event_type = 'cart_add' THEN 1 ELSE 0 END) AS cart_additions
      FROM storefront_analytics_events
      WHERE created_at >= datetime('now', ?) AND COALESCE(device_type, '') <> 'Bot'
      GROUP BY date(created_at)
      ORDER BY day ASC
    `).bind(since).all();

    const popularRows = await db.prepare(`
      SELECT product_id, COUNT(*) AS cart_additions, COUNT(DISTINCT visitor_hash) AS unique_visitors
      FROM storefront_analytics_events
      WHERE event_type = 'cart_add' AND created_at >= datetime('now', ?) AND COALESCE(device_type, '') <> 'Bot'
      GROUP BY product_id
      ORDER BY cart_additions DESC, product_id ASC
      LIMIT 25
    `).bind(since).all();

    const sourceRows = await db.prepare(`
      SELECT COALESCE(NULLIF(referrer_host, ''), 'Direct') AS referrer_host,
             COUNT(DISTINCT session_hash) AS sessions,
             COUNT(DISTINCT visitor_hash) AS unique_visitors,
             SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
             COUNT(DISTINCT CASE WHEN event_type = 'cart_add' THEN visitor_hash END) AS cart_visitors,
             SUM(CASE WHEN event_type = 'cart_add' THEN 1 ELSE 0 END) AS cart_additions
      FROM storefront_analytics_events
      WHERE created_at >= datetime('now', ?) AND COALESCE(device_type, '') <> 'Bot'
      GROUP BY COALESCE(NULLIF(referrer_host, ''), 'Direct')
      ORDER BY sessions DESC, unique_visitors DESC, referrer_host ASC
      LIMIT 30
    `).bind(since).all();

    const recentRows = await db.prepare(`
      SELECT visitor_hash, product_id, page_path, referrer_host, ip_network,
             country_code, region, city, device_type, browser_family, os_family, created_at
      FROM storefront_analytics_events
      WHERE event_type = 'cart_add' AND created_at >= datetime('now', ?) AND COALESCE(device_type, '') <> 'Bot'
      ORDER BY created_at DESC
      LIMIT 75
    `).bind(since).all();

    const locationRows = await db.prepare(`
      SELECT country_code, region, city,
             COUNT(DISTINCT visitor_hash) AS unique_visitors,
             COUNT(DISTINCT CASE WHEN event_type = 'cart_add' THEN visitor_hash END) AS cart_visitors,
             SUM(CASE WHEN event_type = 'cart_add' THEN 1 ELSE 0 END) AS cart_additions
      FROM storefront_analytics_events
      WHERE created_at >= datetime('now', ?) AND COALESCE(device_type, '') <> 'Bot'
      GROUP BY country_code, region, city
      ORDER BY cart_visitors DESC, unique_visitors DESC, country_code ASC
      LIMIT 30
    `).bind(since).all();

    const activeCartRows = await db.prepare(`
      SELECT visitor_hash, product_ids_json, item_count, cart_value_cents, page_path,
             referrer_host, ip_network, country_code, region, city,
             device_type, browser_family, os_family, updated_at
      FROM storefront_cart_state
      WHERE item_count > 0 AND updated_at >= datetime('now', ?)
        AND COALESCE(device_type, '') <> 'Bot'
      ORDER BY updated_at DESC
      LIMIT 75
    `).bind(since).all();

    const uniqueVisitors = Number(metrics?.unique_visitors || 0);
    const cartVisitors = Number(metrics?.cart_visitors || 0);
    const cartAdditions = Number(metrics?.cart_additions || 0);
    const activeCarts = activeCartRows?.results || [];

    return c.json({
      success: true,
      data: {
        range_days: days,
        metrics: {
          unique_visitors: uniqueVisitors,
          page_views: Number(metrics?.page_views || 0),
          cart_visitors: cartVisitors,
          cart_additions: cartAdditions,
          active_carts: activeCarts.length,
          cart_visitor_rate: uniqueVisitors > 0 ? Number(((cartVisitors / uniqueVisitors) * 100).toFixed(1)) : 0,
        },
        daily: (dailyRows?.results || []).map((row) => ({
          day: row.day,
          unique_visitors: Number(row.unique_visitors || 0),
          page_views: Number(row.page_views || 0),
          cart_additions: Number(row.cart_additions || 0),
        })),
        popular_flows: (popularRows?.results || []).map((row) => ({
          product_id: row.product_id,
          title: AUTHORITATIVE_CATALOG_MAP.get(row.product_id)?.title || row.product_id,
          cart_additions: Number(row.cart_additions || 0),
          unique_visitors: Number(row.unique_visitors || 0),
          share: cartAdditions > 0 ? Number(((Number(row.cart_additions || 0) / cartAdditions) * 100).toFixed(1)) : 0,
        })),
        traffic_sources: (sourceRows?.results || []).map((row) => ({
          referrer_host: row.referrer_host || 'Direct',
          sessions: Number(row.sessions || 0),
          unique_visitors: Number(row.unique_visitors || 0),
          page_views: Number(row.page_views || 0),
          cart_visitors: Number(row.cart_visitors || 0),
          cart_additions: Number(row.cart_additions || 0),
        })),
        locations: (locationRows?.results || []).map((row) => {
          const locationVisitors = Number(row.unique_visitors || 0);
          const locationCartVisitors = Number(row.cart_visitors || 0);
          return {
            country_code: row.country_code,
            region: row.region,
            city: row.city,
            unique_visitors: locationVisitors,
            cart_visitors: locationCartVisitors,
            cart_additions: Number(row.cart_additions || 0),
            cart_visitor_rate: locationVisitors > 0
              ? Number(((locationCartVisitors / locationVisitors) * 100).toFixed(1))
              : 0,
          };
        }),
        active_carts: activeCarts.map((row) => {
          let productIds = [];
          try { productIds = JSON.parse(row.product_ids_json || '[]'); } catch (error) {}
          return {
            visitor_id: String(row.visitor_hash || '').slice(0, 12),
            item_count: Number(row.item_count || 0),
            cart_value_usd: Number((Number(row.cart_value_cents || 0) / 100).toFixed(2)),
            items: productIds.map((productId) => ({
              product_id: productId,
              title: AUTHORITATIVE_CATALOG_MAP.get(productId)?.title || productId,
            })),
            page_path: row.page_path,
            referrer_host: row.referrer_host,
            ip_network: row.ip_network,
            country_code: row.country_code,
            region: row.region,
            city: row.city,
            device_type: row.device_type,
            browser_family: row.browser_family,
            os_family: row.os_family,
            updated_at: row.updated_at,
          };
        }),
        recent_cart_additions: (recentRows?.results || []).map((row) => ({
          visitor_id: String(row.visitor_hash || '').slice(0, 12),
          product_id: row.product_id,
          title: AUTHORITATIVE_CATALOG_MAP.get(row.product_id)?.title || row.product_id,
          page_path: row.page_path,
          referrer_host: row.referrer_host,
          ip_network: row.ip_network,
          country_code: row.country_code,
          region: row.region,
          city: row.city,
          device_type: row.device_type,
          browser_family: row.browser_family,
          os_family: row.os_family,
          created_at: row.created_at,
        })),
        retention_days: 90,
        synced_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Admin analytics API error:', err);
    return c.json({ success: false, error: 'Analytics dashboard could not be loaded.' }, 500);
  }
});

// ----------------------------------------------------
// ADMIN ORDERS APIS
// ----------------------------------------------------

// GET /api/admin/orders
app.get('/admin/orders', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  try {
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(c.req.query('pageSize') || '25', 10)));
    const offset = (page - 1) * pageSize;

    const search = (c.req.query('search') || '').trim();
    const status = (c.req.query('status') || '').trim();
    const network = (c.req.query('network') || '').trim();
    const fulfillment = (c.req.query('fulfillment') || '').trim();
    const sortBy = ['created_at', 'total_usd', 'status'].includes(c.req.query('sortBy')) ? c.req.query('sortBy') : 'created_at';
    const sortOrder = c.req.query('sortOrder')?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let whereClauses = [];
    let queryParams = [];

    if (search) {
      whereClauses.push('(o.id LIKE ? OR o.customer_email LIKE ? OR p.id LIKE ? OR p.tx_hash LIKE ? OR p.pay_address LIKE ?)');
      const s = `%${search}%`;
      queryParams.push(s, s, s, s, s);
    }

    if (status && status !== 'all') {
      whereClauses.push('o.status = ?');
      queryParams.push(status);
    }

    if (network && network !== 'all') {
      whereClauses.push('p.currency LIKE ?');
      queryParams.push(`%${network}%`);
    }

    if (fulfillment && fulfillment !== 'all') {
      whereClauses.push('o.fulfillment_status = ?');
      queryParams.push(fulfillment);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = await db.prepare(`
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      LEFT JOIN crypto_payments p ON o.id = p.order_id
      ${whereSql}
    `).bind(...queryParams).first();
    const total = Number(countRow?.total || 0);

    const rows = await db.prepare(`
      SELECT o.id, o.customer_email, o.total_usd, o.delivery_method, o.workflow_subtotal, o.setup_fee,
             o.coupon_code, o.coupon_discount_usd, o.status, o.items, o.fulfillment_status, o.delivered_at, o.created_at, o.updated_at,
             p.id as payment_id, p.currency as payment_currency, p.status as payment_status, p.pay_amount_crypto, p.tx_hash, p.verification_source
      FROM orders o
      LEFT JOIN crypto_payments p ON o.id = p.order_id
      ${whereSql}
      ORDER BY o.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `).bind(...queryParams, pageSize, offset).all();

    const orders = (rows?.results || []).map((row) => {
      let itemsList = [];
      try {
        itemsList = JSON.parse(row.items || '[]');
      } catch (e) {}
      return {
        ...row,
        delivery_method: row.delivery_method || 'download_package',
        workflow_subtotal: Number(row.workflow_subtotal || row.total_usd || 0),
        setup_fee: Number(row.setup_fee || 0),
        coupon_discount_usd: Number(row.coupon_discount_usd || 0),
        itemsCount: itemsList.length,
        itemsSummary: itemsList.map((i) => i.title).join(', '),
      };
    });

    return c.json({
      success: true,
      orders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (err) {
    console.error('Admin orders API error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// GET /api/admin/orders/:id
app.get('/admin/orders/:id', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  const orderId = c.req.param('id');

  try {
    const order = await db.prepare(
      'SELECT * FROM orders WHERE id = ?'
    ).bind(orderId).first();

    if (!order) {
      return c.json({ success: false, error: `Order "${orderId}" not found.` }, 404);
    }

    let parsedItems = [];
    try {
      parsedItems = JSON.parse(order.items || '[]');
    } catch (e) {}

    const payment = await db.prepare(
      'SELECT * FROM crypto_payments WHERE order_id = ?'
    ).bind(orderId).first();

    const fulfillmentLogs = await db.prepare(
      'SELECT * FROM order_fulfillment_logs WHERE order_id = ? ORDER BY created_at DESC'
    ).bind(orderId).all();

    const auditHistory = await db.prepare(
      "SELECT * FROM audit_logs WHERE entity_type = 'order' AND entity_id = ? ORDER BY created_at DESC"
    ).bind(orderId).all();

    const associatedEmails = await db.prepare(
      'SELECT id, subject, from_address, received_at, is_read FROM inbound_emails WHERE order_id = ? ORDER BY received_at DESC'
    ).bind(orderId).all().catch(() => ({ results: [] }));

    let explorerUrl = null;
    let addressExplorerUrl = null;
    if (payment) {
      const netConfig = resolvePaymentNetwork(payment.currency);
      if (netConfig) {
        if (payment.tx_hash) explorerUrl = netConfig.explorer_base + payment.tx_hash;
        if (payment.pay_address) addressExplorerUrl = netConfig.address_explorer + payment.pay_address;
      }
    }

    return c.json({
      success: true,
      order: {
        ...order,
        items: parsedItems,
      },
      payment: payment ? {
        ...payment,
        explorerUrl,
        addressExplorerUrl,
      } : null,
      fulfillment_logs: fulfillmentLogs?.results || [],
      audit_history: auditHistory?.results || [],
      associated_emails: associatedEmails?.results || [],
    });
  } catch (err) {
    console.error('Order detail API error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// POST /api/admin/orders/:id/transition
app.post('/admin/orders/:id/transition', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  const orderId = c.req.param('id');
  const user = c.get('adminUser');

  try {
    const body = await c.req.json();
    const { target_status, reason } = body;

    if (!target_status) {
      return c.json({ success: false, error: 'Target status is required.' }, 400);
    }

    const order = await db.prepare('SELECT status, customer_email, total_usd FROM orders WHERE id = ?').bind(orderId).first();
    if (!order) {
      return c.json({ success: false, error: `Order "${orderId}" not found.` }, 404);
    }

    const currentStatus = order.status;
    const allowedNext = ALLOWED_ORDER_TRANSITIONS[currentStatus] || [];

    if (!allowedNext.includes(target_status)) {
      return c.json({
        success: false,
        error: `Invalid transition: Cannot advance order from "${currentStatus}" to "${target_status}". Allowed transitions are: [${allowedNext.join(', ')}].`,
      }, 400);
    }

    if (['cancelled', 'refunded'].includes(target_status) && user.role !== 'SUPER_ADMIN') {
      return c.json({ success: false, error: 'Forbidden: SUPER_ADMIN role required for order cancellation or refund.' }, 403);
    }

    if (['cancelled', 'refunded'].includes(target_status) && (!reason || reason.trim().length < 5)) {
      return c.json({ success: false, error: 'An explicit reason (min 5 chars) is required for cancellation or refund.' }, 400);
    }

    await db.prepare(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(target_status, orderId).run();

    await recordAuditLog(db, {
      adminId: user.id,
      adminEmail: user.email,
      ip: c.req.header('cf-connecting-ip') || '127.0.0.1',
      userAgent: c.req.header('user-agent'),
      action: 'ORDER_STATUS_TRANSITION',
      entityType: 'order',
      entityId: orderId,
      previousState: currentStatus,
      newState: target_status,
      reason: reason || 'Operational update',
    });

    return c.json({ success: true, orderId, previousStatus: currentStatus, status: target_status });
  } catch (err) {
    console.error('Order status transition error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// POST /api/admin/orders/:id/fulfillment-status
app.post('/admin/orders/:id/fulfillment-status', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  const orderId = c.req.param('id');
  const user = c.get('adminUser');

  try {
    const body = await c.req.json();
    const { target_status, reason, notes } = body;

    const validStatuses = [
      'not_ready',
      'fulfillment_pending',
      'package_preparing',
      'package_delivered',
      'setup_pending',
      'setup_in_progress',
      'setup_completed',
      'failed',
    ];

    if (!target_status || !validStatuses.includes(target_status)) {
      return c.json({
        success: false,
        error: `Invalid fulfillment status "${target_status}". Allowed statuses: ${validStatuses.join(', ')}`,
      }, 400);
    }

    const order = await db.prepare(
      `SELECT o.status, o.fulfillment_status, o.delivery_method, o.customer_email,
              p.status AS payment_status
       FROM orders o
       LEFT JOIN crypto_payments p ON p.order_id = o.id
       WHERE o.id = ?`
    ).bind(orderId).first();
    if (!order) {
      return c.json({ success: false, error: `Order "${orderId}" not found.` }, 404);
    }

    if (!SETTLED_ORDER_STATUSES.has(String(order.status || '').toLowerCase())
        || !CONFIRMED_PROVIDER_STATUSES.has(String(order.payment_status || '').toLowerCase())) {
      return c.json({
        success: false,
        error: `Fulfillment is locked while order status is "${order.status}" and payment status is "${order.payment_status || 'missing'}". Confirm payment before updating delivery.`,
      }, 409);
    }

    const deliveryTransitions = ALLOWED_FULFILLMENT_TRANSITIONS[order.delivery_method] || {};
    const allowedNext = deliveryTransitions[order.fulfillment_status || 'not_ready'] || [];
    if (!allowedNext.includes(target_status)) {
      return c.json({
        success: false,
        error: `Invalid fulfillment transition from "${order.fulfillment_status || 'not_ready'}" to "${target_status}". Allowed: [${allowedNext.join(', ')}].`,
      }, 400);
    }

    const previousStatus = order.fulfillment_status;

    await db.prepare(
      `UPDATE orders
       SET fulfillment_status = ?, fulfillment_notes = COALESCE(?, fulfillment_notes),
           delivered_at = CASE
             WHEN ? IN ('package_delivered', 'setup_completed') THEN COALESCE(delivered_at, CURRENT_TIMESTAMP)
             ELSE delivered_at
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(target_status, notes || null, target_status, orderId).run();

    await recordAuditLog(db, {
      adminId: user.id,
      adminEmail: user.email,
      ip: c.req.header('cf-connecting-ip') || '127.0.0.1',
      userAgent: c.req.header('user-agent'),
      action: 'ORDER_FULFILLMENT_STATUS_UPDATE',
      entityType: 'order',
      entityId: orderId,
      previousState: previousStatus,
      newState: target_status,
      reason: reason || 'Operational fulfillment update',
    });

    return c.json({
      success: true,
      orderId,
      previousFulfillmentStatus: previousStatus,
      fulfillmentStatus: target_status,
    });
  } catch (err) {
    console.error('Fulfillment status update error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// ----------------------------------------------------
// ADMIN PAYMENTS APIS
// ----------------------------------------------------

// GET /api/admin/payments
app.get('/admin/payments', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  try {
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(c.req.query('pageSize') || '25', 10)));
    const offset = (page - 1) * pageSize;

    const search = (c.req.query('search') || '').trim();
    const network = (c.req.query('network') || '').trim();
    const status = (c.req.query('status') || '').trim();

    let whereClauses = [];
    let queryParams = [];

    if (search) {
      whereClauses.push('(p.id LIKE ? OR p.order_id LIKE ? OR p.pay_address LIKE ? OR p.tx_hash LIKE ? OR o.customer_email LIKE ?)');
      const s = `%${search}%`;
      queryParams.push(s, s, s, s, s);
    }

    if (network && network !== 'all') {
      whereClauses.push('p.currency LIKE ?');
      queryParams.push(`%${network}%`);
    }

    if (status && status !== 'all') {
      whereClauses.push('p.status = ?');
      queryParams.push(status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = await db.prepare(`
      SELECT COUNT(*) as total
      FROM crypto_payments p
      LEFT JOIN orders o ON p.order_id = o.id
      ${whereSql}
    `).bind(...queryParams).first();
    const total = Number(countRow?.total || 0);

    const rows = await db.prepare(`
      SELECT p.*, o.customer_email, o.total_usd, o.status as order_status
      FROM crypto_payments p
      LEFT JOIN orders o ON p.order_id = o.id
      ${whereSql}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...queryParams, pageSize, offset).all();

    return c.json({
      success: true,
      payments: rows?.results || [],
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (err) {
    console.error('Admin payments API error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// POST /api/admin/payments/:id/sync
app.post('/admin/payments/:id/sync', adminAuthMiddleware, async (c) => {
  const paymentId = c.req.param('id');
  const db = c.env?.DB;
  const user = c.get('adminUser');
  const apiKey = c.env?.NOWPAYMENTS_API_KEY || c.env?.CRYPTO_GATEWAY_API_KEY;

  if (!apiKey) {
    return c.json({ success: false, error: 'NOWPAYMENTS_API_KEY not configured.' }, 500);
  }

  try {
    const payment = await db?.prepare('SELECT * FROM crypto_payments WHERE id = ? OR order_id = ?').bind(paymentId, paymentId).first();
    if (!payment) {
      return c.json({ success: false, error: `Payment record "${paymentId}" not found in database.` }, 404);
    }

    const actualPayId = payment.id;
    if (!/^\d+$/.test(actualPayId)) {
      return c.json({ success: false, error: 'Cannot sync placeholder payment ID with live gateway.' }, 400);
    }

    const nowPayCheck = await fetch(`https://api.nowpayments.io/v1/payment/${actualPayId}`, {
      headers: { 'x-api-key': apiKey },
    });

    const nowPayData = await nowPayCheck.json();
    if (!nowPayCheck.ok || !nowPayData || !nowPayData.payment_status) {
      return c.json({ success: false, error: nowPayData?.message || 'Gateway returned empty response.' }, 502);
    }

    const order = await db.prepare(
      `SELECT id, status, fulfillment_status, total_usd, total_usd_cents, delivery_method
       FROM orders WHERE id = ?`
    ).bind(payment.order_id).first();
    const snapshotVerification = verifyProviderInvoiceSnapshot(nowPayData, {
      paymentId: payment.id,
      orderId: payment.order_id,
      payAddress: payment.pay_address,
      providerCurrency: payment.provider_currency,
      cryptoAmount: payment.pay_amount_crypto_text || payment.pay_amount_crypto,
      usdCents: Number(order?.total_usd_cents ?? usdToCents(order?.total_usd)),
    });
    if (!order || !snapshotVerification.valid) {
      await db.prepare(
        `UPDATE crypto_payments
         SET status = 'review_required', verification_source = 'reconciliation_failed', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(actualPayId).run();
      return c.json({
        success: false,
        error: snapshotVerification.valid ? 'Stored order was not found.' : snapshotVerification.reason,
        status: 'review_required',
      }, 409);
    }

    const liveStatus = String(nowPayData.payment_status).toLowerCase();
    const liveTxHash = nowPayData.outcome_tx_hash || nowPayData.txid || payment.tx_hash;

    if (db) {
      if (CONFIRMED_PROVIDER_STATUSES.has(liveStatus)) {
        const reconciliation = reconcileProviderPayment(nowPayData, payment, order);
        if (!reconciliation.valid) {
          await db.prepare(
            `UPDATE crypto_payments
             SET status = 'review_required', verification_source = 'reconciliation_failed', updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          ).bind(actualPayId).run();
          return c.json({ success: false, error: reconciliation.reason, status: 'review_required' }, 409);
        }
      }

      const derivedState = deriveOrderStateFromPayment({
        orderStatus: order.status,
        fulfillmentStatus: order.fulfillment_status,
        paymentStatus: liveStatus,
        deliveryMethod: order.delivery_method,
      });
      const syncStatements = [
        db.prepare(
          'UPDATE crypto_payments SET status = ?, tx_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(liveStatus, liveTxHash, actualPayId),
      ];
      if (derivedState.changed) {
        syncStatements.push(
          db.prepare(
            'UPDATE orders SET status = ?, fulfillment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
          ).bind(derivedState.orderStatus, derivedState.fulfillmentStatus, payment.order_id)
        );
      }
      await db.batch(syncStatements);

      await recordAuditLog(db, {
        adminId: user.id,
        adminEmail: user.email,
        ip: c.req.header('cf-connecting-ip') || '127.0.0.1',
        userAgent: c.req.header('user-agent'),
        action: 'NOWPAYMENTS_LIVE_SYNC',
        entityType: 'payment',
        entityId: actualPayId,
        previousState: payment.status,
        newState: liveStatus,
        metadata: { liveTxHash },
      });

      if (derivedState.changed) {
        await recordAuditLog(db, {
          adminId: user.id,
          adminEmail: user.email,
          ip: c.req.header('cf-connecting-ip') || '127.0.0.1',
          userAgent: c.req.header('user-agent'),
          action: 'ORDER_STATUS_RECONCILED',
          entityType: 'order',
          entityId: order.id,
          previousState: order.status,
          newState: derivedState.orderStatus,
          reason: `Gateway sync reported ${liveStatus}`,
          metadata: { paymentId: actualPayId, source: 'admin_sync' },
        });
      }

      return c.json({
        success: true,
        paymentId: actualPayId,
        status: liveStatus,
        orderStatus: derivedState.orderStatus,
        previousOrderStatus: order.status,
        orderReconciled: derivedState.changed,
        txHash: liveTxHash,
        gatewayData: nowPayData,
      });
    }

    return c.json({ success: false, error: 'Database unavailable.' }, 500);
  } catch (err) {
    console.error('Payment sync error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// POST /api/admin/payments/:id/manual-verify
app.post('/admin/payments/:id/manual-verify', adminAuthMiddleware, requireRole('SUPER_ADMIN'), async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  const paymentId = c.req.param('id');
  const user = c.get('adminUser');

  try {
    const body = await c.req.json();
    const { reason, tx_hash } = body;

    if (!reason || reason.trim().length < 10) {
      return c.json({ success: false, error: 'A detailed reason (min 10 characters) is strictly required for manual payment verification.' }, 400);
    }

    const payment = await db.prepare('SELECT * FROM crypto_payments WHERE id = ? OR order_id = ?').bind(paymentId, paymentId).first();
    if (!payment) {
      return c.json({ success: false, error: `Payment record "${paymentId}" not found.` }, 404);
    }

    const finalTxHash = tx_hash || payment.tx_hash || 'MANUAL_VERIFIED_BY_' + user.email;

    const order = await db.prepare('SELECT delivery_method FROM orders WHERE id = ?').bind(payment.order_id).first();
    const fulfillmentStatus = order?.delivery_method === 'geelark_setup' ? 'setup_pending' : 'fulfillment_pending';

    await db.batch([
      db.prepare(
        `UPDATE crypto_payments
         SET status = 'confirmed', tx_hash = ?, verification_source = 'manual_admin', verified_by_admin = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(finalTxHash, user.email, payment.id),
      db.prepare(
        `UPDATE orders
         SET status = 'paid', fulfillment_status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(fulfillmentStatus, payment.order_id),
    ]);

    await recordAuditLog(db, {
      adminId: user.id,
      adminEmail: user.email,
      ip: c.req.header('cf-connecting-ip') || '127.0.0.1',
      userAgent: c.req.header('user-agent'),
      action: 'MANUAL_PAYMENT_VERIFIED',
      entityType: 'payment',
      entityId: payment.id,
      previousState: payment.status,
      newState: 'confirmed',
      reason: reason.trim(),
      metadata: { orderId: payment.order_id, tx_hash: finalTxHash },
    });

    return c.json({
      success: true,
      message: 'Payment manually verified and order marked as paid.',
      paymentId: payment.id,
      orderId: payment.order_id,
    });
  } catch (err) {
    console.error('Manual payment verify error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// ----------------------------------------------------
// ADMIN FULFILLMENT APIS
// ----------------------------------------------------

// GET /api/admin/fulfillment
app.get('/admin/fulfillment', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  try {
    const rows = await db.prepare(`
      SELECT o.id, o.customer_email, o.total_usd, o.status, o.items, o.fulfillment_status, o.fulfillment_notes, o.delivered_at, o.created_at,
             p.currency as payment_currency, p.status as payment_status,
             (SELECT COUNT(*) FROM order_fulfillment_logs fl WHERE fl.order_id = o.id) as attempt_count
      FROM orders o
      LEFT JOIN crypto_payments p ON o.id = p.order_id
      WHERE o.status IN ('paid', 'processing', 'completed') OR o.fulfillment_status != 'not_ready'
      ORDER BY o.created_at DESC
    `).all();

    return c.json({ success: true, fulfillment_queue: rows?.results || [] });
  } catch (err) {
    console.error('Fulfillment queue API error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// POST /api/admin/fulfillment/:orderId/resend
app.post('/admin/fulfillment/:orderId/resend', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  const orderId = c.req.param('orderId');
  const user = c.get('adminUser');

  try {
    const body = await c.req.json().catch(() => ({}));

    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
    if (!order) {
      return c.json({ success: false, error: `Order "${orderId}" not found.` }, 404);
    }

    const payment = await db.prepare('SELECT currency, status FROM crypto_payments WHERE order_id = ?').bind(orderId).first();
    if (!SETTLED_ORDER_STATUSES.has(String(order.status || '').toLowerCase())
        || !CONFIRMED_PROVIDER_STATUSES.has(String(payment?.status || '').toLowerCase())) {
      return c.json({
        success: false,
        error: `Cannot fulfill order with order status "${order.status}" and payment status "${payment?.status || 'missing'}". Confirm payment first.`,
      }, 409);
    }

    let parsedItems = [];
    try {
      parsedItems = JSON.parse(order.items || '[]');
    } catch (e) {}

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return c.json({ success: false, error: 'Order has no valid purchased items to fulfill.' }, 409);
    }

    const minuteBucket = Math.floor(Date.now() / 60000);
    const idempotencyKey = `fulfillment_dispatch_${orderId}_${minuteBucket}`;
    const logId = 'fl_' + generateSecureToken(8);
    try {
      await db.prepare(
        `INSERT INTO order_fulfillment_logs
         (id, order_id, idempotency_key, triggered_by, recipient_email, status)
         VALUES (?, ?, ?, ?, ?, 'sending')`
      ).bind(logId, orderId, idempotencyKey, `admin:${user.email}`, order.customer_email).run();
    } catch (reserveErr) {
      return c.json({ success: false, error: 'A fulfillment delivery is already being processed for this order. Please wait one minute.' }, 429);
    }

    let downloadTokenId = null;
    try {
      const downloadLinks = [];

      if (order.delivery_method === 'download_package') {
        const bucket = c.env?.FLOWS_BUCKET;
        if (!bucket) throw new Error('FLOWS_BUCKET binding is missing; delivery was stopped safely.');

        const uniqueItems = [...new Map(parsedItems.map((item) => [item.id, item])).values()];
        for (const item of uniqueItems) {
          const assetKey = getFlowAssetKey(item.id);
          if (!assetKey) throw new Error(`Unknown product in order: ${item.id}`);
          const asset = await bucket.head(assetKey);
          if (!asset) throw new Error(`Required flow asset is missing from R2: ${assetKey}`);
        }

        const rawDownloadToken = generateSecureToken(32);
        const downloadTokenHash = await sha256Hex(rawDownloadToken);
        downloadTokenId = 'dlt_' + generateSecureToken(8);
        const downloadExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await db.prepare(
          `INSERT INTO order_download_tokens
           (id, order_id, token_hash, expires_at, created_by)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(downloadTokenId, orderId, downloadTokenHash, downloadExpiresAt, `admin:${user.email}`).run();

        const siteOrigin = getSiteOrigin(c.env);
        uniqueItems.forEach((item) => {
          downloadLinks.push({
            title: item.title,
            url: `${siteOrigin}/api/downloads/${rawDownloadToken}/${encodeURIComponent(item.id)}`,
          });
        });
      }

      await sendFulfillmentEmail({
        resendApiKey: c.env.RESEND_API_KEY,
        customerEmail: order.customer_email,
        orderId,
        networkLabel: payment?.currency || 'TRC-20',
        items: parsedItems,
        downloadLinks,
        deliveryMethod: order.delivery_method,
      });

      const nextFulfillmentStatus = order.delivery_method === 'geelark_setup'
        ? 'setup_in_progress'
        : 'package_delivered';

      const updates = [
        db.prepare(
          `UPDATE orders
           SET fulfillment_status = ?, delivered_at = CASE WHEN ? = 'package_delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).bind(nextFulfillmentStatus, nextFulfillmentStatus, orderId),
        db.prepare(
          `UPDATE order_fulfillment_logs SET status = 'dispatched', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(logId),
      ];

      if (downloadTokenId) {
        updates.push(
          db.prepare(
            `UPDATE order_download_tokens
             SET revoked_at = CURRENT_TIMESTAMP
             WHERE order_id = ? AND id != ? AND revoked_at IS NULL`
          ).bind(orderId, downloadTokenId)
        );
      }

      await db.batch(updates);

      await recordAuditLog(db, {
        adminId: user.id,
        adminEmail: user.email,
        ip: c.req.header('cf-connecting-ip') || '127.0.0.1',
        userAgent: c.req.header('user-agent'),
        action: 'FULFILLMENT_DISPATCHED',
        entityType: 'order',
        entityId: orderId,
        newState: nextFulfillmentStatus,
        reason: body.reason || 'Admin triggered secure fulfillment delivery',
      });

      return c.json({ success: true, message: `Secure fulfillment email sent to ${order.customer_email}.`, orderId });
    } catch (deliveryErr) {
      if (downloadTokenId) {
        await db.prepare(
          'UPDATE order_download_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(downloadTokenId).run().catch(() => {});
      }
      await db.batch([
        db.prepare(
          `UPDATE order_fulfillment_logs
           SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(deliveryErr.message, logId),
        db.prepare(
          `UPDATE orders SET fulfillment_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(orderId),
      ]).catch(() => {});
      throw deliveryErr;
    }
  } catch (err) {
    console.error('Resend fulfillment error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// ----------------------------------------------------
// ADMIN WORKFLOWS APIS
// ----------------------------------------------------

// GET /api/admin/workflows
app.get('/admin/workflows', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;

  const derivedBaselineCatalog = (products || []).map((wf) => ({
    id: wf.id,
    platform: wf.platform,
    title: wf.title,
    price: Number(wf.price),
    category: wf.details?.category || 'Automation',
  }));

  try {
    let orderSalesMap = {};
    if (db) {
      const orders = await db.prepare("SELECT items FROM orders WHERE status IN ('paid', 'processing', 'completed')").all();
      (orders?.results || []).forEach((row) => {
        try {
          const items = JSON.parse(row.items || '[]');
          items.forEach((item) => {
            if (item.id) {
              orderSalesMap[item.id] = (orderSalesMap[item.id] || 0) + (item.quantity || 1);
            }
          });
        } catch (e) {}
      });
    }

    const enrichedCatalog = derivedBaselineCatalog.map((wf) => ({
      ...wf,
      units_sold: orderSalesMap[wf.id] || 0,
      total_sales_usd: (orderSalesMap[wf.id] || 0) * wf.price,
    }));

    return c.json({ success: true, workflows: enrichedCatalog });
  } catch (err) {
    console.error('Workflows catalog API error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// ----------------------------------------------------
// ADMIN COUPON MANAGEMENT APIS
// ----------------------------------------------------

// GET /api/admin/coupons
app.get('/admin/coupons', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  try {
    const rows = await db.prepare(`
      SELECT c.*,
             (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id) AS redemption_count
      FROM coupon_codes c
      ORDER BY c.created_at DESC
    `).all();

    return c.json({
      success: true,
      coupons: (rows?.results || []).map((coupon) => ({
        ...coupon,
        active: Number(coupon.active) === 1,
        discount_value_display: coupon.discount_type === 'percentage'
          ? `${Number(coupon.discount_value)}%`
          : `$${(Number(coupon.discount_value) / 100).toFixed(2)}`,
        min_subtotal_usd: Number(coupon.min_subtotal_cents || 0) / 100,
        redemption_count: Number(coupon.redemption_count || 0),
      })),
    });
  } catch (err) {
    console.error('Admin coupons fetch error:', err.message);
    return c.json({ success: false, error: 'Coupons could not be loaded.' }, 500);
  }
});

// POST /api/admin/coupons
app.post('/admin/coupons', adminAuthMiddleware, requireRole('SUPER_ADMIN'), async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);
  const user = c.get('adminUser');

  try {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ success: false, error: 'Invalid coupon request.' }, 400);
    }

    const code = normalizeCouponCode(body.code);
    const description = String(body.description || '').trim().slice(0, 120) || null;
    const discountType = String(body.discount_type || '').trim();
    const submittedValue = Number(body.discount_value);
    const minSubtotalUsd = Number(body.min_subtotal_usd || 0);
    const maxRedemptions = body.max_redemptions === '' || body.max_redemptions === null || body.max_redemptions === undefined
      ? null
      : Number(body.max_redemptions);

    if (!isValidCouponCodeFormat(code)) {
      return c.json({ success: false, error: 'Code must be 3–32 characters using letters, numbers, hyphens, or underscores.' }, 400);
    }
    if (!['percentage', 'fixed_amount'].includes(discountType)) {
      return c.json({ success: false, error: 'Discount type must be percentage or fixed amount.' }, 400);
    }
    if (!Number.isFinite(submittedValue) || submittedValue <= 0) {
      return c.json({ success: false, error: 'Discount value must be greater than zero.' }, 400);
    }

    let storedDiscountValue;
    if (discountType === 'percentage') {
      if (!Number.isInteger(submittedValue) || submittedValue > 100) {
        return c.json({ success: false, error: 'Percentage discounts must be a whole number from 1 to 100.' }, 400);
      }
      storedDiscountValue = submittedValue;
    } else {
      storedDiscountValue = usdToCents(submittedValue);
      if (storedDiscountValue <= 0 || storedDiscountValue > 100000000) {
        return c.json({ success: false, error: 'Fixed discount amount is outside the supported range.' }, 400);
      }
    }

    if (!Number.isFinite(minSubtotalUsd) || minSubtotalUsd < 0) {
      return c.json({ success: false, error: 'Minimum subtotal cannot be negative.' }, 400);
    }
    if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 1000000)) {
      return c.json({ success: false, error: 'Usage limit must be a whole number between 1 and 1,000,000.' }, 400);
    }

    const parseOptionalDate = (value) => {
      if (!value) return null;
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
    };
    const startsAt = parseOptionalDate(body.starts_at);
    const expiresAt = parseOptionalDate(body.expires_at);
    if (body.starts_at && !startsAt) return c.json({ success: false, error: 'Start date is invalid.' }, 400);
    if (body.expires_at && !expiresAt) return c.json({ success: false, error: 'Expiry date is invalid.' }, 400);
    if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
      return c.json({ success: false, error: 'Expiry date must be later than the start date.' }, 400);
    }

    const couponId = 'cpn_' + generateSecureToken(10);
    await db.prepare(`
      INSERT INTO coupon_codes
        (id, code, description, discount_type, discount_value, min_subtotal_cents,
         max_redemptions, active, starts_at, expires_at, created_by_admin_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      couponId,
      code,
      description,
      discountType,
      storedDiscountValue,
      usdToCents(minSubtotalUsd),
      maxRedemptions,
      body.active === false ? 0 : 1,
      startsAt,
      expiresAt,
      user?.id || null,
    ).run();

    await recordAuditLog(db, {
      adminId: user?.id,
      adminEmail: user?.email,
      ip: c.req.header('cf-connecting-ip') || '127.0.0.1',
      userAgent: c.req.header('user-agent'),
      action: 'COUPON_CREATED',
      entityType: 'coupon',
      entityId: couponId,
      newState: code,
      metadata: { discountType, discountValue: storedDiscountValue, maxRedemptions },
    });

    return c.json({ success: true, message: `Coupon ${code} created.`, id: couponId, code }, 201);
  } catch (err) {
    console.error('Admin coupon creation error:', err.message);
    if (/unique|constraint/i.test(err.message || '')) {
      return c.json({ success: false, error: 'A coupon with this code already exists.' }, 409);
    }
    return c.json({ success: false, error: 'Coupon could not be created.' }, 500);
  }
});

// PATCH /api/admin/coupons/:id — activation is the only mutable property;
// financial terms remain immutable once created for reliable order auditing.
app.patch('/admin/coupons/:id', adminAuthMiddleware, requireRole('SUPER_ADMIN'), async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);
  const user = c.get('adminUser');
  const couponId = c.req.param('id');

  try {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.active !== 'boolean') {
      return c.json({ success: false, error: 'The active field must be true or false.' }, 400);
    }
    const existing = await db.prepare('SELECT id, code, active FROM coupon_codes WHERE id = ?').bind(couponId).first();
    if (!existing) return c.json({ success: false, error: 'Coupon not found.' }, 404);

    await db.prepare('UPDATE coupon_codes SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(body.active ? 1 : 0, couponId)
      .run();

    await recordAuditLog(db, {
      adminId: user?.id,
      adminEmail: user?.email,
      ip: c.req.header('cf-connecting-ip') || '127.0.0.1',
      userAgent: c.req.header('user-agent'),
      action: body.active ? 'COUPON_ACTIVATED' : 'COUPON_DEACTIVATED',
      entityType: 'coupon',
      entityId: couponId,
      previousState: Number(existing.active) === 1 ? 'active' : 'inactive',
      newState: body.active ? 'active' : 'inactive',
    });

    return c.json({ success: true, id: couponId, code: existing.code, active: body.active });
  } catch (err) {
    console.error('Admin coupon update error:', err.message);
    return c.json({ success: false, error: 'Coupon status could not be updated.' }, 500);
  }
});

// ----------------------------------------------------
// ADMIN IN-SITE NOTIFICATION CAMPAIGNS
// ----------------------------------------------------

app.get('/admin/notifications', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);
  try {
    const rows = await db.prepare(`
      SELECT n.*,
             c.code AS coupon_code,
             (SELECT COUNT(*) FROM storefront_notification_receipts r WHERE r.notification_id = n.id) AS delivered_count,
             (SELECT COUNT(*) FROM storefront_notification_receipts r WHERE r.notification_id = n.id AND r.read_at IS NOT NULL) AS read_count,
             (SELECT COUNT(*) FROM storefront_notification_receipts r WHERE r.notification_id = n.id AND r.dismissed_at IS NOT NULL) AS dismissed_count,
             (SELECT COUNT(*) FROM storefront_push_deliveries p WHERE p.notification_id = n.id AND p.status = 'sent') AS push_sent_count,
             (SELECT COUNT(*) FROM storefront_push_deliveries p WHERE p.notification_id = n.id AND p.status = 'failed') AS push_failed_count,
             (SELECT COUNT(*) FROM storefront_push_deliveries p WHERE p.notification_id = n.id AND p.status = 'gone') AS push_gone_count
      FROM storefront_notifications n
      LEFT JOIN coupon_codes c ON c.id = n.coupon_id
      ORDER BY n.created_at DESC
    `).all();
    const subscriberRow = await db.prepare('SELECT COUNT(*) AS count FROM storefront_push_subscriptions WHERE active = 1').first();
    return c.json({
      success: true,
      push_configured: webPushConfigured(c.env),
      active_push_subscribers: Number(subscriberRow?.count || 0),
      notifications: (rows?.results || []).map((row) => ({
        ...row,
        active: Number(row.active) === 1,
        push_enabled: Number(row.push_enabled) === 1,
        delivered_count: Number(row.delivered_count || 0),
        read_count: Number(row.read_count || 0),
        dismissed_count: Number(row.dismissed_count || 0),
        push_sent_count: Number(row.push_sent_count || 0),
        push_failed_count: Number(row.push_failed_count || 0),
        push_gone_count: Number(row.push_gone_count || 0),
      })),
    });
  } catch (err) {
    console.error('Admin notification fetch error:', err.message);
    return c.json({ success: false, error: 'Notification campaigns could not be loaded.' }, 500);
  }
});

app.post('/admin/notifications', adminAuthMiddleware, requireRole('SUPER_ADMIN'), async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);
  const user = c.get('adminUser');
  try {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ success: false, error: 'Invalid notification request.' }, 400);
    }

    const title = String(body.title || '').trim();
    const message = String(body.message || '').trim();
    const audienceType = String(body.audience_type || '').trim();
    const productId = String(body.product_id || '').trim() || null;
    const couponId = String(body.coupon_id || '').trim() || null;
    const ctaLabel = String(body.cta_label || '').trim() || null;
    const ctaUrl = normalizeInternalCtaUrl(body.cta_url, couponId ? '/checkout' : '/');
    const pushEnabled = body.push_enabled === true;

    if (title.length < 3 || title.length > 80) {
      return c.json({ success: false, error: 'Title must contain 3–80 characters.' }, 400);
    }
    if (message.length < 5 || message.length > 280) {
      return c.json({ success: false, error: 'Message must contain 5–280 characters.' }, 400);
    }
    if (!['all', 'active_cart', 'product_cart'].includes(audienceType)) {
      return c.json({ success: false, error: 'Choose a valid notification audience.' }, 400);
    }
    if (audienceType === 'product_cart' && !AUTHORITATIVE_CATALOG_MAP.has(productId)) {
      return c.json({ success: false, error: 'Choose a valid flow for product-cart targeting.' }, 400);
    }
    if (ctaLabel && (ctaLabel.length < 2 || ctaLabel.length > 40)) {
      return c.json({ success: false, error: 'CTA label must contain 2–40 characters.' }, 400);
    }
    if (ctaUrl === null) {
      return c.json({ success: false, error: 'CTA URL must be an internal path beginning with one slash.' }, 400);
    }
    if (pushEnabled && !webPushConfigured(c.env)) {
      return c.json({ success: false, error: 'Browser push keys are not configured.' }, 503);
    }
    if (pushEnabled && body.active === false) {
      return c.json({ success: false, error: 'Activate the campaign before sending browser push.' }, 400);
    }

    if (couponId) {
      const coupon = await db.prepare('SELECT id FROM coupon_codes WHERE id = ?').bind(couponId).first();
      if (!coupon) return c.json({ success: false, error: 'Selected coupon was not found.' }, 400);
    }

    const parseOptionalDate = (value) => {
      if (!value) return null;
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
    };
    const startsAt = parseOptionalDate(body.starts_at);
    const expiresAt = parseOptionalDate(body.expires_at);
    if (body.starts_at && !startsAt) return c.json({ success: false, error: 'Start date is invalid.' }, 400);
    if (body.expires_at && !expiresAt) return c.json({ success: false, error: 'Expiry date is invalid.' }, 400);
    if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
      return c.json({ success: false, error: 'Expiry date must be later than the start date.' }, 400);
    }
    if (pushEnabled && startsAt && Date.parse(startsAt) > Date.now() + 60000) {
      return c.json({ success: false, error: 'Browser push sends immediately. Remove the future start time or turn off browser push.' }, 400);
    }

    const notificationId = 'ntf_' + generateSecureToken(10);
    await db.prepare(`
      INSERT INTO storefront_notifications
        (id, title, message, audience_type, product_id, coupon_id, cta_label,
         cta_url, push_enabled, active, starts_at, expires_at, created_by_admin_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      notificationId,
      title,
      message,
      audienceType,
      audienceType === 'product_cart' ? productId : null,
      couponId,
      ctaLabel,
      ctaUrl,
      pushEnabled ? 1 : 0,
      body.active === false ? 0 : 1,
      startsAt,
      expiresAt,
      user?.id || null,
    ).run();

    await recordAuditLog(db, {
      adminId: user?.id,
      adminEmail: user?.email,
      ip: c.req.header('cf-connecting-ip') || '127.0.0.1',
      userAgent: c.req.header('user-agent'),
      action: 'STOREFRONT_NOTIFICATION_CREATED',
      entityType: 'notification',
      entityId: notificationId,
      newState: title,
      metadata: { audienceType, productId: audienceType === 'product_cart' ? productId : null, couponId, pushEnabled },
    });

    const push = pushEnabled
      ? await sendBrowserPushCampaign(db, c.env, notificationId)
      : { sent: 0, failed: 0, gone: 0, skipped: 0 };
    const pushSummary = pushEnabled
      ? ` Browser push: ${push.sent} sent, ${push.failed + push.gone} failed or expired.`
      : '';
    return c.json({
      success: true,
      id: notificationId,
      message: `In-site notification campaign created.${pushSummary}`,
      push,
    }, 201);
  } catch (err) {
    console.error('Admin notification creation error:', err.message);
    return c.json({ success: false, error: 'Notification campaign could not be created.' }, 500);
  }
});

app.patch('/admin/notifications/:id', adminAuthMiddleware, requireRole('SUPER_ADMIN'), async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);
  const user = c.get('adminUser');
  const notificationId = c.req.param('id');
  try {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.active !== 'boolean') {
      return c.json({ success: false, error: 'The active field must be true or false.' }, 400);
    }
    const existing = await db.prepare('SELECT id, title, active FROM storefront_notifications WHERE id = ?')
      .bind(notificationId).first();
    if (!existing) return c.json({ success: false, error: 'Notification campaign not found.' }, 404);

    await db.prepare('UPDATE storefront_notifications SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(body.active ? 1 : 0, notificationId).run();
    await recordAuditLog(db, {
      adminId: user?.id,
      adminEmail: user?.email,
      ip: c.req.header('cf-connecting-ip') || '127.0.0.1',
      userAgent: c.req.header('user-agent'),
      action: body.active ? 'STOREFRONT_NOTIFICATION_ACTIVATED' : 'STOREFRONT_NOTIFICATION_DEACTIVATED',
      entityType: 'notification',
      entityId: notificationId,
      previousState: Number(existing.active) === 1 ? 'active' : 'inactive',
      newState: body.active ? 'active' : 'inactive',
    });
    return c.json({ success: true, id: notificationId, active: body.active });
  } catch (err) {
    console.error('Admin notification update error:', err.message);
    return c.json({ success: false, error: 'Notification status could not be updated.' }, 500);
  }
});

// ----------------------------------------------------
// ADMIN CUSTOMERS APIS
// ----------------------------------------------------

// GET /api/admin/customers
app.get('/admin/customers', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  try {
    const rows = await db.prepare(`
      SELECT customer_email as email,
             COUNT(*) as order_count,
             SUM(CASE WHEN status IN ('paid', 'processing', 'completed') THEN total_usd ELSE 0 END) as total_spent,
             MIN(created_at) as first_order_at,
             MAX(created_at) as last_order_at,
             MAX(status) as latest_status
      FROM orders
      GROUP BY customer_email
      ORDER BY total_spent DESC, order_count DESC
    `).all();

    return c.json({ success: true, customers: rows?.results || [] });
  } catch (err) {
    console.error('Customers API error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// GET /api/admin/customers/:email
app.get('/admin/customers/:email', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  const email = decodeURIComponent(c.req.param('email')).toLowerCase().trim();

  try {
    const orders = await db.prepare(
      'SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC'
    ).bind(email).all();

    const payments = await db.prepare(`
      SELECT p.*
      FROM crypto_payments p
      JOIN orders o ON p.order_id = o.id
      WHERE o.customer_email = ?
      ORDER BY p.created_at DESC
    `).bind(email).all();

    let allPurchasedItems = [];
    (orders?.results || []).forEach((ord) => {
      try {
        const items = JSON.parse(ord.items || '[]');
        items.forEach((item) => allPurchasedItems.push({ ...item, orderId: ord.id, purchasedAt: ord.created_at }));
      } catch (e) {}
    });

    return c.json({
      success: true,
      customer: {
        email,
        total_orders: orders?.results?.length || 0,
        orders: orders?.results || [],
        payments: payments?.results || [],
        purchased_workflows: allPurchasedItems,
      },
    });
  } catch (err) {
    console.error('Customer profile API error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// ----------------------------------------------------
// ADMIN MAIL / INBOX APIS
// ----------------------------------------------------

// GET /api/admin/mail
app.get('/admin/mail', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  try {
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(c.req.query('pageSize') || '25', 10)));
    const offset = (page - 1) * pageSize;

    const search = (c.req.query('search') || '').trim();
    const filter = (c.req.query('filter') || 'all').trim();
    const orderId = (c.req.query('order_id') || '').trim();

    let whereClauses = [];
    let queryParams = [];

    if (search) {
      whereClauses.push('(from_address LIKE ? OR from_name LIKE ? OR subject LIKE ? OR text_body LIKE ? OR order_id LIKE ?)');
      const s = `%${search}%`;
      queryParams.push(s, s, s, s, s);
    }

    if (filter === 'unread') {
      whereClauses.push('is_read = 0 AND is_archived = 0');
    } else if (filter === 'read') {
      whereClauses.push('is_read = 1 AND is_archived = 0');
    } else if (filter === 'archived') {
      whereClauses.push('is_archived = 1');
    } else {
      // 'all' excludes archived unless searched specifically
      whereClauses.push('is_archived = 0');
    }

    if (orderId) {
      whereClauses.push('order_id = ?');
      queryParams.push(orderId);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = await db.prepare(`SELECT COUNT(*) as total FROM inbound_emails ${whereSql}`).bind(...queryParams).first();
    const total = Number(countRow?.total || 0);

    const unreadCountRow = await db.prepare(
      'SELECT COUNT(*) as count FROM inbound_emails WHERE is_read = 0 AND is_archived = 0'
    ).first();

    const rows = await db.prepare(`
      SELECT e.id, e.provider_email_id, e.from_address, e.from_name, e.to_addresses, e.subject,
             substr(e.text_body, 1, 140) as snippet, e.received_at, e.is_read, e.is_archived, e.order_id, e.customer_email,
             (SELECT COUNT(*) FROM email_attachments a WHERE a.inbound_email_id = e.id) as attachment_count
      FROM inbound_emails e
      ${whereSql}
      ORDER BY e.received_at DESC
      LIMIT ? OFFSET ?
    `).bind(...queryParams, pageSize, offset).all();

    return c.json({
      success: true,
      emails: rows?.results || [],
      unread_count: Number(unreadCountRow?.count || 0),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (err) {
    console.error('Admin mail list error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// GET /api/admin/mail/:id
app.get('/admin/mail/:id', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  const emailId = c.req.param('id');

  try {
    const email = await db.prepare('SELECT * FROM inbound_emails WHERE id = ?').bind(emailId).first();
    if (!email) {
      return c.json({ success: false, error: `Email "${emailId}" not found.` }, 404);
    }

    // Automatically mark as read on open
    if (email.is_read === 0) {
      await db.prepare('UPDATE inbound_emails SET is_read = 1 WHERE id = ?').bind(emailId).run();
      email.is_read = 1;
    }

    // Self-heal body if empty and provider_email_id is present
    if ((!email.html_body && !email.text_body) && email.provider_email_id && c.env?.RESEND_API_KEY) {
      try {
        const fullContent = await fetchInboundEmailFromResend(c.env.RESEND_API_KEY, email.provider_email_id);
        if (fullContent) {
          const textBody = fullContent.text || '';
          const htmlBody = fullContent.html || '';
          if (textBody || htmlBody) {
            await db.prepare('UPDATE inbound_emails SET text_body = ?, html_body = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .bind(textBody, htmlBody, emailId).run();
            email.text_body = textBody;
            email.html_body = htmlBody;
          }
        }
      } catch (healErr) {
        console.warn('Failed on-demand Resend content heal:', healErr.message);
      }
    }

    const attachments = await db.prepare(
      `SELECT id, inbound_email_id, provider_attachment_id, filename, content_type, size_bytes
       FROM email_attachments WHERE inbound_email_id = ?`
    ).bind(emailId).all();

    let linkedOrder = null;
    if (email.order_id) {
      linkedOrder = await db.prepare(`
        SELECT o.id, o.customer_email, o.total_usd, o.status, o.fulfillment_status, o.created_at,
               p.currency as payment_currency, p.status as payment_status
        FROM orders o
        LEFT JOIN crypto_payments p ON o.id = p.order_id
        WHERE o.id = ?
      `).bind(email.order_id).first();
    }

    // Associated Thread Messages
    let thread = [];
    if (email.message_id || email.in_reply_to) {
      thread = await db.prepare(`
        SELECT id, from_address, from_name, subject, received_at
        FROM inbound_emails
        WHERE (in_reply_to = ? OR message_id = ? OR id = ?) AND id != ?
        ORDER BY received_at ASC
      `).bind(email.message_id || 'none', email.in_reply_to || 'none', email.id, emailId).all().catch(() => ({ results: [] }));
    }

    return c.json({
      success: true,
      email: {
        ...email,
        to_addresses: JSON.parse(email.to_addresses || '[]'),
        cc_addresses: JSON.parse(email.cc_addresses || '[]'),
      },
      attachments: attachments?.results || [],
      linked_order: linkedOrder || null,
      thread: thread?.results || [],
    });
  } catch (err) {
    console.error('Admin email detail error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// GET /api/admin/mail/:id/attachments/:attachmentId — authenticated provider proxy
app.get('/admin/mail/:id/attachments/:attachmentId', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  const resendApiKey = c.env?.RESEND_API_KEY;
  if (!db || !resendApiKey) {
    return c.json({ success: false, error: 'Attachment service is unavailable.' }, 503);
  }

  try {
    const emailId = c.req.param('id');
    const attachmentId = c.req.param('attachmentId');
    const attachment = await db.prepare(
      `SELECT filename, content_type, storage_reference
       FROM email_attachments WHERE id = ? AND inbound_email_id = ?`
    ).bind(attachmentId, emailId).first();

    if (!attachment?.storage_reference) {
      return c.json({ success: false, error: 'Attachment not found.' }, 404);
    }

    const providerUrl = new URL(attachment.storage_reference);
    const hostname = providerUrl.hostname.toLowerCase();
    if (providerUrl.protocol !== 'https:' || !(hostname === 'resend.com' || hostname.endsWith('.resend.com'))) {
      return c.json({ success: false, error: 'Attachment provider is not trusted.' }, 400);
    }

    const upstream = await fetch(providerUrl.toString(), {
      headers: { Authorization: `Bearer ${resendApiKey}` },
    });
    if (!upstream.ok || !upstream.body) {
      return c.json({ success: false, error: 'Attachment has expired or is unavailable.' }, 502);
    }

    const filename = String(attachment.filename || 'attachment').replace(/["\r\n]/g, '_');
    const headers = new Headers({
      'Content-Type': attachment.content_type || upstream.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
    });
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);
    return new Response(upstream.body, { status: 200, headers });
  } catch (err) {
    console.error('Attachment proxy error:', err.message);
    return c.json({ success: false, error: 'Attachment could not be downloaded.' }, 500);
  }
});

// PATCH /api/admin/mail/:id/read
app.patch('/admin/mail/:id/read', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  const emailId = c.req.param('id');
  try {
    const body = await c.req.json().catch(() => ({}));
    const isRead = body.is_read !== undefined ? (body.is_read ? 1 : 0) : 1;

    await db.prepare('UPDATE inbound_emails SET is_read = ? WHERE id = ?').bind(isRead, emailId).run();
    return c.json({ success: true, emailId, is_read: isRead });
  } catch (err) {
    console.error('Mail read-state update error:', err.message);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// PATCH /api/admin/mail/:id/archive
app.patch('/admin/mail/:id/archive', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  const emailId = c.req.param('id');
  try {
    const body = await c.req.json().catch(() => ({}));
    const isArchived = body.is_archived !== undefined ? (body.is_archived ? 1 : 0) : 1;

    await db.prepare('UPDATE inbound_emails SET is_archived = ? WHERE id = ?').bind(isArchived, emailId).run();
    return c.json({ success: true, emailId, is_archived: isArchived });
  } catch (err) {
    console.error('Mail archive-state update error:', err.message);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// POST /api/admin/mail/:id/link-order
app.post('/admin/mail/:id/link-order', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  const emailId = c.req.param('id');
  const user = c.get('adminUser');

  try {
    const body = await c.req.json();
    const { order_id } = body;

    let targetOrderId = order_id ? order_id.trim() : null;
    let customerEmail = null;

    if (targetOrderId) {
      const order = await db.prepare('SELECT id, customer_email FROM orders WHERE id = ?').bind(targetOrderId).first();
      if (!order) {
        return c.json({ success: false, error: `Order "${targetOrderId}" not found.` }, 404);
      }
      customerEmail = order.customer_email;
    }

    await db.prepare(
      'UPDATE inbound_emails SET order_id = ?, customer_email = COALESCE(?, customer_email), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(targetOrderId, customerEmail, emailId).run();

    await recordAuditLog(db, {
      adminId: user.id,
      adminEmail: user.email,
      ip: c.req.header('cf-connecting-ip') || '127.0.0.1',
      userAgent: c.req.header('user-agent'),
      action: 'EMAIL_ORDER_LINKED',
      entityType: 'mail',
      entityId: emailId,
      newState: targetOrderId || 'UNLINKED',
    });

    return c.json({ success: true, emailId, order_id: targetOrderId });
  } catch (err) {
    console.error('Mail order-link update error:', err.message);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// POST /api/admin/mail/:id/reply
app.post('/admin/mail/:id/reply', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  const emailId = c.req.param('id');
  const user = c.get('adminUser');
  const resendApiKey = c.env?.RESEND_API_KEY;

  if (!resendApiKey) {
    return c.json({ success: false, error: 'RESEND_API_KEY secret is not configured in environment bindings.' }, 500);
  }

  try {
    const email = await db?.prepare('SELECT * FROM inbound_emails WHERE id = ?').bind(emailId).first();
    if (!email) {
      return c.json({ success: false, error: 'Inbound email record not found.' }, 404);
    }

    const body = await c.req.json();
    const adminMessage = (body.body || body.text || '').trim();

    if (!adminMessage) {
      return c.json({ success: false, error: 'Reply content is required.' }, 400);
    }

    const replySubject = formatReplySubject(email.subject);
    const headers = {};
    if (email.message_id) {
      headers['In-Reply-To'] = email.message_id;
      headers['References'] = email.message_id;
    }

    // Render Dedicated GeeLark Customer Support Reply Email
    const { html, plainText } = renderAdminSupportReplyEmail({
      customerName: email.from_name || '',
      adminMessage: adminMessage,
      orderId: email.order_id || null,
      originalSubject: email.subject,
    });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GeeLark Support <support@geelarkflows.com>',
        to: [email.from_address],
        subject: replySubject,
        text: plainText,
        html: html,
        headers,
      }),
    });

    const resData = await response.json();
    if (!response.ok || resData.error || resData.statusCode >= 400) {
      const errorMsg = resData.message || resData.error?.message || JSON.stringify(resData);
      throw new Error(`Resend API Error (${response.status}): ${errorMsg}`);
    }

    await recordAuditLog(db, {
      adminId: user.id,
      adminEmail: user.email,
      ip: c.req.header('cf-connecting-ip') || '127.0.0.1',
      userAgent: c.req.header('user-agent'),
      action: 'EMAIL_REPLY_SENT',
      entityType: 'mail',
      entityId: emailId,
      metadata: {
        recipient: email.from_address,
        subject: replySubject,
        resend_id: resData.id,
      },
    });

    return c.json({ success: true, message: `Reply sent successfully to ${email.from_address}`, data: resData });
  } catch (err) {
    console.error('Email reply send error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// ----------------------------------------------------
// ADMIN ACTIVITY / AUDIT LOG API (Append-Only)
// ----------------------------------------------------

// GET /api/admin/activity
app.get('/admin/activity', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  try {
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(c.req.query('pageSize') || '50', 10)));
    const offset = (page - 1) * pageSize;

    const action = (c.req.query('action') || '').trim();
    const entityType = (c.req.query('entity') || '').trim();

    let whereClauses = [];
    let queryParams = [];

    if (action) {
      whereClauses.push('action = ?');
      queryParams.push(action);
    }
    if (entityType) {
      whereClauses.push('entity_type = ?');
      queryParams.push(entityType);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = await db.prepare(`SELECT COUNT(*) as total FROM audit_logs ${whereSql}`).bind(...queryParams).first();
    const total = Number(countRow?.total || 0);

    const logs = await db.prepare(`
      SELECT * FROM audit_logs
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...queryParams, pageSize, offset).all();

    return c.json({
      success: true,
      logs: logs?.results || [],
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (err) {
    console.error('Activity API error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// ----------------------------------------------------
// ADMIN SETTINGS & HEALTH API
// ----------------------------------------------------

// GET /api/admin/settings
app.get('/admin/settings', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  const user = c.get('adminUser');

  let dbOk = false;
  let adminCount = 0;
  let activeSessions = 0;
  let totalEmails = 0;

  if (db) {
    try {
      const dbCheck = await db.prepare('SELECT COUNT(*) as count FROM admin_users').first();
      adminCount = Number(dbCheck?.count || 0);
      const sesCheck = await db.prepare('SELECT COUNT(*) as count FROM admin_sessions WHERE expires_at > CURRENT_TIMESTAMP').first();
      activeSessions = Number(sesCheck?.count || 0);
      const mailCheck = await db.prepare('SELECT COUNT(*) as count FROM inbound_emails').first().catch(() => ({ count: 0 }));
      totalEmails = Number(mailCheck?.count || 0);
      dbOk = true;
    } catch (e) {}
  }

  return c.json({
    success: true,
    health: {
      database_d1: dbOk ? 'healthy' : 'error',
      storage_r2: c.env?.FLOWS_BUCKET ? 'configured' : 'unbound',
      nowpayments_gateway: Boolean(c.env?.NOWPAYMENTS_API_KEY || c.env?.CRYPTO_GATEWAY_API_KEY) ? 'configured' : 'missing',
      resend_email: Boolean(c.env?.RESEND_API_KEY) ? 'configured' : 'missing',
      resend_inbound_webhook: Boolean(c.env?.RESEND_WEBHOOK_SECRET) ? 'configured' : 'unconfigured_optional',
      crypto_webhook_hmac: Boolean(c.env?.CRYPTO_WEBHOOK_SECRET) ? 'configured' : 'missing',
    },
    system: {
      admin_users_count: adminCount,
      active_sessions_count: activeSessions,
      inbound_emails_count: totalEmails,
      current_user: user,
    },
  });
});

// ----------------------------------------------------
// RESEND PRODUCTION LIVE DIAGNOSTICS & VERIFICATION APIS
// ----------------------------------------------------

// POST /api/admin/resend/diagnostics
app.post('/admin/resend/diagnostics', adminAuthMiddleware, requireRole('SUPER_ADMIN'), async (c) => {
  const apiKey = c.env?.RESEND_API_KEY;
  if (!apiKey) {
    return c.json({ success: false, error: 'RESEND_API_KEY is missing from Cloudflare environment bindings.' }, 500);
  }

  try {
    // 1. Fetch Domains
    const domainsRes = await fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const domainsData = await domainsRes.json();

    // 2. Fetch Webhooks
    const webhooksRes = await fetch('https://api.resend.com/webhooks', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const webhooksData = await webhooksRes.json();

    // 3. Fetch Inbound Receiving Status / Recent Inbound Emails
    let receivingEmails = [];
    try {
      const recvRes = await fetch('https://api.resend.com/emails/receiving', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const recvData = await recvRes.json();
      receivingEmails = recvData?.data || [];
    } catch (e) {}

    const hasWebhookSecret = Boolean(c.env?.RESEND_WEBHOOK_SECRET);

    return c.json({
      success: true,
      domains: domainsData?.data || domainsData,
      webhooks: webhooksData?.data || webhooksData,
      receiving_emails: receivingEmails,
      worker_secrets: {
        resend_api_key: 'CONFIGURED',
        resend_webhook_secret: hasWebhookSecret ? 'CONFIGURED' : 'MISSING',
      },
    });
  } catch (err) {
    console.error('Resend diagnostics error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// POST /api/admin/resend/ensure-webhook
app.post('/admin/resend/ensure-webhook', adminAuthMiddleware, requireRole('SUPER_ADMIN'), async (c) => {
  const apiKey = c.env?.RESEND_API_KEY;
  if (!apiKey) {
    return c.json({ success: false, error: 'RESEND_API_KEY is missing.' }, 500);
  }

  try {
    const targetUrl = 'https://geelarkflows.com/api/webhooks/resend';

    // 1. Check existing webhooks
    const listRes = await fetch('https://api.resend.com/webhooks', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const listData = await listRes.json();
    const existingList = listData?.data || [];

    const existingHook = existingList.find((w) => w.endpoint === targetUrl || w.url === targetUrl);
    if (existingHook) {
      return c.json({
        success: true,
        status: 'already_exists',
        webhook: existingHook,
      });
    }

    // 2. Create Webhook in Resend
    const createRes = await fetch('https://api.resend.com/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: targetUrl,
        events: ['email.received', 'email.delivery_delayed', 'email.bounced'],
      }),
    });

    const createData = await createRes.json();
    if (!createRes.ok) {
      throw new Error(`Resend Webhook Creation Error: ${createData.message || JSON.stringify(createData)}`);
    }

    return c.json({
      success: true,
      status: 'created',
      webhook: createData,
    });
  } catch (err) {
    console.error('Ensure webhook error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// POST /api/admin/resend/send-test-inbound
app.post('/admin/resend/send-test-inbound', adminAuthMiddleware, requireRole('SUPER_ADMIN'), async (c) => {
  const apiKey = c.env?.RESEND_API_KEY;
  if (!apiKey) return c.json({ success: false, error: 'RESEND_API_KEY missing.' }, 500);

  try {
    const body = await c.req.json().catch(() => ({}));
    const { to = 'support@geelarkflows.com', subject, text, orderId } = body;

    const emailSubject = subject || `Production Mail Test — GeeLark ${orderId ? `(#${orderId})` : ''}`;
    const emailBody = text || `This is a real production inbound email test.\n\n${orderId ? `Order reference:\n#${orderId}` : 'No order reference included.'}\n\nSent at: ${new Date().toISOString()}`;

    // Send email to geelarkflows.com domain via Resend outbound
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GeeLark Support <support@geelarkflows.com>',
        to: [to],
        subject: emailSubject,
        text: emailBody,
        html: `<p style="font-family: sans-serif; line-height: 1.6;">${emailBody.replace(/\n/g, '<br/>')}</p>`,
      }),
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      throw new Error(resendData.message || JSON.stringify(resendData));
    }

    return c.json({
      success: true,
      message: `Real test email sent to ${to}`,
      resend_response: resendData,
    });
  } catch (err) {
    console.error('Send test inbound error:', err);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// ----------------------------------------------------
// ADMIN CUSTOM AUTOMATION REQUESTS APIS
// ----------------------------------------------------

// GET /api/admin/custom-requests (List inbound leads)
app.get('/admin/custom-requests', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  try {
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)));
    const offset = (page - 1) * limit;
    const status = (c.req.query('status') || '').trim().toLowerCase();

    let query = 'SELECT * FROM custom_automation_requests';
    const params = [];
    if (status && status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const requests = await db.prepare(query).bind(...params).all();

    const countQuery = (status && status !== 'all')
      ? 'SELECT COUNT(*) as total FROM custom_automation_requests WHERE status = ?'
      : 'SELECT COUNT(*) as total FROM custom_automation_requests';
    const countRes = (status && status !== 'all')
      ? await db.prepare(countQuery).bind(status).first()
      : await db.prepare(countQuery).bind().first();

    return c.json({
      success: true,
      data: requests?.results || [],
      pagination: {
        page,
        limit,
        total: countRes?.total || 0,
      },
    });
  } catch (err) {
    console.error('Admin custom requests fetch error:', err.message);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// PATCH /api/admin/custom-requests/:id (Update lead status)
app.patch('/admin/custom-requests/:id', adminAuthMiddleware, async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);
  const user = c.get('adminUser');

  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { status } = body;

    const validStatuses = ['new', 'in_review', 'contacted', 'closed'];
    if (!status || !validStatuses.includes(status)) {
      return c.json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 400);
    }

    const existing = await db.prepare('SELECT id, status FROM custom_automation_requests WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Custom automation request not found' }, 404);
    }

    await db.prepare(`
      UPDATE custom_automation_requests
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(status, id).run();

    await recordAuditLog(db, {
      adminId: user?.id || null,
      adminEmail: user?.email || 'admin',
      ip: c.req.header('cf-connecting-ip') || '127.0.0.1',
      userAgent: c.req.header('user-agent'),
      action: 'CUSTOM_REQUEST_STATUS_UPDATED',
      entityType: 'lead',
      entityId: id,
      previousState: existing.status,
      newState: status,
    });

    return c.json({ success: true, message: 'Status updated successfully', id, status });
  } catch (err) {
    console.error('Admin custom request update error:', err.message);
    return c.json({ success: false, error: 'An internal server error occurred. Please try again shortly.' }, 500);
  }
});

// ----------------------------------------------------
// ROOT CLOUDFLARE WORKER ROUTER WITH SPA ASSETS FALLBACK
// ----------------------------------------------------
const mainApp = new Hono();
const PUBLIC_SPA_PATHS = new Set([
  '/',
  '/cart',
  '/checkout',
  '/contact',
  '/terms',
  '/privacy',
  '/refund-policy',
]);

function isKnownSpaPath(pathname) {
  const normalizedPath = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';
  if (PUBLIC_SPA_PATHS.has(normalizedPath) || normalizedPath === '/admin' || normalizedPath.startsWith('/admin/')) {
    return true;
  }

  const flowMatch = normalizedPath.match(/^\/flows\/([^/]+)$/);
  return Boolean(flowMatch && AUTHORITATIVE_CATALOG_MAP.has(flowMatch[1]));
}

mainApp.use('*', async (c, next) => {
  const requestUrl = new URL(c.req.url);
  const canonicalUrl = new URL(c.env?.SITE_URL || 'https://geelarkflows.com');
  const requestHostname = requestUrl.hostname.toLowerCase();
  const canonicalHostname = canonicalUrl.hostname.toLowerCase();
  const isCanonicalHostname = requestHostname === canonicalHostname;
  const isWwwHostname = requestHostname === `www.${canonicalHostname}`;

  // Never allow the public site or its legacy www hostname to serve a login,
  // checkout, or storefront response over plaintext HTTP. A 308 preserves the
  // request method for clients that accidentally call an API over HTTP.
  if ((isCanonicalHostname || isWwwHostname) && (requestUrl.protocol !== 'https:' || isWwwHostname)) {
    requestUrl.protocol = 'https:';
    requestUrl.hostname = canonicalHostname;
    requestUrl.port = canonicalUrl.port;
    return c.redirect(requestUrl.toString(), 308);
  }

  await next();

  // Apply these after downstream handlers so headers also survive raw static
  // asset Responses returned by the ASSETS binding.
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' https: blob:; connect-src 'self'",
  );
  if (requestUrl.protocol === 'https:') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
});

// Mount all API endpoints under /api
mainApp.route('/api', app);

// Forward root webhooks if sent directly to root
mainApp.post('/webhooks/crypto', (c) => app.fetch(new Request(new URL('/webhooks/crypto', c.req.url), c.req.raw), c.env, c.executionCtx));
mainApp.post('/webhooks/resend-inbound', (c) => app.fetch(new Request(new URL('/webhooks/resend', c.req.url), c.req.raw), c.env, c.executionCtx));

// Fallback to Cloudflare Workers Static Assets for all non-API / SPA routes (/cart, /checkout, /admin, etc.)
mainApp.all('*', async (c) => {
  if (c.env?.ASSETS) {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status === 404 && !c.req.path.includes('.') && isKnownSpaPath(c.req.path)) {
      // Fetch the root shell instead of /index.html. Cloudflare's default HTML
      // handling redirects /index.html to /, which would erase deep-link URLs
      // such as /admin/custom-requests.
      return c.env.ASSETS.fetch(new Request(new URL('/', c.req.url), c.req.raw));
    }
    return res;
  }
  return c.text('Not Found', 404);
});

export default mainApp;
