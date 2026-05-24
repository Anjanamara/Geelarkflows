import { useCart } from '../context/CartContext';
import './CartButton.css';

export default function CartButton() {
  const { cartItemCount, openCart } = useCart();

  if (cartItemCount === 0) return null;

  return (
    <button
      className="floating-cart-fab animate-badge-bounce"
      onClick={openCart}
      aria-label={`View secure cart (${cartItemCount} items)`}
    >
      <span className="fab-icon">🛒</span>
      <span className="fab-badge mono">{cartItemCount}</span>
    </button>
  );
}
