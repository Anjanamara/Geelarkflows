import React, { useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';
import { products } from '../data/products';
import CheckoutProgress from '../components/CheckoutProgress';
import './CartPage.css';

export default function CartPage({ navigate }) {
  const { cart, removeFromCart, clearCart, addToCart, cartTotal, cartItemCount } = useCart();
  const [addedItemIds, setAddedItemIds] = useState([]);

  // Compute recommendations from catalog (excluding items already in cart)
  const suggestedProducts = useMemo(() => {
    const cartIds = new Set(cart.map((item) => item.id));
    return products
      .filter((p) => !cartIds.has(p.id))
      .slice(0, 3);
  }, [cart]);

  const handleAddSuggestion = (product) => {
    addToCart(product);
    setAddedItemIds((prev) => [...prev, product.id]);
    setTimeout(() => {
      setAddedItemIds((prev) => prev.filter((id) => id !== product.id));
    }, 1500);
  };

  const handleProceedToCheckout = () => {
    if (cart.length === 0) return;
    if (typeof navigate === 'function') {
      navigate('/checkout');
    } else {
      window.history.pushState({}, '', '/checkout');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleContinueShopping = () => {
    if (typeof navigate === 'function') {
      navigate('/');
    } else {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    setTimeout(() => {
      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const isCartEmpty = cart.length === 0;

  return (
    <div className="cart-page-shell">
      {/* Site Header Bar */}
      <header className="cart-page-header">
        <div className="cart-header-inner">
          <a
            href="/"
            className="cart-brand-lockup"
            onClick={(e) => {
              e.preventDefault();
              handleContinueShopping();
            }}
          >
            <span className="brand-mark" aria-hidden="true">
              <img src="/logo-mark.svg" alt="" width="42" height="42" />
            </span>
            <span className="brand-text">
              <strong>GeeLark</strong>
              <small>Flows</small>
            </span>
          </a>

          <button
            type="button"
            className="btn-continue-shopping"
            onClick={handleContinueShopping}
          >
            ← Continue shopping
          </button>
        </div>
      </header>

      <main className="cart-page-main">
        {/* Step Progress Indicator */}
        <CheckoutProgress currentStep="cart" />

        <div className="cart-page-container">
          {isCartEmpty ? (
            /* Empty Cart View */
            <div className="empty-cart-card">
              <div className="empty-cart-icon-circle">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
              </div>
              <h2 className="empty-cart-title">Your cart is empty</h2>
              <p className="empty-cart-subtitle">
                Select reusable automation workflows from our catalog to build your setup.
              </p>
              <button
                type="button"
                className="btn-browse-catalog"
                onClick={handleContinueShopping}
              >
                Browse workflow catalog <span>↘</span>
              </button>
            </div>
          ) : (
            /* Two-Column Cart Layout */
            <div className="cart-layout-grid">
              {/* Left Column: What am I buying? */}
              <section className="cart-items-column" aria-label="Cart Items">
                <div className="cart-items-header">
                  <div className="cart-title-wrap">
                    <h1 className="cart-page-title">Your Cart</h1>
                    <span className="cart-items-count-badge">
                      {cartItemCount} {cartItemCount === 1 ? 'workflow' : 'workflows'}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn-clear-cart-text"
                    onClick={clearCart}
                  >
                    Clear cart
                  </button>
                </div>

                {/* Workflow Cards List */}
                <div className="cart-workflow-list">
                  {cart.map((item) => {
                    const itemSubtotal = item.price;
                    const platformName = item.platform || 'GeeLark';

                    return (
                      <article key={item.id} className="cart-workflow-card">
                        <div className="cart-card-main">
                          <div className="workflow-avatar">
                            {platformName.slice(0, 2).toUpperCase()}
                          </div>

                          <div className="workflow-details">
                            <div className="workflow-headline">
                              <h2 className="workflow-name">{item.title}</h2>
                              <span className="workflow-price font-mono">
                                ${itemSubtotal.toFixed(2)}
                              </span>
                            </div>

                            <p className="workflow-desc">
                              {item.details?.description || 'Reusable automation flow with unlimited runs.'}
                            </p>

                            <div className="workflow-meta-row">
                              <span className="workflow-platform-tag">
                                {platformName}
                              </span>

                              <div className="workflow-actions-right">
                                <button
                                  type="button"
                                  className="btn-remove-item"
                                  onClick={() => removeFromCart(item.id)}
                                  aria-label={`Remove ${item.title} from cart`}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Frequently Bought Together / Recommendations */}
                {suggestedProducts.length > 0 && (
                  <div className="cart-recommendations-panel">
                    <div className="rec-header">
                      <h3 className="rec-title">Frequently bought together</h3>
                      <span className="rec-subtitle">Popular pairings for your workflow setup</span>
                    </div>

                    <div className="rec-grid">
                      {suggestedProducts.map((p) => {
                        const isAdded = addedItemIds.includes(p.id);
                        return (
                          <div key={p.id} className="rec-card">
                            <div className="rec-info">
                              <span className="rec-name">{p.title}</span>
                              <span className="rec-price font-mono">${p.price}.00</span>
                            </div>

                            <button
                              type="button"
                              className={`btn-rec-add ${isAdded ? 'added' : ''}`}
                              onClick={() => handleAddSuggestion(p)}
                              disabled={isAdded}
                            >
                              {isAdded ? '✓ Added' : '+ Add to cart'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* Right Column: Sticky Order Summary */}
              <aside className="cart-summary-column" aria-label="Order Summary">
                <div className="sticky-summary-box">
                  <h2 className="summary-title">Order Summary</h2>

                  <div className="summary-rows">
                    <div className="summary-line">
                      <span className="line-label">
                        Workflows ({cartItemCount} {cartItemCount === 1 ? 'item' : 'items'})
                      </span>
                      <span className="line-value font-mono">
                        ${cartTotal.toFixed(2)}
                      </span>
                    </div>

                    <div className="summary-line total-line">
                      <span className="total-label">Subtotal</span>
                      <span className="total-value font-mono">
                        ${cartTotal.toFixed(2)} USD
                      </span>
                    </div>
                  </div>

                  {/* Primary CTA */}
                  <button
                    type="button"
                    className="btn-proceed-checkout"
                    onClick={handleProceedToCheckout}
                  >
                    Proceed to Checkout →
                  </button>

                  {/* Fulfillment Reassurance & Trust */}
                  <div className="cart-trust-reassurance">
                    <div className="trust-item">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span>Secure USDT checkout</span>
                    </div>

                    <div className="trust-item">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>Delivery coordinated within 24 hours after payment confirmation</span>
                    </div>
                  </div>

                  {/* Subtle Support Contact & Legal Links */}
                  <div className="cart-support-box">
                    <span>Need help? </span>
                    <a href="mailto:support@geelarkflows.com" className="support-mail font-mono">
                      support@geelarkflows.com
                    </a>
                  </div>

                  <div className="cart-legal-links">
                    <a href="/terms" onClick={(e) => { e.preventDefault(); if (typeof navigate === 'function') navigate('/terms'); }}>Terms</a>
                    <span>·</span>
                    <a href="/privacy" onClick={(e) => { e.preventDefault(); if (typeof navigate === 'function') navigate('/privacy'); }}>Privacy</a>
                    <span>·</span>
                    <a href="/refund-policy" onClick={(e) => { e.preventDefault(); if (typeof navigate === 'function') navigate('/refund-policy'); }}>Refunds</a>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Fixed Bottom Action Bar */}
      {!isCartEmpty && (
        <div className="cart-mobile-bar">
          <div className="mobile-bar-info">
            <span className="mobile-bar-label">Total Subtotal</span>
            <span className="mobile-bar-val font-mono">${cartTotal.toFixed(2)} USD</span>
          </div>
          <button
            type="button"
            className="mobile-btn-checkout"
            onClick={handleProceedToCheckout}
          >
            Proceed to Checkout →
          </button>
        </div>
      )}
    </div>
  );
}
