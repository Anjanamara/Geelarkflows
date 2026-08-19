import { strict as assert } from 'node:assert';
import { products } from '../src/data/products.js';

console.log('================================================================');
console.log('  GEELARK FLOWS: SERVER-AUTHORITATIVE PRICING SECURITY TESTS    ');
console.log('================================================================\n');

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

// Server Catalog Map
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

// Worker pure resolution function mirror
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

// 1. Legitimate product ID uses correct authoritative price
runTest('Scenario 1: Legitimate product ID resolves correct authoritative price', () => {
  const input = [{ id: 'instagram-account-creation', quantity: 1 }];
  const res = resolveServerAuthoritativeCart(input);
  assert.ok(!res.error, `Unexpected error: ${res.error}`);
  assert.equal(res.resolvedCart[0].price, 1000);
  assert.equal(res.resolvedCart[0].title, 'Instagram Account Creation');
});

// 2. Client changes $1000 product to $1 -> server still charges $1000
runTest('Scenario 2: Client tampers $1000 product price to $1.00 -> Server ignores client price and charges $1000', () => {
  const input = [{ id: 'instagram-account-creation', title: 'Hacked Item', price: 1.00, quantity: 1 }];
  const res = resolveServerAuthoritativeCart(input);
  assert.ok(!res.error);
  assert.equal(res.resolvedCart[0].price, 1000);
  assert.equal(res.resolvedCart[0].title, 'Instagram Account Creation');

  const totals = calculateOrderTotals(res.resolvedCart, 'download_package');
  assert.equal(totals.workflowSubtotal, 1000);
  assert.equal(totals.finalTotal, 1000);
});

// 3. Client changes price to 0 -> ignored / authoritative price charged
runTest('Scenario 3: Client changes price to $0.00 -> Server enforces authoritative price', () => {
  const input = [{ id: 'snapchat-account-creation', price: 0, quantity: 1 }];
  const res = resolveServerAuthoritativeCart(input);
  assert.ok(!res.error);
  assert.equal(res.resolvedCart[0].price, 800);

  const totals = calculateOrderTotals(res.resolvedCart, 'download_package');
  assert.equal(totals.workflowSubtotal, 800);
  assert.equal(totals.finalTotal, 800);
});

// 4. Client changes price to negative -> ignored / authoritative price charged
runTest('Scenario 4: Client changes price to -$500.00 -> Server enforces authoritative price', () => {
  const input = [{ id: 'tiktok-account-creation', price: -500, quantity: 1 }];
  const res = resolveServerAuthoritativeCart(input);
  assert.ok(!res.error);
  assert.equal(res.resolvedCart[0].price, 1000);
});

// 5. Client changes price to huge number -> ignored
runTest('Scenario 5: Client changes price to $999999 -> Server enforces authoritative price', () => {
  const input = [{ id: 'instagram-profile-edits', price: 999999, quantity: 1 }];
  const res = resolveServerAuthoritativeCart(input);
  assert.ok(!res.error);
  assert.equal(res.resolvedCart[0].price, 150);
});

// 6. Unknown product ID -> rejected
runTest('Scenario 6: Unknown product ID is strictly rejected with error', () => {
  const input = [{ id: 'fake-exploit-flow', quantity: 1 }];
  const res = resolveServerAuthoritativeCart(input);
  assert.ok(res.error);
  assert.match(res.error, /Unknown or discontinued workflow/);
});

// 7. Empty cart -> rejected
runTest('Scenario 7: Empty cart is strictly rejected', () => {
  const res1 = resolveServerAuthoritativeCart([]);
  assert.ok(res1.error);
  const res2 = resolveServerAuthoritativeCart(null);
  assert.ok(res2.error);
});

// 8. Invalid quantity -> rejected
runTest('Scenario 8: Invalid quantities (0, negative, decimal, >100, non-number) are rejected', () => {
  assert.ok(resolveServerAuthoritativeCart([{ id: 'instagram-warmup', quantity: 0 }]).error);
  assert.ok(resolveServerAuthoritativeCart([{ id: 'instagram-warmup', quantity: -1 }]).error);
  assert.ok(resolveServerAuthoritativeCart([{ id: 'instagram-warmup', quantity: 1.5 }]).error);
  assert.ok(resolveServerAuthoritativeCart([{ id: 'instagram-warmup', quantity: 101 }]).error);
  assert.ok(resolveServerAuthoritativeCart([{ id: 'instagram-warmup', quantity: 'abc' }]).error);
});

