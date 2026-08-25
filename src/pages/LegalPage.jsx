import React, { useEffect } from 'react';
import './LegalPage.css';

export default function LegalPage({ type = 'terms', navigate }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [type]);

  const handleNav = (path) => {
    if (typeof navigate === 'function') {
      navigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="legal-page-shell">
      {/* Header Bar */}
      <header className="legal-page-header">
        <div className="legal-header-inner">
          <a href="/" className="legal-brand-lockup" onClick={(e) => { e.preventDefault(); handleNav('/'); }} aria-label="GeeLark Flows home">
            <span className="brand-mark" aria-hidden="true">
              <img src="/logo-mark.svg" alt="" width="42" height="42" />
            </span>
            <span className="brand-text">
              <strong>GeeLark</strong>
              <small>Flows</small>
            </span>
          </a>

          <div className="legal-header-nav">
            <a href="/contact" className="legal-nav-link" onClick={(e) => { e.preventDefault(); handleNav('/contact'); }}>
              Contact Support
            </a>
            <a href="/" className="btn-back-home" onClick={(e) => { e.preventDefault(); handleNav('/'); }}>
              ← Marketplace
            </a>
          </div>
        </div>
      </header>

      <main className="legal-page-main" id="main-content">
        <article className="legal-article-container">
          {/* Policy Navigation Tabs */}
          <nav className="legal-nav-tabs" aria-label="Legal document switcher">
            <button
              type="button"
              className={`legal-tab-btn ${type === 'terms' ? 'active' : ''}`}
              onClick={() => handleNav('/terms')}
            >
              Terms of Service
            </button>
            <button
              type="button"
              className={`legal-tab-btn ${type === 'privacy' ? 'active' : ''}`}
              onClick={() => handleNav('/privacy')}
            >
              Privacy Policy
            </button>
            <button
              type="button"
              className={`legal-tab-btn ${type === 'refund-policy' ? 'active' : ''}`}
              onClick={() => handleNav('/refund-policy')}
            >
              Refund Policy
            </button>
            <button
              type="button"
              className="legal-tab-btn contact-tab-btn"
              onClick={() => handleNav('/contact')}
            >
              Contact Support
            </button>
          </nav>

          {type === 'terms' && (
            <>
              <div className="legal-doc-header">
                <span className="legal-kicker">LEGAL AGREEMENT</span>
                <h1 className="legal-doc-title">Terms of Service</h1>
                <p className="legal-doc-summary">
                  Terms governing the purchase, licensing, and usage of GeeLark automation workflow packages.
                </p>
                <div className="legal-meta-date">Last Updated: August 25, 2026 · Independent operator: GeeLark Flows · support@geelarkflows.com</div>
              </div>

              <div className="legal-body-content">
                <section className="legal-section">
                  <h2>1. Introduction & Acceptance</h2>
                  <p>
                    These Terms of Service ("Terms") apply when you purchase, download, access, or use automation workflows, scripts, or setup services from <strong>GeeLark Flows</strong> ("we", "us", "our") through <code>geelarkflows.com</code>.
                  </p>
                  <p>
                    By placing an order, completing payment, downloading files, or requesting setup services, you agree to these Terms. If you do not agree, please do not purchase or use our products.
                  </p>
                  <p>
                    You must be at least 18 years old and legally able to enter a binding agreement to purchase from this site.
                  </p>
                  <p>
                    <strong>Independent service notice:</strong> GeeLark Flows is an independent digital-products business. It is not affiliated with, endorsed by, or sponsored by the owner of the GeeLark software or trademark. Third-party names identify compatible products only.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>2. Product License & Use</h2>
                  <p>
                    When you purchase an automation flow from GeeLark Flows, you receive a <strong>non-exclusive, non-transferable, perpetual license</strong> to use the specific version of the workflow delivered. You do not acquire ownership of the underlying proprietary scripts or design templates.
                  </p>
                  <p><strong>Permitted Use:</strong> You may run the workflow as often as needed for your own business or personal operations, configure or modify parameters and selectors for your own use, and use the workflow to manage accounts or provide services for your direct clients.</p>
                  <p><strong>Restrictions:</strong> You may not resell, redistribute, lease, publicly upload, share copies as a downloadable product, or repackage substantially the same automation as a competing commercial product.</p>
                </section>

                <section className="legal-section">
                  <h2>3. Delivery & Setup Services</h2>
                  <p>
                    After your payment is confirmed on-chain, GeeLark Flows communicates fulfillment and setup instructions by email within up to 24 hours.
                  </p>
                  <p>
                    <strong>Downloadable Package ($0 Setup Fee):</strong> The purchased package and execution instructions are provided using the email supplied with the order.
                  </p>
                  <p>
                    <strong>GeeLark Account Setup ($50 Setup Fee, Waived on Orders $300+):</strong> Setup coordination begins through post-payment email communication. The $50 setup fee is automatically waived when the workflow subtotal in your cart is $300 or greater.
                  </p>
                  <p>
                    Account credentials are not collected during checkout. Setup details are coordinated by email after payment confirmation. Setup services require customer cooperation; if required configuration details or access are not provided, the order remains pending customer cooperation until supplied.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>4. Third-Party Platforms & Compliance</h2>
                  <p>
                    Our automations interact with third-party software, mobile environments, websites, and social media platforms (such as Instagram, TikTok, Snapchat, Reddit, Facebook, YouTube, Threads, and dating apps).
                  </p>
                  <p>
                    Third-party platforms frequently update their interfaces, selectors, mobile apps, anti-bot mechanisms, and policies. GeeLark Flows does not guarantee uninterrupted or permanent compatibility with third-party platforms, unchanging selectors or APIs, account survival, or particular commercial results. Platform changes that occur after delivery do not mean the delivered product was defective when provided. Future updates or compatibility modifications are not guaranteed indefinitely and may be offered separately or at our discretion.
                  </p>
                  <p>
                    Customers are responsible for using purchased automations in accordance with applicable law and the rules and terms of the third-party platforms they use. GeeLark Flows does not represent that every automation is permitted by every third-party platform, nor do we guarantee that using automation will avoid platform restrictions.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>5. Payments & Cryptocurrency</h2>
                  <p>
                    Payments are processed in Tether USD (USDT) on supported blockchain networks (TRC-20, ERC-20, BEP-20, or Solana) through NOWPayments. Blockchain transfers are generally irreversible once confirmed. Customers are responsible for sending the exact required amount on the selected network to the payment address generated for that order. Incorrect-network or unsupported-token transfers may be unrecoverable, and recovery cannot be guaranteed.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>6. Warranty & Disclaimers</h2>
                  <p>
                    Automations are provided for the functionality described at the time of delivery. Because they depend on third-party applications and operating environments, continued compatibility or particular business results are not guaranteed.
                  </p>
                  <p>
                    To the extent permitted by applicable law, GeeLark Flows is not responsible for third-party platform changes, customer misuse, account suspensions, or failure to achieve expected business outcomes.
                  </p>
                  <p>
                    Except for any express commitment stated in the product description and any rights that cannot legally be excluded, products and services are supplied “as is” and “as available,” without implied warranties of merchantability, fitness for a particular purpose, or non-infringement.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>7. Limitation of Liability</h2>
                  <p>
                    To the maximum extent permitted by applicable law, GeeLark Flows will not be liable for indirect, incidental, special, consequential, exemplary, or lost-profit damages. Our aggregate liability arising from a particular order will not exceed the amount you paid for that order. This limitation does not restrict liability or consumer rights that cannot legally be limited.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>8. Intellectual Property & Third-Party Marks</h2>
                  <p>
                    The delivered workflow code, documentation, storefront content, and original branding remain protected by their respective intellectual-property rights. GeeLark and other platform names and marks belong to their respective owners and are used only to describe compatibility.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>9. Disputes, Changes & Contact</h2>
                  <p>
                    Contact <code>support@geelarkflows.com</code> first so we can attempt an informal resolution. Applicable law and any non-waivable consumer protections continue to apply. We may update these Terms prospectively by publishing a revised date; the terms shown when an order is placed govern that order unless law requires otherwise.
                  </p>
                </section>
              </div>
            </>
          )}

          {type === 'privacy' && (
            <>
              <div className="legal-doc-header">
                <span className="legal-kicker">DATA PROTECTION & PRIVACY</span>
                <h1 className="legal-doc-title">Privacy Policy</h1>
                <p className="legal-doc-summary">
                  How GeeLark Flows collects, processes, and protects customer emails, order records, and technical request data.
                </p>
                <div className="legal-meta-date">Last Updated: August 25, 2026 · Independent operator: GeeLark Flows · support@geelarkflows.com</div>
              </div>

              <div className="legal-body-content">
                <section className="legal-section">
                  <h2>1. Overview</h2>
                  <p>
                    GeeLark Flows operates <code>geelarkflows.com</code>. We limit the information we collect and process to information used to operate the storefront, process payments, deliver orders, provide support, handle custom requests, maintain security, and meet applicable operational or legal requirements. We do not use third-party advertising trackers, tracking pixels, or cross-site behavioral analytics.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>2. Information We Process</h2>
                  <ul>
                    <li><strong>Orders & Delivery:</strong> Email address provided at checkout, order references, workflow selections, quantities, subtotal, delivery method, and fulfillment status.</li>
                    <li><strong>Cryptocurrency Payments:</strong> Payment metadata including cryptocurrency network, generated deposit address, payment amount, invoice status, and blockchain transaction hash. We do not collect or store private wallet keys or bank details.</li>
                    <li><strong>Custom Automation Inquiries:</strong> Name, email address, and project requirements. For abuse prevention and rate limiting, we derive and store a pseudonymous technical identifier from the connecting IP address. The application does not persist the raw IP address with the request. (Pseudonymous data is not anonymous data.)</li>
                    <li><strong>Customer Communications:</strong> Inbound emails, subjects, message content, and attachments sent to <code>support@geelarkflows.com</code>.</li>
                    <li><strong>Browser Storage:</strong> Functional browser local storage to retain cart contents and active payment screens across refreshes. No marketing or advertising cookies are used.</li>
                    <li><strong>Infrastructure & Administrative Records:</strong> Cloudflare edge infrastructure handles standard network connection information necessary for security and routing. Administrative session and audit records include security identifiers, IP addresses, user-agent information, and actions performed in the administrative system for operator authentication and audit logging.</li>
                  </ul>
                </section>

                <section className="legal-section">
                  <h2>3. How We Use Information</h2>
                  <p>
                    Information is used strictly for operational purposes: delivering purchased automations, verifying payment settlement, coordinating GeeLark Account Setup, responding to support inquiries, reviewing custom requests, preventing abuse, and maintaining operational, accounting, payment, and legal record-keeping. We do not sell or rent personal information to third parties for marketing or advertising.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>4. Third-Party Service Providers</h2>
                  <p>
                    We rely on technical infrastructure providers: Cloudflare (hosting, Workers, D1 database, R2 storage), NOWPayments (cryptocurrency invoice processing), and Resend (transactional email delivery).
                  </p>
                  <p>
                    Payment QR codes are generated inside your browser; payment addresses are not sent to an external QR-code service. Purchased files are delivered through private, expiring links validated by our Cloudflare Worker.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>5. Data Retention & Inquiries</h2>
                  <p>
                    Information is retained for as long as reasonably necessary to provide the service, maintain operational and payment records, resolve disputes, prevent fraud, satisfy legitimate business requirements, and comply with applicable legal obligations. Where information is no longer needed, it may be deleted or de-identified. For privacy inquiries, contact <code>support@geelarkflows.com</code>.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>6. Children's Privacy</h2>
                  <p>
                    Purchases are intended only for adults who are at least 18 years old. The service is not directed to children, and we do not knowingly collect personal information from children.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>7. Security & Privacy Requests</h2>
                  <p>
                    We use access controls, hashed customer-status and download tokens, signed provider webhooks, restricted administrative sessions, and audit records to protect operational data. No system is completely secure. To request access, correction, or deletion where applicable, contact <code>support@geelarkflows.com</code>; we may need to verify your identity and retain records required for fraud prevention, accounting, disputes, or legal compliance.
                  </p>
                </section>
              </div>
            </>
          )}

          {type === 'refund-policy' && (
            <>
              <div className="legal-doc-header">
                <span className="legal-kicker">ORDER CANCELLATION & REFUNDS</span>
                <h1 className="legal-doc-title">Refund & Cancellation Policy</h1>
                <p className="legal-doc-summary">
                  Policies regarding digital automation package delivery, GeeLark setup coordination, and cryptocurrency transaction handling.
                </p>
                <div className="legal-meta-date">Last Updated: August 25, 2026 · Independent operator: GeeLark Flows · support@geelarkflows.com</div>
              </div>

              <div className="legal-body-content">
                <section className="legal-section">
                  <h2>1. General Policy for Digital Deliverables</h2>
                  <p>
                    All products sold on GeeLark Flows are digital software packages, automation workflow scripts, and technical setup services. Because these are digital deliverables, <strong>purchases are generally final and non-refundable once the digital workflow package has been successfully delivered, accessed, or sent to your supplied email address</strong>, except where otherwise required by applicable law.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>2. Situations Eligible for Review</h2>
                  <p>We review refund or replacement requests in the following circumstances:</p>
                  <ul>
                    <li><strong>Duplicate Payments:</strong> You accidentally submitted duplicate payments for the same order reference or invoice.</li>
                    <li><strong>Non-Delivery:</strong> A confirmed paid order that GeeLark Flows is ultimately unable to deliver after reasonable support and fulfillment efforts.</li>
                    <li><strong>Wrong Product Delivered:</strong> The digital package sent does not match the product specified in your order confirmation.</li>
                    <li><strong>Material Defect at Delivery:</strong> The workflow has a material technical defect present at delivery that prevents execution on the specified platform as configured, and the issue cannot reasonably be corrected.</li>
                  </ul>
                </section>

                <section className="legal-section">
                  <h2>3. Support & Correction-First Approach</h2>
                  <p>
                    Where a technical issue can reasonably be diagnosed and resolved, GeeLark Flows may first provide technical support, workflow corrections, or an updated replacement package prior to issuing a refund.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>4. Non-Refundable Circumstances</h2>
                  <p>
                    Refunds are not granted for changing your mind after delivery, third-party platform changes occurring after successful delivery, account restrictions, action limits, shadowbans, suspensions, or similar actions imposed by third-party platforms, or failure to achieve particular business or revenue metrics.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>5. GeeLark Account Setup Services</h2>
                  <p>
                    Once setup work has materially begun in your designated GeeLark environment, setup service fees are generally non-refundable unless we cannot perform the agreed service or applicable law requires otherwise. Orders awaiting required customer configuration details remain pending customer cooperation until received.
                  </p>
                </section>

                <section className="legal-section">
                  <h2>6. Cryptocurrency Payments & Refunds</h2>
                  <p>
                    Blockchain transfers are generally irreversible once confirmed. Customers must send the exact required amount to the payment address generated for that order on the selected network. Incorrect-network or unsupported-token transfers may be unrecoverable, and recovery cannot be guaranteed.
                  </p>
                  <p>
                    If a cryptocurrency refund is approved, GeeLark Flows will provide the required refund instructions through support. Approved refund amounts may be affected by applicable blockchain network gas fees, payment-provider transaction fees, exchange-rate changes, and reasonable recovery costs.
                  </p>
                </section>
              </div>
            </>
          )}

          {/* Document Footer Navigation */}
          <div className="legal-doc-footer">
            <div className="legal-footer-links">
              <span>Related Legal Policies:</span>
              <a href="/terms" onClick={(e) => { e.preventDefault(); handleNav('/terms'); }}>Terms</a>
              <span>·</span>
              <a href="/privacy" onClick={(e) => { e.preventDefault(); handleNav('/privacy'); }}>Privacy</a>
              <span>·</span>
              <a href="/refund-policy" onClick={(e) => { e.preventDefault(); handleNav('/refund-policy'); }}>Refunds</a>
              <span>·</span>
              <a href="/contact" onClick={(e) => { e.preventDefault(); handleNav('/contact'); }}>Contact</a>
            </div>
            <div className="legal-support-direct">
              <span>Support: </span>
              <a href="mailto:support@geelarkflows.com" className="legal-support-link font-mono">
                support@geelarkflows.com
              </a>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
