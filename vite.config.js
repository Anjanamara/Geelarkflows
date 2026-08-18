import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const localDevOrders = new Map();

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

function resolveDevNetwork(input) {
  if (!input) return DEV_USDT_NETWORKS['trc20'];
  const cleanKey = String(input).toLowerCase().replace(/[^a-z0-9]/g, '');
  return DEV_USDT_NETWORKS[cleanKey] || null;
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
            // POST /api/checkout/create
            if (req.url?.startsWith('/api/checkout/create') && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', async () => {
                try {
                  const body = JSON.parse(bodyStr || '{}');
                  const { email, network, payment_network, cart = [] } = body;

                  if (!email || !Array.isArray(cart) || cart.length === 0) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: false, error: 'Missing required checkout details' }));
                    return;
                  }

                  const requestedNet = network || payment_network || 'trc20';
                  const netConfig = resolveDevNetwork(requestedNet);

                  if (!netConfig) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                      success: false,
                      error: `Unsupported payment network "${requestedNet}". Choose TRC-20, ERC-20, BEP-20, or SOL.`,
                    }));
                    return;
                  }

                  const orderId = 'ord_' + Math.random().toString(36).substring(2, 9);
                  const totalUsd = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

                  if (totalUsd < netConfig.min_amount_usd) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                      success: false,
                      error: `Minimum order amount for ${netConfig.full_label} is $${netConfig.min_amount_usd} USD. Please choose another network.`,
                    }));
                    return;
                  }

                  let payAddress = '';
                  let payAmountCrypto = Number(totalUsd.toFixed(2));
                  let paymentId = 'pay_' + Math.random().toString(36).substring(2, 9);

                  // 1. If API Key is configured in .env, call LIVE NOWPayments API!
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
                        console.error('NOWPayments API Error:', nowPayData.message || nowPayData.error);
                        res.statusCode = 502;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({
                          success: false,
                          error: `NOWPayments Gateway: ${nowPayData.message || nowPayData.error}`,
                        }));
                        return;
                      }
                    } catch (apiErr) {
                      console.error('NOWPayments Fetch Error:', apiErr);
                      res.statusCode = 502;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({
                        success: false,
                        error: `Payment gateway unreachable: ${apiErr.message}`,
                      }));
                      return;
                    }
                  }

                  // 2. If no live API key is set in .env during local offline dev, report notice
                  if (!payAddress) {
                    res.statusCode = 502;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                      success: false,
                      error: 'NOWPAYMENTS_API_KEY is not configured in .env. Please provide your NOWPayments API key in .env or Cloudflare Worker bindings.',
                    }));
                    return;
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
                    totalUsd,
                    payAmountCrypto,
                    payAddress,
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payAddress)}`,
                    status: 'waiting',
                    items: cart,
                    createdAt: Date.now(),
                    warning: `Send USDT on the ${netConfig.full_label} network only.`,
                  };

                  localDevOrders.set(orderId, orderRecord);
                  localDevOrders.set(paymentId, orderRecord);

                  console.log(`[CHECKOUT_CREATED] order=${orderId} payment=${paymentId} network=${netConfig.id} address=${payAddress}`);

                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    success: true,
                    data: orderRecord,
                  }));
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: err.message }));
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
                  const incomingCurrency = payload.pay_currency || payload.payment_currency;

                  if (orderId && localDevOrders.has(orderId)) {
                    const record = localDevOrders.get(orderId);

                    if (incomingCurrency) {
                      const expectedTicker = (record.payCurrencyTicker || '').toLowerCase();
                      const incomingTicker = String(incomingCurrency).toLowerCase();
                      if (!expectedTicker.includes(incomingTicker) && !incomingTicker.includes(expectedTicker)) {
                        console.warn(`[PAYMENT_MISMATCH] Order ${orderId} expected ${expectedTicker} but received ${incomingTicker}`);
                        record.status = 'payment_mismatch';
                        localDevOrders.set(orderId, record);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({
                          success: true,
                          status: 'mismatch_flagged',
                          warning: `Received currency ${incomingCurrency} does not match expected ${record.currency}`,
                        }));
                        return;
                      }
                    }

                    record.status = paymentStatus;
                    record.txHash = payload.outcome_tx_hash || payload.txid || '0x' + Math.random().toString(16).substring(2);
                    localDevOrders.set(orderId, record);
                    if (record.paymentId) localDevOrders.set(record.paymentId, record);
                  }

                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, status: 'processed' }));
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: err.message }));
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

              // Live NOWPayments Gateway Query Fallback
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
                        localDevOrders.set(record.orderId, record);
                        localDevOrders.set(paymentId, record);
                      }
                      isConfirmed = true;
                    }
                  }
                } catch (syncErr) {
                  console.warn('Dev status sync notice:', syncErr.message);
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                data: {
                  id,
                  orderId: record?.orderId || id,
                  paymentId: record?.paymentId || id,
                  status: currentStatus,
                  orderStatus: isConfirmed ? 'paid' : 'pending',
                  isConfirmed,
                  txHash: record?.txHash || null,
                  asset: 'USDT',
                  network: record?.network || 'trc20',
                  networkLabel: record?.networkLabel || 'TRC-20',
                  blockchain: record?.blockchain || 'TRON',
                  fullNetworkLabel: record?.fullNetworkLabel || 'TRC-20 / TRON',
                  currency: record?.currency || 'USDT (TRC-20)',
                  payCurrency: record?.payCurrencyTicker || 'USDTTRC20',
                  payAmount: record?.payAmountCrypto || record?.totalUsd || 0,
                  payAddress: record?.payAddress || '',
                  confirmations: isConfirmed ? 2 : 0,
                  requiredConfirmations: 2,
                },
              }));
              return;
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
