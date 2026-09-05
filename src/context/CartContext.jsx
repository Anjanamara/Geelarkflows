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
  const [isCartPulsing, setIsCartPulsing] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeFoldAnimation, setActiveFoldAnimation] = useState(null);
  const pulseTimerRef = useRef(null);
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
    clearTimeout(pulseTimerRef.current);
    clearTimeout(addedTimerRef.current);
  }, []);

  const showToast = useCallback((toastData) => setToast(toastData), []);
  const hideToast = useCallback(() => setToast(null), []);

  const triggerCartPulse = useCallback(() => {
    setIsCartPulsing(true);
    clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setIsCartPulsing(false), 360);
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
    triggerCartPulse();
  }, [triggerCartPulse]);

  const addToCartWithAnimation = useCallback((product, sourceElement) => {
    if (cart.some((item) => item.id === product.id) || activeFoldAnimation) return;

    // The cart is updated immediately so the badge, storage, and checkout
    // data are correct right away; the fold animation below is decorative
    // and must never gate real cart state.
    addToCart(product);

    const targetElement = document.querySelector('#floating-cart-btn');
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    if (!sourceElement || !targetElement || prefersReducedMotion) {
      showToast({
        type: 'add',
        product: { title: product.title, price: product.price },
        id: Date.now(),
      });
      return;
    }

    const sourceCard = sourceElement.closest('.flow-card,.modal-content') || sourceElement;
    setActiveFoldAnimation({
      id: `${product.id}-${Date.now()}`,
      product,
      sourceRect: sourceCard.getBoundingClientRect(),
      targetRect: targetElement.getBoundingClientRect(),
    });
  }, [activeFoldAnimation, addToCart, cart, showToast]);

  const handleFoldArrival = useCallback(() => {
    if (!activeFoldAnimation) return;
    const { product } = activeFoldAnimation;
    showToast({
      type: 'add',
      product: { title: product.title, price: product.price },
      id: Date.now(),
    });
  }, [activeFoldAnimation, showToast]);

  const handleFoldComplete = useCallback(() => {
    setActiveFoldAnimation(null);
  }, []);

  const removeFromCart = useCallback((id) => {
    setCart((current) => {
      const item = current.find((entry) => entry.id === id);
      if (item) showToast({ type: 'remove', product: { title: item.title }, id: Date.now() });
      return current.filter((entry) => entry.id !== id);
    });
    triggerCartPulse();
  }, [showToast, triggerCartPulse]);

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
    isCartPulsing,
    toast,
    activeFoldAnimation,
    showToast,
    hideToast,
    addToCart,
    addToCartWithAnimation,
    handleFoldArrival,
    handleFoldComplete,
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
    isCartPulsing,
    toast,
    activeFoldAnimation,
    showToast,
    hideToast,
    addToCart,
    addToCartWithAnimation,
    handleFoldArrival,
    handleFoldComplete,
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
