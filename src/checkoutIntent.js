export const ACTIVE_PAYMENT_STORAGE_KEY = 'geelark_active_payment';
export const PENDING_COUPON_STORAGE_KEY = 'geelark_pending_coupon';

export function normalizeCouponCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code) ? code : '';
}

export function addCouponToCheckoutPath(path, couponCode) {
  const code = normalizeCouponCode(couponCode);
  const candidate = String(path || '/checkout').trim() || '/checkout';
  if (!code) return candidate;

  try {
    const base = new URL('https://geelarkflows.invalid');
    const destination = new URL(candidate, base);
    if (destination.origin !== base.origin || destination.pathname !== '/checkout') return candidate;
    destination.searchParams.set('coupon', code);
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return `/checkout?coupon=${encodeURIComponent(code)}`;
  }
}

export function paymentStageFromStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (['confirmed', 'finished', 'paid'].includes(normalized)) return 'completed';
  if (normalized === 'verifying') return 'verifying';
  if (['failed', 'expired', 'cancelled', 'refunded'].includes(normalized)) return 'form';
  return 'awaiting_payment';
}

export function isClosedPaymentStatus(status) {
  return ['failed', 'expired', 'cancelled', 'refunded'].includes(String(status || '').toLowerCase());
}
