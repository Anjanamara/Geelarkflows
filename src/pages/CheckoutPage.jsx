import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { USDT_NETWORKS, USDT_NETWORKS_LIST, getNetworkConfig, DEFAULT_NETWORK_ID } from '../data/paymentConfig';
import CheckoutProgress from '../components/CheckoutProgress';
import './CheckoutPage.css';

const ACTIVE_PAYMENT_STORAGE_KEY = 'geelark_active_payment';

export default function CheckoutPage({ navigate }) {
  const { cart, clearCart, cartTotal, cartItemCount } = useCart();

  // Explicit Checkout Sub-Stages: 'form' | 'awaiting_payment' | 'verifying' | 'completed'
  const [stage, setStage] = useState('form');
  const [activeOrder, setActiveOrder] = useState(null);

  // Form Fields
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('download_package');
  const [selectedNetwork, setSelectedNetwork] = useState(DEFAULT_NETWORK_ID);

  // Status & UI
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const pollingTimerRef = useRef(null);

  // Pricing Engine (Authoritative mirror of backend logic)
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

  const activeNetworkConfig = useMemo(() => {
    return getNetworkConfig(selectedNetwork) || USDT_NETWORKS[DEFAULT_NETWORK_ID];
  }, [selectedNetwork]);

  // Restore existing active payment session on mount / refresh
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_PAYMENT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.orderId || parsed.paymentId)) {
          setActiveOrder(parsed);
          if (['confirmed', 'finished', 'paid'].includes((parsed.status || '').toLowerCase())) {
            setStage('completed');
          } else if (parsed.status === 'verifying') {
            setStage('verifying');
          } else {
            setStage('awaiting_payment');
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
          setStage('completed');
        }
      }
    } catch (err) {
      console.warn('Payment status polling check failed:', err.message);
    }
  }, []);

  // Polling Loop for active payments
  useEffect(() => {
    if (!activeOrder || (stage !== 'awaiting_payment' && stage !== 'verifying')) {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      return;
    }

    checkBackendPaymentStatus(activeOrder);

    pollingTimerRef.current = setInterval(() => {
      setPollCount((prev) => prev + 1);
      checkBackendPaymentStatus(activeOrder);
    }, 3500);

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [activeOrder, stage, checkBackendPaymentStatus]);

  const handleReturnToCart = () => {
    if (typeof navigate === 'function') {
      navigate('/cart');
    } else {
      window.history.pushState({}, '', '/cart');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleReturnToMarketplace = () => {
    try {
      localStorage.removeItem(ACTIVE_PAYMENT_STORAGE_KEY);
    } catch (e) {}
    setActiveOrder(null);
    clearCart();
    if (typeof navigate === 'function') {
      navigate('/');
    } else {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Authorize Payment Submission
  const handleAuthorizePayment = async (e) => {
    if (e) e.preventDefault();
    if (checkingOut) return;

    if (!customerEmail || !customerEmail.includes('@')) {
      setCheckoutError('Please enter a valid email address.');
      return;
    }

    if (cart.length === 0) {
      setCheckoutError('Your cart is empty. Please add workflows to proceed.');
      return;
    }

    setCheckingOut(true);
    setCheckoutError(null);

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

        setActiveOrder(frozenOrder);
        try {
          localStorage.setItem(ACTIVE_PAYMENT_STORAGE_KEY, JSON.stringify(frozenOrder));
        } catch (storageErr) {
          console.warn('localStorage write failed', storageErr);
        }

        // Clear editable cart
        clearCart();

        // Transition to Awaiting Payment stage
        setStage('awaiting_payment');
      } else {
        setCheckoutError(resData.error || 'Failed to initialize payment invoice.');
      }
    } catch (err) {
      setCheckoutError('Network error connecting to payment gateway.');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleUserReportedPayment = () => {
    if (!activeOrder) return;
    const verifyingOrder = { ...activeOrder, status: 'verifying' };
    setActiveOrder(verifyingOrder);
    try {
      localStorage.setItem(ACTIVE_PAYMENT_STORAGE_KEY, JSON.stringify(verifyingOrder));
    } catch (e) {}
    setStage('verifying');
    checkBackendPaymentStatus(verifyingOrder);
  };

  const handleCancelActivePayment = () => {
    try {
      localStorage.removeItem(ACTIVE_PAYMENT_STORAGE_KEY);
    } catch (e) {}
    setActiveOrder(null);
    setStage('form');
    setShowLeaveConfirm(false);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  // Determine active step for Progress Indicator
  const progressStep = useMemo(() => {
    if (stage === 'completed') return 'confirmation';
    if (stage === 'awaiting_payment' || stage === 'verifying') return 'payment';
    return 'checkout';
  }, [stage]);

  // Guard: If form stage and cart is empty, show empty state
  const isFormEmpty = stage === 'form' && cart.length === 0 && !activeOrder;

  return (
    <div className="checkout-page-shell">
      {/* Header */}
      <header className="checkout-page-header">
        <div className="checkout-header-inner">
          <a
            href="/"
            className="checkout-brand-lockup"
            onClick={(e) => {
              e.preventDefault();
              handleReturnToMarketplace();
            }}
          >
            <span className="brand-mark">GF</span>
            <span className="brand-text">
              <strong>GeeLark</strong>
              <small>Flows</small>
            </span>
          </a>

          <div className="header-status-wrap">
            {stage === 'form' && (
              <button
                type="button"
                className="btn-back-to-cart"
                onClick={handleReturnToCart}
              >
                ← Back to Cart
              </button>
            )}
            {stage === 'awaiting_payment' && (
              <span className="header-badge-pulse">
                <span className="dot-pulse" /> Awaiting Payment
              </span>
            )}
            {stage === 'verifying' && (
              <span className="header-badge-pulse">
                <span className="dot-pulse" /> Verifying On-Chain
              </span>
            )}
            {stage === 'completed' && (
              <span className="header-badge-confirmed">
                ✓ Payment Confirmed
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="checkout-page-main">
        {/* Progress Step Indicator */}
        <CheckoutProgress
          currentStep={progressStep}
          onStepClick={(stepId) => {
            if (stepId === 'cart' && stage === 'form') {
              handleReturnToCart();
            }
          }}
        />

        <div className="checkout-page-container">
          {/* ======================================================== */}
          {/* 1. CHECKOUT FORM STAGE (Contact, Delivery, Payment Network) */}
          {/* ======================================================== */}
          {stage === 'form' && (
            isFormEmpty ? (
              <div className="empty-checkout-card">
                <h2 className="empty-title">Your cart is empty</h2>
                <p className="empty-sub">Add workflows to your cart before proceeding to checkout.</p>
                <button
                  type="button"
                  className="btn-return-cart"
                  onClick={handleReturnToCart}
                >
                  Go to Cart →
                </button>
              </div>
            ) : (
              <div className="checkout-layout-grid">
                {/* Left Column: Numbered Sections */}
                <div className="checkout-form-column">
                  <form onSubmit={handleAuthorizePayment}>
                    {/* 01 — Contact */}
                    <section className="checkout-section-box">
                      <div className="section-header-row">
                        <span className="section-number">01</span>
                        <div className="section-title-wrap">
                          <h2 className="section-title">Contact Information</h2>
                          <span className="section-hint">Order confirmation and delivery details will be sent here</span>
                        </div>
                      </div>

                      <div className="form-input-group">
                        <label className="field-label" htmlFor="checkout-email">
                          Email address
                        </label>
                        <input
                          id="checkout-email"
                          type="email"
                          required
                          className="field-input"
                          placeholder="name@example.com"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                        />
                        <span className="field-subtext">
                          We will never share your email. No GeeLark account credentials required during checkout.
                        </span>
                      </div>
                    </section>

                    {/* 02 — Delivery Method */}
                    <section className="checkout-section-box">
                      <div className="section-header-row">
                        <span className="section-number">02</span>
                        <div className="section-title-wrap">
                          <h2 className="section-title">Delivery Method</h2>
                          <span className="section-hint">Choose how you want to receive your workflows</span>
                        </div>
                      </div>

                      <div className="delivery-cards-grid">
                        {/* Option A: Downloadable Package */}
                        <div
                          className={`delivery-choice-card ${deliveryMethod === 'download_package' ? 'selected' : ''}`}
                          onClick={() => setDeliveryMethod('download_package')}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setDeliveryMethod('download_package')}
                        >
                          <div className="delivery-card-topbar">
                            <div className="radio-pill-wrap">
                              <span className="custom-radio-dot" />
                              <strong className="delivery-name">Downloadable Package</strong>
                            </div>
                            <span className="delivery-tag included">Included · $0</span>
                          </div>
                          <p className="delivery-main-desc">
                            Receive the purchased workflow package at your registered email address.
                          </p>
                          <p className="delivery-secondary-desc">
                            Your downloadable package will be prepared and delivered to your registered email address within 24 hours after payment confirmation.
                          </p>
                        </div>

                        {/* Option B: GeeLark Account Setup */}
                        <div
                          className={`delivery-choice-card ${deliveryMethod === 'geelark_setup' ? 'selected' : ''}`}
                          onClick={() => setDeliveryMethod('geelark_setup')}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setDeliveryMethod('geelark_setup')}
                        >
                          <div className="delivery-card-topbar">
                            <div className="radio-pill-wrap">
                              <span className="custom-radio-dot" />
                              <strong className="delivery-name">GeeLark Account Setup</strong>
                            </div>
                            <span className={`delivery-tag ${workflowSubtotal >= 300 ? 'free' : 'fee'}`}>
                              {workflowSubtotal >= 300 ? 'FREE — order qualifies' : '+$50 Setup Fee'}
                            </span>
                          </div>
                          <p className="delivery-main-desc">
                            Have our team set up the purchased workflows on your GeeLark account.
                          </p>
                          <p className="delivery-secondary-desc">
                            Our team will contact you within 24 hours after payment confirmation to coordinate setup.
                          </p>
                          <p className="delivery-credentials-note">
                            Do NOT provide GeeLark credentials now. Our team will coordinate setup details directly with you.
                          </p>
                        </div>
                      </div>
                    </section>

                    {/* 03 — Payment Network */}
                    <section className="checkout-section-box">
                      <div className="section-header-row">
                        <span className="section-number">03</span>
                        <div className="section-title-wrap">
                          <h2 className="section-title">Payment Network (USDT)</h2>
                          <span className="section-hint">Select the blockchain network you will use to send USDT</span>
                        </div>
                      </div>

                      <div className="networks-selection-grid">
                        {USDT_NETWORKS_LIST.map((net) => {
                          const isSelected = selectedNetwork === net.id;
                          return (
                            <button
                              key={net.id}
                              type="button"
                              className={`network-select-card ${isSelected ? 'selected' : ''}`}
                              onClick={() => setSelectedNetwork(net.id)}
                            >
                              <div className="network-card-header">
                                <span className="network-asset-symbol font-mono">USDT</span>
                                <span className="network-badge-label font-mono">{net.shortLabel}</span>
                              </div>
                              <div className="network-chain-name">{net.chainLabel}</div>
                              <div className="network-feature-tag">{net.badge}</div>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    {checkoutError && (
                      <div className="checkout-error-banner" role="alert">
                        {checkoutError}
                      </div>
                    )}
                  </form>
                </div>

                {/* Right Column: Sticky Order Summary */}
                <aside className="checkout-summary-column" aria-label="Checkout Summary">
                  <div className="sticky-checkout-summary">
                    <h2 className="summary-heading">Order Summary</h2>

                    {/* Purchased Items List */}
                    <div className="summary-purchased-items">
                      {cart.map((item) => (
                        <div key={item.id} className="summary-item-line">
                          <span className="item-title">{item.title}</span>
                          <span className="item-price font-mono">
                            ${((item.price) * (item.quantity || 1)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Pricing Breakdown */}
                    <div className="summary-breakdown-table">
                      <div className="breakdown-row">
                        <span className="k">Workflow subtotal</span>
                        <span className="v font-mono">${workflowSubtotal.toFixed(2)}</span>
                      </div>

                      <div className="breakdown-row">
                        <span className="k">
                          {deliveryMethod === 'geelark_setup' ? 'GeeLark setup' : 'Delivery'}
                        </span>
                        <span className={`v font-mono ${deliveryMethod === 'geelark_setup' && setupFee === 0 ? 'free-tag' : ''}`}>
                          {deliveryMethod === 'geelark_setup'
                            ? (setupFee === 0 ? 'FREE ($0.00)' : `$${setupFee.toFixed(2)}`)
                            : 'Included ($0.00)'}
                        </span>
                      </div>

                      <div className="breakdown-row total-highlight-row">
                        <span className="total-k">Total amount due</span>
                        <span className="total-v font-mono">${calculatedFinalTotal.toFixed(2)} USD</span>
                      </div>
                    </div>

                    {/* Snapshot Tags */}
                    <div className="summary-snapshot-tags">
                      <div className="snapshot-pill">
                        <span className="pill-label">Delivery:</span>
                        <span className="pill-val">
                          {deliveryMethod === 'geelark_setup' ? 'GeeLark Account Setup' : 'Downloadable Package'}
                        </span>
                      </div>

                      <div className="snapshot-pill">
                        <span className="pill-label">Network:</span>
                        <span className="pill-val font-mono">
                          USDT ({activeNetworkConfig.shortLabel} · {activeNetworkConfig.chainLabel})
                        </span>
                      </div>
                    </div>

                    {/* Primary CTA */}
                    <button
                      type="button"
                      className="btn-continue-payment"
                      disabled={checkingOut || cart.length === 0}
                      onClick={handleAuthorizePayment}
                    >
                      {checkingOut ? 'Generating invoice...' : `Continue to Payment · $${calculatedFinalTotal.toFixed(2)} →`}
                    </button>

                    {/* Subtle Reassurance & Support */}
                    <div className="checkout-trust-box">
                      <p className="trust-copy">
                        Payment confirmation and fulfillment instructions will be sent to your email.
                      </p>
                      <div className="checkout-legal-links">
                        <a href="/terms" onClick={(e) => { e.preventDefault(); if (typeof navigate === 'function') navigate('/terms'); }}>Terms of Service</a>
                        <span>·</span>
                        <a href="/privacy" onClick={(e) => { e.preventDefault(); if (typeof navigate === 'function') navigate('/privacy'); }}>Privacy Policy</a>
                        <span>·</span>
                        <a href="/refund-policy" onClick={(e) => { e.preventDefault(); if (typeof navigate === 'function') navigate('/refund-policy'); }}>Refunds</a>
                      </div>
                      <p className="support-copy">
                        Need help?{' '}
                        <a href="mailto:support@geelarkflows.com" className="support-link font-mono">
                          support@geelarkflows.com
                        </a>
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            )
          )}

          {/* ======================================================== */}
          {/* 2. PAYMENT STAGE (Awaiting Crypto Payment) */}
          {/* ======================================================== */}
          {stage === 'awaiting_payment' && activeOrder && (
            <div className="payment-panel-wrapper">
              <div className="payment-panel-card">
                <div className="payment-panel-header">
                  <div className="status-indicator-badge">
                    <span className="pulse-dot" />
                    <span>Awaiting payment</span>
                  </div>
                  <h1 className="payment-panel-title">Send Payment</h1>
                  <p className="payment-panel-subtitle">Send the exact amount in USDT to the address below</p>
                </div>

                <div className="payment-panel-content">
                  {/* QR Code */}
                  <div className="qr-container">
                    <img
                      src={activeOrder.qrCodeUrl}
                      alt={`${activeOrder.currency} Payment QR Code`}
                      className="qr-img"
                    />
                  </div>

                  {/* Amount Hero */}
                  <div className="payment-amount-block">
                    <span className="amount-caption">Exact amount to send</span>
                    <div className="amount-value font-mono">
                      ${activeOrder.totalUsd.toFixed(2)} USDT
                    </div>
                    <div className="amount-network-tag font-mono">
                      {activeOrder.fullNetworkLabel || activeOrder.currency}
                    </div>
                  </div>

                  {/* Delivery Pill */}
                  <div className="payment-spec-bar">
                    <span className="spec-label">Delivery method:</span>
                    <span className="spec-value">
                      {activeOrder.deliveryMethod === 'geelark_setup' ? 'GeeLark Account Setup' : 'Downloadable Package'}
                    </span>
                  </div>

                  {/* Network Warning */}
                  <div className="network-warning-box">
                    <span className="warning-symbol">⚠</span>
                    <span>
                      Send USDT on the <strong>{activeOrder.fullNetworkLabel || activeOrder.currency}</strong> network only. Ensure your wallet/exchange covers network withdrawal fees.
                    </span>
                  </div>

                  {/* Wallet Address Console */}
                  <div className="wallet-address-section">
                    <span className="wallet-section-label">
                      Receiving wallet address ({activeOrder.fullNetworkLabel || activeOrder.currency})
                    </span>
                    <div className="wallet-copy-bar">
                      <span className="wallet-address-text font-mono">{activeOrder.payAddress}</span>
                      <button
                        type="button"
                        className="btn-copy-address"
                        onClick={() => copyToClipboard(activeOrder.payAddress)}
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Order Metadata */}
                  <div className="order-metadata-row">
                    <span>Order: <strong className="font-mono">#{activeOrder.orderId}</strong></span>
                    <span>Invoice: <strong className="font-mono">{activeOrder.paymentId}</strong></span>
                    <span>Email: <strong className="font-mono">{activeOrder.email}</strong></span>
                  </div>
                </div>

                {/* Actions */}
                <div className="payment-panel-actions">
                  <button
                    type="button"
                    className="btn-sent-payment"
                    onClick={handleUserReportedPayment}
                  >
                    I've sent payment →
                  </button>
                  <button
                    type="button"
                    className="btn-leave-payment"
                    onClick={() => setShowLeaveConfirm(true)}
                  >
                    Leave payment session
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 3. PAYMENT STAGE (Verifying On-Chain) */}
          {/* ======================================================== */}
          {stage === 'verifying' && activeOrder && (
            <div className="payment-panel-wrapper">
              <div className="payment-panel-card">
                <div className="verifying-hero">
                  <div className="radar-animation-box">
                    <span className="radar-circle" />
                    <span className="radar-icon">◌</span>
                  </div>
                  <h1 className="verifying-heading">Verifying payment</h1>
                  <p className="verifying-desc">We're verifying your payment on the network.</p>
                </div>

                <div className="verifying-body">
                  <div className="verifying-spec-pill">
                    <span className="v-amount font-mono">${activeOrder.totalUsd.toFixed(2)} USDT</span>
                    <span className="v-net font-mono">{activeOrder.fullNetworkLabel || activeOrder.currency}</span>
                  </div>

                  <div className="verifying-notice-box">
                    <p className="v-notice-title">We've received your payment submission.</p>
                    <p className="v-notice-text">
                      {activeOrder.deliveryMethod === 'geelark_setup'
                        ? 'Our team will contact you within 24 hours after payment confirmation to coordinate setup on your GeeLark account.'
                        : 'Your downloadable package will be prepared and delivered to your registered email address within 24 hours after payment confirmation:'}
                    </p>
                    <div className="v-email-display font-mono">{activeOrder.email}</div>
                    {activeOrder.deliveryMethod === 'geelark_setup' && (
                      <p className="v-credentials-hint">
                        You don't need to provide your GeeLark account details during checkout. Our team will collect the required information separately.
                      </p>
                    )}
                  </div>

                  <div className="verifying-info-table">
                    <div className="v-row">
                      <span>Order ID:</span>
                      <strong className="font-mono">#{activeOrder.orderId}</strong>
                    </div>
                    <div className="v-row">
                      <span>Invoice ID:</span>
                      <strong className="font-mono">{activeOrder.paymentId}</strong>
                    </div>
                    <div className="v-row">
                      <span>Status:</span>
                      <span className="v-live-status font-mono">Awaiting confirmations...</span>
                    </div>
                  </div>
                </div>

                <div className="verifying-actions">
                  <button
                    type="button"
                    className="btn-print-action"
                    onClick={handlePrintReceipt}
                  >
                    View / Print transaction receipt
                  </button>
                  <button
                    type="button"
                    className="btn-return-marketplace"
                    onClick={handleReturnToMarketplace}
                  >
                    Return to marketplace (verification stays active)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 4. CONFIRMATION STAGE (Payment Confirmed & Receipt) */}
          {/* ======================================================== */}
          {stage === 'completed' && activeOrder && (
            <div className="confirmation-panel-wrapper">
              <div className="confirmation-panel-card">
                <div className="confirmation-header">
                  <div className="confirmed-check-circle">✓</div>
                  <h1 className="confirmed-title">Payment confirmed</h1>
                  <p className="confirmed-subtitle">
                    Thank you for your order. Your selected delivery method is now being processed.
                  </p>
                </div>

                <div className="confirmation-body">
                  {/* Delivery Method Reassurance Card */}
                  {activeOrder.deliveryMethod === 'geelark_setup' ? (
                    <div className="confirmed-delivery-box setup-box">
                      <div className="delivery-box-title">
                        <span className="delivery-icon">⚡</span>
                        <strong>GeeLark account setup</strong>
                      </div>
                      <p>
                        Our team will contact you at your registered email address within 24 hours to coordinate the setup.
                      </p>
                      <p className="credentials-reassurance-text">
                        You don't need to provide your GeeLark account details during checkout. Our team will collect the required information separately.
                      </p>
                      <div className="confirmed-status-tag">
                        <span className="tag-dot" />
                        <span>Status: Setup coordination pending</span>
                      </div>
                    </div>
                  ) : (
                    <div className="confirmed-delivery-box package-box">
                      <div className="delivery-box-title">
                        <span className="delivery-icon">📦</span>
                        <strong>Downloadable package</strong>
                      </div>
                      <p>
                        Your workflow package will be prepared and delivered to your registered email address within 24 hours.
                      </p>
                      <div className="delivery-email-line">
                        <span className="lbl">Delivery email:</span>
                        <span className="val font-mono">{activeOrder.email}</span>
                      </div>
                      <div className="confirmed-status-tag">
                        <span className="tag-dot" />
                        <span>Status: Preparing delivery</span>
                      </div>
                    </div>
                  )}

                  {/* Summary Breakdown Table */}
                  <div className="confirmed-receipt-table">
                    <div className="receipt-row">
                      <span className="rk">Order ID</span>
                      <span className="rv font-mono">#{activeOrder.orderId}</span>
                    </div>
                    <div className="receipt-row">
                      <span className="rk">Invoice ID</span>
                      <span className="rv font-mono">{activeOrder.paymentId}</span>
                    </div>
                    {activeOrder.txHash && (
                      <div className="receipt-row">
                        <span className="rk">Tx Hash</span>
                        <span className="rv font-mono">{activeOrder.txHash.substring(0, 18)}...</span>
                      </div>
                    )}
                    <div className="receipt-row">
                      <span className="rk">Payment method</span>
                      <span className="rv">USDT ({activeOrder.fullNetworkLabel || activeOrder.currency})</span>
                    </div>
                    <div className="receipt-row">
                      <span className="rk">Delivery method</span>
                      <span className="rv">
                        {activeOrder.deliveryMethod === 'geelark_setup' ? 'GeeLark Account Setup' : 'Downloadable Package'}
                      </span>
                    </div>
                    <div className="receipt-row">
                      <span className="rk">Workflow subtotal</span>
                      <span className="rv font-mono">
                        ${Number(activeOrder.workflowSubtotal || activeOrder.totalUsd).toFixed(2)} USD
                      </span>
                    </div>
                    <div className="receipt-row">
                      <span className="rk">Delivery / Setup</span>
                      <span className="rv font-mono">
                        {activeOrder.deliveryMethod === 'geelark_setup'
                          ? (activeOrder.setupFee === 0 ? 'FREE' : `$${Number(activeOrder.setupFee).toFixed(2)}`)
                          : 'Included'}
                      </span>
                    </div>
                    <div className="receipt-row total-paid-row">
                      <span className="rk-bold">Amount paid</span>
                      <span className="rv-bold font-mono">
                        ${Number(activeOrder.totalUsd).toFixed(2)} USD
                      </span>
                    </div>

                    {/* Purchased Workflows */}
                    {activeOrder.items && activeOrder.items.length > 0 && (
                      <div className="receipt-items-list">
                        <span className="items-heading">Purchased workflows:</span>
                        {activeOrder.items.map((item, idx) => (
                          <div key={idx} className="purchased-line">
                            <span>{item.title}</span>
                            <span className="font-mono">${(item.price * (item.quantity || 1)).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Subtle Support Contact */}
                  <div className="confirmed-support-section">
                    <span className="support-title">Need help?</span>
                    <p className="support-desc">
                      If you have any questions about your order or need assistance, contact our support team at{' '}
                      <a href="mailto:support@geelarkflows.com" className="support-email-link font-mono">
                        support@geelarkflows.com
                      </a>.
                    </p>
                  </div>
                </div>

                <div className="confirmation-actions">
                  <button
                    type="button"
                    className="btn-print-receipt"
                    onClick={handlePrintReceipt}
                  >
                    Print receipt
                  </button>
                  <button
                    type="button"
                    className="btn-return-home"
                    onClick={handleReturnToMarketplace}
                  >
                    Return to marketplace →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Leave Payment Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="leave-modal-backdrop" onClick={() => setShowLeaveConfirm(false)}>
          <div className="leave-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="leave-title">Leave payment?</h3>
            <p className="leave-text">
              Your payment for Order <strong>#{activeOrder?.orderId}</strong> is awaiting confirmation on the blockchain. You can safely resume this payment at any time.
            </p>
            <div className="leave-actions">
              <button
                type="button"
                className="btn-stay"
                onClick={() => setShowLeaveConfirm(false)}
              >
                Stay on payment
              </button>
              <button
                type="button"
                className="btn-close-session"
                onClick={handleReturnToMarketplace}
              >
                Return to marketplace
              </button>
              <button
                type="button"
                className="btn-cancel-restart"
                onClick={handleCancelActivePayment}
              >
                Cancel order & restart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
