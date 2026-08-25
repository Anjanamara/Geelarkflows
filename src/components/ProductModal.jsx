import { useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { platforms } from '../data/products';
import './ProductModal.css';

export default function ProductModal({ product, onClose }) {
  const { cart, addToCart, addToCartWithAnimation, lastAddedId, openCart, openCheckout } = useCart();
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!product) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll('button:not(:disabled), a[href], video[controls]');
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [product, onClose]);

  if (!product) return null;

  const platform = platforms.find((item) => item.id === product.platform);
  const isInCart = cart.some((item) => item.id === product.id);
  const isJustAdded = lastAddedId === product.id;
  const { details } = product;

  const handleAddToCart = (event) => {
    if (isInCart) {
      onClose();
      openCart();
      return;
    }
    addToCartWithAnimation(product, event.currentTarget);
  };

  // 2. Direct Checkout: Instantly puts flow in cart, closes details, and opens checkout page
  const handleDirectCheckout = () => {
    if (!isInCart) {
      addToCart(product);
    }
    onClose();
    openCheckout();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="modal-content"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="flow-modal-title"
        style={{ '--modal-accent': platform?.color || 'var(--accent-lime)' }}
      >
        <button ref={closeButtonRef} className="modal-close" onClick={onClose} aria-label="Close flow details">×</button>

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
            <span className="modal-price-sub">One purchase · Configured delivery · Unlimited runs</span>
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
