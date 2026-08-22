import React, { useEffect } from 'react';
import './ContactPage.css';

export default function ContactPage({ navigate, onOpenCustomRequest }) {
  useEffect(() => {
    document.title = 'Contact Support & Help | GeeLark Flows';
    const desc = document.head.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute('content', 'Contact GeeLark Flows support for order assistance, crypto payment confirmation, GeeLark setup coordination, or custom RPA workflow development.');
    }
    window.scrollTo(0, 0);
  }, []);

  const handleHomeClick = (e) => {
    e.preventDefault();
    if (typeof navigate === 'function') {
      navigate('/');
    } else {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleCustomRequest = () => {
    if (typeof onOpenCustomRequest === 'function') {
      onOpenCustomRequest('flow');
    } else if (typeof navigate === 'function') {
      navigate('/');
      setTimeout(() => {
        const btn = document.querySelector('.secondary-cta');
        if (btn) btn.click();
      }, 100);
    }
  };

  return (
    <div className="contact-page-shell">
      {/* Header Bar */}
      <header className="contact-page-header">
        <div className="contact-header-inner">
          <a href="/" className="contact-brand-lockup" onClick={handleHomeClick} aria-label="GeeLark Flows home">
            <span className="brand-mark">GF</span>
            <span className="brand-text">
              <strong>GeeLark</strong>
              <small>Flows</small>
            </span>
          </a>

          <a href="/" className="btn-back-home" onClick={handleHomeClick}>
            ← Back to marketplace
          </a>
        </div>
      </header>

      <main className="contact-page-main" id="main-content">
        <div className="contact-container">
          {/* Header */}
          <div className="contact-hero">
            <span className="contact-kicker">SUPPORT & ASSISTANCE</span>
            <h1 className="contact-title">How can we help your operation?</h1>
            <p className="contact-lede">
              Reach our engineering and operations team directly. We assist with order tracking,
              GeeLark Account Setup, payment confirmations, and custom RPA flow development.
            </p>
          </div>

          {/* Direct Email Banner */}
          <div className="contact-primary-channel">
            <div className="channel-icon-wrap">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div className="channel-info">
              <span className="channel-label">Official Support Channel</span>
              <a href="mailto:support@geelarkflows.com" className="channel-email font-mono">
                support@geelarkflows.com
              </a>
              <span className="channel-note">
                Direct communication for all orders, delivery updates, and technical questions.
              </span>
            </div>
          </div>

          {/* Topic Columns */}
          <div className="contact-topics-grid">
            {/* Topic 1: Orders & Payment */}
            <div className="topic-card">
              <div className="topic-header">
                <div className="topic-badge">01</div>
                <h2 className="topic-title">Orders & Cryptocurrency Payments</h2>
              </div>
              <p className="topic-desc">
                Need help with a USDT transaction, blockchain confirmation delay, or order receipt?
              </p>
              <ul className="topic-list">
                <li>Include your <strong>Order ID</strong> (e.g. <code>ord_...</code>) or Invoice ID.</li>
                <li>Provide the transaction hash (TxHash) if querying on-chain confirmation.</li>
                <li>Fulfillment details are dispatched to your checkout email within 24 hours of confirmation.</li>
              </ul>
              <div className="topic-action">
                <a href="mailto:support@geelarkflows.com?subject=Order%20Inquiry" className="btn-topic-link">
                  Email Order Support →
                </a>
              </div>
            </div>

            {/* Topic 2: GeeLark Account Setup */}
            <div className="topic-card">
              <div className="topic-header">
                <div className="topic-badge">02</div>
                <h2 className="topic-title">GeeLark Account Setup Coordination</h2>
              </div>
              <p className="topic-desc">
                Purchased GeeLark Account Setup for your flows and ready to coordinate provisioning?
              </p>
              <ul className="topic-list">
                <li>Our team coordinates directly via email post-purchase.</li>
                <li>Do not send passwords publicly; follow the secure setup instructions emailed to you.</li>
                <li>Setup covers cloud phone configuration, proxy binding assistance, and workflow testing.</li>
              </ul>
              <div className="topic-action">
                <a href="mailto:support@geelarkflows.com?subject=GeeLark%20Setup%20Coordination" className="btn-topic-link">
                  Coordinate Setup →
                </a>
              </div>
            </div>

            {/* Topic 3: Custom Flow Scoping */}
            <div className="topic-card">
              <div className="topic-header">
                <div className="topic-badge">03</div>
                <h2 className="topic-title">Custom Automation Engineering</h2>
              </div>
              <p className="topic-desc">
                Need specialized selectors, custom multi-app pipelines, or private platform automation?
              </p>
              <ul className="topic-list">
                <li>Submit your project requirements via our Custom Automation form.</li>
                <li>We scope API hooks, batch schedules, mobile SEO, and scale parameters.</li>
                <li>Receive technical feasibility analysis and quote references.</li>
              </ul>
              <div className="topic-action">
                <button type="button" className="btn-topic-action" onClick={handleCustomRequest}>
                  Open Custom Request Form ↗
                </button>
              </div>
            </div>
          </div>

          {/* Quick FAQ Strip */}
          <div className="contact-footer-note">
            <h3>Frequently Asked Questions</h3>
            <p>
              Looking for quick answers about unlimited runs, platform compatibility, and delivery formats?
              Visit our <a href="/#faq" onClick={(e) => { e.preventDefault(); handleHomeClick(e); setTimeout(() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }), 150); }}>FAQ section on the homepage</a>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
