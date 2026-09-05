import { lazy, Suspense, useEffect, useState } from 'react';
import { CartProvider, useCart } from './context/CartContext';
import { FilterProvider } from './context/FilterContext';
import FilterHeader from './components/FilterHeader';
import ProductGrid from './components/ProductGrid';
import CustomRequestModal from './components/CustomRequestModal';
import CartToast from './components/CartToast';
import FloatingCart from './components/FloatingCart';
import StorefrontNotifications from './components/StorefrontNotifications';
import MrBeanFoldAnimation from './components/MrBeanFoldAnimation';
import Footer from './components/Footer';
import { products, specialties } from './data/products';
import { trackPageView } from './analytics';
import './App.css';

const AdminApp = lazy(() => import('./admin/AdminApp'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const FlowDetailPage = lazy(() => import('./pages/FlowDetailPage'));
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
        <img src="/logo-mark.svg" alt="" width="42" height="42" />
      </span>
      <span className="brand-name">GeeLark <b>Flows</b></span>
    </a>
  );
}

function CartDeliveryAnimation() {
  const { activeFoldAnimation, handleFoldArrival, handleFoldComplete } = useCart();

  return (
    <MrBeanFoldAnimation
      activeFlow={activeFoldAnimation}
      onArrival={handleFoldArrival}
      onComplete={handleFoldComplete}
    />
  );
}

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

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'GeeLark Flows',
        url: `${siteUrl}/`,
        description: 'Reusable GeeLark automation flows for social media, dating apps, mobile SEO, and account operations at scale.',
      },
      {
        '@type': 'ItemList',
        name: 'GeeLark Automation Flow Catalog',
        numberOfItems: products.length,
        itemListElement: products.map((product, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'Product',
            name: product.title,
            url: `${siteUrl}/flows/${product.id}/`,
            description: product.details.description,
            category: `${product.platform} automation flow`,
            offers: {
              '@type': 'Offer',
              price: product.price,
              priceCurrency: 'USD',
              availability: 'https://schema.org/InStock',
              url: `${siteUrl}/flows/${product.id}/`,
            },
          },
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
    ],
  };

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="site-nav">
          <Brand />
          <nav className={`desktop-nav ${isMenuOpen ? 'is-open' : ''}`} aria-label="Primary navigation">
            <button type="button" onClick={() => scrollToSection('catalog')}>Catalog</button>
            <button type="button" onClick={() => scrollToSection('specialties')}>Capabilities</button>
            <button type="button" onClick={() => scrollToSection('process')}>How it works</button>
            <button type="button" onClick={() => scrollToSection('faq')}>FAQ</button>
            <a href="/contact" onClick={(event) => { event.preventDefault(); navigate('/contact'); }}>Support</a>
            <button className="mobile-custom-link" type="button" onClick={() => openRequest('flow')}>Request a custom flow</button>
          </nav>
          <div className="nav-actions">
            <button className="nav-custom-button" type="button" onClick={() => openRequest('flow')}>Custom build</button>
            <StorefrontNotifications />
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

      <CartToast />
      <CartDeliveryAnimation />

      <main id="top">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow"><span>Reusable GeeLark flows</span><i>25 ready flows</i></div>
            <h1 id="hero-title">Run the work.<br /><em>Skip the repetition.</em></h1>
            <p className="hero-lede">
              Mobile automation for publishing, warmup, account operations, dating apps,
              and mobile SEO—configured once and ready to run again.
            </p>
            <div className="hero-actions">
              <button type="button" className="primary-cta" onClick={() => scrollToSection('catalog')}>
                Browse flows <span aria-hidden="true">↘</span>
              </button>
              <button type="button" className="secondary-cta" onClick={() => openRequest('flow')}>
                Scope a custom build <span aria-hidden="true">→</span>
              </button>
            </div>
            <ul className="hero-proof" aria-label="Purchase benefits">
              <li><b>One purchase</b><span>Clear fixed scope</span></li>
              <li><b>Unlimited runs</b><span>No per-run charge</span></li>
              <li><b>Configured delivery</b><span>Built for your setup</span></li>
            </ul>
          </div>

          <div className="hero-workspace" aria-label="Example automation run">
            <div className="workspace-head">
              <div><span className="workspace-status"><i /> Ready to run</span><strong>Publishing operation</strong></div>
              <span className="workspace-menu" aria-hidden="true">•••</span>
            </div>
            <div className="workspace-flow">
              <div className="flow-stage is-complete"><span>01</span><p><b>Connect accounts</b><small>Inputs validated</small></p><i>✓</i></div>
              <div className="flow-stage is-complete"><span>02</span><p><b>Load content</b><small>Schedule prepared</small></p><i>✓</i></div>
              <div className="flow-stage is-active"><span>03</span><p><b>Run workflow</b><small>Reusable operation</small></p><i>→</i></div>
            </div>
            <div className="workspace-footer"><span>Supports multi-account execution</span><b>Unlimited runs</b></div>
          </div>
        </section>

        <div className="platform-strip" aria-label="Supported platforms">
          <span>Instagram</span><span>TikTok</span><span>Snapchat</span><span>Reddit</span>
          <span>Facebook</span><span>YouTube</span><span>Threads</span><span>Dating apps</span>
        </div>

        <section className="catalog-section" id="catalog">
          <div className="section-heading">
            <div><span className="section-kicker">Automation catalog</span><h2>Find the flow that fits the job.</h2></div>
            <p>Compare exactly what each workflow handles, the fixed purchase price, and the platform it supports—without opening every product.</p>
          </div>
          <FilterHeader />
          <ProductGrid onViewDetails={openProduct} />
        </section>

        <section className="specialties-section" id="specialties">
          <div className="section-heading light-heading">
            <div><span className="section-kicker">Custom capabilities</span><h2>When the catalog is only the starting point.</h2></div>
            <p>Connect content, account operations, analytics, and device-level actions into one scoped system.</p>
          </div>
          <div className="specialty-grid">
            {specialties.map((specialty, index) => (
              <article className="specialty-card" key={specialty.title}>
                <div className="specialty-card-top"><span>{specialty.marker}</span><i>{String(index + 1).padStart(2, '0')}</i></div>
                <h3>{specialty.title}</h3><p>{specialty.description}</p>
              </article>
            ))}
          </div>
          <div className="custom-development-banner">
            <div><span>Need something specific?</span><h3>Bring us the outcome. We’ll map the workflow.</h3></div>
            <p>Custom development can cover one focused action or a connected, multi-account operation.</p>
            <button type="button" onClick={() => openRequest('flow')}>Start a custom request <span>→</span></button>
          </div>
        </section>

        <section className="process-section" id="process">
          <div className="section-heading">
            <div><span className="section-kicker">How delivery works</span><h2>From requirement to repeatable run.</h2></div>
            <p>Every purchase has a defined scope. You know what the flow handles before checkout and what happens after payment.</p>
          </div>
          <div className="process-grid">
            {operationSteps.map(([number, title, copy]) => (
              <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>
            ))}
          </div>
        </section>

        <section className="trust-section" id="trust" aria-labelledby="trust-title">
          <div className="section-heading trust-heading">
            <div><span className="section-kicker">Before you buy</span><h2 id="trust-title">What's visible before you pay.</h2></div>
            <p>Scope, price, payment status, and policy terms are documented before checkout, not after.</p>
          </div>
          <div className="trust-grid">
            {trustSignals.map(([number, title, copy]) => (
              <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></article>
            ))}
          </div>
          <nav className="trust-policy-links" aria-label="Purchase policies and support">
            <a href="/refund-policy" onClick={(event) => { event.preventDefault(); navigate('/refund-policy'); }}>Refund policy <span aria-hidden="true">↗</span></a>
            <a href="/privacy" onClick={(event) => { event.preventDefault(); navigate('/privacy'); }}>Privacy policy <span aria-hidden="true">↗</span></a>
            <a href="/terms" onClick={(event) => { event.preventDefault(); navigate('/terms'); }}>Terms of service <span aria-hidden="true">↗</span></a>
            <a href="/contact" onClick={(event) => { event.preventDefault(); navigate('/contact'); }}>Contact support <span aria-hidden="true">↗</span></a>
          </nav>
        </section>

        <section className="faq-section" id="faq">
          <div className="section-heading faq-heading">
            <div><span className="section-kicker">Before you buy</span><h2>Clear answers. No fine-print surprises.</h2></div>
            <p>Scope, reuse, checkout, account scale, and custom development—explained plainly.</p>
          </div>
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <details key={faq.question} open={index === 0}>
                <summary><span>{String(index + 1).padStart(2, '0')}</span><h3>{faq.question}</h3><i aria-hidden="true">+</i></summary>
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
    trackPageView(currentPath);
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