// 9. Account Setup under $300 -> $50 fee
runTest('Scenario 9: Account Setup under $300 ($150) -> adds $50 setup fee (Total = $200)', () => {
  const res = resolveServerAuthoritativeCart([{ id: 'instagram-profile-edits', quantity: 1 }]);
  const totals = calculateOrderTotals(res.resolvedCart, 'geelark_setup');
  assert.equal(totals.workflowSubtotal, 150);
  assert.equal(totals.setupFee, 50);
  assert.equal(totals.finalTotal, 200);
});

// 10. Account Setup exactly $300 -> FREE fee ($0)
runTest('Scenario 10: Account Setup exactly $300 ($150 x 2) -> FREE setup fee (Total = $300)', () => {
  const res = resolveServerAuthoritativeCart([{ id: 'instagram-profile-edits', quantity: 2 }]);
  const totals = calculateOrderTotals(res.resolvedCart, 'geelark_setup');
  assert.equal(totals.workflowSubtotal, 300);
  assert.equal(totals.setupFee, 0);
  assert.equal(totals.finalTotal, 300);
  assert.equal(totals.setupFeeLabel, 'FREE');
});

// 11. Account Setup over $300 -> FREE fee ($0)
runTest('Scenario 11: Account Setup over $300 ($1000) -> FREE setup fee (Total = $1000)', () => {
  const res = resolveServerAuthoritativeCart([{ id: 'instagram-account-creation', quantity: 1 }]);
  const totals = calculateOrderTotals(res.resolvedCart, 'geelark_setup');
  assert.equal(totals.workflowSubtotal, 1000);
  assert.equal(totals.setupFee, 0);
  assert.equal(totals.finalTotal, 1000);
});

// 12. Downloadable Package -> $0 setup fee
runTest('Scenario 12: Downloadable Package setup fee is always $0 regardless of subtotal', () => {
  const resLow = resolveServerAuthoritativeCart([{ id: 'threads-posting', quantity: 1 }]); // $100
  const totalsLow = calculateOrderTotals(resLow.resolvedCart, 'download_package');
  assert.equal(totalsLow.setupFee, 0);
  assert.equal(totalsLow.finalTotal, 100);

  const resHigh = resolveServerAuthoritativeCart([{ id: 'instagram-account-creation', quantity: 1 }]); // $1000
  const totalsHigh = calculateOrderTotals(resHigh.resolvedCart, 'download_package');
  assert.equal(totalsHigh.setupFee, 0);
  assert.equal(totalsHigh.finalTotal, 1000);
});

// 13. Multiple products calculate correctly
runTest('Scenario 13: Multi-item cart calculates authoritative workflow subtotal correctly', () => {
  const input = [
    { id: 'instagram-account-creation', quantity: 1 }, // 1000
    { id: 'instagram-warmup', quantity: 2 },           // 250 * 2 = 500
    { id: 'instagram-publishing', quantity: 1 },       // 150
  ];
  const res = resolveServerAuthoritativeCart(input);
  const totals = calculateOrderTotals(res.resolvedCart, 'download_package');
  assert.equal(totals.workflowSubtotal, 1650);
  assert.equal(totals.finalTotal, 1650);
});

// 14. Server-computed total is authoritative across all items and quantities
runTest('Scenario 14: All 25 catalog items exist in AUTHORITATIVE_CATALOG_MAP with valid positive prices', () => {
  assert.equal(AUTHORITATIVE_CATALOG_MAP.size, 25);
  for (const [id, item] of AUTHORITATIVE_CATALOG_MAP.entries()) {
    assert.ok(item.title, `Item ${id} missing title`);
    assert.ok(item.price > 0, `Item ${id} has invalid price: ${item.price}`);
    assert.ok(item.platform, `Item ${id} missing platform`);
  }
});

console.log('\n================================================================');
console.log(`  RESULT: ${passCount}/${passCount + failCount} Scenarios Passed (${Math.round((passCount / (passCount + failCount)) * 100)}%)`);
console.log('================================================================\n');

if (failCount > 0) process.exit(1);
