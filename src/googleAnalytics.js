import { analyticsDisabled } from './analytics';

export const GOOGLE_TAG_ID = 'G-BKDBCCN19B';

const GOOGLE_TAG_SCRIPT_ID = 'geelark-google-tag';
const PAGE_VIEW_DEDUPE_MS = 1000;
let initialized = false;
let lastPageViewPath = '';
let lastPageViewAt = 0;

function canMeasure(pathname = window.location.pathname) {
  return !analyticsDisabled() && !String(pathname || '').startsWith('/admin');
}

function ensureGtagQueue() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
}

export function initializeGoogleAnalytics(pathname = window.location.pathname) {
  if (initialized) return true;
  if (!canMeasure(pathname)) return false;

  ensureGtagQueue();
  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('js', new Date());
  window.gtag('set', 'ads_data_redaction', true);
  window.gtag('config', GOOGLE_TAG_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    anonymize_ip: true,
    cookie_expires: 60 * 60 * 24 * 90,
  });

  if (!document.getElementById(GOOGLE_TAG_SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = GOOGLE_TAG_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_TAG_ID)}`;
    document.head.appendChild(script);
  }

  initialized = true;
  return true;
}

export function trackGooglePageView(pathname = window.location.pathname) {
  const cleanPath = String(pathname || '/').startsWith('/') ? String(pathname || '/') : '/';
  if (!canMeasure(cleanPath) || !initializeGoogleAnalytics(cleanPath)) return;

  const now = Date.now();
  if (cleanPath === lastPageViewPath && now - lastPageViewAt < PAGE_VIEW_DEDUPE_MS) return;
  lastPageViewPath = cleanPath;
  lastPageViewAt = now;

  window.gtag('event', 'page_view', {
    page_title: document.title,
    page_location: `${window.location.origin}${cleanPath}`,
    page_path: cleanPath,
  });
}
