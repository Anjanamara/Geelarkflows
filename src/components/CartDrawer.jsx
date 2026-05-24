import { useState } from 'react';
import { useCart } from '../context/CartContext';
import './CartDrawer.css';

export default function CartDrawer() {
  const {
    cart,
    isCartOpen,
    closeCart,
    removeFromCart,
    updateQuantity,
    cartTotal,
  } = useCart();

  const [cryptoSelected, setCryptoSelected] = useState('usdt'); // btc, eth, usdt
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutComplete, setCheckoutComplete] = useState(false);

  if (!isCartOpen) return null;

  const handleCheckoutSubmit = () => {
    setCheckingOut(true);
    setTimeout(() => {
      setCheckingOut(false);
      setCheckoutComplete(true);
    }, 2500);
  };

  const getCryptoAddress = () => {
    switch (cryptoSelected) {
      case 'btc':
        return 'bc1qnx3s3m2v3y4rt7zpx9q2lm72stxl0c8p2hux7k';
      case 'eth':
        return '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
      case 'usdt':
      default:
        return 'TY3SdmV4RT7zPx9q2lm72stXL0c8P2hUx7K';
    }
  };

  return (
    <div className="cart-drawer-overlay" onClick={closeCart}>
      <div className="cart-drawer-content" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="header-title-group">
            <h3>SECURE CHECKOUT</h3>
            <span className="subtitle mono">SECTOR_CART_V1.0</span>
          </div>
          <button className="drawer-close-btn" onClick={closeCart} aria-label="Close Cart">
            ✕
          </button>
        </div>

        {checkoutComplete ? (
          /* Checkout Success View */
          <div className="checkout-success-view">
            <div className="success-icon-container">
              <span className="success-icon animate-pulse-glow">✓</span>
            </div>
            <h4 className="success-title">Transaction Initialized</h4>
            <p className="success-description">
              Your cryptographic lease has been approved. The system is generating download credentials and account cookies.
            </p>
            <div className="digital-delivery-box active">
              <span className="pulse-dot green animate-pulse-glow" />
              <div className="delivery-info">
                <span className="title font-bold">INSTANT DIGITAL DELIVERY</span>
                <span className="desc">Direct API download links &amp; credentials dispatched.</span>
              </div>
            </div>
            <button
              className="success-close-btn"
              onClick={() => {
                setCheckoutComplete(false);
                closeCart();
              }}
            >
              Return to Vault Marketplace
            </button>
          </div>
        ) : cart.length === 0 ? (
          /* Empty Cart View */
          <div className="empty-cart-view">
            <span className="empty-cart-icon">🛒</span>
            <h4>Your Shopping Cart is Empty</h4>
            <p>Select automation flows or social accounts from the vault catalog to queue them for checkout.</p>
            <button className="empty-cart-close-btn" onClick={closeCart}>
              Browse Catalog Assets
            </button>
          </div>
        ) : (
          /* Cart & Checkout Panel */
          <>
            {/* Delivery Badge */}
            <div className="digital-delivery-box">
              <span className="pulse-dot green animate-pulse-glow" />
              <div className="delivery-info">
                <span className="title font-bold">INSTANT DIGITAL DELIVERY</span>
                <span className="desc">Templates and accounts are delivered immediately post-payment.</span>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="cart-items-section">
              <span className="section-title mono">SECURED_ITEMS ({cart.length})</span>
              <div className="cart-items-list">
                {cart.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div className="item-details">
                      <span className="item-title">{item.title}</span>
                      <span className="item-meta mono">
                        {item.type === 'flow' ? '⚡ GeeLark Flow' : `◎ Aged ${item.platform}`}
                      </span>
                    </div>

                    <div className="item-controls-row">
                      <div className="quantity-controls">
                        <button
                          className="quantity-btn decrease"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          -
                        </button>
                        <span className="quantity-val mono">{item.quantity}</span>
                        <button
                          className="quantity-btn increase"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>

                      <span className="item-price mono">${(item.price * item.quantity).toFixed(2)}</span>

                      <button
                        className="remove-item-btn"
                        onClick={() => removeFromCart(item.id)}
                        aria-label="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cryptographic Payment Section */}
            <div className="payment-method-section">
              <span className="section-title mono">CRYPTO_GATEWAY</span>

              <div className="crypto-grid">
                <button
                  className={`crypto-pill btc ${cryptoSelected === 'btc' ? 'active' : ''}`}
                  onClick={() => setCryptoSelected('btc')}
                >
                  <span className="coin-logo">₿</span>
                  <span className="coin-name">BTC</span>
                </button>
                <button
                  className={`crypto-pill eth ${cryptoSelected === 'eth' ? 'active' : ''}`}
                  onClick={() => setCryptoSelected('eth')}
                >
                  <span className="coin-logo">Ξ</span>
                  <span className="coin-name">ETH</span>
                </button>
                <button
                  className={`crypto-pill usdt ${cryptoSelected === 'usdt' ? 'active' : ''}`}
                  onClick={() => setCryptoSelected('usdt')}
                >
                  <span className="coin-logo">₮</span>
                  <span className="coin-name">USDT</span>
                </button>
              </div>

              <div className="crypto-details-panel">
                <div className="details-header">
                  <span className="currency-label uppercase">{cryptoSelected} Address</span>
                  <span className="network-badge mono">ERC-20 / Native</span>
                </div>
                <div className="address-box mono">
                  <span className="address-text">{getCryptoAddress()}</span>
                  <button
                    className="copy-address-btn"
                    onClick={() => navigator.clipboard.writeText(getCryptoAddress())}
                    title="Copy Address"
                  >
                    📋
                  </button>
                </div>
                <span className="checkout-hint">Send exact total equivalent. Digital assets dispatch on 1 confirmation.</span>
              </div>
            </div>

            {/* Cart Drawer Footer */}
            <div className="drawer-footer">
              <div className="total-row">
                <span className="total-label">TOTAL SECURED AMOUNT</span>
                <span className="total-value mono">${cartTotal.toFixed(2)}</span>
              </div>

              <button
                className={`proceed-checkout-btn ${checkingOut ? 'loading' : ''}`}
                onClick={handleCheckoutSubmit}
                disabled={checkingOut}
              >
                {checkingOut ? (
                  <>
                    <span className="loading-spinner" />
                    <span>Processing Payment Verification...</span>
                  </>
                ) : (
                  <span>AUTHORIZE CRYPTO PURCHASE</span>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
