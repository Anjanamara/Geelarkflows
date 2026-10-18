const REFERRAL_STORAGE_KEY = 'geelark_referral_code';

export function normalizeReferralCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^GF[A-F0-9]{10}$/.test(code) ? code : '';
}

export function captureReferralCode() {
  try {
    const url = new URL(window.location.href);
    const incoming = normalizeReferralCode(url.searchParams.get('ref'));
    if (incoming) {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, incoming);
      url.searchParams.delete('ref');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      return incoming;
    }
    return normalizeReferralCode(window.localStorage.getItem(REFERRAL_STORAGE_KEY));
  } catch {
    return '';
  }
}

export function getStoredReferralCode() {
  return captureReferralCode();
}
