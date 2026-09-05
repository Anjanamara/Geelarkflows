import { useCart } from '../context/CartContext';
import './FloatingCart.css';

export default function FloatingCart() {
  const { cartItemCount, cartTotal, openCart, isCartPulsing } = useCart();

  return (
    <div className="floating-cart-wrapper">
      <button
        id="floating-cart-btn"
        className={`floating-cart-pill ${isCartPulsing ? 'cart-impact-active' : ''}`}
        onClick={openCart}
        aria-label={`View cart (${cartItemCount} items, $${cartTotal.toFixed(2)})`}
      >
        <svg className="floating-cart-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.5 4.5h2l1.7 9.1a2 2 0 0 0 2 1.6h7.5a2 2 0 0 0 1.9-1.4L20 8H6.2M9 19.2h.01M17 19.2h.01" />
        </svg>
        <span className="floating-cart-label">Cart</span>
        {cartItemCount > 0 && (
          <span className={`floating-cart-badge ${isCartPulsing ? 'badge-pop' : ''}`}>{cartItemCount}</span>
        )}
        {cartItemCount > 0 && <span className="floating-cart-total">${cartTotal.toLocaleString('en-US')}</span>}
      </button>
    </div>
  );
}
