import { useState } from 'react';
import { useCart } from '../context/CartContext';
import './CartDrawer.css';

export default function CartDrawer() {
  const { cart, isCartOpen, closeCart, removeFromCart, updateQuantity, cartTotal } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutComplete, setCheckoutComplete] = useState(false);

  if (!isCartOpen) return null;

  const handleCheckoutSubmit = () => {
    setCheckingOut(true);
    setTimeout(() => {
      setCheckingOut(false);
      setCheckoutComplete(true);
    }, 2000);
  };

  return (
    <div className={`cart-drawer-overlay ${isCartOpen ? 'open' : ''}`} onClick={closeCart}>
      <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cart-header">
          <h2 className="cart-title">
            Your Cart
            <span className="cart-count-badge">{cart.length}</span>
          </h2>
          <button className="close-btn" onClick={closeCart}>✕</button>
        </div>

        {/* Body */}
        <div className="cart-body">
          {checkoutComplete ? (
            <div className="empty-cart">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <h3>Payment Authorized</h3>
              <p>Your digital assets and workflows are being provisioned.</p>
              <button className="checkout-btn" onClick={() => { setCheckoutComplete(false); closeCart(); }}>
                Return to Marketplace
              </button>
            </div>
          ) : cart.length === 0 ? (
            <div className="empty-cart">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              <h3>Your cart is empty</h3>
              <p>Browse the marketplace to find high-quality assets.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="cart-item">
                <div className="item-visual">{item.platform.substring(0,2).toUpperCase()}</div>
                <div className="item-details">
                  <span className="item-title">{item.title}</span>
                  <span className="item-type">{item.type} • {item.platform}</span>
                  <div className="item-price-row">
                    <span className="item-price">${(item.price * item.quantity).toFixed(2)}</span>
                    <button className="remove-btn" onClick={() => removeFromCart(item.id)}>Remove</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {!checkoutComplete && cart.length > 0 && (
          <div className="cart-footer">
            <div className="crypto-indicators">
              <span className="crypto-badge">
                <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
                BTC
              </span>
              <span className="crypto-badge">
                <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 4.1L18.4 18H5.6L12 6.1z"/></svg>
                ETH
              </span>
              <span className="crypto-badge">
                <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2c5.52 2 10 6.48 10 12s-4.48 10-10 10S2 19.52 2 14c0-5.52 4.48-10 10-12zm0 2.22A8.006 8.006 0 004.22 12 8.006 8.006 0 0012 19.78 8.006 8.006 0 0019.78 12 8.006 8.006 0 0012 4.22z"/></svg>
                USDT
              </span>
            </div>
            <div className="summary-row total">
              <span>Total Secured Amount</span>
              <span className="price-val">${cartTotal.toFixed(2)}</span>
            </div>
            <button className="checkout-btn" onClick={handleCheckoutSubmit} disabled={checkingOut}>
              {checkingOut ? 'Processing...' : 'Authorize Purchase'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
