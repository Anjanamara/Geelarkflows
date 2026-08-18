import { useEffect, useState } from 'react';
import { CartProvider, useCart } from './context/CartContext';
import { FilterProvider } from './context/FilterContext';
import FilterHeader from './components/FilterHeader';
import ProductGrid from './components/ProductGrid';
import CartDrawer from './components/CartDrawer';
import ProductModal from './components/ProductModal';
import CustomRequestModal from './components/CustomRequestModal';
import CartToast from './components/CartToast';
import FloatingCart from './components/FloatingCart';
import MrBeanFoldAnimation from './components/MrBeanFoldAnimation';
import { products, specialties } from './data/products';
import './App.css';

const siteUrl = 'https://geelarkflows.com';

const getProductFromPath = () => {
  const match = window.location.pathname.match(/^\/flows\/([^/]+)\/?$/);
  return match ? products.find((product) => product.id === match[1]) || null : null;
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
    question: 'Can these flows manage multiple social media accounts?',
    answer: 'Yes. Instagram, TikTok, Snapchat, Reddit, Facebook, YouTube, Threads, and dating-app workflows can be prepared for repeatable multi-account operations when your setup supports it.',
  },
  {
    question: 'Can you build a custom GeeLark RPA workflow?',
    answer: 'Yes. Custom development is available for video automation, metadata workflows, analytics tracking, mobile SEO searches, content generation, and large-scale account operations.',
  },
];

