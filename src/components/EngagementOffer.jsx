import { useEffect, useRef, useState } from 'react';
import { analyticsDisabled, getStorefrontEngagement } from '../analytics';
import './EngagementOffer.css';

const DISMISSED_KEY = 'geelark_engagement_offer_dismissed';

export default function EngagementOffer({ pathname }) {
  const [visible, setVisible] = useState(false);
  const [leadFormVisible, setLeadFormVisible] = useState(false);
  const timerRef = useRef(null);
  const eligiblePath = pathname === '/';

  useEffect(() => {
    if (!eligiblePath || analyticsDisabled()) return undefined;
    try {
      if (sessionStorage.getItem(DISMISSED_KEY)) return undefined;
    } catch {
      // A session-only dismissal is optional when storage is unavailable.
    }

    const consider = () => {
      if (!getStorefrontEngagement().engaged) return;
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setVisible(true), 900);
    };
    const hideAfterLead = () => setVisible(false);
    window.addEventListener('geelark:engagement', consider);
    window.addEventListener('geelark:lead-captured', hideAfterLead);
    consider();
    return () => {
      window.clearTimeout(timerRef.current);
      window.removeEventListener('geelark:engagement', consider);
      window.removeEventListener('geelark:lead-captured', hideAfterLead);
    };
  }, [eligiblePath, pathname]);

  useEffect(() => {
    if (!eligiblePath || !('IntersectionObserver' in window)) return undefined;
    const form = document.querySelector('.lead-magnet');
    if (!form) return undefined;
    const observer = new IntersectionObserver(([entry]) => setLeadFormVisible(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(form);
    return () => observer.disconnect();
  }, [eligiblePath, pathname]);

  const dismiss = () => {
    setVisible(false);
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch { /* no-op */ }
  };

  const openPreview = () => {
    const form = document.querySelector('.lead-magnet');
    if (!form) return;
    setVisible(false);
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => form.querySelector('input[type="email"]')?.focus({ preventScroll: true }), 550);
  };

  if (!eligiblePath || !visible || leadFormVisible) return null;

  return (
    <aside className="engagement-offer" aria-label="Free workflow preview">
      <button type="button" className="engagement-offer-close" onClick={dismiss} aria-label="Dismiss preview offer">×</button>
      <span className="engagement-offer-kicker">Still comparing?</span>
      <strong>Get the exact flow scope + 10%.</strong>
      <p>No account or payment. We’ll send one useful preview.</p>
      <button type="button" className="engagement-offer-cta" onClick={openPreview}>Get free preview <span aria-hidden="true">→</span></button>
    </aside>
  );
}
