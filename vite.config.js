import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';
import { products } from './src/data/products.js';

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

// Seed sample orders for realistic local dev testing if empty
if (localDevOrders.size === 0) {
  const seedOrders = [
    {
      orderId: 'ord_5710mi3',
      paymentId: '5150455726',
      email: 'customer.alpha@example.com',
      totalUsd: 1400,
      status: 'paid',
      fulfillmentStatus: 'delivered',
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
      fulfillmentStatus: 'processing',
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
  ];

  seedOrders.forEach((ord) => {
    localDevOrders.set(ord.orderId, ord);
    if (ord.paymentId) localDevOrders.set(ord.paymentId, ord);
  });

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

const DEV_USDT_NETWORKS = {
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

function resolveDevNetwork(input) {
  if (!input) return DEV_USDT_NETWORKS['trc20'];
  const cleanKey = String(input).toLowerCase().replace(/[^a-z0-9]/g, '');
  return DEV_USDT_NETWORKS[cleanKey] || null;
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
  const apiKey = (env.NOWPAYMENTS_API_KEY || env.CRYPTO_GATEWAY_API_KEY || '').trim();

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

            // POST /api/checkout/create
            if (req.url?.startsWith('/api/checkout/create') && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', async () => {
                try {
                  const body = JSON.parse(bodyStr || '{}');
                  const { email, network, payment_network, delivery_method, cart = [] } = body;

                  if (!email || !Array.isArray(cart) || cart.length === 0) {
                    return sendJson(400, { success: false, error: 'Missing required checkout details' });
                  }

                  const validDeliveryMethods = ['download_package', 'geelark_setup'];
                  const deliveryMethod = validDeliveryMethods.includes(delivery_method) ? delivery_method : 'download_package';

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

                  const orderId = 'ord_' + Math.random().toString(36).substring(2, 9);
                  const workflowSubtotal = resolvedCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                  const setupFee = deliveryMethod === 'geelark_setup' ? (workflowSubtotal >= 300 ? 0 : 50) : 0;
                  const totalUsd = workflowSubtotal + setupFee;

                  if (totalUsd < netConfig.min_amount_usd) {
                    return sendJson(400, {
                      success: false,
                      error: `Minimum order amount for ${netConfig.full_label} is $${netConfig.min_amount_usd} USD. Please choose another network.`,
                    });
                  }

                  let payAddress = '';
                  let payAmountCrypto = Number(totalUsd.toFixed(2));
                  let paymentId = 'pay_' + Math.random().toString(36).substring(2, 9);

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

                  if (!payAddress) {
                    return sendJson(502, {
                      success: false,
                      error: 'NOWPAYMENTS_API_KEY is not configured. Please provide your API key.',
                    });
                  }

                  const orderRecord = {
                    orderId,
                    paymentId,
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
                    totalUsd,
                    payAmountCrypto,
                    payAddress,
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payAddress)}`,
                    status: 'waiting',
                    fulfillmentStatus: 'not_ready',
                    items: resolvedCart,
                    createdAt: new Date().toISOString(),
                    warning: `Send USDT on the ${netConfig.full_label} network only.`,
                  };

                  localDevOrders.set(orderId, orderRecord);
                  localDevOrders.set(paymentId, orderRecord);

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
                  const orderId = payload.order_id;
                  const paymentStatus = payload.payment_status || 'finished';

                  if (orderId && localDevOrders.has(orderId)) {
                    const record = localDevOrders.get(orderId);
                    record.status = paymentStatus;
                    record.txHash = payload.outcome_tx_hash || payload.txid || '0x' + Math.random().toString(16).substring(2);
                    if (['confirmed', 'finished', 'paid'].includes(paymentStatus.toLowerCase())) {
                      record.fulfillmentStatus = 'delivered';
                      record.deliveredAt = new Date().toISOString();
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
              let currentStatus = record ? record.status : 'waiting';
              let isConfirmed = ['confirmed', 'finished', 'paid'].includes(currentStatus.toLowerCase());

              const paymentId = record?.paymentId;
              if (apiKey && paymentId && !isConfirmed && currentStatus === 'waiting') {
                try {
                  const nowPayCheck = await fetch(`https://api.nowpayments.io/v1/payment/${paymentId}`, {
                    headers: { 'x-api-key': apiKey }
                  });
                  const nowPayStatusData = await nowPayCheck.json();
                  if (nowPayStatusData && nowPayStatusData.payment_status) {
                    const liveStatus = String(nowPayStatusData.payment_status).toLowerCase();
                    if (['confirmed', 'finished', 'paid'].includes(liveStatus)) {
                      currentStatus = liveStatus;
                      if (record) {
                        record.status = liveStatus;
                        record.txHash = nowPayStatusData.outcome_tx_hash || nowPayStatusData.txid || record.txHash;
                        record.fulfillmentStatus = 'delivered';
                        record.deliveredAt = new Date().toISOString();
                        localDevOrders.set(record.orderId, record);
                        localDevOrders.set(paymentId, record);
                      }
                      isConfirmed = true;
                    }
                  }
                } catch (syncErr) {}
              }

              return sendJson(200, {
                success: true,
                data: {
                  id,
                  orderId: record?.orderId || id,
                  paymentId: record?.paymentId || id,
                  status: currentStatus,
                  orderStatus: isConfirmed ? 'paid' : (record?.status || 'pending'),
                  isConfirmed,
                  txHash: record?.txHash || null,
                  asset: 'USDT',
                  network: record?.network || 'trc20',
                  networkLabel: record?.networkLabel || 'TRC-20',
                  blockchain: record?.blockchain || 'TRON',
                  fullNetworkLabel: record?.fullNetworkLabel || 'TRC-20 / TRON',
                  currency: record?.currency || 'USDT (TRC-20)',
                  payCurrency: record?.payCurrencyTicker || 'USDTTRC20',
                  deliveryMethod: record?.deliveryMethod || 'download_package',
                  workflowSubtotal: record?.workflowSubtotal || record?.totalUsd || 0,
                  setupFee: record?.setupFee || 0,
                  totalUsd: record?.totalUsd || 0,
                  payAmount: record?.payAmountCrypto || record?.totalUsd || 0,
                  payAddress: record?.payAddress || '',
                  fulfillmentStatus: record?.fulfillmentStatus || 'not_ready',
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

                  // Accepts standard default dev credentials
                  if (
                    (email === 'admin@geelarkflows.com' && password === 'GeelarkAdmin2026!#') ||
                    (email === 'admin' && password === 'admin')
                  ) {
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

                    res.setHeader('Set-Cookie', `gf_admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
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
              res.setHeader('Set-Cookie', 'gf_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
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
                const countVerifying = allOrders.filter(o => o.status === 'waiting' || o.status === 'confirming').length;
                const countPaid = allOrders.filter(o => o.status === 'paid').length;
                const countProcessing = allOrders.filter(o => o.status === 'processing').length;
                const countCompleted = allOrders.filter(o => o.status === 'completed').length;
                const countFulfillmentPending = allOrders.filter(o => ['paid', 'processing'].includes(o.status) && o.fulfillmentStatus !== 'delivered').length;

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
                    recent_orders: allOrders.slice(0, 10),
                    synced_at: new Date().toISOString(),
                  },
                });
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
                    total_usd: o.totalUsd,
                    status: o.status,
                    items: JSON.stringify(o.items || []),
                    fulfillment_status: o.fulfillmentStatus || 'not_ready',
                    created_at: o.createdAt,
                    payment_id: o.paymentId,
                    payment_currency: o.currency,
                    payment_status: o.status,
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
                    status: order.status,
                    verification_source: order.verificationSource || 'nowpayments_ipn',
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
                    payment_status: o.status,
                    attempt_count: 1,
                  })),
                });
              }

              // POST /api/admin/fulfillment/:orderId/resend
              if (req.url.match(/\/api\/admin\/fulfillment\/[^/?]+\/resend/) && req.method === 'POST') {
                const orderId = req.url.split('/api/admin/fulfillment/')[1].split('/resend')[0];
                const order = localDevOrders.get(orderId);
                if (!order) return sendJson(404, { success: false, error: 'Order not found' });

                order.fulfillmentStatus = 'delivered';
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
      host: true,
    },
  };
});
