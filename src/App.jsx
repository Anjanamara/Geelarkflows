import { lazy, Suspense, useEffect, useState } from 'react';
import { CartProvider } from './context/CartContext';
import { FilterProvider } from './context/FilterContext';
import FilterHeader from './components/FilterHeader';
import ProductGrid from './components/ProductGrid';
import CustomRequestModal from './components/CustomRequestModal';
import FloatingCart from './components/FloatingCart';
import Footer from './components/Footer';
import { products, specialties } from './data/products';
import { startEngagementTracking, trackPageView } from './analytics';
import { trackGooglePageView } from './googleAnalytics';
import { captureReferralCode } from './referrals';
import { buildCatalogStructuredData } from './seo/structuredData';
import './App.css';

const AdminApp = lazy(() => import('./admin/AdminApp'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const FlowDetailPage = lazy(() => import('./pages/FlowDetailPage'));
const LeadUnsubscribePage = lazy(() => import('./pages/LeadUnsubscribePage'));
const siteUrl = 'https://geelarkflows.com';

const getFlowIdFromPath = (path) => {
  const match = path.match(/^\/flows\/([^/]+)\/?$/);
  return match ? match[1] : null;
};

const setMetaContent = (selector, attribute, value) => {
  const element = document.head.querySelector(selector);
  if (element) element.setAttribute(attribute, value);
};

const setCanonicalUrl = (url) => {
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = url;
};

const faqs = [
  {
    question: 'Can I run my GeeLark automation flow more than once?',
    answer: 'Yes. Every catalog purchase delivers a reusable automation flow. After setup and delivery, you can run that workflow as many times as your operation needs.',
  },
  {
    question: 'What is included with each automation flow?',
    answer: 'You receive the complete workflow shown on the product card, configured for the named platform and your agreed operating inputs. Each detail page lists the exact actions the flow handles.',
  },
  {
    question: 'How are checkout, payment, and delivery handled?',
    answer: 'Before an invoice is created, checkout shows the workflow subtotal, any setup fee or coupon discount, the final USD total, and your selected USDT network. Payment status is verified through NOWPayments before fulfillment begins, and support is available at support@geelarkflows.com.',
  },
  {
    question: 'Can these flows manage multiple social media accounts?',
    answer: 'Yes. Instagram, TikTok, Snapchat, Reddit, Facebook, YouTube, Threads, and dating-app workflows can be prepared for repeatable multi-account operations when your setup supports it.',
  },
  {
    question: 'Can you build a custom GeeLark RPA workflow?',
    answer: 'Yes. Custom development is available for video automation, metadata workflows, analytics tracking, mobile SEO searches, content generation, and large-scale account operations.',
  },
];

const operationSteps = [
  ['01', 'Choose the exact flow', 'Compare scope, supported actions, and price directly in the catalog.'],
  ['02', 'Share your operating inputs', 'After purchase, we confirm the platform and configuration needed for your setup.'],
  ['03', 'Receive a reusable workflow', 'Run the delivered automation repeatedly for your authorized operation.'],
];

const trustSignals = [
  ['01', 'Exact scope before checkout', 'Each catalog card and detail view states the workflow actions, platform, reusable license, and fixed price before you buy.'],
  ['02', 'Transparent order total', 'Checkout itemizes the workflow subtotal, setup fee, coupon discount, final USD total, and selected USDT network before creating an invoice.'],
  ['03', 'Verified payment status', 'The payment address and settlement status come from NOWPayments. Fulfillment starts only after the payment reaches a confirmed state.'],
  ['04', 'Published support policies', 'Delivery, refund limits, privacy practices, acceptable use, and a real support address are available before purchase.'],
];

function Brand({ href = '#top', onClick }) {
  return (
    <a className="brand-lockup" href={href} onClick={onClick} aria-label="GeeLark Flows home">
      <span className="brand-mark" aria-hidden="true">
        <img src="/logo-mark.svg" alt="" width="36" height="36" />
      </span>
      <span className="brand-name">GeeLark <b>Flows</b></span>
    </a>
  );
}

const heroFacts = [
  'Fixed price, shown before checkout',
  'Reusable: run it as often as you like',
  '30-day compatibility fixes',
  'Published refund, privacy and support policies',
];

function Storefront({ navigate }) {
  const [isCustomRequestModalOpen, setIsCustomRequestModalOpen] = useState(false);
  const [customRequestType, setCustomRequestType] = useState('flow');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    document.title = 'GeeLark Automation Flows for Social Media & Mobile';
    setCanonicalUrl(`${siteUrl}/`);
    setMetaContent('meta[name="description"]', 'content', 'Buy reusable GeeLark automation flows for Instagram, TikTok, Snapchat, Reddit, Facebook, YouTube, Threads, dating apps, mobile SEO, and account management.');
    setMetaContent('meta[property="og:title"]', 'content', 'GeeLark Automation Flows for Social Media & Mobile');
    setMetaContent('meta[property="og:description"]', 'content', 'Buy reusable GeeLark automation flows for Instagram, TikTok, Snapchat, Reddit, Facebook, YouTube, Threads, dating apps, mobile SEO, and account management.');
    setMetaContent('meta[property="og:url"]', 'content', `${siteUrl}/`);
    setMetaContent('meta[name="twitter:title"]', 'content', 'GeeLark Automation Flows for Social Media & Mobile');
    setMetaContent('meta[name="twitter:description"]', 'content', 'Buy reusable GeeLark automation flows for Instagram, TikTok, Snapchat, Reddit, Facebook, YouTube, Threads, dating apps, mobile SEO, and account management.');
    setMetaContent('meta[name="robots"]', 'content', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  }, []);

  const openRequest = (type = 'flow') => {
    setCustomRequestType(type);
    setIsCustomRequestModalOpen(true);
    setIsMenuOpen(false);
  };

  const scrollToSection = (id) => {
    setIsMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const openProduct = (product) => navigate(`/flows/${product.id}/`);
  const goTo = (path) => (event) => { event.preventDefault(); navigate(path); };

  const structuredData = buildCatalogStructuredData({ products, faqs, siteUrl });

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="site-nav">
          <Brand />
          <nav className={`desktop-nav ${isMenuOpen ? 'is-open' : ''}`} aria-label="Primary navigation">
            <button type="button" onClick={() => scrollToSection('catalog')}>Flows</button>
            <button type="button" onClick={() => scrollToSection('process')}>How it works</button>
            <button type="button" onClick={() => scrollToSection('trust')}>Policies</button>
            <button type="button" onClick={() => scrollToSection('faq')}>FAQ</button>
            <a href="/contact" onClick={goTo('/contact')}>Support</a>
            <button className="mobile-custom-link" type="button" onClick={() => openRequest('flow')}>Request a custom flow</button>
          </nav>
          <div className="nav-actions">
            <button className="nav-custom-button" type="button" onClick={() => openRequest('flow')}>Custom build</button>
            <FloatingCart />
            <button
              className="menu-button"
              type="button"
              aria-label={isMenuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <span /><span />
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero-section" aria-labelledby="hero-title">
          <p className="eyebrow">Independent marketplace · {products.length} ready-made flows</p>
          <h1 id="hero-title">Ready-made automation for your GeeLark cloud phones.</h1>
          <p className="hero-lede">
            Buy a flow once and run it as often as you need. Account creation, warmup,
            posting and more for Instagram, TikTok, Snapchat, Reddit, Facebook, YouTube,
            Threads and dating apps.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-cta" onClick={() => scrollToSection('catalog')}>
              Browse the flows
            </button>
            <button type="button" className="secondary-cta" onClick={() => openRequest('flow')}>
              Request a custom flow
            </button>
          </div>
          <ul className="hero-facts" aria-label="What you can rely on">
            {heroFacts.map((fact) => (
              <li key={fact}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                {fact}
              </li>
            ))}
          </ul>
        </section>

        <section className="catalog-section" id="catalog">
          <div className="section-heading">
            <h2>All flows</h2>
            <p>Every flow has one fixed price and a plain description of what it does. Open one to see exactly what is included.</p>
          </div>
          <FilterHeader />
          <ProductGrid onViewDetails={openProduct} />
        </section>

        <section className="custom-section" id="custom" aria-labelledby="custom-title">
          <div>
            <h2 id="custom-title">Need something that isn’t listed?</h2>
            <p>
              Tell us the outcome you want and we’ll scope a custom workflow. Examples:{' '}
              {specialties.map((specialty) => specialty.title.toLowerCase().replace('seo', 'SEO')).join(', ')}.
            </p>
          </div>
          <button type="button" className="secondary-cta" onClick={() => openRequest('flow')}>Request a custom flow</button>
        </section>

        <section className="process-section" id="process">
          <div className="section-heading">
            <h2>How buying works</h2>
          </div>
          <ol className="process-grid">
            {operationSteps.map(([number, title, copy]) => (
              <li key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></li>
            ))}
          </ol>
        </section>

        <section className="trust-section" id="trust" aria-labelledby="trust-title">
          <div className="section-heading">
            <h2 id="trust-title">What's visible before you pay.</h2>
            <p>Scope, price, payment status and policy terms are documented before checkout, not after.</p>
          </div>
          <ul className="trust-grid">
            {trustSignals.map(([number, title, copy]) => (
              <li key={number}><h3>{title}</h3><p>{copy}</p></li>
            ))}
          </ul>
          <nav className="trust-policy-links" aria-label="Purchase policies and support">
            <a href="/refund-policy" onClick={goTo('/refund-policy')}>Refund policy</a>
            <a href="/privacy" onClick={goTo('/privacy')}>Privacy policy</a>
            <a href="/terms" onClick={goTo('/terms')}>Terms of service</a>
            <a href="/contact" onClick={goTo('/contact')}>Contact support</a>
          </nav>
          <p className="trust-independence">
            GeeLark Flows is an independent business. It is not affiliated with, endorsed by, or sponsored by the owner of the GeeLark software or trademark.
          </p>
        </section>

        <section className="faq-section" id="faq">
          <div className="section-heading">
            <h2>Common questions</h2>
          </div>
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <details key={faq.question} open={index === 0}>
                <summary><h3>{faq.question}</h3><i aria-hidden="true" /></summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </main>

      <Footer navigate={navigate} onOpenCustomRequest={openRequest} />
      <CustomRequestModal isOpen={isCustomRequestModalOpen} onClose={() => setIsCustomRequestModalOpen(false)} requestType={customRequestType} />
    </div>
  );
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const handlePop = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
      window.scrollTo(0, 0);
    }
  };

  useEffect(() => {
    const routeMeta = {
      '/contact': { title: 'Contact GeeLark Flow Automation Specialists | GeeLark Flows', description: 'Contact GeeLark Flows for reusable mobile automation, custom RPA development, account operations, setup, and technical support.', index: true },
      '/terms': { title: 'Terms of Service | GeeLark Flows', description: 'Terms governing purchases, delivery, acceptable use, support, and reusable automation flows from GeeLark Flows.', index: true },
      '/privacy': { title: 'Privacy Policy | GeeLark Flows', description: 'Learn how GeeLark Flows handles checkout, customer support, payment, analytics, and account information.', index: true },
      '/refund-policy': { title: 'Refund Policy | GeeLark Flows', description: 'Read the GeeLark Flows digital-product refund, duplicate-payment, delivery, and support policy.', index: true },
      '/cart': { title: 'Your Flow Cart | GeeLark Flows', description: 'Review selected reusable GeeLark automation flows before checkout.', index: false },
      '/checkout': { title: 'Secure Checkout | GeeLark Flows', description: 'Create and securely monitor a GeeLark Flows USDT invoice.', index: false },
      '/unsubscribe': { title: 'Email Preferences | GeeLark Flows', description: 'Manage optional GeeLark Flows email offers.', index: false },
    };
    const flowId = getFlowIdFromPath(currentPath);
    const flowProduct = flowId ? products.find((product) => product.id === flowId) : null;
    const metadata = currentPath.startsWith('/admin')
      ? { title: 'Administration | GeeLark Flows', description: 'Private administration area.', index: false }
      : flowProduct
        ? {
          title: `${flowProduct.title} GeeLark Flow | GeeLark Flows`,
          description: `${flowProduct.details.description} Reusable GeeLark automation with unlimited runs. $${flowProduct.price.toLocaleString('en-US')} USD.`,
          index: true,
        }
        : routeMeta[currentPath];
    if (!metadata) return;

    const canonicalUrl = `${siteUrl}${currentPath}`;
    document.title = metadata.title;
    setCanonicalUrl(canonicalUrl);
    setMetaContent('meta[name="description"]', 'content', metadata.description);
    setMetaContent('meta[property="og:title"]', 'content', metadata.title);
    setMetaContent('meta[property="og:description"]', 'content', metadata.description);
    setMetaContent('meta[property="og:url"]', 'content', canonicalUrl);
    setMetaContent('meta[name="twitter:title"]', 'content', metadata.title);
    setMetaContent('meta[name="twitter:description"]', 'content', metadata.description);
    setMetaContent('meta[name="robots"]', 'content', metadata.index ? 'index, follow' : 'noindex, nofollow');
  }, [currentPath]);

  useEffect(() => {
    captureReferralCode();
    trackPageView(currentPath);
    trackGooglePageView(currentPath);
    return startEngagementTracking(currentPath);
  }, [currentPath]);

  if (currentPath.startsWith('/admin')) {
    return <Suspense fallback={<div className="route-loading">Loading secure administration…</div>}><AdminApp /></Suspense>;
  }

  const flowId = getFlowIdFromPath(currentPath);

  return (
    <CartProvider>
      <FilterProvider>
        <Suspense fallback={<div className="route-loading">Loading…</div>}>
          {flowId ? <FlowDetailPage productId={flowId} navigate={navigate} />
            : currentPath === '/cart' ? <CartPage navigate={navigate} />
              : currentPath === '/checkout' ? <CheckoutPage navigate={navigate} />
                : currentPath === '/unsubscribe' ? <LeadUnsubscribePage navigate={navigate} />
                : currentPath === '/contact' ? <ContactPage navigate={navigate} />
                  : currentPath === '/terms' ? <LegalPage type="terms" navigate={navigate} />
                    : currentPath === '/privacy' ? <LegalPage type="privacy" navigate={navigate} />
                      : currentPath === '/refund-policy' ? <LegalPage type="refund-policy" navigate={navigate} />
                        : <Storefront navigate={navigate} />}
        </Suspense>
      </FilterProvider>
    </CartProvider>
  );
}
