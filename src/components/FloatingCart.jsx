import { useState } from 'react';
import { useCart } from '../context/CartContext';
import './FloatingCart.css';

export default function FloatingCart() {
  const { cartItemCount, cartTotal, openCart, isCartPulsing } = useCart();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="floating-cart-wrapper">
      <button
        id="floating-cart-btn"
        className={`floating-cart-pill ${isCartPulsing ? 'cart-impact-active' : ''} ${isHovered ? 'hovered' : ''}`}
        onClick={openCart}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={`View cart (${cartItemCount} items, $${cartTotal.toFixed(2)})`}
      >
        {/* Radial impact ring that animates on flow arrival */}
        <span className="cart-impact-ring" />
        
        <div className="floating-cart-inner">
          <span className="floating-cart-icon">🛒</span>
          <span className="floating-cart-label">Cart</span>
          <span className={`floating-cart-badge ${isCartPulsing ? 'badge-pop' : ''}`}>
            {cartItemCount}
          </span>
          {cartItemCount > 0 && (
            <span className="floating-cart-total">
              ${cartTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
