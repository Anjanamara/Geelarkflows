import React, { useId, useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';
import { products } from '../data/products';
import { getLandingReferrerHost, getStorefrontVisitorId } from '../analytics';
import { getStoredReferralCode } from '../referrals';
import './LeadMagnet.css';

export default function LeadMagnet({ variant = 'home', productId = '' }) {
  const { cart } = useCart();
  const emailId = useId();
  const flowId = useId();
  const consentId = useId();
  const [email, setEmail] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(productId || cart[0]?.id || '');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [shareUrl, setShareUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === (productId || selectedProductId)),
    [productId, selectedProductId],
  );
  const isCompact = variant !== 'home';
  const [isReferred] = useState(() => Boolean(getStoredReferralCode()));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setStatus({ type: 'idle', message: '' });
    setCopied(false);

    try {
      const response = await fetch('/api/leads/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          marketing_consent: marketingConsent,
          visitor_id: getStorefrontVisitorId(),
          selected_product_id: productId || selectedProductId || null,
          product_ids: cart.map((item) => item.id),
          page_path: window.location.pathname,
          landing_referrer_host: getLandingReferrerHost(),
          referred_by_code: getStoredReferralCode() || null,
          company_website: '',
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Your preview could not be requested.');

      setShareUrl(payload.data?.share_url || '');
      setStatus({
        type: 'success',
        message: payload.data?.email_sent
          ? 'Check your inbox—your automatic preview, personal 10% code, and referral link are on the way. Reply to that email if you want a free demo call.'
          : 'Your request is saved. We will send the preview and personal code as soon as email delivery is available.',
      });
      window.dispatchEvent(new CustomEvent('geelark:lead-captured'));
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Please try again shortly.' });
    } finally {
      setSubmitting(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section id={variant === 'home' ? 'free-preview' : undefined} className={`lead-magnet lead-magnet--${variant}`} aria-labelledby={`${emailId}-title`}>
      <div className="lead-magnet-copy">
        <span className="lead-magnet-kicker">{isReferred ? 'YOUR FRIEND SENT YOU A BENEFIT' : 'FREE DECISION KIT'}</span>
        <h2 id={`${emailId}-title`}>
          {selectedProduct ? `Preview ${selectedProduct.title} before you decide.` : 'See what you’re buying before you buy.'}
        </h2>
        <p>
          Choose a flow and we’ll automatically email its scope, setup checklist, and a personal 10% code. If it looks useful, reply for a free demo call.
        </p>
        {!isCompact && (
          <ul className="lead-benefit-list" aria-label="Included free benefits">
            <li><b>Preview</b><span>Scope + requirements</span></li>
            <li><b>10% off</b><span>Personal 14-day code</span></li>
            <li><b>Refer & earn</b><span>Reward after a paid referral</span></li>
          </ul>
        )}
        <p className="lead-trust-line"><span aria-hidden="true">✓</span> No account &nbsp;·&nbsp; No payment &nbsp;·&nbsp; Unsubscribe anytime</p>
      </div>

      <div className="lead-magnet-action">
        {status.type === 'success' ? (
          <div className="lead-success" role="status">
            <span aria-hidden="true">✓</span>
            <strong>Useful stuff is headed to your inbox.</strong>
            <p>{status.message}</p>
            {shareUrl && (
              <button type="button" onClick={copyShareLink}>{copied ? 'Referral link copied ✓' : 'Copy my referral link'}</button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {!productId && variant === 'home' && (
              <label className="lead-field" htmlFor={flowId}>
                <span>Preview preference</span>
                <select id={flowId} value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
                  <option value="">Help me choose the right flow</option>
                  {products.map((product) => <option value={product.id} key={product.id}>{product.title}</option>)}
                </select>
              </label>
            )}
            <label className="lead-field" htmlFor={emailId}>
              <span>Where should we send it?</span>
              <div className="lead-email-row">
                <input
                  id={emailId}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  maxLength={254}
                  required
                />
                <button type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Send my free preview →'}</button>
              </div>
            </label>
            <label className="lead-consent" htmlFor={consentId}>
              <input id={consentId} type="checkbox" checked={marketingConsent} onChange={(event) => setMarketingConsent(event.target.checked)} />
              <span>Send me occasional useful product updates and offers too. Optional.</span>
            </label>
            <details className="lead-disclosure">
              <summary>Privacy and referral terms</summary>
              <p className="lead-terms">Your preview is sent whether or not you select offers. Referral rewards are one-use discounts, not cash, and are issued after a referred order is confirmed. Public recommendations should disclose that you may earn a discount. See our <a href="/privacy">privacy policy</a>.</p>
            </details>
            {status.type === 'error' && <p className="lead-error" role="alert">{status.message}</p>}
          </form>
        )}
      </div>
    </section>
  );
}
