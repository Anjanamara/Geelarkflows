import { Hono } from 'hono';
import { products } from './data/products.js';

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

/**
 * Authoritative Supported USDT Payment Networks Configuration
 */
const SUPPORTED_USDT_NETWORKS = {
  trc20: {
    id: 'trc20',
    asset: 'USDT',
    network: 'TRC-20',
    blockchain: 'TRON',
    nowpayments_currency: 'usdttrc20',
    display_currency: 'USDT (TRC-20)',
    full_label: 'TRC-20 / TRON',
    min_amount_usd: 5,
    explorer_base: 'https://tronscan.org/#/transaction/',
    address_explorer: 'https://tronscan.org/#/address/',
  },
  erc20: {
    id: 'erc20',
    asset: 'USDT',
    network: 'ERC-20',
    blockchain: 'Ethereum',
    nowpayments_currency: 'usdterc20',
    display_currency: 'USDT (ERC-20)',
    full_label: 'ERC-20 / Ethereum',
    min_amount_usd: 15,
    explorer_base: 'https://etherscan.io/tx/',
    address_explorer: 'https://etherscan.io/address/',
  },
  bep20: {
    id: 'bep20',
    asset: 'USDT',
    network: 'BEP-20',
    blockchain: 'BNB Smart Chain',
    nowpayments_currency: 'usdtbsc',
    display_currency: 'USDT (BEP-20)',
    full_label: 'BEP-20 / BNB Chain',
    min_amount_usd: 5,
    explorer_base: 'https://bscscan.com/tx/',
    address_explorer: 'https://bscscan.com/address/',
  },
  sol: {
    id: 'sol',
    asset: 'USDT',
    network: 'SOL',
    blockchain: 'Solana',
    nowpayments_currency: 'usdtsol',
    display_currency: 'USDT (SOL)',
    full_label: 'SOL / Solana',
    min_amount_usd: 5,
    explorer_base: 'https://solscan.io/tx/',
    address_explorer: 'https://solscan.io/account/',
  },
};

function resolvePaymentNetwork(networkInput) {
  if (!networkInput) return SUPPORTED_USDT_NETWORKS['trc20'];
  const cleanKey = String(networkInput).toLowerCase().replace(/[^a-z0-9]/g, '');
  return SUPPORTED_USDT_NETWORKS[cleanKey] || null;
}

// ----------------------------------------------------
// SECURITY & CRYPTO HELPERS (WebCrypto Native)
// ----------------------------------------------------

const PBKDF2_ITERATIONS = 100000;
const HASH_ALGO_PREFIX = 'pbkdf2_sha256';

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
  const [, iterStr, saltHex, expectedHashHex] = parts;
  const iterations = parseInt(iterStr, 10) || PBKDF2_ITERATIONS;

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

