import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [lastAddedId, setLastAddedId] = useState(null);

  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setLastAddedId(product.id);
    setTimeout(() => setLastAddedId(null), 500);
  }, []);

  const removeFromCart = useCallback((id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id, quantity) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);
  const toggleCart = useCallback(() => setIsCartOpen((prev) => !prev), []);
  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const cartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const value = useMemo(
    () => ({
      cart,
      isCartOpen,
      lastAddedId,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      toggleCart,
      openCart,
      closeCart,
      cartTotal,
      cartItemCount,
    }),
    [cart, isCartOpen, lastAddedId, addToCart, removeFromCart, updateQuantity, clearCart, toggleCart, openCart, closeCart, cartTotal, cartItemCount]
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
