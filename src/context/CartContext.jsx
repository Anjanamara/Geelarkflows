import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [lastAddedId, setLastAddedId] = useState(null);
  const [isCartPulsing, setIsCartPulsing] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeFoldAnimation, setActiveFoldAnimation] = useState(null);
  const [animatingProductIds, setAnimatingProductIds] = useState(new Set());

  const pulseTimerRef = useRef(null);

  const showToast = useCallback((toastData) => {
    setToast(toastData);
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const triggerCartPulse = useCallback(() => {
    setIsCartPulsing(true);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => {
      setIsCartPulsing(false);
    }, 550);
  }, []);

  const addToCartDirect = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: (item.quantity || 1) + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setLastAddedId(product.id);
    setTimeout(() => setLastAddedId(null), 2500);
  }, []);

  // Strict One-Time Add with Fold & Deliver Animation
  const addToCartWithAnimation = useCallback((product, sourceElement) => {
    // 1. Strict Guard: If product is already in cart, NEVER animate
    const isAlreadyInCart = cart.some((item) => item.id === product.id);
    if (isAlreadyInCart) {
      return;
    }

    // 2. Strict Guard: If currently animating, ignore rapid duplicate clicks
    if (animatingProductIds.has(product.id) || activeFoldAnimation) {
      return;
    }

    if (!sourceElement || typeof window === 'undefined') {
      addToCartDirect(product);
      triggerCartPulse();
      showToast({
        type: 'add',
        product: { title: product.title, price: product.price },
        id: Date.now(),
      });
      return;
    }

    const targetElement = document.querySelector('#floating-cart-btn') || document.querySelector('.nav-cart');
    if (!targetElement) {
      addToCartDirect(product);
      triggerCartPulse();
      showToast({
        type: 'add',
        product: { title: product.title, price: product.price },
        id: Date.now(),
      });
      return;
    }

    const isReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (isReducedMotion) {
      addToCartDirect(product);
      triggerCartPulse();
      showToast({
        type: 'add',
        product: { title: product.title, price: product.price },
        id: Date.now(),
      });
      return;
    }

    // Lock product from duplicate animation triggers
    setAnimatingProductIds((prev) => new Set(prev).add(product.id));

    // Tactile button response
    sourceElement.style.transition = 'transform 0.15s ease';
    sourceElement.style.transform = 'scale(0.97)';
    setTimeout(() => {
      sourceElement.style.transform = 'scale(1)';
    }, 150);

    const sourceCard = sourceElement.closest('.flow-card') || sourceElement;
    const sourceRect = sourceCard.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    // Trigger Fold & Deliver Animation
    setActiveFoldAnimation({
      product,
      sourceRect,
      targetRect,
      id: Date.now(),
    });
  }, [cart, animatingProductIds, activeFoldAnimation, addToCartDirect, triggerCartPulse, showToast]);

  const handleFoldArrival = useCallback(() => {
    if (!activeFoldAnimation) return;
    const { product } = activeFoldAnimation;
    // Execute real cart state update (Single Source of Truth)
    addToCartDirect(product);
    // Trigger floating cart impact response
    triggerCartPulse();
  }, [activeFoldAnimation, addToCartDirect, triggerCartPulse]);

  const handleFoldComplete = useCallback(() => {
    if (!activeFoldAnimation) return;
    const { product } = activeFoldAnimation;

    // Release animation lock
    setAnimatingProductIds((prev) => {
      const next = new Set(prev);
      next.delete(product.id);
      return next;
    });

    // Clear active animation
    setActiveFoldAnimation(null);

    // Show toast after cart delivery is complete
    showToast({
      type: 'add',
      product: { title: product.title, price: product.price },
      id: Date.now(),
    });
  }, [activeFoldAnimation, showToast]);

  const removeFromCart = useCallback((id) => {
    setCart((prev) => {
      const itemToRemove = prev.find((item) => item.id === id);
      if (itemToRemove) {
        showToast({
          type: 'remove',
          product: { title: itemToRemove.title },
          id: Date.now(),
        });
      }
      return prev.filter((item) => item.id !== id);
    });
    triggerCartPulse();
  }, [showToast, triggerCartPulse]);

  const updateQuantity = useCallback((id, quantity) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => setCart([]), []);
  const toggleCart = useCallback(() => setIsCartOpen((prev) => !prev), []);
  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0),
    [cart]
  );

  const cartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + (item.quantity || 1), 0),
    [cart]
  );

  const value = useMemo(
    () => ({
      cart,
      isCartOpen,
      lastAddedId,
      isCartPulsing,
      toast,
      activeFoldAnimation,
      showToast,
      hideToast,
      addToCart: addToCartDirect,
      addToCartWithAnimation,
      handleFoldArrival,
      handleFoldComplete,
      removeFromCart,
      updateQuantity,
      clearCart,
      toggleCart,
      openCart,
      closeCart,
      cartTotal,
      cartItemCount,
    }),
    [
      cart,
      isCartOpen,
      lastAddedId,
      isCartPulsing,
      toast,
      activeFoldAnimation,
      showToast,
      hideToast,
      addToCartDirect,
      addToCartWithAnimation,
      handleFoldArrival,
      handleFoldComplete,
      removeFromCart,
      updateQuantity,
      clearCart,
      toggleCart,
      openCart,
      closeCart,
      cartTotal,
      cartItemCount,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
