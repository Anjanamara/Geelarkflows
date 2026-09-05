import React, { useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { products, platforms } from '../data/products';
import { PROVEN_FLOW_NOTE, OUTCOME_DISCLAIMER, getCompatibilityNote } from '../data/trustCopy';
import './FlowDetailPage.css';

export default function FlowDetailPage({ productId, navigate }) {
  const { cart, addToCart, addToCartWithAnimation, lastAddedId, openCheckout } = useCart();
  const product = products.find((item) => item.id === productId);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [productId]);

  const handleBackClick = (e) => {
    e.preventDefault();
    if (typeof navigate === 'function') {
      navigate('/');
    } else {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  if (!product) {
    return (
      <div className="flow-detail-shell">
        <header className="flow-detail-header">
          <div className="flow-detail-header-inner">
            <a href="/" className="flow-detail-brand-lockup" onClick={handleBackClick} aria-label="GeeLark Flows home">
              <span className="brand-mark" aria-hidden="true">
                <img src="/logo-mark.svg" alt="" width="42" height="42" />
              </span>
              <span className="brand-text">
                <strong>GeeLark</strong>
                <small>Flows</small>
              </span>
            </a>
            <a href="/" className="btn-back-to-marketplace" onClick={handleBackClick}>← Back to marketplace</a>
          </div>
        </header>
        <main className="flow-detail-main">
          <div className="flow-not-found">
            <h1>Flow not found</h1>
            <p>This automation flow may have been renamed or retired.</p>
            <a href="/" className="btn-back-to-marketplace" onClick={handleBackClick}>← Back to marketplace</a>
          </div>
        </main>
      </div>
    );
  }

  const platform = platforms.find((item) => item.id === product.platform);
  const isInCart = cart.some((item) => item.id === product.id);
  const isJustAdded = lastAddedId === product.id;
  const { details } = product;

  const handleAddToCart = (event) => {
    if (isInCart) return;
    addToCartWithAnimation(product, event.currentTarget);
  };

  const handleDirectCheckout = () => {
    if (!isInCart) addToCart(product);
    openCheckout();
  };

  return (
    <div className="flow-detail-shell" style={{ '--modal-accent': platform?.color || 'var(--accent-lime)' }}>
      <header className="flow-detail-header">
        <div className="flow-detail-header-inner">
          <a href="/" className="flow-detail-brand-lockup" onClick={handleBackClick} aria-label="GeeLark Flows home">
            <span className="brand-mark" aria-hidden="true">
              <img src="/logo-mark.svg" alt="" width="42" height="42" />
            </span>
            <span className="brand-text">
              <strong>GeeLark</strong>
              <small>Flows</small>
            </span>
          </a>
          <a href="/" className="btn-back-to-marketplace" onClick={handleBackClick}>← Back to marketplace</a>
        </div>
      </header>

      <main className="flow-detail-main">
        <div className="flow-detail-layout-grid">
          <div className="flow-detail-content-column">
            <div className="flow-platform-line">
              <span className="flow-platform-token">{platform?.shortLabel || 'GF'}</span>
              <div>
                <span>{platform?.label || product.platform}</span>
                <small>{details.category}</small>
              </div>
            </div>

            <h1 className="flow-detail-title">{product.title}</h1>
            <p className="flow-detail-description">{details.description}</p>
            <p className="flow-proven-note">{PROVEN_FLOW_NOTE}</p>

            {details.demoVideo && (
              <section className="flow-detail-section flow-video-section">
                <div className="flow-section-label">VIDEO DEMO</div>
                <video controls preload="metadata" poster={details.demoPoster || undefined}>
                  <source src={details.demoVideo} />
                  Your browser does not support video playback.
                </video>
              </section>
            )}

            <section className="flow-detail-section">
              <div className="flow-section-label">WHAT THIS FLOW HANDLES</div>
              <ul className="flow-feature-grid">
                {details.features.map((feature, index) => (
                  <li key={feature}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </section>

            {details.supportedPlatforms.length > 0 && (
              <section className="flow-detail-section">
                <div className="flow-section-label">AVAILABLE FOR</div>
                <div className="flow-supported-apps">
                  {details.supportedPlatforms.map((name) => <span key={name}>{name}</span>)}
                </div>
                <p className="flow-platform-setup-copy">
                  Tell us which app you need during setup so the workflow can be configured correctly.
                </p>
              </section>
            )}

            {details.howItWorks.length > 0 && (
              <section className="flow-detail-section">
                <div className="flow-section-label">HOW THIS FLOW WORKS</div>
                <ol className="flow-steps-list">
                  {details.howItWorks.map((step, index) => (
                    <li key={step}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <p>{step}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {details.requirements.length > 0 && (
              <section className="flow-detail-section">
                <div className="flow-section-label">WHAT YOU NEED BEFORE YOU BUY</div>
                <ul className="flow-requirements-list">
                  {details.requirements.map((req) => <li key={req}>{req}</li>)}
                </ul>
              </section>
            )}

            <section className="flow-detail-section">
              <div className="flow-section-label">HOW YOUR PURCHASE WORKS</div>
              <div className="flow-purchase-steps">
                <div><span>01</span><p>Choose the automation flow that matches your operation.</p></div>
                <div><span>02</span><p>We confirm your inputs and configure the reusable workflow.</p></div>
                <div><span>03</span><p>Run the delivered flow as many times as you need.</p></div>
              </div>
            </section>

            <section className="flow-delivery-note">
              <span>WHAT YOU RECEIVE</span>
              <p>{details.delivery}. The delivered automation is reusable and can be run repeatedly after handoff.</p>
            </section>

            <section className="flow-compatibility-note">
              <span>30-DAY COMPATIBILITY SUPPORT</span>
              <p>{getCompatibilityNote(platform?.label || product.platform)}</p>
              <p className="flow-outcome-disclaimer">{OUTCOME_DISCLAIMER}</p>
            </section>
          </div>

          <aside className="flow-detail-buybox-column">
            <div className="flow-detail-buybox">
              <div className="flow-buybox-price">${product.price.toLocaleString('en-US')}</div>
              <span className="flow-buybox-sub">One purchase · Configured delivery · Unlimited runs</span>

              <button type="button" className="btn-primary flow-buybox-checkout" onClick={handleDirectCheckout}>
                Direct checkout · ${product.price.toLocaleString('en-US')} →
              </button>
              <button
                type="button"
                className={`btn-secondary flow-buybox-add ${isInCart ? 'in-cart' : ''}`}
                onClick={handleAddToCart}
              >
                {isJustAdded ? 'Added ✓' : isInCart ? 'In cart ✓' : '+ Add to cart'}
              </button>

              <div className="flow-buybox-trust">
                <div className="flow-trust-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  Secure USDT checkout
                </div>
                <div className="flow-trust-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  Delivery coordinated within 24 hours after payment confirmation
                </div>
              </div>

              <p className="flow-buybox-support">
                Need help? <a href="mailto:support@geelarkflows.com" className="font-mono">support@geelarkflows.com</a>
              </p>
              <div className="flow-buybox-legal-links">
                <a href="/terms" onClick={(e) => { e.preventDefault(); if (typeof navigate === 'function') navigate('/terms'); }}>Terms</a>
                <span>·</span>
                <a href="/privacy" onClick={(e) => { e.preventDefault(); if (typeof navigate === 'function') navigate('/privacy'); }}>Privacy</a>
                <span>·</span>
                <a href="/refund-policy" onClick={(e) => { e.preventDefault(); if (typeof navigate === 'function') navigate('/refund-policy'); }}>Refunds</a>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Mobile Fixed Bottom Action Bar */}
      <div className="flow-detail-mobile-bar">
        <div className="mobile-bar-info">
          <span className="mobile-bar-label">Price</span>
          <span className="mobile-bar-val font-mono">${product.price.toLocaleString('en-US')}</span>
        </div>
        <button type="button" className="mobile-btn-checkout" onClick={handleDirectCheckout}>
          Direct checkout →
        </button>
      </div>
    </div>
  );
}
