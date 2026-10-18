const VISITOR_STORAGE_KEY = 'geelark_visitor_id';
const SESSION_STORAGE_KEY = 'geelark_session_id';
const SEEN_PATHS_STORAGE_KEY = 'geelark_session_seen_paths';
const LANDING_REFERRER_STORAGE_KEY = 'geelark_session_referrer_host';
const ENGAGEMENT_STORAGE_KEY = 'geelark_session_engagement';

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

export function getLandingReferrerHost() {
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

function readSeenPageCount() {
  try {
    return Math.max(1, new Set(JSON.parse(window.sessionStorage.getItem(SEEN_PATHS_STORAGE_KEY) || '[]')).size);
  } catch {
    return 1;
  }
}

function readEngagementState() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(ENGAGEMENT_STORAGE_KEY) || '{}');
    return {
      pageViews: readSeenPageCount(),
      scrollPercent: Math.min(100, Math.max(0, Number(stored.scrollPercent) || 0)),
      engagedSeconds: Math.min(3600, Math.max(0, Number(stored.engagedSeconds) || 0)),
      productId: String(stored.productId || '') || null,
    };
  } catch {
    return { pageViews: readSeenPageCount(), scrollPercent: 0, engagedSeconds: 0, productId: null };
  }
}

function productIdFromPath(pathname) {
  const match = String(pathname || '').match(/^\/flows\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function getStorefrontEngagement() {
  const state = readEngagementState();
  return {
    page_views: state.pageViews,
    scroll_percent: state.scrollPercent,
    engaged_seconds: state.engagedSeconds,
    product_id: state.productId,
    engaged: state.engagedSeconds >= 10 || state.pageViews >= 2 || state.scrollPercent >= 50,
    deep_scrolled: state.scrollPercent >= 90,
  };
}

export function startEngagementTracking(pathname = window.location.pathname) {
  if (analyticsDisabled() || pathname.startsWith('/admin')) return () => {};

  const visitorId = getOrCreateId(window.localStorage, VISITOR_STORAGE_KEY);
  const sessionId = getOrCreateId(window.sessionStorage, SESSION_STORAGE_KEY);
  const currentProductId = productIdFromPath(pathname);
  let state = readEngagementState();
  state.pageViews = readSeenPageCount();
  if (currentProductId) state.productId = currentProductId;
  let visibleStartedAt = document.hidden ? null : Date.now();
  let lastSentSignature = '';
  let stopped = false;

  const persist = () => {
    try {
      window.sessionStorage.setItem(ENGAGEMENT_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Engagement targeting remains optional when session storage is blocked.
    }
  };

  const activeSeconds = () => Math.min(3600, Math.max(
    state.engagedSeconds,
    state.engagedSeconds + (visibleStartedAt ? Math.floor((Date.now() - visibleStartedAt) / 1000) : 0),
  ));

  const sendSnapshot = (force = false) => {
    if (stopped) return;
    const seconds = activeSeconds();
    const snapshot = {
      visitor_id: visitorId,
      session_id: sessionId,
      page_path: pathname,
      product_id: currentProductId,
      page_views: state.pageViews,
      scroll_percent: state.scrollPercent,
      engaged_seconds: seconds,
    };
    const signature = `${snapshot.page_views}:${snapshot.scroll_percent >= 90 ? 90 : snapshot.scroll_percent >= 50 ? 50 : 0}:${snapshot.engaged_seconds >= 10 ? 10 : 0}:${snapshot.product_id || ''}`;
    if (!force && signature === lastSentSignature) return;
    lastSentSignature = signature;
    persist();
    fetch('/api/analytics/engagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
      keepalive: true,
    }).catch(() => {}).finally(() => {
      window.dispatchEvent(new CustomEvent('geelark:engagement', { detail: getStorefrontEngagement() }));
    });
  };

  const updateScroll = () => {
    const root = document.documentElement;
    const scrollable = Math.max(1, root.scrollHeight - window.innerHeight);
    const percent = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
    if (percent <= state.scrollPercent) return;
    const previousThreshold = state.scrollPercent >= 90 ? 90 : state.scrollPercent >= 50 ? 50 : 0;
    state.scrollPercent = percent;
    const nextThreshold = percent >= 90 ? 90 : percent >= 50 ? 50 : 0;
    if (nextThreshold > previousThreshold) {
      persist();
      sendSnapshot();
    }
  };

  const onVisibilityChange = () => {
    if (document.hidden && visibleStartedAt) {
      state.engagedSeconds = activeSeconds();
      visibleStartedAt = null;
      persist();
      if (state.engagedSeconds >= 10) sendSnapshot();
    } else if (!document.hidden && !visibleStartedAt) {
      visibleStartedAt = Date.now();
    }
  };

  const timer = window.setInterval(() => {
    const seconds = activeSeconds();
    if (seconds >= 10 && state.engagedSeconds < 10) {
      state.engagedSeconds = seconds;
      visibleStartedAt = Date.now();
      sendSnapshot();
    }
  }, 1000);
  const initialTimer = window.setTimeout(() => sendSnapshot(true), 180);
  window.addEventListener('scroll', updateScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  updateScroll();

  return () => {
    stopped = true;
    if (visibleStartedAt) state.engagedSeconds = activeSeconds();
    persist();
    window.clearInterval(timer);
    window.clearTimeout(initialTimer);
    window.removeEventListener('scroll', updateScroll);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
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