function Storefront() {
  const { cartItemCount, openCart, activeFoldAnimation, handleFoldArrival, handleFoldComplete } = useCart();
  const [selectedProduct, setSelectedProduct] = useState(getProductFromPath);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isCustomRequestModalOpen, setIsCustomRequestModalOpen] = useState(false);
  const [customRequestType, setCustomRequestType] = useState('flow');

  useEffect(() => {
    document.body.classList.toggle('dark-theme', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    const handleLocationChange = () => setSelectedProduct(getProductFromPath());
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  useEffect(() => {
    const pageTitle = selectedProduct
      ? `${selectedProduct.title} GeeLark Flow | GeeLark Flows`
      : 'GeeLark Automation Flows for Social Media & Mobile';
    const pageDescription = selectedProduct
      ? `${selectedProduct.details.description} Reusable GeeLark automation with unlimited runs. $${selectedProduct.price.toLocaleString('en-US')} USD.`
      : 'Buy reusable GeeLark automation flows for Instagram, TikTok, Snapchat, Reddit, Facebook, YouTube, Threads, dating apps, mobile SEO, and account management.';
    const canonicalUrl = selectedProduct
      ? `${siteUrl}/flows/${selectedProduct.id}/`
      : `${siteUrl}/`;

    document.title = pageTitle;
    setCanonicalUrl(canonicalUrl);
    setMetaContent('meta[name="description"]', 'content', pageDescription);
    setMetaContent('meta[property="og:title"]', 'content', pageTitle);
    setMetaContent('meta[property="og:description"]', 'content', pageDescription);
    setMetaContent('meta[property="og:url"]', 'content', canonicalUrl);
    setMetaContent('meta[name="twitter:title"]', 'content', pageTitle);
    setMetaContent('meta[name="twitter:description"]', 'content', pageDescription);
  }, [selectedProduct]);

  const openRequest = (type = 'flow') => {
    setCustomRequestType(type);
    setIsCustomRequestModalOpen(true);
  };

  const scrollToCatalog = () => {
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
  };

  const openProduct = (product) => {
    const productPath = `/flows/${product.id}/`;
    if (window.location.pathname !== productPath) {
      window.history.pushState({ productId: product.id }, '', productPath);
    }
    setSelectedProduct(product);
  };

  const closeProduct = () => {
    if (window.location.pathname.startsWith('/flows/')) {
      window.history.pushState({}, '', '/');
    }
    setSelectedProduct(null);
  };

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
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  };

  return (
    <div className="site-shell">
      <header className="site-nav">
        <div className="nav-left">
          <a className="brand-lockup" href="#top" aria-label="GeeLark Flows home">
            <span className="brand-mark">GF</span>
            <span>
              <strong>GeeLark</strong>
              <small>Flows</small>
            </span>
          </a>

          <nav className="desktop-nav" aria-label="Primary navigation">
            <a href="#catalog">Flow catalog</a>
            <a href="#specialties">Specialties</a>
            <a href="#faq">FAQ</a>
            <button type="button" onClick={() => openRequest('flow')}>Custom development</button>
          </nav>
        </div>

        <div className="nav-actions">
          <button
            type="button"
            className="theme-button"
            onClick={() => setIsDarkMode((value) => !value)}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      {/* Floating Technical Cart (Always accessible at top-right on scroll) */}
      <FloatingCart />

      {/* Iconic Mr. Bean "Fold the Flow into Cart" Micro-Interaction */}
      <MrBeanFoldAnimation
        activeFlow={activeFoldAnimation}
        onArrival={handleFoldArrival}
        onComplete={handleFoldComplete}
      />

      {/* Toast Feedback (Appears below floating cart after impact) */}
      <CartToast />

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span /> Mobile automation, engineered to scale</div>
            <h1>GeeLark automation.<br /><em>Built to run on repeat.</em></h1>
            <p className="hero-lede">
              Reusable Instagram, TikTok, Snapchat, Reddit, Facebook, YouTube,
              Threads, dating-app, and mobile SEO automation built for operations at scale.
            </p>

            <div className="hero-actions">
              <button type="button" className="primary-cta" onClick={scrollToCatalog}>
                Explore 25 flows <span>↘</span>
              </button>
              <button type="button" className="secondary-cta" onClick={() => openRequest('flow')}>
                Build a custom flow
              </button>
            </div>

            <div className="pricing-rule">
              <strong>Buy once</strong>
              <span>Your delivered workflow is reusable—run it as many times as you need.</span>
            </div>
          </div>

          <div className="hero-console" aria-label="Automation workflow preview">
            <div className="console-topbar">
              <span className="console-dots"><i /><i /><i /></span>
              <span>LIVE OPERATIONS</span>
              <span className="live-state"><i /> SYSTEM READY</span>
            </div>
            <div className="console-grid">
              <div className="console-stat featured-stat">
                <span>PLATFORM FAMILIES</span>
                <strong>08</strong>
                <small>Social + dating</small>
              </div>
              <div className="console-stat">
                <span>READY FLOWS</span>
                <strong>25</strong>
                <small>Reusable from $100</small>
              </div>
              <div className="workflow-map">
                <div className="workflow-label">AUTOMATION PIPELINE</div>
                <div className="workflow-nodes">
                  <div><b>01</b><span>Input</span></div>
                  <i />
                  <div><b>02</b><span>Operate</span></div>
                  <i />
                  <div className="active-node"><b>03</b><span>Track</span></div>
                </div>
              </div>
              <div className="console-log">
                <p><span>06:41</span> Account batch connected</p>
                <p><span>06:42</span> Schedule loaded</p>
                <p className="success"><span>06:42</span> Workflow ready to run</p>
              </div>
            </div>
          </div>
        </section>

        <section className="platform-marquee" aria-label="Supported platforms">
          <span>Instagram</span><i />
          <span>TikTok</span><i />
          <span>Snapchat</span><i />
          <span>Reddit</span><i />
          <span>Facebook</span><i />
          <span>YouTube</span><i />
          <span>Threads</span><i />
          <span>Dating apps</span>
        </section>

        <section className="catalog-section" id="catalog">
          <div className="section-heading">
            <div>
              <span className="section-kicker">FLOW CATALOG / 2026</span>
              <h2>Choose your platform.<br />Own the repeatable workflow.</h2>
            </div>
            <p>
              Choose the exact social media or mobile automation you need.
              We configure the workflow for your operation, then you can run it repeatedly.
            </p>
          </div>

          <FilterHeader />
          <ProductGrid onViewDetails={openProduct} />
        </section>

        <section className="specialties-section" id="specialties">
          <div className="section-heading light-heading">
            <div>
              <span className="section-kicker">BEYOND THE CATALOG</span>
              <h2>Special systems for<br />serious operations.</h2>
            </div>
            <p>
              Need a connected workflow, custom logic, or a capability that
              does not fit a standard card? We scope it around your operation.
            </p>
          </div>

          <div className="specialty-grid">
            {specialties.map((specialty, index) => (
              <article className="specialty-card" key={specialty.title}>
                <div className="specialty-number">{String(index + 1).padStart(2, '0')}</div>
                <span className="specialty-marker">{specialty.marker}</span>
                <h3>{specialty.title}</h3>
                <p>{specialty.description}</p>
                <button type="button" onClick={() => openRequest('flow')}>Discuss project ↗</button>
              </article>
            ))}
          </div>

          <div className="custom-development-banner">
            <div>
              <span>CUSTOM DEVELOPMENT</span>
              <h3>One workflow or a complete account operation.</h3>
            </div>
            <p>
              We design platform-specific flows, connect content and analytics,
              and prepare systems for repeatable multi-account execution.
            </p>
            <button type="button" onClick={() => openRequest('flow')}>Start a custom build</button>
          </div>
        </section>

        <section className="faq-section" id="faq">
          <div className="section-heading faq-heading">
            <div>
              <span className="section-kicker">CLEAR BEFORE YOU BUY</span>
              <h2>GeeLark flow questions,<br />answered plainly.</h2>
            </div>
            <p>
              Everything clients need to know about reusable automation flows,
              unlimited runs, supported platforms, demos, and custom development.
            </p>
          </div>

          <div className="faq-list">
            {faqs.map((faq, index) => (
              <details key={faq.question} open={index === 0}>
                <summary>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{faq.question}</h3>
                  <i>+</i>
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </main>

      <footer className="site-footer">
        <div className="brand-lockup footer-brand">
          <span className="brand-mark">GF</span>
          <span><strong>GeeLark</strong><small>Flows</small></span>
        </div>
        <p>Mobile automation flows for platform operations at scale.</p>
        <button type="button" onClick={() => openRequest('consulting')}>Talk to us ↗</button>
      </footer>

      <CartDrawer />
      <ProductModal product={selectedProduct} onClose={closeProduct} />
      <CustomRequestModal
        isOpen={isCustomRequestModalOpen}
        onClose={() => setIsCustomRequestModalOpen(false)}
        requestType={customRequestType}
      />
    </div>
  );
}

export default function App() {
  return (
    <CartProvider>
      <FilterProvider>
        <Storefront />
      </FilterProvider>
    </CartProvider>
  );
}
