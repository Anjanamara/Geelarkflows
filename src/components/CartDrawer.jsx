import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { products } from '../data/products';
import { USDT_NETWORKS, USDT_NETWORKS_LIST, getNetworkConfig, DEFAULT_NETWORK_ID } from '../data/paymentConfig';
import './CartDrawer.css';

const ACTIVE_PAYMENT_STORAGE_KEY = 'geelark_active_payment';

export default function CartDrawer() {
  const { cart, isCartOpen, closeCart, removeFromCart, addToCart, cartTotal, clearCart } = useCart();
  
  // Explicit State Machine: 'cart' | 'awaiting_payment' | 'verifying' | 'completed'
  const [checkoutStep, setCheckoutStep] = useState('cart');
  const [activeOrder, setActiveOrder] = useState(null);

  // Delivery / Setup Selection: 'download_package' | 'geelark_setup'
  const [deliveryMethod, setDeliveryMethod] = useState('download_package');

  // Pre-payment configuration state: Centralized USDT multi-network ID ('trc20' | 'erc20' | 'bep20' | 'sol')
  const [selectedNetwork, setSelectedNetwork] = useState(DEFAULT_NETWORK_ID);
  const [customerEmail, setCustomerEmail] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  
  // UI interaction states
  const [copied, setCopied] = useState(false);
  const [addedItemIds, setAddedItemIds] = useState([]);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const pollingTimerRef = useRef(null);

  // Authoritative Client-Side Mirror of Pricing Rules
  const workflowSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
  }, [cart]);

  const setupFee = useMemo(() => {
    if (deliveryMethod !== 'geelark_setup') return 0;
    return workflowSubtotal >= 300 ? 0 : 50;
  }, [deliveryMethod, workflowSubtotal]);

  const calculatedFinalTotal = useMemo(() => {
    return workflowSubtotal + setupFee;
  }, [workflowSubtotal, setupFee]);

  // Restore existing active payment session on mount / refresh
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_PAYMENT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.orderId || parsed.paymentId)) {
          setActiveOrder(parsed);
          if (['confirmed', 'finished', 'paid'].includes((parsed.status || '').toLowerCase())) {
            setCheckoutStep('completed');
          } else if (parsed.status === 'verifying') {
            setCheckoutStep('verifying');
          } else {
            setCheckoutStep('awaiting_payment');
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse active payment from localStorage', e);
    }
  }, []);

  // Backend Status Polling: Queries GET /api/checkout/status/:id
  const checkBackendPaymentStatus = useCallback(async (order) => {
    if (!order || (!order.orderId && !order.paymentId)) return;

    try {
      const checkId = order.orderId || order.paymentId;
      const response = await fetch(`/api/checkout/status/${checkId}`);
      if (!response.ok) return;

      const resData = await response.json();
      if (resData.success && resData.data) {
        const { isConfirmed, status, txHash, fullNetworkLabel, currency, deliveryMethod: backendDelivery, workflowSubtotal: backendSubtotal, setupFee: backendSetup, totalUsd: backendTotal, fulfillmentStatus } = resData.data;

        if (isConfirmed || ['confirmed', 'finished', 'paid'].includes((status || '').toLowerCase())) {
          // Real backend confirmation verified
          const confirmedOrder = {
            ...order,
            status: 'confirmed',
            txHash: txHash || order.txHash || null,
            fullNetworkLabel: fullNetworkLabel || order.fullNetworkLabel || currency || order.currency,
            deliveryMethod: backendDelivery || order.deliveryMethod || 'download_package',
            workflowSubtotal: backendSubtotal || order.workflowSubtotal || order.totalUsd,
            setupFee: backendSetup ?? order.setupFee ?? 0,
            totalUsd: backendTotal || order.totalUsd,
            fulfillmentStatus: fulfillmentStatus || order.fulfillmentStatus || 'fulfillment_pending',
          };
          setActiveOrder(confirmedOrder);
          try {
            localStorage.setItem(ACTIVE_PAYMENT_STORAGE_KEY, JSON.stringify(confirmedOrder));
          } catch (e) {}
          setCheckoutStep('completed');
        }
      }
    } catch (err) {
      console.warn('Payment status polling check failed:', err.message);
    }
  }, []);

  // Polling loop for active payment & verification states
  useEffect(() => {
    if (!activeOrder || (checkoutStep !== 'awaiting_payment' && checkoutStep !== 'verifying')) {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      return;
    }

    // Immediate check
    checkBackendPaymentStatus(activeOrder);

    // Periodic poll every 3.5 seconds
    pollingTimerRef.current = setInterval(() => {
      setPollCount((prev) => prev + 1);
      checkBackendPaymentStatus(activeOrder);
    }, 3500);

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [activeOrder, checkoutStep, checkBackendPaymentStatus]);

  // Compute Frequently Bought Together recommendations (excluding items already in cart)
  const suggestedProducts = useMemo(() => {
    const cartIds = new Set(cart.map((item) => item.id));
    return products
      .filter((p) => !cartIds.has(p.id))
      .slice(0, 3);
  }, [cart]);

  const activeNetworkConfig = useMemo(() => {
    return getNetworkConfig(selectedNetwork) || USDT_NETWORKS[DEFAULT_NETWORK_ID];
  }, [selectedNetwork]);

  if (!isCartOpen) return null;

  // 1. Authorize Payment -> Freezes Cart Snapshot and Transitions to 'awaiting_payment'
  const handleAuthorizePayment = async (e) => {
    if (e) e.preventDefault();
    if (checkingOut) return; // Prevent double-clicks / rapid submission

    if (!customerEmail || !customerEmail.includes('@')) {
      setCheckoutError('Please enter a valid delivery email address.');
      return;
    }

    if (cart.length === 0) {
      setCheckoutError('Your cart is empty.');
      return;
    }

    if (!deliveryMethod || !['download_package', 'geelark_setup'].includes(deliveryMethod)) {
      setCheckoutError('Please select a delivery method.');
      return;
    }

    setCheckingOut(true);
    setCheckoutError(null);

    // Freeze the current cart snapshot
    const cartSnapshot = cart.map((item) => ({
      id: item.id,
      title: item.title,
      price: item.price,
      quantity: item.quantity || 1,
      platform: item.platform || 'geelark',
    }));

    try {
      const response = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerEmail,
          network: selectedNetwork,
          payment_network: selectedNetwork,
          delivery_method: deliveryMethod,
          cart: cartSnapshot,
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        // Construct frozen order snapshot determined by backend
        const frozenOrder = {
          orderId: resData.data.orderId,
          paymentId: resData.data.paymentId,
          payAddress: resData.data.payAddress,
          payAmountCrypto: resData.data.payAmountCrypto,
          currency: resData.data.currency,
          network: resData.data.network,
          networkLabel: resData.data.networkLabel,
          blockchain: resData.data.blockchain,
          fullNetworkLabel: resData.data.fullNetworkLabel,
          payCurrencyTicker: resData.data.payCurrencyTicker,
          qrCodeUrl: resData.data.qrCodeUrl,
          deliveryMethod: resData.data.deliveryMethod || deliveryMethod,
          workflowSubtotal: resData.data.workflowSubtotal || workflowSubtotal,
          setupFee: resData.data.setupFee ?? setupFee,
          totalUsd: resData.data.totalUsd || calculatedFinalTotal,
          email: customerEmail,
          items: cartSnapshot,
          status: 'awaiting_payment',
          warning: resData.data.warning,
          createdAt: Date.now(),
        };

        // Persist frozen order
        setActiveOrder(frozenOrder);
        try {
          localStorage.setItem(ACTIVE_PAYMENT_STORAGE_KEY, JSON.stringify(frozenOrder));
        } catch (storageErr) {
          console.warn('localStorage write failed', storageErr);
        }

        // Clear editable cart to prevent backdoor modifications
        clearCart();

        // Lock & transition to dedicated awaiting payment screen
        setCheckoutStep('awaiting_payment');
      } else {
        setCheckoutError(resData.error || 'Failed to initialize payment invoice.');
      }
    } catch (err) {
      setCheckoutError('Network error connecting to payment gateway.');
    } finally {
      setCheckingOut(false);
    }
  };

  // 2. User clicks "I've sent payment" -> Transitions to 'verifying' (NEVER 'completed')
  const handleUserReportedPayment = () => {
    if (!activeOrder) return;
    const verifyingOrder = { ...activeOrder, status: 'verifying' };
    setActiveOrder(verifyingOrder);
    try {
      localStorage.setItem(ACTIVE_PAYMENT_STORAGE_KEY, JSON.stringify(verifyingOrder));
    } catch (e) {}
    setCheckoutStep('verifying');
    // Trigger immediate status check
    checkBackendPaymentStatus(verifyingOrder);
  };

  const handleAddSuggestion = (product) => {
    if (checkoutStep !== 'cart') return; // Guard: Only allow adding during pre-payment cart
    addToCart(product);
    setAddedItemIds((prev) => [...prev, product.id]);
    setTimeout(() => {
      setAddedItemIds((prev) => prev.filter((id) => id !== product.id));
    }, 1500);
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Finish and return to marketplace (clears payment session)
  const handleFinishAndReturn = () => {
    try {
      localStorage.removeItem(ACTIVE_PAYMENT_STORAGE_KEY);
    } catch (e) {}
    setActiveOrder(null);
    setCheckoutStep('cart');
    setCheckoutError(null);
    clearCart();
    closeCart();
  };

  // Browse workflows navigation
  const handleBrowseWorkflows = () => {
    closeCart();
    setTimeout(() => {
      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Close button handler with safety check for active payment
  const handleHeaderClose = () => {
    if (checkoutStep === 'awaiting_payment' || checkoutStep === 'verifying') {
      setShowLeaveConfirm(true);
    } else {
      closeCart();
    }
  };

  const handleConfirmLeave = () => {
    setShowLeaveConfirm(false);
    closeCart();
  };

  const handleCancelLeave = () => {
    setShowLeaveConfirm(false);
  };

  const handleCancelActivePayment = () => {
    try {
      localStorage.removeItem(ACTIVE_PAYMENT_STORAGE_KEY);
    } catch (e) {}
    setActiveOrder(null);
    setCheckoutStep('cart');
    setShowLeaveConfirm(false);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const isCartEmpty = checkoutStep === 'cart' && cart.length === 0;

  return (
    <div className={`checkout-modal-overlay ${isCartOpen ? 'open' : ''}`} onClick={handleHeaderClose}>
      <div
        className={`checkout-modal-container ${
          checkoutStep !== 'cart'
            ? 'payment-focused-mode'
            : isCartEmpty
            ? 'empty-cart-mode'
            : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================ */}
        {/* 1. HEADER (Adapts to current checkout stage) */}
        {/* ============================================================ */}
        <div className="checkout-modal-header">
          <div className="header-brand-lockup">
            <span className="brand-mark-box">GF</span>
            <div className="brand-title-wrap">
              <span className="brand-title">GeeLark Flows</span>
              <span className="brand-subtitle">
                {checkoutStep === 'cart'
                  ? 'System checkout & order authorization'
                  : `Order #${activeOrder?.orderId || 'PENDING'}`}
              </span>
            </div>
          </div>

          <div className="header-actions-wrap">
            {checkoutStep === 'cart' && (
              <span className="header-cart-summary">
                {cart.length > 0
                  ? `${cart.length} ${cart.length === 1 ? 'workflow' : 'workflows'} · $${calculatedFinalTotal.toFixed(2)}`
                  : '0 items'}
              </span>
            )}
            {checkoutStep === 'awaiting_payment' && (
              <span className="header-locked-badge">Locked transaction</span>
            )}
            {checkoutStep === 'verifying' && (
              <span className="header-verifying-badge">
                <span className="pulse-mini-dot" /> Verifying on-chain
              </span>
            )}
            <button className="checkout-close-btn" onClick={handleHeaderClose} aria-label="Close checkout">
              ✕
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. BODY CONTENT (4 Explicit States) */}
        {/* ============================================================ */}

        {/* ------------------------------------------------------------ */}
        {/* STATE 1: CART & CONFIGURE (Pre-Payment Editable State) */}
        {/* ------------------------------------------------------------ */}
        {checkoutStep === 'cart' && (
          <div className="checkout-modal-body">
            {/* Left: Selected Flows OR Designed Empty State */}
            <div className="checkout-column left-column">
              <div className="column-header">
                <div className="column-header-left">
                  <h2 className="column-title">Your workflows</h2>
                  {cart.length > 0 && <span className="column-count">{cart.length}</span>}
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    className="btn-clear-cart"
                    onClick={clearCart}
                    title="Remove all items from cart"
                  >
                    Clear cart
                  </button>
                )}
              </div>

              {isCartEmpty ? (
                /* Intentional Designed Empty State */
                <div className="empty-cart-composition">
                  <div className="empty-cart-icon-box">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="21" r="1" />
                      <circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                  </div>
                  <h3 className="empty-cart-heading">Your cart is empty</h3>
                  <p className="empty-cart-desc">
                    Select reusable automation workflows from the catalog to build your setup.
                  </p>
                  <button
                    type="button"
                    className="empty-browse-btn"
                    onClick={handleBrowseWorkflows}
                  >
                    <span>Browse workflow catalog</span>
                    <span className="btn-arrow">↓</span>
                  </button>
                </div>
              ) : (
                <div className="cart-content-wrapper">
                  <div className="column-scroll-area">
                    <div className="checkout-items-list">
                      {cart.map((item) => (
                        <div key={item.id} className="checkout-item-row">
                          <span className="item-icon-square">
                            {item.platform ? item.platform.slice(0, 2).toUpperCase() : 'GF'}
                          </span>
                          <div className="item-info">
                            <div className="item-title-row">
                              <h3 className="item-name">{item.title}</h3>
                              <span className="item-price font-mono">${item.price}</span>
                            </div>
                            <div className="item-meta-row">
                              <span className="item-desc">Reusable GeeLark flow</span>
                              <button
                                type="button"
                                className="item-remove-btn"
                                onClick={() => removeFromCart(item.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Frequently Bought Together */}
                    {suggestedProducts.length > 0 && (
                      <div className="recommendations-section">
                        <div className="recommendations-header">
                          <h4 className="rec-title">Frequently bought together</h4>
                          <span className="rec-subtitle">Popular pairings for your setup</span>
                        </div>
                        <div className="recommendations-list">
                          {suggestedProducts.map((p) => {
                            const isAdded = addedItemIds.includes(p.id);
                            return (
                              <div key={p.id} className="rec-item-row">
                                <div className="rec-item-info">
                                  <span className="rec-item-name">{p.title}</span>
                                  <span className="rec-item-price font-mono">${p.price}.00</span>
                                </div>
                                <button
                                  type="button"
                                  className={`rec-add-btn ${isAdded ? 'added' : ''}`}
                                  onClick={() => handleAddSuggestion(p)}
                                  disabled={isAdded}
                                >
                                  {isAdded ? '✓ Added' : '+ Add'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pricing Summary Breakdown */}
                  <div className="column-summary-footer">
                    <div className="summary-row">
                      <span className="summary-label">Workflows ({cart.length} {cart.length === 1 ? 'item' : 'items'})</span>
                      <span className="summary-value font-mono">${workflowSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-label">
                        {deliveryMethod === 'geelark_setup' ? 'GeeLark setup' : 'Delivery'}
                      </span>
                      <span className={`summary-value font-mono ${deliveryMethod === 'geelark_setup' && setupFee === 0 ? 'free-tag' : ''}`}>
                        {deliveryMethod === 'geelark_setup'
                          ? (setupFee === 0 ? 'FREE' : `$${setupFee.toFixed(2)}`)
                          : 'Included'}
                      </span>
                    </div>
                    <div className="summary-row main-total">
                      <span className="summary-label">Total amount due</span>
                      <span className="summary-value font-mono total-bold">${calculatedFinalTotal.toFixed(2)} USD</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Payment Method & Customer Details */}
            <div className="checkout-column right-column">
              <div className="column-header">
                <h2 className="column-title">Configuration & Payment</h2>
                <span className="column-badge">Authoritative settlement</span>
              </div>

              <div className="payment-content-wrapper">
                {isCartEmpty ? (
                  <div className="empty-payment-composition">
                    <div className="empty-payment-icon-box">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                      </svg>
                    </div>
                    <h4 className="empty-payment-heading">Checkout unavailable</h4>
                    <p className="empty-payment-desc">
                      Add at least one workflow from the catalog to configure delivery and crypto payment.
                    </p>
                    <div className="empty-payment-steps-preview">
                      <div className="step-preview-item">
                        <span className="step-num">1</span>
                        <span>Select your reusable automation flow</span>
                      </div>
                      <div className="step-preview-item">
                        <span className="step-num">2</span>
                        <span>Choose delivery method & USDT network</span>
                      </div>
                      <div className="step-preview-item">
                        <span className="step-num">3</span>
                        <span>Receive package or setup coordination within 24 hours</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form className="payment-form" onSubmit={handleAuthorizePayment}>
                    <div className="payment-form-fields">
                      {/* Step 1: Customer Email */}
                      <div className="form-group">
                        <label className="form-label" htmlFor="checkout-email">
                          Registered email address
                        </label>
                        <input
                          id="checkout-email"
                          type="email"
                          required
                          className="form-input"
                          placeholder="name@example.com"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                        />
                        <span className="form-hint">
                          Order confirmation and delivery details will be sent to this email.
                        </span>
                      </div>

                      {/* Step 2: Mandatory Delivery Method Selection */}
                      <div className="form-group">
                        <div className="form-label-row">
                          <label className="form-label">Delivery method</label>
                          <span className="form-label-hint">Select how you want to receive your workflows</span>
                        </div>

                        <div className="delivery-selection-cards">
                          {/* Option A: Downloadable Package */}
                          <div
                            className={`delivery-card ${deliveryMethod === 'download_package' ? 'selected' : ''}`}
                            onClick={() => setDeliveryMethod('download_package')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setDeliveryMethod('download_package')}
                          >
                            <div className="delivery-card-header">
                              <div className="delivery-radio-wrap">
                                <span className="delivery-radio-dot" />
                                <strong className="delivery-title">Downloadable Package</strong>
                              </div>
                              <span className="delivery-fee-badge included">Included</span>
                            </div>
                            <p className="delivery-desc">
                              Receive the purchased workflow package at your registered email address.
                            </p>
                            <p className="delivery-support-text">
                              Your downloadable package will be prepared and delivered to your registered email address within 24 hours after payment confirmation.
                            </p>
                          </div>

                          {/* Option B: GeeLark Account Setup */}
                          <div
                            className={`delivery-card ${deliveryMethod === 'geelark_setup' ? 'selected' : ''}`}
                            onClick={() => setDeliveryMethod('geelark_setup')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setDeliveryMethod('geelark_setup')}
                          >
                            <div className="delivery-card-header">
                              <div className="delivery-radio-wrap">
                                <span className="delivery-radio-dot" />
                                <strong className="delivery-title">GeeLark Account Setup</strong>
                              </div>
                              <span className={`delivery-fee-badge ${workflowSubtotal >= 300 ? 'free' : 'fee'}`}>
                                {workflowSubtotal >= 300 ? 'FREE' : '+$50'}
                              </span>
                            </div>
                            <p className="delivery-desc">
                              Have our team set up the purchased workflows on your GeeLark account.
                            </p>
                            <p className="delivery-support-text">
                              Our team will contact you within 24 hours after payment confirmation to coordinate the setup.
                            </p>
                            <p className="delivery-no-credentials-note">
                              No account credentials required during checkout. Our team will coordinate setup details directly with you.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Step 3: Payment Asset Header */}
                      <div className="form-group">
                        <label className="form-label">Payment asset</label>
                        <div className="payment-asset-row">
                          <div className="asset-pill-selected">
                            <span className="asset-pill-symbol font-mono">₮</span>
                            <div className="asset-pill-text">
                              <span className="asset-pill-title">USDT</span>
                              <span className="asset-pill-sub">Tether USD</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 4: Multi-Network USDT Selector (4 Options) */}
                      <div className="form-group">
                        <div className="form-label-row">
                          <label className="form-label">USDT network</label>
                          <span className="form-label-hint">Choose network to send USDT</span>
                        </div>
                        <div className="network-selector-grid">
                          {USDT_NETWORKS_LIST.map((net) => {
                            const isSelected = selectedNetwork === net.id;
                            return (
                              <button
                                key={net.id}
                                type="button"
                                className={`network-option-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => setSelectedNetwork(net.id)}
                              >
                                <div className="net-card-header">
                                  <span className="net-card-symbol font-mono">USDT</span>
                                  <span className="net-card-badge font-mono">{net.shortLabel}</span>
                                </div>
                                <div className="net-card-chain">{net.chainLabel}</div>
                                <div className="net-card-tag">{net.badge}</div>
                              </button>
                            );
                          })}
                        </div>
                        <div className="network-helper-text">
                          Choose the network you'll use to send USDT.
                        </div>
                      </div>

                      {/* Total Review */}
                      <div className="payment-total-box">
                        <div className="payment-total-row">
                          <span className="pay-total-label">Total</span>
                          <span className="pay-total-val font-mono">${calculatedFinalTotal.toFixed(2)} USD</span>
                        </div>
                        <span className="pay-total-sub">
                          {deliveryMethod === 'geelark_setup' ? (
                            setupFee === 0
                              ? `Includes FREE GeeLark setup · Payable in USDT (${activeNetworkConfig.shortLabel} · ${activeNetworkConfig.chainLabel})`
                              : `Includes $50 GeeLark setup · Payable in USDT (${activeNetworkConfig.shortLabel} · ${activeNetworkConfig.chainLabel})`
                          ) : (
                            `Includes Downloadable Package delivery · Payable in USDT (${activeNetworkConfig.shortLabel} · ${activeNetworkConfig.chainLabel})`
                          )}
                        </span>
                      </div>

                      {checkoutError && <div className="form-error-banner">{checkoutError}</div>}
                    </div>

                    <div className="column-action-footer">
                      <button
                        type="submit"
                        className="btn-action btn-primary"
                        disabled={checkingOut || cart.length === 0}
                      >
                        {checkingOut
                          ? 'Generating invoice...'
                          : `Authorize payment · $${calculatedFinalTotal.toFixed(2)} →`}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* STATE 2: AWAITING PAYMENT (QR Code, Locked Order Details) */}
        {/* ------------------------------------------------------------ */}
        {checkoutStep === 'awaiting_payment' && activeOrder && (
          <div className="payment-dedicated-layout">
            <div className="payment-dedicated-header">
              <div className="payment-status-badge">
                <span className="status-dot-pulse" />
                <span>Awaiting payment</span>
              </div>
              <p className="payment-sub-instruction">Send the exact amount to the address below</p>
            </div>

            <div className="payment-dedicated-scroll">
              {/* QR Scan Box */}
              <div className="payment-qr-card">
                <img
                  src={activeOrder.qrCodeUrl}
                  alt={`${activeOrder.currency} Payment QR Code`}
                  className="payment-qr-image"
                />
              </div>

              {/* Exact Amount Block (Immutable & Network-Aware) */}
              <div className="payment-amount-hero">
                <span className="amount-caption">Exact amount to send</span>
                <div className="amount-crypto-val font-mono">
                  ${activeOrder.totalUsd.toFixed(2)} USDT
                </div>
                <div className="amount-network-pill font-mono">
                  {activeOrder.fullNetworkLabel || activeOrder.currency}
                </div>
              </div>

              {/* Delivery Specification Pill */}
              <div className="payment-delivery-spec-pill">
                <span className="spec-k">Delivery:</span>
                <strong className="spec-v">
                  {activeOrder.deliveryMethod === 'geelark_setup' ? 'GeeLark Account Setup' : 'Downloadable Package'}
                </strong>
              </div>

              {/* Network Safety Warning */}
              <div className="payment-network-warning-box">
                <span className="warning-icon">⚠</span>
                <span>Send USDT on the <strong>{activeOrder.fullNetworkLabel || activeOrder.currency}</strong> network only. Ensure withdrawal covers exchange network fees.</span>
              </div>

              {/* Read-Only Registered Email */}
              <div className="payment-readonly-info">
                <span className="readonly-label">Registered email</span>
                <span className="readonly-val font-mono">{activeOrder.email}</span>
              </div>

              {/* Receiving Wallet Address Console */}
              <div className="payment-wallet-box">
                <span className="readonly-label">
                  Receiving wallet address ({activeOrder.fullNetworkLabel || activeOrder.currency})
                </span>
                <div className="wallet-address-bar">
                  <span className="wallet-string font-mono">{activeOrder.payAddress}</span>
                  <button
                    type="button"
                    className="btn-wallet-copy"
                    onClick={() => copyToClipboard(activeOrder.payAddress)}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Order Metadata */}
              <div className="payment-meta-row">
                <span>Order: <strong className="font-mono">{activeOrder.orderId}</strong></span>
                <span>Invoice: <strong className="font-mono">{activeOrder.paymentId}</strong></span>
              </div>
            </div>

            {/* Action Footer */}
            <div className="payment-dedicated-footer">
              <button
                type="button"
                className="btn-action btn-primary"
                onClick={handleUserReportedPayment}
              >
                I've sent payment →
              </button>
              <button
                type="button"
                className="btn-action btn-ghost"
                onClick={() => setShowLeaveConfirm(true)}
              >
                Leave payment session
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* STATE 3: VERIFYING PAYMENT (Pending On-Chain Confirmation) */}
        {/* ------------------------------------------------------------ */}
        {checkoutStep === 'verifying' && activeOrder && (
          <div className="payment-dedicated-layout">
            <div className="verifying-hero-header">
              <div className="verifying-radar-icon">
                <span className="radar-ring" />
                <span className="radar-core">◌</span>
              </div>
              <h2 className="verifying-title">Verifying payment</h2>
              <p className="verifying-subtitle">We're verifying your payment on the network.</p>
            </div>

            <div className="payment-dedicated-scroll">
              {/* Payment Spec Box */}
              <div className="verifying-spec-card">
                <div className="verifying-amount-line">
                  <span className="verifying-amount-val font-mono">
                    ${activeOrder.totalUsd.toFixed(2)} USDT
                  </span>
                  <span className="verifying-network-pill font-mono">
                    {activeOrder.fullNetworkLabel || activeOrder.currency}
                  </span>
                </div>
                <div className="verifying-wallet-line">
                  <span className="v-label">Wallet:</span>
                  <span className="v-address font-mono">{activeOrder.payAddress}</span>
                </div>
              </div>

              {/* Status Explanation Card */}
              <div className="verifying-notice-card">
                <p className="notice-main">We've received your payment submission.</p>
                <p className="notice-sub">
                  {activeOrder.deliveryMethod === 'geelark_setup'
                    ? 'Our team will contact you within 24 hours after payment confirmation to coordinate setup on your GeeLark account.'
                    : 'Your downloadable package will be prepared and delivered to your registered email address within 24 hours after payment confirmation:'}
                </p>
                <div className="verifying-email-box">
                  <span className="email-text font-mono">{activeOrder.email}</span>
                </div>
                {activeOrder.deliveryMethod === 'geelark_setup' && (
                  <p className="verifying-extra-note">
                    You don't need to provide your GeeLark account details during checkout. Our team will collect the required information separately.
                  </p>
                )}
              </div>

              {/* Order IDs */}
              <div className="verifying-meta-table">
                <div className="v-meta-row">
                  <span>Order:</span>
                  <strong className="font-mono">{activeOrder.orderId}</strong>
                </div>
                <div className="v-meta-row">
                  <span>Invoice:</span>
                  <strong className="font-mono">{activeOrder.paymentId}</strong>
                </div>
                <div className="v-meta-row">
                  <span>Delivery:</span>
                  <span className="font-mono">{activeOrder.deliveryMethod === 'geelark_setup' ? 'GeeLark Setup' : 'Downloadable'}</span>
                </div>
                <div className="v-meta-row">
                  <span>Status:</span>
                  <span className="v-status-live font-mono">Awaiting confirmations...</span>
                </div>
              </div>
            </div>

            <div className="payment-dedicated-footer">
              <button
                type="button"
                className="btn-action btn-secondary"
                onClick={handlePrintReceipt}
              >
                View / Print transaction receipt
              </button>
              <button
                type="button"
                className="btn-action btn-ghost"
                onClick={closeCart}
              >
                Return to marketplace (verification stays active)
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* STATE 4: PAYMENT CONFIRMED (Decoupled from Fulfillment) */}
        {/* ------------------------------------------------------------ */}
        {checkoutStep === 'completed' && activeOrder && (
          <div className="payment-dedicated-layout">
            <div className="payment-dedicated-header">
              <div className="receipt-success-badge">
                <span className="receipt-check-glyph">✓</span>
              </div>
              <h2 className="receipt-success-title">Payment confirmed</h2>
              <p className="payment-sub-instruction">
                Thank you for your order. Your selected delivery method is now being processed.
              </p>
            </div>

            <div className="payment-dedicated-scroll">
              {/* Delivery-Method-Aware Processing Card */}
              {activeOrder.deliveryMethod === 'geelark_setup' ? (
                <div className="receipt-delivery-card setup-mode">
                  <div className="receipt-card-header">
                    <span className="receipt-delivery-icon">⚡</span>
                    <strong>GeeLark account setup</strong>
                  </div>
                  <p>
                    Our team will contact you at your registered email address within 24 hours to coordinate the setup.
                  </p>
                  <p className="receipt-credentials-reassurance">
                    You don't need to provide your GeeLark account details during checkout. Our team will collect the required information separately.
                  </p>
                  <div className="receipt-status-pill">
                    <span className="status-dot-pending" />
                    <span>Status: Setup coordination pending</span>
                  </div>
                </div>
              ) : (
                <div className="receipt-delivery-card package-mode">
                  <div className="receipt-card-header">
                    <span className="receipt-delivery-icon">📦</span>
                    <strong>Downloadable package</strong>
                  </div>
                  <p>
                    Your workflow package will be prepared and delivered to your registered email address within 24 hours.
                  </p>
                  <div className="receipt-email-row">
                    <span className="email-label">Delivery email:</span>
                    <span className="email-highlight font-mono">{activeOrder.email}</span>
                  </div>
                  <div className="receipt-status-pill">
                    <span className="status-dot-pending" />
                    <span>Status: Preparing delivery</span>
                  </div>
                </div>
              )}

              {/* Summary Breakdown Table */}
              <div className="receipt-summary-table">
                <div className="summary-row">
                  <span className="row-k">Order ID</span>
                  <span className="row-v font-mono">#{activeOrder.orderId}</span>
                </div>
                <div className="summary-row">
                  <span className="row-k">Invoice ID</span>
                  <span className="row-v font-mono">{activeOrder.paymentId}</span>
                </div>
                {activeOrder.txHash && (
                  <div className="summary-row">
                    <span className="row-k">Tx Hash</span>
                    <span className="row-v font-mono">{activeOrder.txHash.substring(0, 16)}...</span>
                  </div>
                )}
                <div className="summary-row">
                  <span className="row-k">Payment method</span>
                  <span className="row-v">USDT ({activeOrder.fullNetworkLabel || activeOrder.currency})</span>
                </div>
                <div className="summary-row">
                  <span className="row-k">Delivery method</span>
                  <span className="row-v">
                    {activeOrder.deliveryMethod === 'geelark_setup' ? 'GeeLark Account Setup' : 'Downloadable Package'}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="row-k">Workflow subtotal</span>
                  <span className="row-v font-mono">
                    ${Number(activeOrder.workflowSubtotal || activeOrder.totalUsd).toFixed(2)} USD
                  </span>
                </div>
                <div className="summary-row">
                  <span className="row-k">Delivery / Setup</span>
                  <span className="row-v font-mono">
                    {activeOrder.deliveryMethod === 'geelark_setup'
                      ? (activeOrder.setupFee === 0 ? 'FREE' : `$${Number(activeOrder.setupFee).toFixed(2)}`)
                      : 'Included'}
                  </span>
                </div>
                <div className="summary-row" style={{ borderTop: '1px solid var(--admin-border, rgba(255,255,255,0.12))', paddingTop: '8px', marginTop: '6px' }}>
                  <span className="row-k" style={{ fontWeight: 700, color: '#ffffff' }}>Amount paid</span>
                  <span className="row-v font-mono" style={{ fontWeight: 700, color: 'var(--accent-lime, #a7ff4f)', fontSize: '14px' }}>
                    ${Number(activeOrder.totalUsd).toFixed(2)} USD
                  </span>
                </div>

                {activeOrder.items && activeOrder.items.length > 0 && (
                  <div className="receipt-purchased-items">
                    <span className="purchased-items-title">Purchased workflows:</span>
                    {activeOrder.items.map((item, idx) => (
                      <div key={idx} className="purchased-item-line">
                        <span>{item.title}</span>
                        <span className="font-mono">${(item.price * (item.quantity || 1)).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subtle Professional Support Section */}
              <div className="receipt-support-section">
                <span className="support-heading">Need help?</span>
                <p className="support-body">
                  If you have any questions about your order or need assistance, contact our support team at{' '}
                  <a href="mailto:support@geelarkflows.com" className="support-link font-mono">
                    support@geelarkflows.com
                  </a>.
                </p>
              </div>
            </div>

            <div className="payment-dedicated-footer">
              <button
                type="button"
                className="btn-action btn-secondary"
                onClick={handlePrintReceipt}
              >
                Print receipt
              </button>
              <button
                type="button"
                className="btn-action btn-primary"
                onClick={handleFinishAndReturn}
              >
                Return to marketplace →
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 3. LEAVE PAYMENT CONFIRMATION DIALOG */}
        {/* ============================================================ */}
        {showLeaveConfirm && (
          <div className="leave-modal-dialog-overlay" onClick={handleCancelLeave}>
            <div className="leave-modal-dialog" onClick={(e) => e.stopPropagation()}>
              <h3>Leave payment?</h3>
              <p>
                Your payment for Order <strong>#{activeOrder?.orderId}</strong> is awaiting confirmation on the blockchain.
                You can safely resume this payment at any time.
              </p>
              <div className="leave-dialog-actions">
                <button type="button" className="dialog-btn dialog-stay" onClick={handleCancelLeave}>
                  Stay on payment
                </button>
                <button type="button" className="dialog-btn dialog-leave" onClick={handleConfirmLeave}>
                  Close window
                </button>
                <button type="button" className="dialog-btn dialog-cancel-order" onClick={handleCancelActivePayment}>
                  Cancel order & restart
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
