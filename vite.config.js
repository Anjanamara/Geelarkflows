import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';
import { products } from './src/data/products.js';
import { getNetworkConfig } from './src/data/paymentConfig.js';

const devCatalogMap = new Map(
  (products || []).map((p) => [
    p.id,
    {
      id: p.id,
      title: p.title,
      platform: p.platform,
      price: Number(p.price),
      category: p.details?.category || 'Automation',
    },
  ])
);

const localDevOrders = new Map();
const localDevSessions = new Map();
const localDevAuditLogs = [];
const localDevFulfillmentLogs = [];
const localDevInboundEmails = new Map();
const localDevAttachments = new Map();
const localDevCustomRequests = new Map();
const localDevCartState = new Map();
const localDevNotificationReceipts = new Map();
const localDevPushSubscriptions = new Map();
const localDevVapidPublicKey = 'BGeCvdAiPbmKQWzMxOF6Arlal71NLS5k0eraATcr-AjyEL5khb51XZ_vk5J_AT5AcYKjhDraknI6byFNstqTKE8';
const localDevCoupons = new Map([
  ['DEV10', {
    id: 'cpn_dev10',
    code: 'DEV10',
    description: 'Local development checkout test',
    discount_type: 'percentage',
    discount_value: 10,
    min_subtotal_cents: 0,
    max_redemptions: null,
    active: true,
    starts_at: null,
    expires_at: null,
    redemption_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }],
]);
const localDevNotifications = new Map([
  ['ntf_dev_cart_offer', {
    id: 'ntf_dev_cart_offer',
    title: 'A saving for your cart',
    message: 'Use DEV10 to save 10% on the workflows currently in your cart.',
    audience_type: 'active_cart',
    product_id: null,
    coupon_id: 'cpn_dev10',
    coupon_code: 'DEV10',
    cta_label: 'Use coupon',
    cta_url: '/checkout',
    push_enabled: false,
    push_sent_at: null,
    active: true,
    starts_at: null,
    expires_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }],
]);

function resolveLocalCoupon(rawCode, workflowSubtotal) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
    return { valid: false, error: 'Enter a valid coupon code.' };
  }

  const coupon = localDevCoupons.get(code);
  const now = Date.now();
  if (!coupon || !coupon.active) return { valid: false, error: 'This coupon is not valid.' };
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) return { valid: false, error: 'This coupon is not active yet.' };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now) return { valid: false, error: 'This coupon has expired.' };
  if (coupon.max_redemptions && coupon.redemption_count >= coupon.max_redemptions) return { valid: false, error: 'This coupon has reached its usage limit.' };

  const subtotalCents = Math.round(Number(workflowSubtotal || 0) * 100);
  if (subtotalCents < Number(coupon.min_subtotal_cents || 0)) {
    return { valid: false, error: `This coupon requires a workflow subtotal of at least $${(coupon.min_subtotal_cents / 100).toFixed(2)} USD.` };
  }

  const rawDiscountCents = coupon.discount_type === 'percentage'
    ? Math.round(subtotalCents * coupon.discount_value / 100)
    : coupon.discount_value;
  const discountCents = Math.min(subtotalCents, Math.max(0, rawDiscountCents));
  if (discountCents <= 0) return { valid: false, error: 'This coupon does not apply to the current order.' };

  return {
    valid: true,
    coupon,
    code,
    discountCents,
    couponDiscount: discountCents / 100,
    discountLabel: coupon.discount_type === 'percentage'
      ? `${coupon.discount_value}% off workflows`
      : `$${(coupon.discount_value / 100).toFixed(2)} off workflows`,
  };
}

// Seed sample orders for realistic local dev testing if empty
if (localDevOrders.size === 0) {
  const seedOrders = [
    {
      orderId: 'ord_5710mi3',
      paymentId: '5150455726',
      email: 'customer.alpha@example.com',
      totalUsd: 1400,
      status: 'paid',
      fulfillmentStatus: 'package_delivered',
      deliveredAt: new Date(Date.now() - 3600000).toISOString(),
      network: 'trc20',
      networkLabel: 'TRC-20',
      blockchain: 'TRON',
      fullNetworkLabel: 'TRC-20 / TRON',
      currency: 'USDT (TRC-20)',
      payCurrencyTicker: 'USDTTRC20',
      payAmountCrypto: 1400,
      payAddress: '0xDd02DDc41C93e175b3eBa1e5bd43Ac8e803eb83b',
      txHash: '0x3a88c2b5e7d43231e6c8e31bfd7890a218d6e32bc194cf21d6e38a5b281f9b3a',
      verificationSource: 'nowpayments_ipn',
      items: [
        { id: 'instagram-account-creation', title: 'Instagram Account Creation', price: 1000, quantity: 1, platform: 'Instagram' },
        { id: 'instagram-warmup', title: 'Instagram Warmup', price: 250, quantity: 1, platform: 'Instagram' },
        { id: 'instagram-profile-edits', title: 'Instagram Profile Editing', price: 150, quantity: 1, platform: 'Instagram' },
      ],
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      orderId: 'ord_9349e8ff',
      paymentId: '5429955784',
      email: 'growth.agency@digitalops.io',
      totalUsd: 1250,
      status: 'processing',
      fulfillmentStatus: 'package_preparing',
      deliveredAt: null,
      network: 'bep20',
      networkLabel: 'BEP-20',
      blockchain: 'BNB Smart Chain',
      fullNetworkLabel: 'BEP-20 / BNB Chain',
      currency: 'USDT (BEP-20)',
      payCurrencyTicker: 'USDTBSC',
      payAmountCrypto: 1250,
      payAddress: '0x71C568a15998a446aBfF446Ec1Ac9A9A48e02dD8',
      txHash: '0x88f01cba2398b2c451da782e4c1959828e678a1bc7e1694b281f9b3a3a88c2b5',
      verificationSource: 'nowpayments_ipn',
      items: [
        { id: 'tiktok-account-creation', title: 'TikTok Account Creation', price: 1000, quantity: 1, platform: 'TikTok' },
        { id: 'tiktok-warmup', title: 'TikTok Warmup', price: 250, quantity: 1, platform: 'TikTok' },
      ],
      createdAt: new Date(Date.now() - 14400000).toISOString(),
    },
    {
      orderId: 'ord_8a2b3c4d',
      paymentId: '5628194012',
      email: 'ops@phantomscale.com',
      totalUsd: 1150,
      status: 'pending',
      fulfillmentStatus: 'not_ready',
      deliveredAt: null,
      network: 'sol',
      networkLabel: 'SOL',
      blockchain: 'Solana',
      fullNetworkLabel: 'SOL / Solana',
      currency: 'USDT (SOL)',
      payCurrencyTicker: 'USDTSOL',
      payAmountCrypto: 1150,
      payAddress: 'Cxfwgdq5K98aXwL19e487aBc2389eD04781ba4c95aBc',
      txHash: null,
      verificationSource: 'nowpayments_ipn',
      items: [
        { id: 'youtube-channel-creation', title: 'YouTube Channel Creation', price: 1000, quantity: 1, platform: 'YouTube' },
        { id: 'youtube-publishing', title: 'YouTube Shorts Publishing', price: 150, quantity: 1, platform: 'YouTube' },
      ],
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      orderId: 'ord_dev_status_mismatch',
      paymentId: '4000000001',
      email: 'status-check@example.test',
      totalUsd: 1000,
      workflowSubtotal: 1000,
      setupFee: 0,
      status: 'failed',
      paymentStatus: 'waiting',
      fulfillmentStatus: 'not_ready',
      deliveredAt: null,
      deliveryMethod: 'download_package',
      network: 'trc20',
      networkLabel: 'TRC-20',
      blockchain: 'TRON',
      fullNetworkLabel: 'TRC-20 / TRON',
      currency: 'USDT (TRC-20)',
      payCurrencyTicker: 'USDTTRC20',
      payAmountCrypto: 998.847139,
      payAddress: 'TXkP7mT5vR7nL2pY9wA6qK4cD8eF1gH3jB',
      txHash: null,
      verificationSource: 'nowpayments_api_double_verified',
      items: [
        { id: 'tiktok-account-creation', title: 'TikTok Account Creation', price: 1000, quantity: 1, platform: 'TikTok' },
      ],
      createdAt: '2026-09-02 04:08:11',
    },
  ];

  seedOrders.forEach((ord) => {
    ord.statusToken = `dev_seed_status_${ord.orderId}`;
    ord.paymentStatus = ord.paymentStatus || (['paid', 'processing', 'completed'].includes(ord.status) ? 'finished' : 'waiting');
    localDevOrders.set(ord.orderId, ord);
    if (ord.paymentId) localDevOrders.set(ord.paymentId, ord);
  });

  const sampleCustomRequest = {
    id: 'req_dev_preview',
    customer_name: 'Dev Preview Customer',
    customer_email: 'preview@example.test',
    request_type: 'flow',
    details: 'Build a custom multi-profile publishing flow with scheduling, retry handling, and a concise operator report.',
    status: 'new',
    internal_notification_status: 'sent',
    internal_notification_error: null,
    created_at: new Date(Date.now() - 5400000).toISOString(),
    updated_at: new Date(Date.now() - 5400000).toISOString(),
  };
  localDevCustomRequests.set(sampleCustomRequest.id, sampleCustomRequest);

  const seedEmails = [
    {
      id: 'msg_98a7bc12',
      providerEmailId: 're_01j5x9a2k8m7n6p5q4r3s2t1',
      fromAddress: 'customer.alpha@example.com',
      fromName: 'Alex Mercer',
      toAddresses: ['noreply@geelarkflows.com'],
      ccAddresses: [],
      replyTo: 'customer.alpha@example.com',
      subject: 'Question regarding order #ord_5710mi3 configuration',
      textBody: 'Hello GeeLark Team,\n\nI just finished sending the USDT TRC-20 payment for order #ord_5710mi3. Can you please confirm what Android profile version is recommended for the Instagram warm-up flow?\n\nBest regards,\nAlex',
      htmlBody: '<p>Hello GeeLark Team,</p><p>I just finished sending the USDT TRC-20 payment for order <strong>#ord_5710mi3</strong>. Can you please confirm what Android profile version is recommended for the Instagram warm-up flow?</p><p>Best regards,<br/>Alex</p>',
      receivedAt: new Date(Date.now() - 3600000).toISOString(),
      isRead: 0,
      isArchived: 0,
      orderId: 'ord_5710mi3',
      customerEmail: 'customer.alpha@example.com',
      attachments: [
        {
          id: 'att_01j5x9a2',
          filename: 'tx_receipt_proof.png',
          contentType: 'image/png',
          sizeBytes: 84200,
        }
      ]
    },
    {
      id: 'msg_43f2e1a9',
      providerEmailId: 're_01j5y8b3k9n8m7q6r5s4t3u2',
      fromAddress: 'marcus@leadscaleglobal.com',
      fromName: 'Marcus Vance',
      toAddresses: ['support@geelarkflows.com'],
      ccAddresses: [],
      replyTo: 'marcus@leadscaleglobal.com',
      subject: 'Bulk discount inquiry for TikTok & Snapchat workflows',
      textBody: 'Hi Support,\n\nWe are looking to purchase 50+ licenses for our agency fleet. Do you offer custom invoice generation or enterprise pricing for multi-seat deployments?\n\nThanks,\nMarcus Vance',
      htmlBody: '<p>Hi Support,</p><p>We are looking to purchase 50+ licenses for our agency fleet. Do you offer custom invoice generation or enterprise pricing for multi-seat deployments?</p><p>Thanks,<br/>Marcus Vance</p>',
      receivedAt: new Date(Date.now() - 14400000).toISOString(),
      isRead: 1,
      isArchived: 0,
      orderId: null,
      customerEmail: 'marcus@leadscaleglobal.com',
      attachments: []
    },
    {
      id: 'msg_11b2c3d4',
      providerEmailId: 're_01j5z7c4l0p9n8r7s6t5u4v3',
      fromAddress: 'sarah@growthflow.co',
      fromName: 'Sarah Jenkins',
      toAddresses: ['noreply@geelarkflows.com'],
      ccAddresses: [],
      replyTo: 'sarah@growthflow.co',
      subject: 'Order ord_9349e8ff - Payment completed on BEP-20',
      textBody: 'Hi,\n\nI just paid via BEP-20 for order #ord_9349e8ff. Looking forward to receiving the package.\n\nSarah',
      htmlBody: '<p>Hi,</p><p>I just paid via BEP-20 for order <strong>#ord_9349e8ff</strong>. Looking forward to receiving the package.</p><p>Sarah</p>',
      receivedAt: new Date(Date.now() - 7200000).toISOString(),
      isRead: 0,
      isArchived: 0,
      orderId: 'ord_9349e8ff',
      customerEmail: 'growth.agency@digitalops.io',
      attachments: []
    }
  ];

  seedEmails.forEach((email) => {
    localDevInboundEmails.set(email.id, email);
    if (email.attachments && email.attachments.length > 0) {
      localDevAttachments.set(email.id, email.attachments);
    }
  });
}

