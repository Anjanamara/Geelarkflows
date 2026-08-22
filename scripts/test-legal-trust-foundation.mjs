import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('  GEELARK FLOWS: LEGAL & TRUST PUBLICATION TEST SUITE ');
console.log('====================================================\n');

let passedCases = 0;
let totalCases = 0;

function test(name, fn) {
  totalCases++;
  try {
    fn();
    console.log(`[PASS] Scenario ${totalCases}: ${name}`);
    passedCases++;
  } catch (err) {
    console.error(`[FAIL] Scenario ${totalCases}: ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

// 1. /contact Page: Component exists, uses official email and verified facts
test('/contact Page: Component exists, uses official email and verified facts', () => {
  const filePath = path.join(projectRoot, 'src', 'pages', 'ContactPage.jsx');
  assert.ok(fs.existsSync(filePath), 'ContactPage.jsx must exist');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(content.includes('support@geelarkflows.com'), 'Must expose official support email');
  assert.ok(content.includes('Orders & Cryptocurrency Payments'), 'Must have Orders section');
  assert.ok(content.includes('GeeLark Account Setup Coordination'), 'Must have Setup section');
  assert.ok(content.includes('Custom Automation Engineering'), 'Must have Custom engineering section');
  assert.ok(!content.includes('+1-'), 'Must not invent fake phone numbers');
  assert.ok(!content.includes('Suite '), 'Must not invent fake physical addresses');
});

// 2. Official support email visible and canonical across contact, footer, and legal pages
test('Support Email: support@geelarkflows.com is canonical across contact/footer/legal', () => {
  const contactContent = fs.readFileSync(path.join(projectRoot, 'src', 'pages', 'ContactPage.jsx'), 'utf8');
  const footerContent = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'Footer.jsx'), 'utf8');
  const legalContent = fs.readFileSync(path.join(projectRoot, 'src', 'pages', 'LegalPage.jsx'), 'utf8');
  assert.ok(contactContent.includes('support@geelarkflows.com'), 'Contact page must have support email');
  assert.ok(footerContent.includes('support@geelarkflows.com'), 'Footer must have support email');
  assert.ok(legalContent.includes('support@geelarkflows.com'), 'LegalPage must have support email');
});

// 3. Global Footer structure and 4 columns
test('Footer Component: Global footer contains Product, Support, Legal, and real destinations', () => {
  const footerPath = path.join(projectRoot, 'src', 'components', 'Footer.jsx');
  const content = fs.readFileSync(footerPath, 'utf8');
  assert.ok(content.includes('Product'), 'Must contain Product column');
  assert.ok(content.includes('Support'), 'Must contain Support column');
  assert.ok(content.includes('Legal'), 'Must contain Legal column');
  assert.ok(content.includes('Browse Flows'), 'Must use stable Browse Flows label');
  assert.ok(content.includes('/terms'), 'Footer must link to /terms');
  assert.ok(content.includes('/privacy'), 'Footer must link to /privacy');
  assert.ok(content.includes('/refund-policy'), 'Footer must link to /refund-policy');
  assert.ok(content.includes('/contact'), 'Must navigate to /contact');
});

// 4. Cart trust links
test('Cart Trust Area: Cart contains subtle support email and legal links', () => {
  const cartContent = fs.readFileSync(path.join(projectRoot, 'src', 'pages', 'CartPage.jsx'), 'utf8');
  assert.ok(cartContent.includes('cart-legal-links'), 'CartPage must have cart-legal-links container');
  assert.ok(cartContent.includes('/terms'), 'CartPage must link to /terms');
  assert.ok(cartContent.includes('/privacy'), 'CartPage must link to /privacy');
  assert.ok(cartContent.includes('/refund-policy'), 'CartPage must link to /refund-policy');
  assert.ok(cartContent.includes('support@geelarkflows.com'), 'CartPage must retain support email');
});

// 5. Checkout trust links
test('Checkout Trust Area: Checkout contains order reassurance and legal links', () => {
  const checkoutContent = fs.readFileSync(path.join(projectRoot, 'src', 'pages', 'CheckoutPage.jsx'), 'utf8');
  assert.ok(checkoutContent.includes('checkout-legal-links'), 'CheckoutPage must have checkout-legal-links container');
  assert.ok(checkoutContent.includes('/terms'), 'CheckoutPage must link to /terms');
  assert.ok(checkoutContent.includes('/privacy'), 'CheckoutPage must link to /privacy');
  assert.ok(checkoutContent.includes('/refund-policy'), 'CheckoutPage must link to /refund-policy');
  assert.ok(checkoutContent.includes('support@geelarkflows.com'), 'CheckoutPage must retain support email');
});

// 6. Router registers public legal routes
test('App Router: App registers /terms, /privacy, /refund-policy, /contact, /cart, /checkout', () => {
  const appContent = fs.readFileSync(path.join(projectRoot, 'src', 'App.jsx'), 'utf8');
  assert.ok(appContent.includes("currentPath === '/terms'"), 'App routes /terms');
  assert.ok(appContent.includes("currentPath === '/privacy'"), 'App routes /privacy');
  assert.ok(appContent.includes("currentPath === '/refund-policy'"), 'App routes /refund-policy');
  assert.ok(appContent.includes("currentPath === '/contact'"), 'App routes /contact');
  assert.ok(appContent.includes("currentPath === '/cart'"), 'App routes /cart');
  assert.ok(appContent.includes("currentPath === '/checkout'"), 'App routes /checkout');
});

// 7. Sitemap / SEO contains all policy routes
test('Sitemap / SEO: /contact, /terms, /privacy, /refund-policy are included', () => {
  const seoScript = fs.readFileSync(path.join(projectRoot, 'scripts', 'generate-seo.mjs'), 'utf8');
  assert.ok(seoScript.includes("`${siteUrl}/contact`"), 'generate-seo.mjs must include /contact');
  assert.ok(seoScript.includes("`${siteUrl}/terms`"), 'generate-seo.mjs must include /terms');
  assert.ok(seoScript.includes("`${siteUrl}/privacy`"), 'generate-seo.mjs must include /privacy');
  assert.ok(seoScript.includes("`${siteUrl}/refund-policy`"), 'generate-seo.mjs must include /refund-policy');

  const sitemapXml = fs.readFileSync(path.join(projectRoot, 'dist', 'sitemap.xml'), 'utf8');
  assert.ok(sitemapXml.includes('https://geelarkflows.com/contact'), 'dist/sitemap.xml must include /contact');
  assert.ok(sitemapXml.includes('https://geelarkflows.com/terms'), 'dist/sitemap.xml must include /terms');
  assert.ok(sitemapXml.includes('https://geelarkflows.com/privacy'), 'dist/sitemap.xml must include /privacy');
  assert.ok(sitemapXml.includes('https://geelarkflows.com/refund-policy'), 'dist/sitemap.xml must include /refund-policy');
});

// 8. No invented "formal annual review" or review process claim
test('Accuracy: No invented "formal annual review" claims exist in source code', () => {
  const legalContent = fs.readFileSync(path.join(projectRoot, 'src', 'pages', 'LegalPage.jsx'), 'utf8');
  assert.ok(!legalContent.includes('formal annual review'), 'Must not claim formal annual review');
  assert.ok(!legalContent.includes('annual review'), 'Must not claim annual review');
});

// 9. No static fake operational-status claim
test('Status Badge: No static fake operational-status badge in Footer', () => {
  const footerContent = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'Footer.jsx'), 'utf8');
  assert.ok(!footerContent.includes('footer-operational-pill'), 'Must not have fake operational status badge');
  assert.ok(!footerContent.includes('Production Systems Operational'), 'Must not display static operational claim');
});

// 10. GeeLark Account Setup terminology is consistent
test('Terminology: "GeeLark Account Setup" is used consistently', () => {
  const contactContent = fs.readFileSync(path.join(projectRoot, 'src', 'pages', 'ContactPage.jsx'), 'utf8');
  assert.ok(!contactContent.toLowerCase().includes('cloud setup'), 'Contact page must not use "cloud setup"');
  assert.ok(contactContent.includes('GeeLark Account Setup'), 'Contact page must use "GeeLark Account Setup"');
});

// 11. Footer has no dead links
test('Footer Destinations: All clickable buttons and links have working handlers or destinations', () => {
  const footerContent = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'Footer.jsx'), 'utf8');
  assert.ok(!footerContent.includes('href="#"'), 'Footer must not have dead href="#" links');
  assert.ok(!footerContent.includes('javascript:void'), 'Footer must not have javascript:void links');
});

// 12. Public Privacy Policy does not leak internal technical identifiers
test('Privacy Policy: Does not leak internal cookie names, hashing formulas, or iteration counts', () => {
  const legalContent = fs.readFileSync(path.join(projectRoot, 'src', 'pages', 'LegalPage.jsx'), 'utf8');
  assert.ok(!legalContent.includes('gf_admin_session'), 'Must not leak cookie name gf_admin_session');
  assert.ok(!legalContent.includes('sha256Hex'), 'Must not leak formula sha256Hex');
  assert.ok(!legalContent.includes('PBKDF2'), 'Must not leak PBKDF2');
});

// 13. Zero secret disclosures in legal files
test('Security: Zero credential or secret disclosures across legal and trust documents', () => {
  const files = [
    'src/pages/LegalPage.jsx',
    'src/pages/ContactPage.jsx',
    'src/components/Footer.jsx',
    'docs/DRAFT_TERMS_OF_SERVICE.md',
    'docs/DRAFT_PRIVACY_POLICY.md',
    'docs/DRAFT_REFUND_POLICY.md',
  ];
  for (const rel of files) {
    const content = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    assert.ok(!content.includes('whsec_'), `${rel} must not contain whsec_`);
    assert.ok(!content.includes('re_'), `${rel} must not contain Resend API key prefixes`);
    assert.ok(!content.includes('NOWPAYMENTS_'), `${rel} must not contain secret tokens`);
  }
});

// 14. Core eCommerce Non-Regression: Worker pricing, webhooks, and catalog intact
test('Core eCommerce Non-Regression: Authoritative pricing and webhooks intact in Worker', () => {
  const workerContent = fs.readFileSync(path.join(projectRoot, 'src', 'worker.js'), 'utf8');
  assert.ok(workerContent.includes('AUTHORITATIVE_CATALOG_MAP'), 'Authoritative pricing map intact');
  assert.ok(workerContent.includes('verifyNowPaymentsSignature'), 'NOWPayments webhook intact');
  assert.ok(workerContent.includes('verifyResendWebhookSignature'), 'Resend webhook intact');
});

console.log('\n====================================================');
console.log(`  RESULT: ${passedCases}/${totalCases} Scenarios Passed (${Math.round((passedCases / totalCases) * 100)}%)`);
console.log('====================================================\n');

if (passedCases !== totalCases) {
  process.exit(1);
}
