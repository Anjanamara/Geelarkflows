import { useEffect } from 'react';
import { useCart } from '../context/CartContext';
import './CartToast.css';

export default function CartToast() {
  const { toast, hideToast, openCart } = useCart();

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => {
      hideToast();
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast, hideToast]);

  if (!toast) return null;

  return (
    <div className={`cart-toast-banner ${toast.type === 'remove' ? 'toast-remove' : 'toast-add'}`} role="status">
      <div className="toast-icon-wrap">
        {toast.type === 'remove' ? (
          <span className="toast-glyph-remove">✕</span>
        ) : (
          <span className="toast-glyph-add">✓</span>
        )}
      </div>

      <div className="toast-body">
        <div className="toast-eyebrow">
          {toast.type === 'remove' ? 'Flow removed from cart' : 'Flow added to cart'}
        </div>
        <div className="toast-title">{toast.product?.title || 'Workflow'}</div>
        {toast.product?.price != null && toast.type !== 'remove' && (
          <div className="toast-price">${toast.product.price.toLocaleString('en-US')} USD</div>
        )}
      </div>

      <div className="toast-actions">
        {toast.type !== 'remove' && (
          <button
            type="button"
            className="toast-view-cart-btn"
            onClick={() => {
              hideToast();
              openCart();
            }}
          >
            View cart
          </button>
        )}
        <button
          type="button"
          className="toast-close-btn"
          onClick={hideToast}
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
