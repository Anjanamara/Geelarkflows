const VISITOR_STORAGE_KEY = 'geelark_visitor_id';
const SESSION_STORAGE_KEY = 'geelark_session_id';
const SEEN_PATHS_STORAGE_KEY = 'geelark_session_seen_paths';
const LANDING_REFERRER_STORAGE_KEY = 'geelark_session_referrer_host';

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getOrCreateId(storage, key) {
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const created = createId();
    storage.setItem(key, created);
    return created;
  } catch {
    return createId();
  }
}

export function analyticsDisabled() {
  return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
}

export function getStorefrontVisitorId() {
  if (analyticsDisabled() || window.location.pathname.startsWith('/admin')) return null;
  return getOrCreateId(window.localStorage, VISITOR_STORAGE_KEY);
}

function getLandingReferrerHost() {
  try {
    const existing = window.sessionStorage.getItem(LANDING_REFERRER_STORAGE_KEY);
    if (existing) return existing;

    let source = 'Direct';
    if (document.referrer) {
      const referrerUrl = new URL(document.referrer);
      source = referrerUrl.origin === window.location.origin
        ? 'Internal'
        : referrerUrl.hostname.toLowerCase().replace(/^www\./, '').slice(0, 253);
    }
    window.sessionStorage.setItem(LANDING_REFERRER_STORAGE_KEY, source);
    return source;
  } catch {
    return 'Direct';
  }
}

function sendAnalyticsEvent(eventType, details = {}) {
  if (analyticsDisabled() || window.location.pathname.startsWith('/admin')) return;

  const payload = {
    event_type: eventType,
    visitor_id: getOrCreateId(window.localStorage, VISITOR_STORAGE_KEY),
    session_id: getOrCreateId(window.sessionStorage, SESSION_STORAGE_KEY),
    event_id: createId(),
    page_path: window.location.pathname,
    landing_referrer_host: getLandingReferrerHost(),
    ...details,
  };

  fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

export function trackPageView(pathname = window.location.pathname) {
  if (analyticsDisabled() || pathname.startsWith('/admin')) return;

  try {
    const seenPaths = new Set(JSON.parse(window.sessionStorage.getItem(SEEN_PATHS_STORAGE_KEY) || '[]'));
    if (seenPaths.has(pathname)) return;
    seenPaths.add(pathname);
    window.sessionStorage.setItem(SEEN_PATHS_STORAGE_KEY, JSON.stringify([...seenPaths].slice(-50)));
  } catch {
    // Server-side deduplication still prevents duplicate session/path page views.
  }

  sendAnalyticsEvent('page_view', { page_path: pathname });
}

export function trackCartAddition(productId) {
  if (!productId) return;
  sendAnalyticsEvent('cart_add', { product_id: productId });
}

export function syncCartState(cart = []) {
  if (analyticsDisabled() || window.location.pathname.startsWith('/admin')) return;

  const productIds = [...new Set(
    (Array.isArray(cart) ? cart : [])
      .map((item) => String(item?.id || '').trim())
      .filter(Boolean),
  )].slice(0, 25);

  const payload = {
    visitor_id: getOrCreateId(window.localStorage, VISITOR_STORAGE_KEY),
    session_id: getOrCreateId(window.sessionStorage, SESSION_STORAGE_KEY),
    event_id: createId(),
    page_path: window.location.pathname,
    landing_referrer_host: getLandingReferrerHost(),
    product_ids: productIds,
  };

  fetch('/api/analytics/cart-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}
