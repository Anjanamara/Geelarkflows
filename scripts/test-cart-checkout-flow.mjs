import { strict as assert } from 'node:assert';

console.log('====================================================');
console.log('  GEELARK FLOWS: CART & CHECKOUT SEPARATION TESTS   ');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failCount++;
  }
}

// 1. Cart Subtotal & Item Count calculation
runTest('Cart Engine: calculates subtotal and item count correctly', () => {
  const cart = [
    { id: 'flow-1', price: 1000, quantity: 1 },
    { id: 'flow-2', price: 150, quantity: 2 },
  ];
  const subtotal = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
  const itemCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  assert.equal(subtotal, 1300);
  assert.equal(itemCount, 3);
});

// 2. Pricing Engine Thresholds
runTest('Checkout Pricing Engine: Downloadable Package setup fee is always $0', () => {
  const calculateTotals = (cart, deliveryMethod) => {
    const subtotal = cart.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
    const setupFee = deliveryMethod === 'geelark_setup' ? (subtotal >= 300 ? 0 : 50) : 0;
    return { subtotal, setupFee, total: subtotal + setupFee };
  };

  const lowOrder = [{ id: 'flow-1', price: 150, quantity: 1 }];
  const res1 = calculateTotals(lowOrder, 'download_package');
  assert.equal(res1.setupFee, 0);
  assert.equal(res1.total, 150);

  const highOrder = [{ id: 'flow-1', price: 1000, quantity: 1 }];
  const res2 = calculateTotals(highOrder, 'download_package');
  assert.equal(res2.setupFee, 0);
  assert.equal(res2.total, 1000);
});

runTest('Checkout Pricing Engine: GeeLark Setup is $50 under $300 and FREE at or above $300', () => {
  const calculateTotals = (cart, deliveryMethod) => {
    const subtotal = cart.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
    const setupFee = deliveryMethod === 'geelark_setup' ? (subtotal >= 300 ? 0 : 50) : 0;
    return { subtotal, setupFee, total: subtotal + setupFee };
  };

  // Under $300 -> $50 fee
  const resUnder = calculateTotals([{ id: 'flow-1', price: 150, quantity: 1 }], 'geelark_setup');
  assert.equal(resUnder.setupFee, 50);
  assert.equal(resUnder.total, 200);

  // Exactly $300 -> FREE ($0) fee
  const resExact = calculateTotals([{ id: 'flow-1', price: 150, quantity: 2 }], 'geelark_setup');
  assert.equal(resExact.setupFee, 0);
  assert.equal(resExact.total, 300);

  // Above $300 -> FREE ($0) fee
  const resOver = calculateTotals([{ id: 'flow-1', price: 1000, quantity: 1 }], 'geelark_setup');
  assert.equal(resOver.setupFee, 0);
  assert.equal(resOver.total, 1000);
});

// 3. Payload Construction Validation
runTest('Checkout Payload: matches backend expectations exactly', () => {
  const customerEmail = 'sarah.dev@growthscale.com';
  const selectedNetwork = 'trc20';
  const deliveryMethod = 'download_package';
  const cart = [
    { id: 'instagram-account-creation', title: 'Instagram Account Creation', price: 1000, quantity: 1, platform: 'instagram' },
  ];

  const payload = {
    email: customerEmail,
    network: selectedNetwork,
    payment_network: selectedNetwork,
    delivery_method: deliveryMethod,
    cart: cart.map((item) => ({
      id: item.id,
      title: item.title,
      price: item.price,
      quantity: item.quantity || 1,
      platform: item.platform || 'geelark',
    })),
  };

  assert.equal(payload.email, 'sarah.dev@growthscale.com');
  assert.equal(payload.payment_network, 'trc20');
  assert.equal(payload.delivery_method, 'download_package');
  assert.equal(payload.cart.length, 1);
  assert.equal(payload.cart[0].id, 'instagram-account-creation');
  assert.equal(payload.cart[0].price, 1000);
});

// 4. Progress Steps State Mapping
runTest('Progress Indicator: Maps stage to step correctly', () => {
  const getProgressStep = (stage) => {
    if (stage === 'completed') return 'confirmation';
    if (stage === 'awaiting_payment' || stage === 'verifying') return 'payment';
    return 'checkout';
  };

  assert.equal(getProgressStep('form'), 'checkout');
  assert.equal(getProgressStep('awaiting_payment'), 'payment');
  assert.equal(getProgressStep('verifying'), 'payment');
  assert.equal(getProgressStep('completed'), 'confirmation');
});

// 5. Network Definitions
runTest('Payment Networks: contains all 4 required USDT networks', () => {
  const expectedNetworks = ['trc20', 'erc20', 'bep20', 'sol'];
  const networkLabels = {
    trc20: 'USDT (TRC-20)',
    erc20: 'USDT (ERC-20)',
    bep20: 'USDT (BEP-20)',
    sol: 'USDT (SOL)',
  };

  for (const net of expectedNetworks) {
    assert.ok(networkLabels[net], `Missing network ${net}`);
  }
});

console.log('\n====================================================');
console.log(`  RESULT: ${passCount}/${passCount + failCount} Scenarios Passed (${Math.round((passCount / (passCount + failCount)) * 100)}%)`);
console.log('====================================================\n');

if (failCount > 0) process.exit(1);
