import { useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { platforms } from '../data/products';
import './ProductModal.css';

export default function ProductModal({ product, onClose }) {
  const { cart, addToCart, addToCartWithAnimation, lastAddedId, openCart } = useCart();

  useEffect(() => {
    if (!product) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [product, onClose]);

  if (!product) return null;

  const platform = platforms.find((item) => item.id === product.platform);
  const isInCart = cart.some((item) => item.id === product.id);
  const isJustAdded = lastAddedId === product.id;
  const { details } = product;

  // 1. Add to cart with animation (stays in browsing flow)
  const handleAddToCart = (event) => {
    if (isInCart) {
      onClose();
      openCart();
      return;
    }
    addToCartWithAnimation(product, event.currentTarget);
  };

  // 2. Direct Checkout: Instantly puts flow in cart, closes details, and opens checkout modal
  const handleDirectCheckout = () => {
    if (!isInCart) {
      addToCart(product);
    }
    onClose();
    openCart();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-content"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="flow-modal-title"
        style={{ '--modal-accent': platform?.color || 'var(--accent-lime)' }}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close flow details">×</button>

        <div className="modal-header">
          <div className="modal-platform-line">
            <span className="modal-platform-token">{platform?.shortLabel || 'GF'}</span>
            <div>
              <span>{platform?.label || product.platform}</span>
              <small>{details.category}</small>
            </div>
          </div>
          <h2 className="modal-title" id="flow-modal-title">{product.title}</h2>
          <p>{details.description}</p>
          <div className="modal-price-row">
            <div className="modal-price">${product.price.toLocaleString('en-US')}</div>
            <span className="modal-price-sub">Reusable workflow · Instant delivery</span>
            <button
              type="button"
              className="modal-quick-checkout-pill"
              onClick={handleDirectCheckout}
            >
              Direct checkout →
            </button>
          </div>
        </div>

        <div className="modal-body">
          {details.demoVideo && (
            <section className="modal-video-section">
              <div className="modal-section-label">VIDEO DEMO</div>
              <video controls preload="metadata" poster={details.demoPoster || undefined}>
                <source src={details.demoVideo} />
                Your browser does not support video playback.
              </video>
            </section>
          )}

          <section className="modal-section">
            <div className="modal-section-label">WHAT THIS FLOW HANDLES</div>
            <ul className="modal-feature-grid">
              {details.features.map((feature, index) => (
                <li key={feature}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {feature}
                </li>
              ))}
            </ul>
          </section>

          {details.supportedPlatforms.length > 0 && (
            <section className="modal-section">
              <div className="modal-section-label">AVAILABLE FOR</div>
              <div className="modal-supported-apps">
                {details.supportedPlatforms.map((name) => <span key={name}>{name}</span>)}
              </div>
              <p className="platform-setup-copy">
                Tell us which app you need during setup so the workflow can be configured correctly.
              </p>
            </section>
          )}

          <section className="modal-section">
            <div className="modal-section-label">HOW YOUR PURCHASE WORKS</div>
            <div className="purchase-steps">
              <div><span>01</span><p>Choose the automation flow that matches your operation.</p></div>
              <div><span>02</span><p>We confirm your inputs and configure the reusable workflow.</p></div>
              <div><span>03</span><p>Run the delivered flow as many times as you need.</p></div>
            </div>
          </section>

          <section className="modal-delivery-note">
            <span>WHAT YOU RECEIVE</span>
            <p>{details.delivery}. The delivered automation is reusable and can be run repeatedly after handoff.</p>
          </section>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary modal-browse-btn" onClick={onClose}>
            Keep browsing
          </button>
          <button
            type="button"
            className={`btn-secondary modal-add-btn ${isInCart ? 'in-cart' : ''}`}
            onClick={handleAddToCart}
          >
            {isJustAdded
              ? 'Added ✓'
              : isInCart
              ? 'In cart ✓'
              : '+ Add to cart'}
          </button>
          <button
            type="button"
            className="btn-primary modal-direct-btn"
            onClick={handleDirectCheckout}
          >
            Direct checkout · ${product.price.toLocaleString('en-US')} →
          </button>
        </div>
      </div>
    </div>
  );
}
