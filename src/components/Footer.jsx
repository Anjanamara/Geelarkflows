import React from 'react';
import './Footer.css';

export default function Footer({ navigate, onOpenCustomRequest }) {
  const handleNav = (path) => {
    if (typeof navigate === 'function') {
      navigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleCustomRequest = () => {
    if (typeof onOpenCustomRequest === 'function') {
      onOpenCustomRequest('flow');
    } else {
      handleNav('/');
      setTimeout(() => {
        const btn = document.querySelector('.secondary-cta');
        if (btn) btn.click();
      }, 100);
    }
  };

  const handleScrollToSection = (sectionId) => {
    if (window.location.pathname !== '/') {
      handleNav('/');
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="global-site-footer">
      <div className="footer-container">
        <div className="footer-grid">
          {/* Brand & Purpose Column */}
          <div className="footer-brand-col">
            <a href="/" className="footer-brand-lockup" onClick={(e) => { e.preventDefault(); handleNav('/'); }} aria-label="GeeLark Flows Home">
              <span className="footer-brand-mark" aria-hidden="true">
                <img src="/logo-mark.svg" alt="" width="42" height="42" />
              </span>
              <span className="footer-brand-text">
                <strong>GeeLark</strong>
                <small>Flows</small>
              </span>
            </a>
            <p className="footer-tagline">
              Reusable mobile and social automation, configured for repeatable operations.
            </p>
          </div>

          {/* Column 1: Products & Workflows */}
          <div className="footer-links-col">
            <span className="footer-heading">Product</span>
            <ul className="footer-links-list">
              <li>
                <button type="button" onClick={() => handleScrollToSection('catalog')}>
                  Browse Flows
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleScrollToSection('specialties')}>
                  Specialties & RPA
                </button>
              </li>
              <li>
                <button type="button" onClick={handleCustomRequest}>
                  Custom Development ↗
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Help & Support */}
          <div className="footer-links-col">
            <span className="footer-heading">Support</span>
            <ul className="footer-links-list">
              <li>
                <button type="button" onClick={() => handleScrollToSection('faq')}>
                  Questions & FAQ
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('/contact')}>
                  Contact Support
                </button>
              </li>
              <li>
                <a href="mailto:support@geelarkflows.com" className="footer-mail-link font-mono">
                  support@geelarkflows.com
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal & Terms */}
          <div className="footer-links-col">
            <span className="footer-heading">Legal</span>
            <ul className="footer-links-list">
              <li>
                <button type="button" onClick={() => handleNav('/terms')}>
                  Terms of Service
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('/privacy')}>
                  Privacy Policy
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('/refund-policy')}>
                  Refund Policy
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom-bar">
          <p className="footer-copyright">
            © {new Date().getFullYear()} GeeLark Flows. All rights reserved. Delivered workflows are reusable for authorized customer operations.
            <br />Independent service; not affiliated with or endorsed by the owner of the GeeLark software or trademark.
          </p>
          <div className="footer-bottom-meta">
            <span className="crypto-badge"><i /> Secure USDT checkout via NOWPayments</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
