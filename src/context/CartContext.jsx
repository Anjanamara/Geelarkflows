import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { syncCartState, trackCartAddition } from '../analytics';

const CartContext = createContext(null);
const CART_STORAGE_KEY = 'geelark_cart_items';

const readSavedCart = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    const seen = new Set();
    return saved
      .filter((item) => item?.id && !seen.has(item.id) && seen.add(item.id))
      .map((item) => ({ ...item, quantity: 1 }));
  } catch {
    return [];
  }
};

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readSavedCart);
  const [lastAddedId, setLastAddedId] = useState(null);
  const addedTimerRef = useRef(null);
  const cartRef = useRef(cart);

  useEffect(() => {
    cartRef.current = cart;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // The cart still works in memory when storage is unavailable.
    }
    syncCartState(cart);
  }, [cart]);

  useEffect(() => () => {
    clearTimeout(addedTimerRef.current);
  }, []);

  const addToCart = useCallback((product) => {
    if (!product?.id || cartRef.current.some((item) => item.id === product.id)) return;
    const nextCart = [...cartRef.current, { ...product, quantity: 1 }];
    cartRef.current = nextCart;
    setCart(nextCart);
    trackCartAddition(product.id);
    setLastAddedId(product.id);
    clearTimeout(addedTimerRef.current);
    addedTimerRef.current = setTimeout(() => setLastAddedId(null), 1800);
  }, []);

  const removeFromCart = useCallback((id) => {
    setCart((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const navigateTo = useCallback((path) => {
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentPath !== path) {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.scrollTo(0, 0);
    }
  }, []);

  const openCart = useCallback(() => navigateTo('/cart'), [navigateTo]);
  const openCheckout = useCallback(() => navigateTo('/checkout'), [navigateTo]);
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price, 0), [cart]);
  const cartItemCount = cart.length;

  const value = useMemo(() => ({
    cart,
    lastAddedId,
    addToCart,
    removeFromCart,
    clearCart,
    openCart,
    openCheckout,
    navigateTo,
    cartTotal,
    cartItemCount,
  }), [
    cart,
    lastAddedId,
    addToCart,
    removeFromCart,
    clearCart,
    openCart,
    openCheckout,
    navigateTo,
    cartTotal,
    cartItemCount,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
