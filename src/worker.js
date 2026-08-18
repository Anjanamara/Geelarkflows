import { Hono } from 'hono';

const app = new Hono().basePath('/api');

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
  },
};

/**
 * Resolves network configuration from internal ID or network string
 */
function resolvePaymentNetwork(networkInput) {
  if (!networkInput) return SUPPORTED_USDT_NETWORKS['trc20'];
  const cleanKey = String(networkInput).toLowerCase().replace(/[^a-z0-9]/g, '');
  return SUPPORTED_USDT_NETWORKS[cleanKey] || null;
}

/**
 * Web Crypto HMAC-SHA512 Verification for NOWPayments Webhooks
 */
async function verifyNowPaymentsSignature(payload, headerSignature, secretKey) {
  if (!headerSignature || !secretKey) return false;

  try {
    const sortedKeys = Object.keys(payload).sort();
    const sortedObj = {};
    for (const key of sortedKeys) {
      sortedObj[key] = payload[key];
    }
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

    return computedHex.toLowerCase() === headerSignature.toLowerCase();
  } catch (err) {
    console.error('HMAC calculation error:', err);
    return false;
  }
}

/**
 * Send Digital Assets Email via Resend API
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
            Thank you! Your cryptocurrency payment has been verified on the blockchain.
          </p>
          <div style="background: #141815; padding: 16px; border-radius: 6px; margin: 20px 0; border: 1px solid #232a25;">
            <p style="margin: 0 0 6px 0; font-size: 12px; color: #828c85; font-family: monospace;">ORDER ID: <strong>${orderId}</strong></p>
            <p style="margin: 0 0 12px 0; font-size: 12px; color: #828c85; font-family: monospace;">PAYMENT METHOD: <strong style="color: #A7FF4F;">USDT (${networkLabel || 'TRC-20'})</strong></p>
            <ul style="margin: 0; padding-left: 20px; color: #e1e6e2; font-size: 14px;">
              ${itemsHtml}
            </ul>
          </div>
          <p style="color: #c0c6c2; font-size: 14px; line-height: 1.5;">
            Your purchased automation flow package file is attached directly to this email.
          </p>
          <p style="font-size: 12px; color: #667269; margin-top: 24px; border-top: 1px solid #1e2420; padding-top: 14px;">
            Need custom setup assistance? Reply directly to this email for technical support.
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

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// POST /api/checkout/create
app.post('/checkout/create', async (c) => {
  try {
    const body = await c.req.json();
    const { email, network, payment_network, cart = [] } = body;

    // 1. Validate Input
    if (!email || !Array.isArray(cart) || cart.length === 0) {
      return c.json({ success: false, error: 'Missing required checkout details or email.' }, 400);
    }

    // 2. Strict Network Resolution & Validation
    const requestedNetwork = network || payment_network || 'trc20';
    const networkConfig = resolvePaymentNetwork(requestedNetwork);

    if (!networkConfig) {
      return c.json({
        success: false,
        error: `Unsupported payment network "${requestedNetwork}". Supported USDT networks are: TRC-20, ERC-20, BEP-20, and SOL.`,
      }, 400);
    }

    const orderId = 'ord_' + crypto.randomUUID().split('-')[0];
    const paymentId = 'pay_' + crypto.randomUUID().split('-')[0];
    const totalUsd = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);

    // 3. Minimum Payment Validation
    if (totalUsd < networkConfig.min_amount_usd) {
      return c.json({
        success: false,
        error: `Minimum order amount for ${networkConfig.full_label} is $${networkConfig.min_amount_usd} USD. Please choose another network.`,
      }, 400);
    }

    let payAddress = '';
    let payAmountCrypto = Number(totalUsd.toFixed(2));
    let cryptoRate = 1.0;
    let actualPaymentId = paymentId;
    let gatewayError = null;

    const apiKey = c.env?.NOWPAYMENTS_API_KEY || c.env?.CRYPTO_GATEWAY_API_KEY;

    // 4. NOWPayments Live Invoice Creation
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
            price_amount: totalUsd,
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
          payAmountCrypto = Number(nowPayData.pay_amount || totalUsd);
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

    // Require real address from NOWPayments
    if (!payAddress) {
      return c.json({
        success: false,
        error: gatewayError ? `NOWPayments Gateway: ${gatewayError}` : 'Payment gateway failed to return a receiving address.',
      }, 502);
    }

    const expiresAtStr = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // 5. Store in Cloudflare D1 Database
    if (c.env && c.env.DB) {
      try {
        await c.env.DB.prepare(
          'INSERT INTO orders (id, customer_email, total_usd, status, items) VALUES (?, ?, ?, ?, ?)'
        ).bind(orderId, email, totalUsd, 'pending', JSON.stringify(cart)).run();

        await c.env.DB.prepare(
          'INSERT INTO crypto_payments (id, order_id, currency, pay_address, pay_amount_crypto, exchange_rate_usd, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(actualPaymentId, orderId, networkConfig.display_currency, payAddress, payAmountCrypto, cryptoRate, expiresAtStr, 'waiting').run();
      } catch (dbErr) {
        console.warn('D1 Database store notice:', dbErr.message);
      }
    }

    console.log(`[CHECKOUT_CREATED] order=${orderId} payment=${actualPaymentId} network=${networkConfig.id} currency=${networkConfig.nowpayments_currency} amount=${totalUsd}`);

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
        totalUsd,
        payAmountCrypto,
        payAddress,
        expiresAt: expiresAtStr,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payAddress)}`,
        status: 'waiting',
        warning: `Send USDT on the ${networkConfig.full_label} network only.`,
      },
    });
  } catch (err) {
    console.error('Checkout creation error:', err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/webhooks/crypto (NOWPayments IPN Callback)
app.post('/webhooks/crypto', async (c) => {
  try {
    const rawPayload = await c.req.json();
    const headerSignature = c.req.header('x-nowpayments-sig');
    const webhookSecret = c.env?.CRYPTO_WEBHOOK_SECRET;

    // 1. Cryptographic HMAC-SHA512 Signature Verification
    if (webhookSecret) {
      const isValid = await verifyNowPaymentsSignature(rawPayload, headerSignature, webhookSecret);
      if (!isValid) {
        console.error('Invalid NOWPayments HMAC Webhook Signature');
        return c.json({ success: false, error: 'Invalid HMAC signature' }, 401);
      }
    }

    const { payment_id, order_id, payment_status, pay_currency, actually_paid, outcome_tx_hash, txid } = rawPayload;
    const txHash = outcome_tx_hash || txid || null;

    if (!order_id) {
      return c.json({ success: false, error: 'Missing order_id in webhook payload' }, 400);
    }

    if (c.env && c.env.DB) {
      // 2. Lookup Order in Database
      const orderRecord = await c.env.DB.prepare(
        'SELECT customer_email, total_usd, items, status FROM orders WHERE id = ?'
      ).bind(order_id).first();

      if (!orderRecord) {
        console.error(`Order ${order_id} not found in D1 database.`);
        return c.json({ success: false, error: `Order ${order_id} not found` }, 404);
      }

      // 3. Idempotency Guard: Never fulfill an already paid order twice
      if (orderRecord.status === 'paid') {
        console.log(`Order ${order_id} already marked as paid. Skipping duplicate fulfillment.`);
        return c.json({ success: true, status: 'already_processed' });
      }

      // Lookup Payment Record
      const paymentRecord = await c.env.DB.prepare(
        'SELECT currency, pay_amount_crypto FROM crypto_payments WHERE order_id = ?'
      ).bind(order_id).first();

      // 4. Payment Network Mismatch Check
      if (pay_currency && paymentRecord && paymentRecord.currency) {
        const expectedCurrencyStr = (paymentRecord.currency || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const incomingCurrencyStr = (pay_currency || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        if (!expectedCurrencyStr.includes(incomingCurrencyStr) && !incomingCurrencyStr.includes(expectedCurrencyStr)) {
          console.warn(`[PAYMENT_NETWORK_MISMATCH] Order ${order_id} expected ${paymentRecord.currency} but received ${pay_currency}`);
          await c.env.DB.prepare(
            'UPDATE crypto_payments SET status = ?, tx_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?'
          ).bind('payment_mismatch', txHash, order_id).run();

          return c.json({
            success: true,
            status: 'mismatch_flagged',
            warning: `Received currency ${pay_currency} does not match expected ${paymentRecord.currency}`,
          });
        }
      }

      // Update payment record status
      await c.env.DB.prepare(
        'UPDATE crypto_payments SET status = ?, tx_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?'
      ).bind(payment_status, txHash, order_id).run();

      // 5. Final Confirmation & Digital Fulfillment
      if (['confirmed', 'finished', 'paid'].includes((payment_status || '').toLowerCase())) {
        await c.env.DB.prepare(
          'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind('paid', order_id).run();

        const items = JSON.parse(orderRecord.items || '[]');

        console.log(`[PAYMENT_CONFIRMED] order=${order_id} payment=${payment_id} currency=${pay_currency} amount=${actually_paid || orderRecord.total_usd}`);

        let attachmentBuffer = null;
        let fileName = `geelark_flows_package_${order_id}.zip`;

        if (c.env.FLOWS_BUCKET) {
          try {
            const r2Object = await c.env.FLOWS_BUCKET.get('bundle_master_flows.zip');
            if (r2Object) {
              attachmentBuffer = await r2Object.arrayBuffer();
            }
          } catch (r2Err) {
            console.warn('R2 Asset retrieval notice:', r2Err.message);
          }
        }

        try {
          const emailRes = await sendFulfillmentEmail({
            resendApiKey: c.env.RESEND_API_KEY,
            customerEmail: orderRecord.customer_email,
            orderId: order_id,
            networkLabel: paymentRecord?.currency || 'USDT',
            items,
            attachmentBuffer,
            fileName,
          });

          return c.json({
            success: true,
            status: 'processed',
            emailFulfillment: emailRes,
          });
        } catch (emailErr) {
          console.error('Email fulfillment dispatch failed:', emailErr.message);
          return c.json({
            success: false,
            error: `Email fulfillment failed: ${emailErr.message}`,
          }, 500);
        }
      }
    }

    return c.json({ success: true, status: 'processed' });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return c.json({ success: false, error: err.message }, 500);
  }
}// GET /api/checkout/status/:id (Queries by payment_id or order_id)
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
          'SELECT status, total_usd FROM orders WHERE id = ?'
        ).bind(orderId).first();
        if (orderRec) {
          orderStatus = orderRec.status || 'pending';
          if (!payAmount && orderRec.total_usd) {
            payAmount = orderRec.total_usd;
          }
        }
      } catch (dbErr) {
        console.warn('D1 Status fetch notice:', dbErr.message);
      }
    }

    isConfirmed = ['confirmed', 'finished', 'paid'].includes((currentStatus || '').toLowerCase()) || orderStatus === 'paid';

    // Direct Live NOWPayments Gateway Query Fallback
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

            if (c.env && c.env.DB) {
              await c.env.DB.prepare(
                'UPDATE crypto_payments SET status = ?, tx_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR order_id = ?'
              ).bind(currentStatus, txHash, paymentId, orderId).run();
              await c.env.DB.prepare(
                'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
              ).bind('paid', orderId).run();
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
        payAmount,
        payAddress,
        confirmations: isConfirmed ? 2 : 0,
        requiredConfirmations: 2,
      },
    });
  } catch (routeErr) {
    console.error('Status route unhandled error:', routeErr);
    return c.json({ success: false, error: routeErr.message }, 500);
  }
});

export default app;