function resolveDevNetwork(input) {
  return getNetworkConfig(input || 'trc20');
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const livePaymentMockEnabled = env.ENABLE_LIVE_PAYMENT_MOCK === 'true';
  const apiKey = livePaymentMockEnabled
    ? (env.NOWPAYMENTS_API_KEY || env.CRYPTO_GATEWAY_API_KEY || '').trim()
    : '';
  const devAdminEmail = (env.DEV_ADMIN_EMAIL || '').trim().toLowerCase();
  const devAdminPassword = env.DEV_ADMIN_PASSWORD || '';
  const devWebhookSecret = env.DEV_CRYPTO_WEBHOOK_SECRET || '';

  return {
    base: '/',
    plugins: [
      react(),
      {
        name: 'api-dev-server',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            // Helper JSON Responder
            const sendJson = (statusCode, data) => {
              res.statusCode = statusCode;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            };

            // ----------------------------------------------------
            // 1. PUBLIC CHECKOUT & STOREFRONT APIS
            // ----------------------------------------------------

            // POST /api/analytics/events (accepted without persisting in local development)
            if (req.url?.startsWith('/api/analytics/events') && req.method === 'POST') {
              req.resume();
              return sendJson(202, { success: true, recorded: true });
            }

            // POST /api/analytics/cart-state (minimal local state supports notification targeting)
            if (req.url?.startsWith('/api/analytics/cart-state') && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', () => {
                try {
                  const body = JSON.parse(bodyStr || '{}');
                  const visitorId = String(body.visitor_id || '');
                  if (visitorId) localDevCartState.set(visitorId, Array.isArray(body.product_ids) ? body.product_ids : []);
                  return sendJson(202, { success: true, recorded: true });
                } catch {
                  return sendJson(400, { success: false, error: 'Invalid cart state.' });
                }
              });
              return;
            }

            // GET /api/notifications
            if (req.url?.startsWith('/api/notifications?') && req.method === 'GET') {
              const requestUrl = new URL(req.url, 'http://localhost');
              const visitorId = requestUrl.searchParams.get('visitor_id') || '';
              const cartProductIds = new Set(localDevCartState.get(visitorId) || []);
              const items = Array.from(localDevNotifications.values()).filter((notification) => {
                if (!notification.active) return false;
                if (notification.audience_type === 'active_cart' && cartProductIds.size === 0) return false;
                if (notification.audience_type === 'product_cart' && !cartProductIds.has(notification.product_id)) return false;
                const receipt = localDevNotificationReceipts.get(`${notification.id}:${visitorId}`);
                return !receipt?.dismissed;
              }).map((notification) => {
                const receipt = localDevNotificationReceipts.get(`${notification.id}:${visitorId}`);
                return { ...notification, is_read: Boolean(receipt?.read) };
              });
              return sendJson(200, { success: true, notifications: items, unread_count: items.filter((item) => !item.is_read).length });
            }

            // Browser push configuration and local subscription persistence
            if (req.url === '/api/push/config' && req.method === 'GET') {
              return sendJson(200, { success: true, enabled: true, public_key: localDevVapidPublicKey });
            }

            if (req.url === '/api/push/subscribe' && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', () => {
                try {
                  const body = JSON.parse(bodyStr || '{}');
                  const endpoint = String(body.subscription?.endpoint || '');
                  if (!endpoint || !body.visitor_id) return sendJson(400, { success: false, error: 'Invalid browser push subscription.' });
                  localDevPushSubscriptions.set(endpoint, { ...body.subscription, visitor_id: body.visitor_id, active: true });
                  return sendJson(200, { success: true, subscribed: true });
                } catch {
                  return sendJson(400, { success: false, error: 'Invalid browser push subscription.' });
                }
              });
              return;
            }

            if (req.url === '/api/push/unsubscribe' && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', () => {
                try {
                  const body = JSON.parse(bodyStr || '{}');
                  localDevPushSubscriptions.delete(String(body.endpoint || ''));
                  return sendJson(200, { success: true, subscribed: false });
                } catch {
                  return sendJson(400, { success: false, error: 'Invalid browser push subscription.' });
                }
              });
              return;
            }

            // POST /api/notifications/:id/read or /dismiss
            if (req.url?.match(/^\/api\/notifications\/[^/?]+\/(read|dismiss)$/) && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', () => {
                try {
                  const body = JSON.parse(bodyStr || '{}');
                  const parts = req.url.split('/');
                  const notificationId = parts[3];
                  const action = parts[4];
                  const key = `${notificationId}:${body.visitor_id || ''}`;
                  const receipt = localDevNotificationReceipts.get(key) || {};
                  receipt[action === 'read' ? 'read' : 'dismissed'] = true;
                  localDevNotificationReceipts.set(key, receipt);
                  return sendJson(200, { success: true, id: notificationId });
                } catch {
                  return sendJson(400, { success: false, error: 'Invalid notification receipt.' });
                }
              });
              return;
            }

            // POST /api/custom-request
            if (req.url?.startsWith('/api/custom-request') && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', async () => {
                try {
                  const body = JSON.parse(bodyStr || '{}');
                  const { name, email, type, details } = body;

                  if (!name || typeof name !== 'string' || !name.trim()) {
                    return sendJson(400, { success: false, error: 'Full name is required' });
                  }
                  if (!email || typeof email !== 'string' || !email.includes('@')) {
                    return sendJson(400, { success: false, error: 'Please provide a valid email address' });
                  }
                  const cleanType = String(type || 'flow').trim().toLowerCase();
                  if (!['flow', 'consulting'].includes(cleanType)) {
                    return sendJson(400, { success: false, error: "Service type must be 'flow' or 'consulting'" });
                  }
                  if (!details || typeof details !== 'string' || details.trim().length < 10) {
                    return sendJson(400, { success: false, error: 'Please provide at least 10 characters describing your project requirements' });
                  }
                  if (details.trim().length > 5000) {
                    return sendJson(400, { success: false, error: 'Project requirements must not exceed 5000 characters' });
                  }

                  const requestId = 'req_' + Math.random().toString(36).substring(2, 10);
                  return sendJson(200, {
                    success: true,
                    request_id: requestId,
                    customer_email: email.trim().toLowerCase(),
                    message: 'Your custom automation request has been received.',
                  });
                } catch (err) {
                  return sendJson(500, { success: false, error: err.message });
                }
              });
              return;
            }

            // POST /api/coupons/validate
            if (req.url?.startsWith('/api/coupons/validate') && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', () => {
                try {
                  const body = JSON.parse(bodyStr || '{}');
                  const cart = Array.isArray(body.cart) ? body.cart : [];
                  if (!cart.length || cart.length > 50) {
                    return sendJson(400, { success: false, error: 'Add at least one workflow before applying a coupon.' });
                  }

                  let workflowSubtotal = 0;
                  for (let i = 0; i < cart.length; i++) {
                    const catalogItem = devCatalogMap.get(String(cart[i]?.id || '').trim());
                    const quantity = Number(cart[i]?.quantity ?? 1);
                    if (!catalogItem || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
                      return sendJson(400, { success: false, error: 'The cart contains an invalid workflow or quantity.' });
                    }
                    workflowSubtotal += catalogItem.price * quantity;
                  }

                  const coupon = resolveLocalCoupon(body.coupon_code || body.couponCode, workflowSubtotal);
                  if (!coupon.valid) return sendJson(400, { success: false, error: coupon.error });

                  const deliveryMethod = body.delivery_method || body.deliveryMethod || 'download_package';
                  const setupFee = deliveryMethod === 'geelark_setup' && workflowSubtotal < 300 ? 50 : 0;
                  return sendJson(200, {
                    success: true,
                    data: {
                      code: coupon.code,
                      description: coupon.coupon.description,
                      discountType: coupon.coupon.discount_type,
                      discountValue: coupon.coupon.discount_value,
                      discountLabel: coupon.discountLabel,
                      workflowSubtotal,
                      setupFee,
                      couponDiscount: coupon.couponDiscount,
                      totalUsd: workflowSubtotal + setupFee - coupon.couponDiscount,
                    },
                  });
                } catch (err) {
                  return sendJson(400, { success: false, error: 'Invalid coupon request.' });
                }
              });
              return;
            }

            // POST /api/checkout/create
            if (req.url?.startsWith('/api/checkout/create') && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', async () => {
                try {
                  const body = JSON.parse(bodyStr || '{}');
                  const { email, network, payment_network, delivery_method, coupon_code, couponCode, cart = [] } = body;

                  const cleanEmail = String(email || '').trim().toLowerCase();
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254 || !Array.isArray(cart) || cart.length === 0) {
                    return sendJson(400, { success: false, error: 'Missing required checkout details' });
                  }

                  if (cart.length > 50) {
                    return sendJson(400, { success: false, error: 'Cart exceeds maximum allowed item count.' });
                  }

                  const validDeliveryMethods = ['download_package', 'geelark_setup'];
                  if (!validDeliveryMethods.includes(delivery_method)) {
                    return sendJson(400, { success: false, error: 'Please select a valid delivery method.' });
                  }
                  const deliveryMethod = delivery_method;

                  const requestedNet = network || payment_network || 'trc20';
                  const netConfig = resolveDevNetwork(requestedNet);

                  if (!netConfig) {
                    return sendJson(400, {
                      success: false,
                      error: `Unsupported payment network "${requestedNet}". Choose TRC-20, ERC-20, BEP-20, or SOL.`,
                    });
                  }

                  const resolvedCart = [];
                  for (let i = 0; i < cart.length; i++) {
                    const item = cart[i];
                    if (!item || typeof item !== 'object') {
                      return sendJson(400, { success: false, error: `Invalid item format at index ${i + 1}.` });
                    }
                    const productId = String(item.id || '').trim();
                    const catalogItem = devCatalogMap.get(productId);
                    if (!catalogItem) {
                      return sendJson(400, { success: false, error: `Unknown or discontinued workflow "${productId}".` });
                    }
                    const rawQty = item.quantity !== undefined && item.quantity !== null ? item.quantity : 1;
                    const numQty = Number(rawQty);
                    if (!Number.isInteger(numQty) || numQty < 1 || numQty > 100) {
                      return sendJson(400, { success: false, error: `Invalid quantity "${rawQty}" for workflow "${catalogItem.title}". Quantity must be an integer between 1 and 100.` });
                    }
                    resolvedCart.push({
                      id: catalogItem.id,
                      title: catalogItem.title,
                      platform: catalogItem.platform,
                      category: catalogItem.category,
                      price: catalogItem.price,
                      quantity: numQty,
                    });
                  }

                  const orderId = 'ord_' + crypto.randomBytes(16).toString('hex');
                  const statusToken = crypto.randomBytes(32).toString('hex');
                  const workflowSubtotal = resolvedCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                  const setupFee = deliveryMethod === 'geelark_setup' ? (workflowSubtotal >= 300 ? 0 : 50) : 0;
                  const suppliedCouponCode = coupon_code || couponCode;
                  const appliedCoupon = suppliedCouponCode ? resolveLocalCoupon(suppliedCouponCode, workflowSubtotal) : null;
                  if (appliedCoupon && !appliedCoupon.valid) {
                    return sendJson(400, { success: false, error: appliedCoupon.error });
                  }
                  const couponDiscount = appliedCoupon?.couponDiscount || 0;
                  const totalUsd = workflowSubtotal + setupFee - couponDiscount;

                  if (totalUsd < netConfig.min_amount_usd) {
                    return sendJson(400, {
                      success: false,
                      error: `Minimum order amount for ${netConfig.full_label} is $${netConfig.min_amount_usd} USD. Please choose another network.`,
                    });
                  }

                  let payAddress = '';
                  let payAmountCrypto = Number(totalUsd.toFixed(2));
                  let paymentId = 'pay_' + crypto.randomBytes(16).toString('hex');

                  if (apiKey) {
                    try {
                      const nowPayRes = await fetch('https://api.nowpayments.io/v1/payment', {
                        method: 'POST',
                        headers: {
                          'x-api-key': apiKey,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          price_amount: totalUsd,
                          price_currency: 'usd',
                          pay_currency: netConfig.nowpayments_currency,
                          order_id: orderId,
                          order_description: `GeeLark Flows Order ${orderId} (${netConfig.full_label})`,
                          ipn_callback_url: `https://geelarkflows.com/api/webhooks/crypto`,
                        }),
                      });

                      const nowPayData = await nowPayRes.json();
                      if (nowPayData && nowPayData.pay_address) {
                        payAddress = nowPayData.pay_address;
                        payAmountCrypto = Number(nowPayData.pay_amount || totalUsd);
                        if (nowPayData.payment_id) {
                          paymentId = String(nowPayData.payment_id);
                        }
                      } else if (nowPayData && (nowPayData.message || nowPayData.error)) {
                        return sendJson(502, {
                          success: false,
                          error: `NOWPayments Gateway: ${nowPayData.message || nowPayData.error}`,
                        });
                      }
                    } catch (apiErr) {
                      return sendJson(502, {
                        success: false,
                        error: `Payment gateway unreachable: ${apiErr.message}`,
                      });
                    }
                  }

                  if (!payAddress && !livePaymentMockEnabled) {
                    const fakeAddresses = {
                      trc20: 'TXkP7mT5vR7nL2pY9wA6qK4cD8eF1gH3jB',
                      erc20: '0x1111111111111111111111111111111111111111',
                      bep20: '0x2222222222222222222222222222222222222222',
                      sol: '11111111111111111111111111111111',
                    };
                    payAddress = fakeAddresses[netConfig.id];
                  }

                  if (!payAddress) {
                    return sendJson(502, { success: false, error: 'The explicitly enabled live payment mock could not create an invoice.' });
                  }

                  const orderRecord = {
                    orderId,
                    paymentId,
                    statusToken,
                    email,
                    asset: 'USDT',
                    network: netConfig.id,
                    networkLabel: netConfig.network,
                    blockchain: netConfig.blockchain,
                    fullNetworkLabel: netConfig.full_label,
                    currency: netConfig.display_currency,
                    payCurrencyTicker: netConfig.nowpayments_currency.toUpperCase(),
                    deliveryMethod,
                    workflowSubtotal,
                    setupFee,
                    couponCode: appliedCoupon?.code || null,
                    couponDiscount,
                    couponLabel: appliedCoupon?.discountLabel || null,
                    totalUsd,
                    payAmountCrypto,
                    payAddress,
                    addressVerified: false,
                    verificationSource: livePaymentMockEnabled ? 'local_live_unverified' : 'local_development_mock',
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                    status: 'awaiting_payment',
                    paymentStatus: 'waiting',
                    fulfillmentStatus: 'not_ready',
                    items: resolvedCart,
                    createdAt: new Date().toISOString(),
                    warning: `Send USDT on the ${netConfig.full_label} network only.`,
                  };

                  localDevOrders.set(orderId, orderRecord);
                  localDevOrders.set(paymentId, orderRecord);
                  if (appliedCoupon) appliedCoupon.coupon.redemption_count += 1;

                  return sendJson(200, { success: true, data: orderRecord });
                } catch (err) {
                  return sendJson(500, { success: false, error: err.message });
                }
              });
              return;
            }

            // POST /api/webhooks/crypto
            if (req.url?.startsWith('/api/webhooks/crypto') && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', () => {
                try {
                  const payload = JSON.parse(bodyStr || '{}');
                  if (!devWebhookSecret) {
                    return sendJson(503, { success: false, error: 'DEV_CRYPTO_WEBHOOK_SECRET is not configured.' });
                  }
                  const sortKeys = (value) => {
                    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
                    return Object.keys(value).sort().reduce((result, key) => {
                      result[key] = sortKeys(value[key]);
                      return result;
                    }, {});
                  };
                  const expectedSignature = crypto.createHmac('sha512', devWebhookSecret)
                    .update(JSON.stringify(sortKeys(payload)))
                    .digest('hex');
                  const suppliedSignature = String(req.headers['x-nowpayments-sig'] || '');
                  const signaturesMatch = suppliedSignature.length === expectedSignature.length
                    && crypto.timingSafeEqual(Buffer.from(suppliedSignature), Buffer.from(expectedSignature));
                  if (!signaturesMatch) {
                    return sendJson(401, { success: false, error: 'Invalid HMAC signature.' });
                  }
                  const orderId = payload.order_id;
                  const paymentStatus = payload.payment_status || 'finished';

                  if (orderId && localDevOrders.has(orderId)) {
                    const record = localDevOrders.get(orderId);
                    record.paymentStatus = paymentStatus;
                    record.txHash = payload.outcome_tx_hash || payload.txid || '0x' + Math.random().toString(16).substring(2);
                    if (['confirmed', 'finished', 'paid'].includes(paymentStatus.toLowerCase())) {
                      if (!['processing', 'completed', 'refunded'].includes(record.status)) record.status = 'paid';
                      record.fulfillmentStatus = record.deliveryMethod === 'geelark_setup' ? 'setup_pending' : 'fulfillment_pending';
                    } else if (['failed', 'expired'].includes(paymentStatus.toLowerCase()) && ['pending', 'awaiting_payment'].includes(record.status)) {
                      record.status = 'failed';
                    } else if (['waiting', 'confirming', 'sending', 'partially_paid'].includes(paymentStatus.toLowerCase()) && record.status === 'failed') {
                      record.status = 'awaiting_payment';
                      record.fulfillmentStatus = 'not_ready';
                    }
                    localDevOrders.set(orderId, record);
                    if (record.paymentId) localDevOrders.set(record.paymentId, record);
                  }
                  return sendJson(200, { success: true, status: 'processed' });
                } catch (err) {
                  return sendJson(500, { success: false, error: err.message });
                }
              });
              return;
            }

            // GET /api/checkout/status/:id
            if (req.url?.startsWith('/api/checkout/status/') && req.method === 'GET') {
              const id = req.url.split('/api/checkout/status/')[1].split('?')[0];
              const record = localDevOrders.get(id);
              const suppliedToken = req.headers['x-checkout-token'];
              if (!record || !record.statusToken || suppliedToken !== record.statusToken) {
                return sendJson(404, { success: false, error: 'Payment status not found.' });
              }

              res.setHeader('Cache-Control', 'no-store, private');
              const currentStatus = record.paymentStatus || 'waiting';
              const isConfirmed = ['confirmed', 'finished', 'paid'].includes(currentStatus.toLowerCase());

              return sendJson(200, {
                success: true,
                data: {
                  id,
                  orderId: record?.orderId || id,
                  paymentId: record?.paymentId || id,
                  status: currentStatus,
                  orderStatus: record.status || (isConfirmed ? 'paid' : 'awaiting_payment'),
                  isConfirmed,
                  txHash: record?.txHash || null,
                  asset: 'USDT',
                  network: record.network,
                  networkLabel: record.networkLabel,
                  blockchain: record.blockchain,
                  fullNetworkLabel: record.fullNetworkLabel,
                  currency: record.currency,
                  payCurrency: record.payCurrencyTicker,
                  deliveryMethod: record.deliveryMethod || 'download_package',
                  workflowSubtotal: record.workflowSubtotal || record.totalUsd || 0,
                  setupFee: record.setupFee || 0,
                  couponCode: record.couponCode || null,
                  couponDiscount: record.couponDiscount || 0,
                  totalUsd: record.totalUsd || 0,
                  payAmount: record.payAmountCrypto || record.totalUsd || 0,
                  payAddress: record.payAddress || '',
                  fulfillmentStatus: record.fulfillmentStatus || 'not_ready',
                  confirmations: isConfirmed ? 2 : 0,
                  requiredConfirmations: 2,
                },
              });
            }

            // POST /api/webhooks/resend (Local Dev Inbound Receiving)
            if (req.url?.startsWith('/api/webhooks/resend') && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', () => {
                try {
                  const payload = JSON.parse(bodyStr || '{}');
                  const emailData = payload.data || payload;
                  const providerId = emailData.email_id || emailData.id || `resend_${Date.now()}`;

                  // Duplicate check
                  for (const existing of localDevInboundEmails.values()) {
                    if (existing.providerEmailId === providerId) {
                      return sendJson(200, { success: true, status: 'already_processed', id: existing.id });
                    }
                  }

                  let rawFrom = emailData.from || 'Unknown Sender';
                  let fromName = null;
                  let fromAddress = rawFrom;
                  const fromMatch = rawFrom.match(/^(.*?)\s*<([^>]+)>$/);
                  if (fromMatch) {
                    fromName = fromMatch[1].replace(/["']/g, '').trim();
                    fromAddress = fromMatch[2].trim();
                  }

                  const subject = emailData.subject || '(No Subject)';
                  const textBody = emailData.text || '';
                  const htmlBody = emailData.html || '';

                  // Match order
                  let matchedOrderId = null;
                  const combined = `${subject} ${textBody} ${htmlBody}`;
                  const orderMatch = combined.match(/ord_[a-zA-Z0-9]{5,12}/i);
                  if (orderMatch) {
                    const candidate = orderMatch[0].toLowerCase();
                    for (const ord of localDevOrders.values()) {
                      if (ord.orderId.toLowerCase() === candidate) {
                        matchedOrderId = ord.orderId;
                        break;
                      }
                    }
                  }
                  if (!matchedOrderId && fromAddress) {
                    for (const ord of localDevOrders.values()) {
                      if (ord.email?.toLowerCase() === fromAddress.toLowerCase()) {
                        matchedOrderId = ord.orderId;
                        break;
                      }
                    }
                  }

                  const emailId = 'msg_' + Math.random().toString(36).substring(2, 10);
                  const newEmail = {
                    id: emailId,
                    providerEmailId: providerId,
                    fromAddress,
                    fromName,
                    toAddresses: Array.isArray(emailData.to) ? emailData.to : [emailData.to || 'noreply@geelarkflows.com'],
                    ccAddresses: Array.isArray(emailData.cc) ? emailData.cc : [],
                    replyTo: emailData.reply_to || fromAddress,
                    subject,
                    textBody,
                    htmlBody,
                    receivedAt: emailData.created_at || new Date().toISOString(),
                    isRead: 0,
                    isArchived: 0,
                    orderId: matchedOrderId,
                    customerEmail: fromAddress,
                    attachments: emailData.attachments || [],
                  };

                  localDevInboundEmails.set(emailId, newEmail);

                  localDevAuditLogs.unshift({
                    id: 'aud_' + Math.random().toString(36).substring(2),
                    actor_admin_email: 'resend_webhook',
                    action: 'INBOUND_EMAIL_RECEIVED',
                    entity_type: 'mail',
                    entity_id: emailId,
                    new_state: matchedOrderId || 'UNMATCHED',
                    created_at: new Date().toISOString(),
                  });

                  return sendJson(200, { success: true, id: emailId, order_id: matchedOrderId });
                } catch (err) {
                  return sendJson(500, { success: false, error: err.message });
                }
              });
              return;
            }

            // ----------------------------------------------------
            // 2. ADMIN AUTHENTICATION APIS (LOCAL DEV)
            // ----------------------------------------------------

            // POST /api/admin/auth/login
            if (req.url?.startsWith('/api/admin/auth/login') && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', () => {
                try {
                  const body = JSON.parse(bodyStr || '{}');
                  const { email, password } = body;

                  if (!devAdminEmail || !devAdminPassword) {
                    return sendJson(503, { success: false, error: 'Set DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD to enable local admin login.' });
                  }

                  if (String(email || '').toLowerCase() === devAdminEmail && password === devAdminPassword) {
                    const token = 'dev_token_' + Math.random().toString(36).substring(2);
                    const user = { id: 'usr_dev_admin', email: 'admin@geelarkflows.com', name: 'Primary Super Admin', role: 'SUPER_ADMIN' };
                    localDevSessions.set(token, user);

                    localDevAuditLogs.unshift({
                      id: 'aud_' + Math.random().toString(36).substring(2),
                      actor_admin_email: user.email,
                      action: 'LOGIN_SUCCESS',
                      entity_type: 'auth',
                      entity_id: 'session',
                      created_at: new Date().toISOString(),
                    });

                    res.setHeader('Set-Cookie', `gf_admin_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200`);
                    return sendJson(200, { success: true, user });
                  }

                  localDevAuditLogs.unshift({
                    id: 'aud_' + Math.random().toString(36).substring(2),
                    actor_admin_email: email || 'unknown',
                    action: 'LOGIN_FAILED',
                    entity_type: 'auth',
                    entity_id: email || 'unknown',
                    reason: 'Invalid credentials in local dev',
                    created_at: new Date().toISOString(),
                  });

                  return sendJson(401, { success: false, error: 'Invalid email or password.' });
                } catch (e) {
                  return sendJson(500, { success: false, error: e.message });
                }
              });
              return;
            }

            // POST /api/admin/auth/logout
            if (req.url?.startsWith('/api/admin/auth/logout') && req.method === 'POST') {
              const cookies = parseCookies(req.headers.cookie);
              if (cookies.gf_admin_session) localDevSessions.delete(cookies.gf_admin_session);
              res.setHeader('Set-Cookie', 'gf_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
              return sendJson(200, { success: true, message: 'Logged out.' });
            }

            // GET /api/admin/auth/me
            if (req.url?.startsWith('/api/admin/auth/me') && req.method === 'GET') {
              const cookies = parseCookies(req.headers.cookie);
              const user = localDevSessions.get(cookies.gf_admin_session);
              if (!user) return sendJson(401, { success: false, error: 'Unauthorized' });
              return sendJson(200, { success: true, user });
            }

            // ----------------------------------------------------
            // 3. ADMIN OPERATIONS APIS (LOCAL DEV)
            // ----------------------------------------------------

            if (req.url?.startsWith('/api/admin/')) {
              // CSRF Guard on Mutating Requests
              if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method.toUpperCase())) {
                if (req.headers['x-admin-action'] !== '1') {
                  return sendJson(403, { success: false, error: 'Forbidden: Missing X-Admin-Action header.' });
                }
              }

              // Auth Check
              const cookies = parseCookies(req.headers.cookie);
              const user = localDevSessions.get(cookies.gf_admin_session);
              if (!user) {
                return sendJson(401, { success: false, error: 'Unauthorized: Session missing or expired.' });
              }

              // GET /api/admin/dashboard
              if (req.url.startsWith('/api/admin/dashboard') && req.method === 'GET') {
                const allOrders = Array.from(new Set(Array.from(localDevOrders.values())));
                const totalOrders = allOrders.length;
                const paidOrders = allOrders.filter(o => ['paid', 'processing', 'completed'].includes(o.status));
                const grossRev = paidOrders.reduce((sum, o) => sum + (o.totalUsd || 0), 0);
                const refundedOrders = allOrders.filter(o => o.status === 'refunded');
                const refundedAmt = refundedOrders.reduce((sum, o) => sum + (o.totalUsd || 0), 0);

                const countPending = allOrders.filter(o => o.status === 'pending').length;
                const countAwaiting = allOrders.filter(o => o.status === 'awaiting_payment').length;
                const countVerifying = allOrders.filter(o => ['confirming', 'sending'].includes(o.paymentStatus)).length;
                const countPaid = allOrders.filter(o => o.status === 'paid').length;
                const countProcessing = allOrders.filter(o => o.status === 'processing').length;
                const countCompleted = allOrders.filter(o => o.status === 'completed').length;
                const countFulfillmentPending = allOrders.filter(o => (
                  ['paid', 'processing'].includes(o.status)
                  && !['package_delivered', 'setup_completed'].includes(o.fulfillmentStatus)
                )).length;

                return sendJson(200, {
                  success: true,
                  data: {
                    metrics: {
                      total_orders: totalOrders,
                      net_revenue: Math.max(0, grossRev - refundedAmt),
                      gross_revenue: grossRev,
                      refunded_amount: refundedAmt,
                      pending: countPending,
                      awaiting_payment: countAwaiting,
                      verifying: countVerifying,
                      paid: countPaid,
                      processing: countProcessing,
                      completed: countCompleted,
                      fulfillment_pending: countFulfillmentPending,
                      cancelled: allOrders.filter(o => o.status === 'cancelled').length,
                      refunded: refundedOrders.length,
                    },
                    attention_alerts: countFulfillmentPending > 0 ? [
                      { id: 'alt_1', type: 'warning', title: `${countFulfillmentPending} Paid orders pending fulfillment`, link: '/admin/fulfillment' }
                    ] : [],
                    network_distribution: [
                      { currency: 'USDT (TRC-20)', tx_count: allOrders.filter(o => o.network === 'trc20').length, total_volume: 1400 },
                      { currency: 'USDT (BEP-20)', tx_count: allOrders.filter(o => o.network === 'bep20').length, total_volume: 1250 },
                    ],
                    recent_orders: allOrders.slice(0, 10).map((order) => ({
                      id: order.orderId,
                      created_at: order.createdAt,
                      customer_email: order.email,
                      total_usd: order.totalUsd,
                      payment_currency: order.currency,
                      status: order.status,
                      fulfillment_status: order.fulfillmentStatus || 'not_ready',
                    })),
                    synced_at: new Date().toISOString(),
                  },
                });
              }

              // GET /api/admin/analytics
              if (req.url.startsWith('/api/admin/analytics') && req.method === 'GET') {
                const now = new Date();
                const day = (offset) => new Date(now.getTime() - offset * 86400000).toISOString().slice(0, 10);
                return sendJson(200, {
                  success: true,
                  data: {
                    range_days: 30,
                    metrics: {
                      unique_visitors: 184,
                      page_views: 493,
                      cart_visitors: 37,
                      cart_additions: 52,
                      active_carts: 12,
                      cart_visitor_rate: 20.1,
                    },
                    daily: [
                      { day: day(6), unique_visitors: 19, page_views: 48, cart_additions: 4 },
                      { day: day(5), unique_visitors: 23, page_views: 61, cart_additions: 7 },
                      { day: day(4), unique_visitors: 27, page_views: 70, cart_additions: 8 },
                      { day: day(3), unique_visitors: 22, page_views: 59, cart_additions: 5 },
                      { day: day(2), unique_visitors: 31, page_views: 83, cart_additions: 9 },
                      { day: day(1), unique_visitors: 35, page_views: 91, cart_additions: 11 },
                      { day: day(0), unique_visitors: 27, page_views: 81, cart_additions: 8 },
                    ],
                    popular_flows: [
                      { product_id: 'instagram-account-creation', title: 'Instagram Account Creation', cart_additions: 18, unique_visitors: 15, share: 34.6 },
                      { product_id: 'tiktok-warmup', title: 'TikTok Warmup', cart_additions: 13, unique_visitors: 11, share: 25 },
                      { product_id: 'youtube-publishing', title: 'YouTube Publishing', cart_additions: 9, unique_visitors: 8, share: 17.3 },
                    ],
                    traffic_sources: [
                      { referrer_host: 'bing.com', sessions: 58, unique_visitors: 49, page_views: 132, cart_visitors: 13, cart_additions: 18 },
                      { referrer_host: 'google.com', sessions: 46, unique_visitors: 41, page_views: 119, cart_visitors: 11, cart_additions: 15 },
                      { referrer_host: 'Direct', sessions: 39, unique_visitors: 35, page_views: 101, cart_visitors: 8, cart_additions: 12 },
                      { referrer_host: 'Internal', sessions: 17, unique_visitors: 15, page_views: 41, cart_visitors: 5, cart_additions: 7 },
                    ],
                    locations: [
                      { country_code: 'IN', region: 'Telangana', city: 'Hyderabad', unique_visitors: 61, cart_visitors: 15, cart_additions: 22, cart_visitor_rate: 24.6 },
                      { country_code: 'US', region: 'California', city: 'San Francisco', unique_visitors: 38, cart_visitors: 9, cart_additions: 12, cart_visitor_rate: 23.7 },
                    ],
                    active_carts: [
                      { visitor_id: 'a4e92c0d71f8', item_count: 2, cart_value_usd: 1250, items: [{ product_id: 'instagram-account-creation', title: 'Instagram Account Creation' }, { product_id: 'instagram-warmup', title: 'Instagram Warmup' }], page_path: '/cart', referrer_host: 'google.com', ip_network: '203.0.113.0/24', country_code: 'IN', region: 'Telangana', city: 'Hyderabad', device_type: 'Desktop', browser_family: 'Chrome', os_family: 'Windows', updated_at: now.toISOString().replace('T', ' ').slice(0, 19) },
                      { visitor_id: '91bc73d0842a', item_count: 1, cart_value_usd: 250, items: [{ product_id: 'tiktok-warmup', title: 'TikTok Warmup' }], page_path: '/cart', referrer_host: null, ip_network: '2001:db8:42::/48', country_code: 'US', region: 'California', city: 'San Francisco', device_type: 'Mobile', browser_family: 'Safari', os_family: 'iOS', updated_at: new Date(now.getTime() - 3600000).toISOString().replace('T', ' ').slice(0, 19) },
                    ],
                    recent_cart_additions: [
                      { visitor_id: 'a4e92c0d71f8', product_id: 'instagram-account-creation', title: 'Instagram Account Creation', page_path: '/flows/instagram-account-creation', referrer_host: 'google.com', ip_network: '203.0.113.0/24', country_code: 'IN', region: 'Telangana', city: 'Hyderabad', device_type: 'Desktop', browser_family: 'Chrome', os_family: 'Windows', created_at: now.toISOString().replace('T', ' ').slice(0, 19) },
                      { visitor_id: '91bc73d0842a', product_id: 'tiktok-warmup', title: 'TikTok Warmup', page_path: '/', referrer_host: 'Direct', ip_network: '2001:db8:42::/48', country_code: 'US', region: 'California', city: 'San Francisco', device_type: 'Mobile', browser_family: 'Safari', os_family: 'iOS', created_at: new Date(now.getTime() - 3600000).toISOString().replace('T', ' ').slice(0, 19) },
                    ],
                    retention_days: 90,
                    synced_at: now.toISOString(),
                  },
                });
              }

              // GET /api/admin/coupons
              if (req.url.startsWith('/api/admin/coupons') && req.method === 'GET') {
                const coupons = Array.from(localDevCoupons.values())
                  .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
                  .map((coupon) => ({
                    ...coupon,
                    discount_value_display: coupon.discount_type === 'percentage'
                      ? `${coupon.discount_value}%`
                      : `$${(coupon.discount_value / 100).toFixed(2)}`,
                    min_subtotal_usd: coupon.min_subtotal_cents / 100,
                  }));
                return sendJson(200, { success: true, coupons });
              }

              // POST /api/admin/coupons
              if (req.url === '/api/admin/coupons' && req.method === 'POST') {
                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', () => {
                  try {
                    const body = JSON.parse(bodyStr || '{}');
                    const code = String(body.code || '').trim().toUpperCase();
                    const discountType = body.discount_type;
                    const inputValue = Number(body.discount_value);
                    if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) return sendJson(400, { success: false, error: 'Coupon codes must be 3–32 letters, numbers, underscores, or hyphens.' });
                    if (localDevCoupons.has(code)) return sendJson(409, { success: false, error: 'A coupon with this code already exists.' });
                    if (!['percentage', 'fixed_amount'].includes(discountType) || !Number.isFinite(inputValue) || inputValue <= 0) return sendJson(400, { success: false, error: 'Enter a valid discount.' });
                    if (discountType === 'percentage' && (!Number.isInteger(inputValue) || inputValue > 100)) return sendJson(400, { success: false, error: 'Percentage discounts must be a whole number from 1 to 100.' });

                    const now = new Date().toISOString();
                    const coupon = {
                      id: 'cpn_' + crypto.randomBytes(8).toString('hex'),
                      code,
                      description: String(body.description || '').trim() || null,
                      discount_type: discountType,
                      discount_value: discountType === 'percentage' ? inputValue : Math.round(inputValue * 100),
                      min_subtotal_cents: Math.max(0, Math.round(Number(body.min_subtotal_usd || 0) * 100)),
                      max_redemptions: body.max_redemptions ? Number(body.max_redemptions) : null,
                      active: body.active !== false,
                      starts_at: body.starts_at || null,
                      expires_at: body.expires_at || null,
                      redemption_count: 0,
                      created_at: now,
                      updated_at: now,
                    };
                    localDevCoupons.set(code, coupon);
                    return sendJson(201, { success: true, message: `Coupon ${code} created.`, id: coupon.id, code });
                  } catch (err) {
                    return sendJson(400, { success: false, error: 'Invalid coupon request.' });
                  }
                });
                return;
              }

              // PATCH /api/admin/coupons/:id
              if (req.url.match(/\/api\/admin\/coupons\/[^/?]+$/) && req.method === 'PATCH') {
                const couponId = decodeURIComponent(req.url.split('/api/admin/coupons/')[1].split('?')[0]);
                const coupon = Array.from(localDevCoupons.values()).find((item) => item.id === couponId);
                if (!coupon) return sendJson(404, { success: false, error: 'Coupon not found.' });
                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', () => {
                  const body = JSON.parse(bodyStr || '{}');
                  if (typeof body.active !== 'boolean') return sendJson(400, { success: false, error: 'The active flag must be boolean.' });
                  coupon.active = body.active;
                  coupon.updated_at = new Date().toISOString();
                  return sendJson(200, { success: true, id: coupon.id, code: coupon.code, active: coupon.active });
                });
                return;
              }

              // GET /api/admin/notifications
              if (req.url.startsWith('/api/admin/notifications') && req.method === 'GET') {
                const notifications = Array.from(localDevNotifications.values())
                  .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
                  .map((notification) => {
                    const receipts = Array.from(localDevNotificationReceipts.entries())
                      .filter(([key]) => key.startsWith(`${notification.id}:`))
                      .map(([, receipt]) => receipt);
                    return {
                      ...notification,
                      push_enabled: Boolean(notification.push_enabled),
                      push_sent_count: Number(notification.push_sent_count || 0),
                      push_failed_count: Number(notification.push_failed_count || 0),
                      push_gone_count: Number(notification.push_gone_count || 0),
                      delivered_count: receipts.length,
                      read_count: receipts.filter((receipt) => receipt.read).length,
                      dismissed_count: receipts.filter((receipt) => receipt.dismissed).length,
                    };
                  });
                return sendJson(200, {
                  success: true,
                  push_configured: true,
                  active_push_subscribers: localDevPushSubscriptions.size,
                  notifications,
                });
              }

              // POST /api/admin/notifications
              if (req.url === '/api/admin/notifications' && req.method === 'POST') {
                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', () => {
                  try {
                    const body = JSON.parse(bodyStr || '{}');
                    const title = String(body.title || '').trim();
                    const message = String(body.message || '').trim();
                    if (title.length < 3 || message.length < 5) return sendJson(400, { success: false, error: 'Enter a title and message.' });
                    if (!['all', 'active_cart', 'product_cart'].includes(body.audience_type)) return sendJson(400, { success: false, error: 'Choose a valid audience.' });
                    if (body.audience_type === 'product_cart' && !devCatalogMap.has(body.product_id)) return sendJson(400, { success: false, error: 'Choose a valid flow.' });
                    if (!/^\/(?!\/)/.test(String(body.cta_url || '/'))) return sendJson(400, { success: false, error: 'CTA URL must be an internal path.' });
                    const coupon = body.coupon_id
                      ? Array.from(localDevCoupons.values()).find((item) => item.id === body.coupon_id)
                      : null;
                    if (body.coupon_id && !coupon) return sendJson(400, { success: false, error: 'Selected coupon was not found.' });
                    const now = new Date().toISOString();
                    const notification = {
                      id: 'ntf_' + crypto.randomBytes(8).toString('hex'),
                      title,
                      message,
                      audience_type: body.audience_type,
                      product_id: body.audience_type === 'product_cart' ? body.product_id : null,
                      coupon_id: coupon?.id || null,
                      coupon_code: coupon?.code || null,
                      cta_label: String(body.cta_label || '').trim() || null,
                      cta_url: String(body.cta_url || '/'),
                      push_enabled: body.push_enabled === true,
                      push_sent_at: body.push_enabled === true ? now : null,
                      active: body.active !== false,
                      starts_at: body.starts_at || null,
                      expires_at: body.expires_at || null,
                      created_at: now,
                      updated_at: now,
                      delivered_count: 0,
                      read_count: 0,
                      dismissed_count: 0,
                      push_sent_count: body.push_enabled === true ? localDevPushSubscriptions.size : 0,
                      push_failed_count: 0,
                      push_gone_count: 0,
                    };
                    localDevNotifications.set(notification.id, notification);
                    return sendJson(201, {
                      success: true,
                      id: notification.id,
                      message: `In-site notification campaign created.${body.push_enabled === true ? ` Browser push: ${localDevPushSubscriptions.size} sent, 0 failed or expired.` : ''}`,
                      push: { sent: body.push_enabled === true ? localDevPushSubscriptions.size : 0, failed: 0, gone: 0, skipped: 0 },
                    });
                  } catch {
                    return sendJson(400, { success: false, error: 'Invalid notification request.' });
                  }
                });
                return;
              }

              // PATCH /api/admin/notifications/:id
              if (req.url.match(/\/api\/admin\/notifications\/[^/?]+$/) && req.method === 'PATCH') {
                const notificationId = decodeURIComponent(req.url.split('/api/admin/notifications/')[1].split('?')[0]);
                const notification = localDevNotifications.get(notificationId);
                if (!notification) return sendJson(404, { success: false, error: 'Notification campaign not found.' });
                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', () => {
                  const body = JSON.parse(bodyStr || '{}');
                  if (typeof body.active !== 'boolean') return sendJson(400, { success: false, error: 'The active flag must be boolean.' });
                  notification.active = body.active;
                  notification.updated_at = new Date().toISOString();
                  return sendJson(200, { success: true, id: notification.id, active: notification.active });
                });
                return;
              }

              // GET /api/admin/orders
              if (req.url.startsWith('/api/admin/orders') && req.method === 'GET' && !req.url.includes('/orders/')) {
                const allOrders = Array.from(new Set(Array.from(localDevOrders.values())));
                return sendJson(200, {
                  success: true,
                  orders: allOrders.map(o => ({
                    id: o.orderId,
                    customer_email: o.email,
                    delivery_method: o.deliveryMethod || 'download_package',
                    workflow_subtotal: o.workflowSubtotal || o.totalUsd || 0,
                    setup_fee: o.setupFee || 0,
                    coupon_code: o.couponCode || null,
                    coupon_discount_usd: o.couponDiscount || 0,
                    total_usd: o.totalUsd,
                    status: o.status,
                    items: JSON.stringify(o.items || []),
                    fulfillment_status: o.fulfillmentStatus || 'not_ready',
                    created_at: o.createdAt,
                    payment_id: o.paymentId,
                    payment_currency: o.currency,
                    payment_status: o.paymentStatus || 'waiting',
                    pay_amount_crypto: o.payAmountCrypto,
                    tx_hash: o.txHash,
                    itemsCount: (o.items || []).length,
                    itemsSummary: (o.items || []).map(i => i.title).join(', '),
                  })),
                  pagination: { page: 1, pageSize: 25, total: allOrders.length, totalPages: 1 },
                });
              }

              // GET /api/admin/orders/:id
              if (req.url.match(/\/api\/admin\/orders\/[^/?]+$/) && req.method === 'GET') {
                const orderId = req.url.split('/api/admin/orders/')[1].split('?')[0];
                const order = localDevOrders.get(orderId);
                if (!order) return sendJson(404, { success: false, error: 'Order not found' });

                return sendJson(200, {
                  success: true,
                  order: {
                    id: order.orderId,
                    customer_email: order.email,
                    delivery_method: order.deliveryMethod || 'download_package',
                    workflow_subtotal: order.workflowSubtotal || order.totalUsd || 0,
                    setup_fee: order.setupFee || 0,
                    coupon_code: order.couponCode || null,
                    coupon_discount_usd: order.couponDiscount || 0,
                    total_usd: order.totalUsd,
                    status: order.status,
                    fulfillment_status: order.fulfillmentStatus || 'not_ready',
                    delivered_at: order.deliveredAt || null,
                    created_at: order.createdAt,
                    items: order.items || [],
                  },
                  payment: {
                    id: order.paymentId,
                    order_id: order.orderId,
                    currency: order.currency,
                    pay_address: order.payAddress,
                    pay_amount_crypto: order.payAmountCrypto,
                    tx_hash: order.txHash,
                    status: order.paymentStatus || 'waiting',
                    verification_source: order.verificationSource || 'nowpayments_ipn',
                    created_at: order.createdAt,
                    explorerUrl: order.txHash ? `https://tronscan.org/#/transaction/${order.txHash}` : null,
                  },
                  fulfillment_logs: localDevFulfillmentLogs.filter(f => f.order_id === orderId),
                  audit_history: localDevAuditLogs.filter(a => a.entity_id === orderId),
                });
              }

              // POST /api/admin/orders/:id/fulfillment-status
              if (req.url.match(/\/api\/admin\/orders\/[^/?]+\/fulfillment-status/) && req.method === 'POST') {
                const orderId = req.url.split('/api/admin/orders/')[1].split('/fulfillment-status')[0];
                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', () => {
                  const body = JSON.parse(bodyStr || '{}');
                  const order = localDevOrders.get(orderId);
                  if (!order) return sendJson(404, { success: false, error: 'Order not found' });

                  const confirmedPayment = ['confirmed', 'finished', 'paid'].includes(String(order.paymentStatus || '').toLowerCase());
                  if (!['paid', 'processing', 'completed'].includes(order.status) || !confirmedPayment) {
                    return sendJson(409, { success: false, error: 'Fulfillment is locked until both order and payment records confirm settlement.' });
                  }

                  const prev = order.fulfillmentStatus;
                  order.fulfillmentStatus = body.target_status;
                  localDevOrders.set(orderId, order);

                  localDevAuditLogs.unshift({
                    id: 'aud_' + Math.random().toString(36).substring(2),
                    actor_admin_email: user.email,
                    action: 'ORDER_FULFILLMENT_STATUS_UPDATE',
                    entity_type: 'order',
                    entity_id: orderId,
                    previous_state: prev,
                    new_state: body.target_status,
                    timestamp: new Date().toISOString(),
                  });

                  return sendJson(200, { success: true, orderId, previousFulfillmentStatus: prev, fulfillmentStatus: body.target_status });
                });
                return;
              }

              // POST /api/admin/orders/:id/transition
              if (req.url.match(/\/api\/admin\/orders\/[^/?]+\/transition/) && req.method === 'POST') {
                const orderId = req.url.split('/api/admin/orders/')[1].split('/transition')[0];
                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', () => {
                  const body = JSON.parse(bodyStr || '{}');
                  const order = localDevOrders.get(orderId);
                  if (!order) return sendJson(404, { success: false, error: 'Order not found' });

                  const prev = order.status;
                  const allowedTransitions = {
                    pending: ['awaiting_payment', 'cancelled'],
                    awaiting_payment: ['cancelled'],
                    paid: ['processing', 'refunded'],
                    processing: ['completed', 'refunded'],
                    completed: ['refunded'],
                    cancelled: [],
                    refunded: [],
                    failed: [],
                  };
                  if (!(allowedTransitions[prev] || []).includes(body.target_status)) {
                    return sendJson(400, { success: false, error: `Invalid transition from ${prev} to ${body.target_status}.` });
                  }
                  order.status = body.target_status;
                  localDevOrders.set(orderId, order);

                  localDevAuditLogs.unshift({
                    id: 'aud_' + Math.random().toString(36).substring(2),
                    actor_admin_email: user.email,
                    action: 'ORDER_STATUS_TRANSITION',
                    entity_type: 'order',
                    entity_id: orderId,
                    previous_state: prev,
                    new_state: body.target_status,
                    reason: body.reason || 'Operational update',
                    created_at: new Date().toISOString(),
                  });

                  return sendJson(200, { success: true, orderId, previousStatus: prev, status: body.target_status });
                });
                return;
              }

              // GET /api/admin/payments
              if (req.url.startsWith('/api/admin/payments') && req.method === 'GET' && !req.url.includes('/payments/')) {
                const allOrders = Array.from(new Set(Array.from(localDevOrders.values())));
                return sendJson(200, {
                  success: true,
                  payments: allOrders.map(o => ({
                    id: o.paymentId,
                    order_id: o.orderId,
                    currency: o.currency,
                    pay_address: o.payAddress,
                    pay_amount_crypto: o.payAmountCrypto,
                    tx_hash: o.txHash,
                    status: o.status,
                    customer_email: o.email,
                    total_usd: o.totalUsd,
                    created_at: o.createdAt,
                  })),
                  pagination: { page: 1, pageSize: 25, total: allOrders.length, totalPages: 1 },
                });
              }

              // POST /api/admin/payments/:id/manual-verify
              if (req.url.match(/\/api\/admin\/payments\/[^/?]+\/manual-verify/) && req.method === 'POST') {
                const paymentId = req.url.split('/api/admin/payments/')[1].split('/manual-verify')[0];
                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', () => {
                  const body = JSON.parse(bodyStr || '{}');
                  const order = localDevOrders.get(paymentId);
                  if (!order) return sendJson(404, { success: false, error: 'Payment not found' });

                  const prev = order.status;
                  order.status = 'paid';
                  order.paymentStatus = 'confirmed';
                  order.txHash = body.tx_hash || 'MANUAL_VERIFIED_BY_' + user.email;
                  order.verificationSource = 'manual_admin';
                  localDevOrders.set(order.orderId, order);

                  localDevAuditLogs.unshift({
                    id: 'aud_' + Math.random().toString(36).substring(2),
                    actor_admin_email: user.email,
                    action: 'MANUAL_PAYMENT_VERIFIED',
                    entity_type: 'payment',
                    entity_id: paymentId,
                    previous_state: prev,
                    new_state: 'confirmed',
                    reason: body.reason,
                    created_at: new Date().toISOString(),
                  });

                  return sendJson(200, { success: true, message: 'Payment manually verified.', paymentId, orderId: order.orderId });
                });
                return;
              }

              // GET /api/admin/fulfillment
              if (req.url.startsWith('/api/admin/fulfillment') && req.method === 'GET') {
                const allOrders = Array.from(new Set(Array.from(localDevOrders.values())));
                return sendJson(200, {
                  success: true,
                  fulfillment_queue: allOrders.map(o => ({
                    id: o.orderId,
                    customer_email: o.email,
                    total_usd: o.totalUsd,
                    status: o.status,
                    fulfillment_status: o.fulfillmentStatus || 'not_ready',
                    delivered_at: o.deliveredAt || null,
                    created_at: o.createdAt,
                    payment_currency: o.currency,
                    payment_status: o.paymentStatus || 'waiting',
                    attempt_count: 1,
                  })),
                });
              }

              // POST /api/admin/fulfillment/:orderId/resend
              if (req.url.match(/\/api\/admin\/fulfillment\/[^/?]+\/resend/) && req.method === 'POST') {
                const orderId = req.url.split('/api/admin/fulfillment/')[1].split('/resend')[0];
                const order = localDevOrders.get(orderId);
                if (!order) return sendJson(404, { success: false, error: 'Order not found' });

                order.fulfillmentStatus = order.deliveryMethod === 'geelark_setup' ? 'setup_in_progress' : 'package_delivered';
                order.deliveredAt = new Date().toISOString();
                localDevOrders.set(orderId, order);

                localDevFulfillmentLogs.unshift({
                  id: 'fl_' + Math.random().toString(36).substring(2),
                  order_id: orderId,
                  triggered_by: `admin:${user.email}`,
                  recipient_email: order.email,
                  status: 'dispatched',
                  created_at: new Date().toISOString(),
                });

                localDevAuditLogs.unshift({
                  id: 'aud_' + Math.random().toString(36).substring(2),
                  actor_admin_email: user.email,
                  action: 'FULFILLMENT_RESENT',
                  entity_type: 'order',
                  entity_id: orderId,
                  new_state: 'delivered',
                  created_at: new Date().toISOString(),
                });

                return sendJson(200, { success: true, message: `Package re-dispatched to ${order.email}`, orderId });
              }

              // GET /api/admin/workflows
              if (req.url.startsWith('/api/admin/workflows') && req.method === 'GET') {
                const derivedWorkflows = (products || []).map((wf) => ({
                  id: wf.id,
                  platform: wf.platform,
                  title: wf.title,
                  price: Number(wf.price),
                  category: wf.details?.category || 'Automation',
                  units_sold: 0,
                  total_sales_usd: 0,
                }));
                return sendJson(200, {
                  success: true,
                  workflows: derivedWorkflows,
                });
              }

              // GET /api/admin/custom-requests
              if (req.url.startsWith('/api/admin/custom-requests') && req.method === 'GET') {
                const urlObj = new URL(req.url, 'http://localhost');
                const status = urlObj.searchParams.get('status') || 'all';
                const page = Math.max(1, Number(urlObj.searchParams.get('page')) || 1);
                const limit = Math.max(1, Number(urlObj.searchParams.get('limit')) || 50);
                const requests = Array.from(localDevCustomRequests.values())
                  .filter((item) => status === 'all' || item.status === status)
                  .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

                return sendJson(200, {
                  success: true,
                  data: requests.slice((page - 1) * limit, page * limit),
                  pagination: { page, limit, total: requests.length },
                });
              }

              // PATCH /api/admin/custom-requests/:id
              if (req.url.match(/\/api\/admin\/custom-requests\/[^/?]+$/) && req.method === 'PATCH') {
                const requestId = req.url.split('/api/admin/custom-requests/')[1].split('?')[0];
                const customRequest = localDevCustomRequests.get(requestId);
                if (!customRequest) return sendJson(404, { success: false, error: 'Custom automation request not found' });

                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', () => {
                  const body = JSON.parse(bodyStr || '{}');
                  const validStatuses = ['new', 'in_review', 'contacted', 'closed'];
                  if (!validStatuses.includes(body.status)) {
                    return sendJson(400, { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
                  }

                  customRequest.status = body.status;
                  customRequest.updated_at = new Date().toISOString();
                  localDevCustomRequests.set(requestId, customRequest);
                  return sendJson(200, { success: true, message: 'Status updated successfully', id: requestId, status: body.status });
                });
                return;
              }

              // GET /api/admin/customers
              if (req.url.startsWith('/api/admin/customers') && req.method === 'GET' && !req.url.includes('/customers/')) {
                const allOrders = Array.from(new Set(Array.from(localDevOrders.values())));
                const customerMap = {};
                allOrders.forEach(o => {
                  if (!customerMap[o.email]) {
                    customerMap[o.email] = { email: o.email, order_count: 0, total_spent: 0, first_order_at: o.createdAt, last_order_at: o.createdAt };
                  }
                  customerMap[o.email].order_count += 1;
                  customerMap[o.email].total_spent += o.totalUsd || 0;
                });
                return sendJson(200, { success: true, customers: Object.values(customerMap) });
              }

              // GET /api/admin/mail
              if (req.url.startsWith('/api/admin/mail') && req.method === 'GET' && !req.url.includes('/mail/')) {
                const urlObj = new URL(req.url, 'http://localhost');
                const filter = urlObj.searchParams.get('filter') || 'all';
                const search = (urlObj.searchParams.get('search') || '').toLowerCase().trim();

                let all = Array.from(localDevInboundEmails.values());
                if (filter === 'unread') all = all.filter(e => e.isRead === 0 && e.isArchived === 0);
                else if (filter === 'read') all = all.filter(e => e.isRead === 1 && e.isArchived === 0);
                else if (filter === 'archived') all = all.filter(e => e.isArchived === 1);
                else all = all.filter(e => e.isArchived === 0);

                if (search) {
                  all = all.filter(e =>
                    e.fromAddress?.toLowerCase().includes(search) ||
                    e.fromName?.toLowerCase().includes(search) ||
                    e.subject?.toLowerCase().includes(search) ||
                    e.textBody?.toLowerCase().includes(search) ||
                    e.orderId?.toLowerCase().includes(search)
                  );
                }

                const unreadCount = Array.from(localDevInboundEmails.values()).filter(e => e.isRead === 0 && e.isArchived === 0).length;

                return sendJson(200, {
                  success: true,
                  emails: all.map(e => ({
                    id: e.id,
                    provider_email_id: e.providerEmailId,
                    from_address: e.fromAddress,
                    from_name: e.fromName,
                    to_addresses: e.toAddresses,
                    subject: e.subject,
                    snippet: e.textBody ? e.textBody.substring(0, 140) : '',
                    received_at: e.receivedAt,
                    is_read: e.isRead,
                    is_archived: e.isArchived,
                    order_id: e.orderId,
                    customer_email: e.customerEmail,
                    attachment_count: e.attachments?.length || 0,
                  })),
                  unread_count: unreadCount,
                  pagination: { page: 1, pageSize: 25, total: all.length, totalPages: 1 },
                });
              }

              // GET /api/admin/mail/:id
              if (req.url.match(/\/api\/admin\/mail\/msg_[^/?]+/) && req.method === 'GET') {
                const emailId = req.url.split('/api/admin/mail/')[1].split('?')[0];
                const email = localDevInboundEmails.get(emailId);
                if (!email) return sendJson(404, { success: false, error: 'Email not found' });

                email.isRead = 1;
                localDevInboundEmails.set(emailId, email);

                let linkedOrder = null;
                if (email.orderId) {
                  const ord = localDevOrders.get(email.orderId);
                  if (ord) {
                    linkedOrder = {
                      id: ord.orderId,
                      customer_email: ord.email,
                      total_usd: ord.totalUsd,
                      status: ord.status,
                      fulfillment_status: ord.fulfillmentStatus,
                      created_at: ord.createdAt,
                      payment_currency: ord.currency,
                      payment_status: ord.status,
                    };
                  }
                }

                return sendJson(200, {
                  success: true,
                  email: {
                    id: email.id,
                    provider_email_id: email.providerEmailId,
                    from_address: email.fromAddress,
                    from_name: email.fromName,
                    to_addresses: email.toAddresses,
                    cc_addresses: email.ccAddresses || [],
                    reply_to: email.replyTo,
                    subject: email.subject,
                    text_body: email.textBody,
                    html_body: email.htmlBody,
                    received_at: email.receivedAt,
                    is_read: email.isRead,
                    is_archived: email.isArchived,
                    order_id: email.orderId,
                    customer_email: email.customerEmail,
                  },
                  attachments: email.attachments || [],
                  linked_order: linkedOrder,
                  thread: [],
                });
              }

              // PATCH /api/admin/mail/:id/read
              if (req.url.match(/\/api\/admin\/mail\/msg_[^/?]+\/read/) && req.method === 'PATCH') {
                const emailId = req.url.split('/api/admin/mail/')[1].split('/read')[0];
                const email = localDevInboundEmails.get(emailId);
                if (!email) return sendJson(404, { success: false, error: 'Email not found' });

                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', () => {
                  const b = JSON.parse(bodyStr || '{}');
                  email.isRead = b.is_read !== undefined ? (b.is_read ? 1 : 0) : 1;
                  localDevInboundEmails.set(emailId, email);
                  return sendJson(200, { success: true, emailId, is_read: email.isRead });
                });
                return;
              }

              // PATCH /api/admin/mail/:id/archive
              if (req.url.match(/\/api\/admin\/mail\/msg_[^/?]+\/archive/) && req.method === 'PATCH') {
                const emailId = req.url.split('/api/admin/mail/')[1].split('/archive')[0];
                const email = localDevInboundEmails.get(emailId);
                if (!email) return sendJson(404, { success: false, error: 'Email not found' });

                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', () => {
                  const b = JSON.parse(bodyStr || '{}');
                  email.isArchived = b.is_archived !== undefined ? (b.is_archived ? 1 : 0) : 1;
                  localDevInboundEmails.set(emailId, email);
                  return sendJson(200, { success: true, emailId, is_archived: email.isArchived });
                });
                return;
              }

              // POST /api/admin/mail/:id/link-order
              if (req.url.match(/\/api\/admin\/mail\/msg_[^/?]+\/link-order/) && req.method === 'POST') {
                const emailId = req.url.split('/api/admin/mail/')[1].split('/link-order')[0];
                const email = localDevInboundEmails.get(emailId);
                if (!email) return sendJson(404, { success: false, error: 'Email not found' });

                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', () => {
                  const b = JSON.parse(bodyStr || '{}');
                  email.orderId = b.order_id ? b.order_id.trim() : null;
                  localDevInboundEmails.set(emailId, email);

                  localDevAuditLogs.unshift({
                    id: 'aud_' + Math.random().toString(36).substring(2),
                    actor_admin_email: user.email,
                    action: 'EMAIL_ORDER_LINKED',
                    entity_type: 'mail',
                    entity_id: emailId,
                    new_state: email.orderId || 'UNLINKED',
                    created_at: new Date().toISOString(),
                  });

                  return sendJson(200, { success: true, emailId, order_id: email.orderId });
                });
                return;
              }

              // POST /api/admin/mail/:id/reply
              if (req.url.match(/\/api\/admin\/mail\/msg_[^/?]+\/reply/) && req.method === 'POST') {
                const emailId = req.url.split('/api/admin/mail/')[1].split('/reply')[0];
                const email = localDevInboundEmails.get(emailId);
                if (!email) return sendJson(404, { success: false, error: 'Email not found' });

                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', () => {
                  const b = JSON.parse(bodyStr || '{}');
                  const adminMessage = (b.body || b.text || b.html || '').trim();
                  if (!adminMessage) return sendJson(400, { success: false, error: 'Reply text is required.' });

                  localDevAuditLogs.unshift({
                    id: 'aud_' + Math.random().toString(36).substring(2),
                    actor_admin_email: user.email,
                    action: 'EMAIL_REPLY_SENT',
                    entity_type: 'mail',
                    entityId: emailId,
                    metadata_json: JSON.stringify({ recipient: email.fromAddress, subject: 'Re: ' + email.subject }),
                    created_at: new Date().toISOString(),
                  });

                  return sendJson(200, { success: true, message: `Reply sent successfully to ${email.fromAddress}` });
                });
                return;
              }

              // GET /api/admin/activity
              if (req.url.startsWith('/api/admin/activity') && req.method === 'GET') {
                return sendJson(200, {
                  success: true,
                  logs: localDevAuditLogs,
                  pagination: { page: 1, pageSize: 50, total: localDevAuditLogs.length, totalPages: 1 },
                });
              }

              // GET /api/admin/settings
              if (req.url.startsWith('/api/admin/settings') && req.method === 'GET') {
                return sendJson(200, {
                  success: true,
                  health: {
                    database_d1: 'healthy (local dev)',
                    storage_r2: 'configured (mock)',
                    nowpayments_gateway: apiKey ? 'configured' : 'missing',
                    resend_email: 'configured (mock)',
                    crypto_webhook_hmac: 'configured',
                  },
                  system: {
                    admin_users_count: 1,
                    active_sessions_count: localDevSessions.size,
                    current_user: user,
                  },
                });
              }
            }

            next();
          });
        },
      },
    ],
    server: {
      port: 5173,
      host: env.VITE_DEV_HOST === '0.0.0.0' ? '0.0.0.0' : '127.0.0.1',
      strictPort: true,
    },
  };
});
