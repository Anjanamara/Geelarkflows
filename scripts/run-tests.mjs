import { spawnSync } from 'node:child_process';

const suites = [
  'scripts/test-server-pricing-security.mjs',
  'scripts/test-route-level-checkout-security.mjs',
  'scripts/test-security-hardening.mjs',
  'scripts/test-webhook-security.mjs',
  'scripts/test-provider-compatibility-vectors.mjs',
  'scripts/test-legal-trust-foundation.mjs',
  'scripts/test-delivery-pricing-lifecycle.mjs',
  'scripts/test-custom-request.mjs',
  'scripts/test-cart-checkout-flow.mjs',
  'scripts/test-storefront-typography.mjs',
  'scripts/test-storefront-analytics.mjs',
  'scripts/test-storefront-notifications.mjs',
  'scripts/test-coupon-checkout-intent.mjs',
  'scripts/test-order-consistency.mjs',
  'scripts/test-schema.mjs',
];

for (const suite of suites) {
  const result = spawnSync(process.execPath, [suite], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`\nAll ${suites.length} repository test suites passed.`);