function calculateOrderTotals(resolvedCart = [], deliveryMethod = 'download_package') {
  const workflowSubtotal = (resolvedCart || []).reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 1;
    return sum + price * quantity;
  }, 0);

  let setupFee = 0;
  if (deliveryMethod === 'geelark_setup') {
    setupFee = workflowSubtotal >= 300 ? 0 : 50;
  }

  const finalTotal = workflowSubtotal + setupFee;
  return {
    workflowSubtotal: Number(workflowSubtotal.toFixed(2)),
    setupFee: Number(setupFee.toFixed(2)),
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
            <td style="padding: 4px 0; text-align: right; font-family: monospace; color: #f1f3f1;">${customerEmail}</td>
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
 * Send Digital Assets Package via Resend API (Outbound)
 */
async function sendFulfillmentEmail({ resendApiKey, customerEmail, orderId, networkLabel, items, attachmentBuffer, fileName }) {
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY secret is missing in Cloudflare Workers environment bindings.');
  }

  let attachments = [];
  if (attachmentBuffer) {
    const base64Content = btoa(
      new Uint8Array(attachmentBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    attachments.push({
      filename: fileName || `geelark_flow_package_${orderId}.zip`,
      content: base64Content,
    });
  }

  const itemsHtml = items.map((i) => `<li><strong>${i.title}</strong> (${i.platform || 'GeeLark'}) — $${i.price}</li>`).join('');
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
      subject: `Your GeeLark Automation Package (Order #${orderId})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0f0d; color: #f1f3f1; padding: 28px; border-radius: 8px; border: 1px solid #222924;">
          <h2 style="color: #A7FF4F; margin-top: 0; font-size: 20px;">GeeLark Flows — Purchase Delivered</h2>
          <p style="color: #c0c6c2; font-size: 14px; line-height: 1.5;">
            Thank you! Your package has been prepared and is attached below.
          </p>
          <div style="background: #141815; padding: 16px; border-radius: 6px; margin: 20px 0; border: 1px solid #232a25;">
            <p style="margin: 0 0 6px 0; font-size: 12px; color: #828c85; font-family: monospace;">ORDER ID: <strong>${orderId}</strong></p>
            <p style="margin: 0 0 12px 0; font-size: 12px; color: #828c85; font-family: monospace;">PAYMENT METHOD: <strong style="color: #A7FF4F;">USDT (${networkLabel || 'TRC-20'})</strong></p>
            <ul style="margin: 0; padding-left: 20px; color: #e1e6e2; font-size: 14px;">
              ${itemsHtml}
            </ul>
          </div>
          <p style="color: #c0c6c2; font-size: 14px; line-height: 1.5;">
            For setup assistance or technical support, contact <a href="mailto:support@geelarkflows.com" style="color: #a7ff4f;">support@geelarkflows.com</a>.
          </p>
        </div>
      `,
      attachments,
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
  if (!db) return { allowed: true };
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
    console.warn('Rate limit check warning:', err.message);
    return { allowed: true };
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
  awaiting_payment: ['paid', 'failed', 'cancelled'],
  paid: ['processing', 'refunded'],
  processing: ['completed', 'refunded'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
  failed: [],
};

// ----------------------------------------------------
// CUSTOMER-FACING STOREFRONT APIS (PRESERVED)
// ----------------------------------------------------

// POST /api/checkout/create
app.post('/checkout/create', async (c) => {
  try {
    const body = await c.req.json();
    const { email, network, payment_network, delivery_method, deliveryMethod, cart = [] } = body;

    if (!email || typeof email !== 'string' || !email.includes('@') || email.trim().length < 5) {
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
    const { workflowSubtotal, setupFee, finalTotal } = calculateOrderTotals(resolvedCart, selectedDeliveryMethod);

    if (finalTotal < networkConfig.min_amount_usd) {
      return c.json({
        success: false,
        error: `Minimum order amount for ${networkConfig.full_label} is $${networkConfig.min_amount_usd} USD. Please choose another network.`,
      }, 400);
    }

    const orderId = 'ord_' + crypto.randomUUID().split('-')[0];
    const paymentId = 'pay_' + crypto.randomUUID().split('-')[0];

    let payAddress = '';
    let payAmountCrypto = Number(finalTotal.toFixed(2));
    let cryptoRate = 1.0;
    let actualPaymentId = paymentId;
    let gatewayError = null;

    const apiKey = c.env?.NOWPAYMENTS_API_KEY || c.env?.CRYPTO_GATEWAY_API_KEY;

    if (apiKey) {
      try {
        let requestOrigin = 'https://geelarkflows.com';
        try {
          if (c.req.url) {
            const parsedUrl = new URL(c.req.url);
            if (parsedUrl.protocol.startsWith('http') && !parsedUrl.hostname.includes('localhost') && !parsedUrl.hostname.includes('127.0.0.1')) {
              requestOrigin = parsedUrl.origin;
            }
          }
        } catch (urlErr) {}

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
        if (nowPayData && nowPayData.pay_address) {
          payAddress = nowPayData.pay_address;
          payAmountCrypto = Number(nowPayData.pay_amount || finalTotal);
          cryptoRate = nowPayData.price_amount && nowPayData.pay_amount ? (nowPayData.price_amount / nowPayData.pay_amount) : 1.0;
          if (nowPayData.payment_id) {
            actualPaymentId = String(nowPayData.payment_id);
          }
        } else if (nowPayData && (nowPayData.message || nowPayData.error)) {
          gatewayError = nowPayData.message || nowPayData.error;
          console.error('NOWPayments API Error:', gatewayError);
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

    if (c.env && c.env.DB) {
      try {
        await c.env.DB.prepare(
          'INSERT INTO orders (id, customer_email, total_usd, delivery_method, workflow_subtotal, setup_fee, status, items, fulfillment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(orderId, cleanEmail, finalTotal, selectedDeliveryMethod, workflowSubtotal, setupFee, 'pending', JSON.stringify(resolvedCart), 'not_ready').run();

        await c.env.DB.prepare(
          'INSERT INTO crypto_payments (id, order_id, currency, pay_address, pay_amount_crypto, exchange_rate_usd, expires_at, status, verification_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(actualPaymentId, orderId, networkConfig.display_currency, payAddress, payAmountCrypto, cryptoRate, expiresAtStr, 'waiting', 'nowpayments_ipn').run();
      } catch (dbErr) {
        console.warn('D1 Database store notice:', dbErr.message);
      }
    }

    return c.json({
      success: true,
      data: {
        orderId,
        paymentId: actualPaymentId,
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
        totalUsd: finalTotal,
        payAmountCrypto,
        payAddress,
        expiresAt: expiresAtStr,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payAddress)}`,
        status: 'waiting',
        warning: `Send USDT on the ${networkConfig.full_label} network only. Sending other tokens or using a different network will result in permanent loss.`,
      },
    });
  } catch (err) {
    console.error('Checkout creation error:', err);
    return c.json({ success: false, error: err.message }, 500);
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

    if (c.env && c.env.DB && order_id) {
      const paymentRec = await c.env.DB.prepare(
        'SELECT id, currency, status FROM crypto_payments WHERE order_id = ? OR id = ?'
      ).bind(order_id, String(payment_id)).first();

      const orderRec = await c.env.DB.prepare(
        'SELECT id, customer_email, status, items, total_usd, delivery_method, workflow_subtotal, setup_fee FROM orders WHERE id = ?'
      ).bind(order_id).first();

      if (['confirmed', 'finished', 'paid'].includes(normalizedStatus)) {
        await c.env.DB.prepare(
          'UPDATE crypto_payments SET status = ?, tx_hash = ?, verification_source = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ? OR id = ?'
        ).bind(normalizedStatus, finalTxHash, 'nowpayments_ipn', order_id, String(payment_id)).run();

        const initialFulfillmentStatus = (orderRec?.delivery_method === 'geelark_setup') ? 'setup_pending' : 'fulfillment_pending';

        await c.env.DB.prepare(
          'UPDATE orders SET status = ?, fulfillment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind('paid', initialFulfillmentStatus, order_id).run();

        if (orderRec && orderRec.status !== 'paid' && orderRec.status !== 'completed') {
          let parsedItems = [];
          try {
            parsedItems = JSON.parse(orderRec.items || '[]');
          } catch (e) {}

          const idempotencyKey = `auto_confirm_email_${order_id}_${payment_id}`;
          try {
            await sendPaymentConfirmationEmail({
              resendApiKey: c.env.RESEND_API_KEY,
              customerEmail: orderRec.customer_email,
              orderId: order_id,
              networkLabel: paymentRec?.currency || 'TRC-20',
              items: parsedItems,
              deliveryMethod: orderRec.delivery_method || 'download_package',
              workflowSubtotal: orderRec.workflow_subtotal || orderRec.total_usd,
              setupFee: orderRec.setup_fee || 0,
              totalUsd: orderRec.total_usd,
            });

            await c.env.DB.prepare(
              `INSERT INTO order_fulfillment_logs (id, order_id, idempotency_key, triggered_by, recipient_email, status)
               VALUES (?, ?, ?, ?, ?, ?)`
            ).bind('fl_' + generateSecureToken(8), order_id, idempotencyKey, 'system_webhook', orderRec.customer_email, 'dispatched').run();
          } catch (emailErr) {
            console.error('Automated payment confirmation email failure:', emailErr.message);
            await c.env.DB.prepare(
              `INSERT INTO order_fulfillment_logs (id, order_id, idempotency_key, triggered_by, recipient_email, status, error_message)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind('fl_' + generateSecureToken(8), order_id, idempotencyKey, 'system_webhook', orderRec.customer_email, 'failed', emailErr.message).run();
          }
        }
      } else if (['failed', 'expired', 'refunded'].includes(normalizedStatus)) {
        await c.env.DB.prepare(
          'UPDATE crypto_payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ? OR id = ?'
        ).bind(normalizedStatus, order_id, String(payment_id)).run();
      }
    }

    return c.json({ success: true, status: 'processed' });
  } catch (err) {
    console.error('NOWPayments webhook processing error:', err.message);
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/checkout/status/:id
app.get('/checkout/status/:id', async (c) => {
  try {
    const id = c.req.param('id');
    let currentStatus = 'waiting';
    let txHash = null;
    let orderStatus = 'pending';
    let rawCurrency = 'USDT (TRC-20)';
    let payAddress = '';
    let payAmount = 0;
    let orderId = id;
    let paymentId = id;
    let isConfirmed = false;
    let deliveryMethod = 'download_package';
    let workflowSubtotal = 0;
    let setupFee = 0;
    let fulfillmentStatus = 'not_ready';
    let customerEmail = '';

    if (c.env && c.env.DB) {
      try {
        const record = await c.env.DB.prepare(
          'SELECT id, order_id, currency, pay_address, pay_amount_crypto, status, tx_hash FROM crypto_payments WHERE id = ? OR order_id = ?'
        ).bind(id, id).first();
        if (record) {
          currentStatus = record.status || 'waiting';
          txHash = record.tx_hash || null;
          rawCurrency = record.currency || 'USDT (TRC-20)';
          payAddress = record.pay_address || '';
          payAmount = record.pay_amount_crypto || 0;
          paymentId = record.id;
          orderId = record.order_id;
        }
        const orderRec = await c.env.DB.prepare(
          'SELECT status, total_usd, delivery_method, workflow_subtotal, setup_fee, fulfillment_status, customer_email FROM orders WHERE id = ?'
        ).bind(orderId).first();
        if (orderRec) {
          orderStatus = orderRec.status || 'pending';
          if (!payAmount && orderRec.total_usd) {
            payAmount = orderRec.total_usd;
          }
          deliveryMethod = orderRec.delivery_method || 'download_package';
          workflowSubtotal = orderRec.workflow_subtotal || orderRec.total_usd || payAmount;
          setupFee = orderRec.setup_fee || 0;
          fulfillmentStatus = orderRec.fulfillment_status || 'not_ready';
          customerEmail = orderRec.customer_email || '';
        }
      } catch (dbErr) {
        console.warn('D1 Status fetch notice:', dbErr.message);
      }
    }

    isConfirmed = ['confirmed', 'finished', 'paid'].includes((currentStatus || '').toLowerCase()) || orderStatus === 'paid';

    const apiKey = c.env?.NOWPAYMENTS_API_KEY || c.env?.CRYPTO_GATEWAY_API_KEY;
    const isNumericPaymentId = paymentId && /^\d+$/.test(paymentId);
    if (apiKey && isNumericPaymentId && !isConfirmed && currentStatus === 'waiting') {
      try {
        const nowPayCheck = await fetch(`https://api.nowpayments.io/v1/payment/${paymentId}`, {
          headers: { 'x-api-key': apiKey }
        });
        const nowPayStatusData = await nowPayCheck.json();
        if (nowPayStatusData && nowPayStatusData.payment_status) {
          const liveStatus = String(nowPayStatusData.payment_status).toLowerCase();
          if (['confirmed', 'finished', 'paid'].includes(liveStatus)) {
            currentStatus = liveStatus;
            txHash = nowPayStatusData.outcome_tx_hash || nowPayStatusData.txid || txHash;
            orderStatus = 'paid';
            isConfirmed = true;

            const initialFulfillmentStatus = (deliveryMethod === 'geelark_setup') ? 'setup_pending' : 'fulfillment_pending';
            fulfillmentStatus = initialFulfillmentStatus;

            if (c.env && c.env.DB) {
              await c.env.DB.prepare(
                'UPDATE crypto_payments SET status = ?, tx_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR order_id = ?'
              ).bind(currentStatus, txHash, paymentId, orderId).run();
              await c.env.DB.prepare(
                'UPDATE orders SET status = ?, fulfillment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
              ).bind('paid', initialFulfillmentStatus, orderId).run();
            }
          }
        }
      } catch (pollErr) {
        console.warn('Direct NOWPayments status sync notice:', pollErr.message);
      }
    }

    const resolvedNetwork = resolvePaymentNetwork(rawCurrency) || SUPPORTED_USDT_NETWORKS['trc20'];

    return c.json({
      success: true,
      data: {
        id,
        orderId,
        paymentId,
        status: currentStatus,
        orderStatus,
        isConfirmed,
        txHash,
        asset: 'USDT',
        network: resolvedNetwork.id,
        networkLabel: resolvedNetwork.network,
        blockchain: resolvedNetwork.blockchain,
        fullNetworkLabel: resolvedNetwork.full_label,
        currency: resolvedNetwork.display_currency,
        payCurrency: resolvedNetwork.nowpayments_currency.toUpperCase(),
        deliveryMethod,
        workflowSubtotal,
        setupFee,
        totalUsd: payAmount,
        payAmount,
        payAddress,
        customerEmail,
        fulfillmentStatus,
        confirmations: isConfirmed ? 2 : 0,
        requiredConfirmations: 2,
      },
    });
  } catch (routeErr) {
    console.error('Status route unhandled error:', routeErr);
    return c.json({ success: false, error: routeErr.message }, 500);
  }
});

// ----------------------------------------------------
// ADMIN AUTHENTICATION APIS
// ----------------------------------------------------

// POST /api/admin/auth/bootstrap
app.post('/admin/auth/bootstrap', async (c) => {
  const db = c.env?.DB;
  if (!db) return c.json({ success: false, error: 'Database unavailable' }, 500);

  try {
    const countRow = await db.prepare('SELECT COUNT(*) as count FROM admin_users').first();
    if (countRow && countRow.count > 0) {
      return c.json({ success: false, error: 'Bootstrap disabled: Administrator account already exists.' }, 403);
    }

    const body = await c.req.json();
    const { email, password, bootstrapSecret, name = 'Primary Administrator' } = body;

    const expectedSecret = c.env?.ADMIN_BOOTSTRAP_SECRET || 'geelark_initial_bootstrap_key_2026';
    if (!bootstrapSecret || bootstrapSecret !== expectedSecret) {
      return c.json({ success: false, error: 'Invalid bootstrap authorization secret.' }, 403);
    }

    if (!email || !password || password.length < 8) {
      return c.json({ success: false, error: 'Email and password (min 8 characters) are required.' }, 400);
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
    return c.json({ success: false, error: err.message }, 500);
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
      return c.json({ success: false, error: rateCheck.reason }, 429);
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

    await clearLoginRateLimit(db, clientIp, cleanEmail);

    const rawSessionToken = generateSecureToken(32);
    const tokenHash = await sha256Hex(rawSessionToken);
    const sessionId = 'ses_' + generateSecureToken(8);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

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
    const cookieString = `gf_admin_session=${encodeURIComponent(rawSessionToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${isSecure ? '; Secure' : ''}`;

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
    return c.json({ success: false, error: 'Server authentication error: ' + err.message }, 500);
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

  c.header('Set-Cookie', 'gf_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
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
        SUM(CASE WHEN status IN ('paid', 'processing', 'completed') AND fulfillment_status != 'delivered' THEN 1 ELSE 0 END) as count_fulfillment_pending,
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
    return c.json({ success: false, error: err.message }, 500);
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
      SELECT o.id, o.customer_email, o.total_usd, o.delivery_method, o.workflow_subtotal, o.setup_fee, o.status, o.items, o.fulfillment_status, o.delivered_at, o.created_at, o.updated_at,
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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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

    const order = await db.prepare('SELECT fulfillment_status, delivery_method, customer_email FROM orders WHERE id = ?').bind(orderId).first();
    if (!order) {
      return c.json({ success: false, error: `Order "${orderId}" not found.` }, 404);
    }

    const previousStatus = order.fulfillment_status;

    await db.prepare(
      'UPDATE orders SET fulfillment_status = ?, fulfillment_notes = COALESCE(?, fulfillment_notes), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(target_status, notes || null, orderId).run();

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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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
    if (!nowPayData || !nowPayData.payment_status) {
      return c.json({ success: false, error: nowPayData?.message || 'Gateway returned empty response.' }, 502);
    }

    const liveStatus = String(nowPayData.payment_status).toLowerCase();
    const liveTxHash = nowPayData.outcome_tx_hash || nowPayData.txid || payment.tx_hash;

    if (db) {
      await db.prepare(
        'UPDATE crypto_payments SET status = ?, tx_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(liveStatus, liveTxHash, actualPayId).run();

      if (['confirmed', 'finished', 'paid'].includes(liveStatus)) {
        await db.prepare(
          'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind('paid', payment.order_id).run();
      }

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
    }

    return c.json({
      success: true,
      paymentId: actualPayId,
      status: liveStatus,
      txHash: liveTxHash,
      gatewayData: nowPayData,
    });
  } catch (err) {
    console.error('Payment sync error:', err);
    return c.json({ success: false, error: err.message }, 500);
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

    await db.batch([
      db.prepare(
        `UPDATE crypto_payments
         SET status = 'confirmed', tx_hash = ?, verification_source = 'manual_admin', verified_by_admin = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(finalTxHash, user.email, payment.id),
      db.prepare(
        `UPDATE orders
         SET status = 'paid', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(payment.order_id),
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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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
    const clientProvidedIdempotencyKey = body.idempotency_key || `resend_${orderId}_${Date.now()}`;

    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
    if (!order) {
      return c.json({ success: false, error: `Order "${orderId}" not found.` }, 404);
    }

    if (!['paid', 'processing', 'completed'].includes(order.status)) {
      return c.json({ success: false, error: `Cannot fulfill order with status "${order.status}". Order must be paid.` }, 400);
    }

    const recentLog = await db.prepare(
      `SELECT id, created_at FROM order_fulfillment_logs
       WHERE order_id = ? AND status = 'dispatched' AND created_at > datetime('now', '-60 seconds')`
    ).bind(orderId).first();

    if (recentLog) {
      return c.json({ success: false, error: 'Idempotency Protection: A package was already dispatched to this customer within the last 60 seconds.' }, 429);
    }

    const payment = await db.prepare('SELECT currency FROM crypto_payments WHERE order_id = ?').bind(orderId).first();

    let parsedItems = [];
    try {
      parsedItems = JSON.parse(order.items || '[]');
    } catch (e) {}

    let attachmentBuffer = null;
    let fileName = `geelark_flows_package_${orderId}.zip`;

    if (c.env.FLOWS_BUCKET) {
      try {
        const r2Obj = await c.env.FLOWS_BUCKET.get('master_package.zip');
        if (r2Obj) {
          attachmentBuffer = await r2Obj.arrayBuffer();
        }
      } catch (r2Err) {
        console.warn('R2 bucket fetch notice:', r2Err.message);
      }
    }

    await sendFulfillmentEmail({
      resendApiKey: c.env.RESEND_API_KEY,
      customerEmail: order.customer_email,
      orderId,
      networkLabel: payment?.currency || 'TRC-20',
      items: parsedItems,
      attachmentBuffer,
      fileName,
    });

    await db.prepare(
      'UPDATE orders SET fulfillment_status = ?, delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind('delivered', orderId).run();

    await db.prepare(
      `INSERT INTO order_fulfillment_logs (id, order_id, idempotency_key, triggered_by, recipient_email, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind('fl_' + generateSecureToken(8), orderId, clientProvidedIdempotencyKey, `admin:${user.email}`, order.customer_email, 'dispatched').run();

    await recordAuditLog(db, {
      adminId: user.id,
      adminEmail: user.email,
      ip: c.req.header('cf-connecting-ip') || '127.0.0.1',
      userAgent: c.req.header('user-agent'),
      action: 'FULFILLMENT_RESENT',
      entityType: 'order',
      entityId: orderId,
      newState: 'delivered',
      reason: body.reason || 'Admin triggered manual package re-delivery',
    });

    return c.json({ success: true, message: `Package re-sent successfully to ${order.customer_email}.`, orderId });
  } catch (err) {
    console.error('Resend fulfillment error:', err);
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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

    const attachments = await db.prepare('SELECT * FROM email_attachments WHERE inbound_email_id = ?').bind(emailId).all();

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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
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
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ----------------------------------------------------
// ROOT CLOUDFLARE WORKER ROUTER WITH SPA ASSETS FALLBACK
// ----------------------------------------------------
const mainApp = new Hono();

// Mount all API endpoints under /api
mainApp.route('/api', app);

// Forward root webhooks if sent directly to root
mainApp.post('/webhooks/crypto', (c) => app.fetch(new Request(new URL('/webhooks/crypto', c.req.url), c.req.raw), c.env, c.executionCtx));
mainApp.post('/webhooks/resend-inbound', (c) => app.fetch(new Request(new URL('/webhooks/resend-inbound', c.req.url), c.req.raw), c.env, c.executionCtx));

// Fallback to Cloudflare Workers Static Assets for all non-API / SPA routes (/cart, /checkout, /admin, etc.)
mainApp.all('*', async (c) => {
  if (c.env?.ASSETS) {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status === 404 && !c.req.path.includes('.')) {
      return c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url), c.req.raw));
    }
    return res;
  }
  return c.text('Not Found', 404);
});

export default mainApp;
