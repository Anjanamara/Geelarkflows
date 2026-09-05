import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  addCouponToCheckoutPath,
  isClosedPaymentStatus,
  normalizeCouponCode,
  paymentStageFromStatus,
} from '../src/checkoutIntent.js';

assert.equal(normalizeCouponCode(' cart15 '), 'CART15');
assert.equal(normalizeCouponCode('bad code'), '');
assert.equal(addCouponToCheckoutPath('/checkout', 'cart15'), '/checkout?coupon=CART15');
assert.equal(addCouponToCheckoutPath('/checkout?source=notification', 'SAVE_20'), '/checkout?source=notification&coupon=SAVE_20');
assert.equal(addCouponToCheckoutPath('/cart', 'CART15'), '/cart', 'non-checkout campaign destinations must remain unchanged');
assert.equal(paymentStageFromStatus('verifying'), 'verifying');
assert.equal(paymentStageFromStatus('waiting'), 'awaiting_payment');
assert.equal(paymentStageFromStatus('paid'), 'completed');
assert.equal(paymentStageFromStatus('expired'), 'form');
assert.equal(isClosedPaymentStatus('cancelled'), true);

const checkoutSource = fs.readFileSync('src/pages/CheckoutPage.jsx', 'utf8');
assert(checkoutSource.includes('setResumeCandidate(parsed)'), 'coupon checkout must not silently restore an older invoice');
assert(checkoutSource.includes('Start new checkout with coupon'));
assert(checkoutSource.includes('Current cart'));
assert(checkoutSource.includes('Previous invoice'));
assert(checkoutSource.includes('generateLocalQrCode(activeOrder.payAddress)'), 'legacy QR images must be regenerated locally');
assert(checkoutSource.includes('isClosedPaymentStatus(status)'), 'closed invoices must leave the payment screen');

const notificationSource = fs.readFileSync('src/components/StorefrontNotifications.jsx', 'utf8');
assert(notificationSource.includes('addCouponToCheckoutPath(destination, notification.coupon_code)'));
assert(notificationSource.includes('className="notification-live-region"'));
const notificationCss = fs.readFileSync('src/components/StorefrontNotifications.css', 'utf8');
assert.match(notificationCss, /\.notification-live-region[^}]*clip-path:\s*inset\(50%\)/s, 'screen-reader announcement must not consume header space');

const cartContextSource = fs.readFileSync('src/context/CartContext.jsx', 'utf8');
assert(cartContextSource.includes('window.location.search'), 'SPA navigation must distinguish coupon query strings');

console.log('Coupon checkout intent, stale invoice choice, QR fallback, and notification UI regression checks passed.');
