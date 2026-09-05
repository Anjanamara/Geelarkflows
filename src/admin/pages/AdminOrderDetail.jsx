import React, { useEffect, useState } from 'react';
import { formatAdminDateTime, formatAdminTime } from '../dateUtils';
import { redirectIfUnauthorized } from '../apiUtils';
import { formatStatusLabel } from '../formatUtils';

export default function AdminOrderDetail({ orderId, navigate, user, onActionSuccess }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status Transition Modal
  const [transitionModal, setTransitionModal] = useState({ open: false, targetStatus: '', reason: '' });
  const [transitioning, setTransitioning] = useState(false);

  // Manual Payment Verification Modal
  const [manualVerifyModal, setManualVerifyModal] = useState({ open: false, reason: '', txHash: '' });
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  // Resend Fulfillment Action
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState(null);

  // Live Gateway Sync
  const [syncingGateway, setSyncingGateway] = useState(false);
  const [gatewayNotice, setGatewayNotice] = useState(null);

  const fetchOrderDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to fetch order.');

      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
  }, [orderId]);

  const handleExecuteTransition = async () => {
    setTransitioning(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Action': '1',
        },
        body: JSON.stringify({
          target_status: transitionModal.targetStatus,
          reason: transitionModal.reason,
        }),
      });

      if (redirectIfUnauthorized(res)) return;
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Transition failed.');

      setTransitionModal({ open: false, targetStatus: '', reason: '' });
      fetchOrderDetail();
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setTransitioning(false);
    }
  };

  const handleExecuteManualVerify = async () => {
    if (!manualVerifyModal.reason || manualVerifyModal.reason.trim().length < 10) {
      alert('A detailed justification (min 10 characters) is required.');
      return;
    }

    setVerifyingPayment(true);
    try {
      const payId = data?.payment?.id || orderId;
      const res = await fetch(`/api/admin/payments/${payId}/manual-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Action': '1',
        },
        body: JSON.stringify({
          reason: manualVerifyModal.reason.trim(),
          tx_hash: manualVerifyModal.txHash.trim() || undefined,
        }),
      });

      if (redirectIfUnauthorized(res)) return;
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Verification failed.');

      setManualVerifyModal({ open: false, reason: '', txHash: '' });
      fetchOrderDetail();
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      alert(`Manual verification error: ${err.message}`);
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleSyncGateway = async () => {
    setSyncingGateway(true);
    setGatewayNotice(null);
    try {
      const payId = data?.payment?.id || orderId;
      const res = await fetch(`/api/admin/payments/${payId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Action': '1',
        },
      });

      if (redirectIfUnauthorized(res)) return;
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Gateway sync failed.');

      setGatewayNotice({
        type: 'success',
        text: json.orderReconciled
          ? `Gateway status ${json.status}; order reconciled from ${json.previousOrderStatus} to ${json.orderStatus}.`
          : `Gateway status ${json.status}; order state already consistent.`,
      });
      fetchOrderDetail();
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      setGatewayNotice({ type: 'error', text: err.message });
    } finally {
      setSyncingGateway(false);
    }
  };

  const handleUpdateFulfillmentStatus = async (newStatus) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/fulfillment-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Action': '1',
        },
        body: JSON.stringify({
          target_status: newStatus,
          reason: `Admin changed fulfillment status to ${newStatus}`,
        }),
      });

      if (redirectIfUnauthorized(res)) return;
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update fulfillment status.');

      fetchOrderDetail();
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      alert(`Error updating fulfillment: ${err.message}`);
    }
  };

  const handleResendFulfillment = async () => {
    setResending(true);
    setResendNotice(null);
    try {
      const res = await fetch(`/api/admin/fulfillment/${orderId}/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Action': '1',
        },
        body: JSON.stringify({
          idempotency_key: `admin_resend_${orderId}_${Date.now()}`,
          reason: 'Manual re-delivery initiated from Order Detail',
        }),
      });

      if (redirectIfUnauthorized(res)) return;
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Fulfillment dispatch failed.');

      setResendNotice({ type: 'success', text: json.message || 'Digital package re-dispatched successfully.' });
      fetchOrderDetail();
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      setResendNotice({ type: 'error', text: err.message });
    } finally {
      setResending(false);
    }
  };

  if (loading && !data) {
    return <div style={{ padding: '32px', color: 'var(--admin-text-muted)', textAlign: 'center' }}>Loading order #{orderId}...</div>;
  }

  if (error || !data) {
    return (
      <div className="table-panel" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--admin-danger)', marginBottom: '16px' }}>{error || 'Order not found'}</p>
        <button type="button" className="btn-admin-secondary" onClick={() => navigate('/admin/orders')}>
          ← Back to Orders
        </button>
      </div>
    );
  }

  const order = data.order;
  const payment = data.payment;
  const fulfillmentLogs = data.fulfillment_logs || [];
  const auditHistory = data.audit_history || [];

  // Allowed transitions
  const ALLOWED_ORDER_TRANSITIONS = {
    pending: ['awaiting_payment', 'cancelled'],
    awaiting_payment: ['cancelled'],
    paid: ['processing', 'refunded'],
    processing: ['completed', 'refunded'],
    completed: ['refunded'],
    cancelled: [],
    refunded: [],
    failed: [],
  };
  const nextAllowed = ALLOWED_ORDER_TRANSITIONS[order.status] || [];

  const confirmedPaymentStatuses = ['confirmed', 'finished', 'paid'];
  const activePaymentStatuses = ['waiting', 'confirming', 'sending', 'partially_paid'];
  const settledOrderStatuses = ['paid', 'processing', 'completed'];
  const paymentStatus = String(payment?.status || '').toLowerCase();
  const isPaymentConfirmed = confirmedPaymentStatuses.includes(paymentStatus);
  const isOrderSettled = settledOrderStatuses.includes(order.status);
  const canFulfill = isOrderSettled && isPaymentConfirmed;
  const failedWithActiveInvoice = order.status === 'failed' && activePaymentStatuses.includes(paymentStatus);
  const settledWithoutConfirmedPayment = isOrderSettled && !isPaymentConfirmed;

  // Fulfillment transition options based on delivery method
  const isSetup = order.delivery_method === 'geelark_setup';
  const fulfillmentStages = isSetup
    ? [
        { id: 'setup_pending', label: 'Setup Pending' },
        { id: 'setup_in_progress', label: 'Setup In Progress' },
        { id: 'setup_completed', label: 'Setup Completed' },
      ]
    : [
        { id: 'fulfillment_pending', label: 'Fulfillment Pending' },
        { id: 'package_preparing', label: 'Package Preparing' },
        { id: 'package_delivered', label: 'Package Delivered' },
      ];
  const fulfillmentTransitions = isSetup
    ? {
        not_ready: ['setup_pending'],
        setup_pending: ['setup_in_progress', 'failed'],
        setup_in_progress: ['setup_completed', 'failed'],
        setup_completed: [],
        failed: [],
      }
    : {
        not_ready: ['fulfillment_pending'],
        fulfillment_pending: ['package_preparing', 'failed'],
        package_preparing: ['package_delivered', 'failed'],
        package_delivered: [],
        failed: [],
      };
  const allowedFulfillmentTargets = fulfillmentTransitions[order.fulfillment_status || 'not_ready'] || [];

  return (
    <div>
      {/* Top Breadcrumb & Actions Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button type="button" className="btn-admin-secondary" style={{ height: '30px' }} onClick={() => navigate('/admin/orders')}>
            ← Orders
          </button>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, fontFamily: 'var(--admin-font-mono)' }}>
            #{order.id}
          </h2>
          <span className={`status-badge ${order.status}`}>{order.status}</span>
          <span className="network-badge" style={{ fontSize: '11px' }}>
            {isSetup ? 'GeeLark Setup' : 'Downloadable Package'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {payment?.id && /^\d+$/.test(payment.id) && (
            <button
              type="button"
              className="btn-admin-secondary"
              onClick={handleSyncGateway}
              disabled={syncingGateway}
            >
              {syncingGateway ? 'Syncing...' : '🔄 Sync Gateway'}
            </button>
          )}
          {user?.role === 'SUPER_ADMIN' && !isPaymentConfirmed && (
            <button
              type="button"
              className="btn-admin-primary"
              onClick={() => setManualVerifyModal({ open: true, reason: '', txHash: '' })}
            >
              ⚡ Force Settle (Override)
            </button>
          )}
        </div>
      </div>

      {/* Resend Notice */}
      {resendNotice && (
        <div className={`attention-banner ${resendNotice.type === 'success' ? 'warning' : 'danger'}`} style={{ marginBottom: '16px' }}>
          {resendNotice.text}
        </div>
      )}
      {gatewayNotice && (
        <div className={`attention-banner ${gatewayNotice.type === 'success' ? 'warning' : 'danger'}`} style={{ marginBottom: '16px' }}>
          {gatewayNotice.text}
        </div>
      )}
      {failedWithActiveInvoice && (
        <div className="attention-banner warning" style={{ marginBottom: '16px' }}>
          <strong>Status mismatch:</strong> this order is marked failed, but NOWPayments still reports an active <span className="font-mono">{paymentStatus}</span> invoice. Use <strong>Sync Gateway</strong> to restore the order to awaiting payment. Fulfillment remains locked.
        </div>
      )}
      {settledWithoutConfirmedPayment && (
        <div className="attention-banner danger" style={{ marginBottom: '16px' }}>
          <strong>Critical mismatch:</strong> the order is marked {order.status}, but the payment record is <span className="font-mono">{paymentStatus || 'missing'}</span>. Verify with NOWPayments before fulfillment.
        </div>
      )}

      {/* Main 2-Column Order Operations Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.95fr)', gap: '20px' }}>
        {/* Left Column: Items, Financial Breakdown, Payment, Fulfillment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Purchased Items Card */}
          <div className="table-panel" style={{ margin: 0 }}>
            <div className="table-header-controls">
              <strong style={{ fontSize: '13px' }}>Purchased Workflows ({order.items.length})</strong>
            </div>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Workflow Title</th>
                    <th>Platform</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>{item.title}</td>
                      <td>{item.platform || 'GeeLark'}</td>
                      <td className="font-mono">${Number(item.price || 0).toFixed(2)}</td>
                      <td className="font-mono">{item.quantity || 1}</td>
                      <td className="font-mono" style={{ fontWeight: 700 }}>
                        ${((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary Breakdown */}
            <div style={{ padding: '14px 20px', background: 'var(--admin-surface-2, rgba(255,255,255,0.02))', borderTop: '1px solid var(--admin-border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <div>
                  <span className="stat-label" style={{ display: 'block', marginBottom: '2px' }}>Delivery Method</span>
                  <strong style={{ fontSize: '12px', color: 'var(--admin-text-primary)' }}>
                    {isSetup ? 'GeeLark Account Setup' : 'Downloadable Package'}
                  </strong>
                </div>
                <div>
                  <span className="stat-label" style={{ display: 'block', marginBottom: '2px' }}>Workflow Subtotal</span>
                  <span className="font-mono" style={{ fontSize: '12.5px', color: 'var(--admin-text-primary)' }}>
                    ${Number(order.workflow_subtotal || order.total_usd || 0).toFixed(2)} USD
                  </span>
                </div>
                <div>
                  <span className="stat-label" style={{ display: 'block', marginBottom: '2px' }}>Setup Fee</span>
                  <span className="font-mono" style={{ fontSize: '12.5px', color: isSetup && Number(order.setup_fee) === 0 ? 'var(--admin-accent)' : 'var(--admin-text-primary)' }}>
                    {isSetup
                      ? (Number(order.setup_fee) === 0 ? 'FREE ($0.00)' : `$${Number(order.setup_fee).toFixed(2)} USD`)
                      : 'Included ($0.00)'}
                  </span>
                </div>
                {order.coupon_code && Number(order.coupon_discount_usd || 0) > 0 && (
                  <div>
                    <span className="stat-label" style={{ display: 'block', marginBottom: '2px' }}>Coupon ({order.coupon_code})</span>
                    <span className="font-mono" style={{ fontSize: '12.5px', color: 'var(--admin-accent)' }}>
                      −${Number(order.coupon_discount_usd).toFixed(2)} USD
                    </span>
                  </div>
                )}
                <div>
                  <span className="stat-label" style={{ display: 'block', marginBottom: '2px' }}>{isPaymentConfirmed ? 'Total Paid' : 'Invoice Total (Unpaid)'}</span>
                  <span className="font-mono" style={{ fontSize: '13px', fontWeight: 700, color: isPaymentConfirmed ? 'var(--admin-accent)' : 'var(--admin-text-primary)' }}>
                    ${Number(order.total_usd || 0).toFixed(2)} USD
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Crypto Payment Record Card */}
          <div className="table-panel" style={{ margin: 0 }}>
            <div className="table-header-controls">
              <strong style={{ fontSize: '13px' }}>Cryptocurrency Settlement</strong>
              {payment?.verification_source && (
                <span style={{ fontSize: '10.5px', fontFamily: 'var(--admin-font-mono)', color: 'var(--admin-text-muted)' }}>
                  Source: {payment.verification_source}
                </span>
              )}
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {payment ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                    <div>
                      <span className="stat-label" style={{ marginBottom: '4px', display: 'block' }}>Payment ID</span>
                      <span className="font-mono" style={{ color: 'var(--admin-text-primary)' }}>{payment.id}</span>
                    </div>
                    <div>
                      <span className="stat-label" style={{ marginBottom: '4px', display: 'block' }}>Network</span>
                      <span className="network-badge">{payment.currency}</span>
                    </div>
                    <div>
                      <span className="stat-label" style={{ marginBottom: '4px', display: 'block' }}>{isPaymentConfirmed ? 'Crypto Amount Paid' : 'Crypto Amount Requested'}</span>
                      <span className="font-mono" style={{ fontWeight: 700, color: isPaymentConfirmed ? 'var(--admin-accent)' : 'var(--admin-text-primary)' }}>
                        {payment.pay_amount_crypto} USDT
                      </span>
                    </div>
                    <div>
                      <span className="stat-label" style={{ marginBottom: '4px', display: 'block' }}>Payment Status</span>
                      <span className={`status-badge ${payment.status}`}>{formatStatusLabel(payment.status)}</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '12px' }}>
                    <span className="stat-label" style={{ marginBottom: '4px', display: 'block' }}>Receiving Address</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="font-mono" style={{ wordBreak: 'break-all', fontSize: '12px' }}>{payment.pay_address}</span>
                      {payment.addressExplorerUrl && (
                        <a href={payment.addressExplorerUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--admin-accent)', textDecoration: 'none' }}>
                          Explorer ↗
                        </a>
                      )}
                    </div>
                  </div>

                  {payment.tx_hash && (
                    <div style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '12px' }}>
                      <span className="stat-label" style={{ marginBottom: '4px', display: 'block' }}>Transaction Hash</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="font-mono" style={{ wordBreak: 'break-all', fontSize: '12px' }}>{payment.tx_hash}</span>
                        {payment.explorerUrl && (
                          <a href={payment.explorerUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--admin-accent)', textDecoration: 'none' }}>
                            Verify On-Chain ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p style={{ color: 'var(--admin-text-muted)' }}>No cryptocurrency invoice registered.</p>
              )}
            </div>
          </div>

          {/* Fulfillment Card */}
          <div className="table-panel" style={{ margin: 0 }}>
            <div className="table-header-controls">
              <strong style={{ fontSize: '13px' }}>
                {isSetup ? 'GeeLark Account Setup Fulfillment' : 'Digital Package Fulfillment'}
              </strong>
              <span className={`status-badge ${order.fulfillment_status || 'not_ready'}`}>
                {formatStatusLabel(order.fulfillment_status || 'not_ready')}
              </span>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span className="stat-label" style={{ display: 'block', marginBottom: '2px' }}>
                    {isSetup ? 'Customer Setup Contact Email' : 'Recipient Delivery Email'}
                  </span>
                  <span className="font-mono" style={{ color: 'var(--admin-text-primary)' }}>{order.customer_email}</span>
                </div>
                {!isSetup && canFulfill && (
                  <button
                    type="button"
                    className="btn-admin-secondary"
                    onClick={handleResendFulfillment}
                    disabled={resending}
                  >
                    {resending ? 'Dispatching...' : '⚡ Resend Package Email'}
                  </button>
                )}
              </div>

              {/* Advance Fulfillment Status Action */}
              <div style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '12px' }}>
                <span className="stat-label" style={{ display: 'block', marginBottom: '8px' }}>
                  Update Fulfillment Lifecycle State:
                </span>
                {!canFulfill && (
                  <p style={{ marginBottom: '10px', color: 'var(--admin-danger)', fontSize: '11.5px' }}>
                    Locked until both records confirm settlement. Order: <strong className="font-mono">{order.status}</strong>; payment: <strong className="font-mono">{paymentStatus || 'missing'}</strong>.
                  </p>
                )}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {fulfillmentStages.map((stage) => {
                    const isCurrent = order.fulfillment_status === stage.id;
                    const isAllowedNext = allowedFulfillmentTargets.includes(stage.id);
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        className={isCurrent ? 'btn-admin-primary' : 'btn-admin-secondary'}
                        style={{ height: '30px', fontSize: '11.5px' }}
                        disabled={isCurrent || !canFulfill || !isAllowedNext}
                        onClick={() => handleUpdateFulfillmentStatus(stage.id)}
                      >
                        {isCurrent ? `✓ ${stage.label}` : `Set ${stage.label}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {order.delivered_at && (
                <div style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)', fontFamily: 'var(--admin-font-mono)' }}>
                  Completed at: {formatAdminDateTime(order.delivered_at)}
                </div>
              )}

              {/* Fulfillment Attempt Logs */}
              {fulfillmentLogs.length > 0 && (
                <div style={{ marginTop: '4px', borderTop: '1px solid var(--admin-border)', paddingTop: '10px' }}>
                  <span className="stat-label" style={{ display: 'block', marginBottom: '6px' }}>Delivery History</span>
                  {fulfillmentLogs.map((log) => (
                    <div key={log.id} style={{ fontSize: '11.5px', display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span className="font-mono">{formatAdminTime(log.created_at)} ({log.triggered_by})</span>
                      <span className={`status-badge ${log.status}`}>{log.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: State Machine, Timeline, Audit Trail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Order State Transition Control */}
          <div className="table-panel" style={{ margin: 0, padding: '20px' }}>
            <strong style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>Order Status Control</strong>
            <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '14px' }}>
              Current: <strong className="font-mono">{order.status}</strong>
            </p>

            {nextAllowed.length === 0 ? (
              <p style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)' }}>
                {failedWithActiveInvoice
                  ? 'Manual transitions are locked because the live invoice is active. Use Sync Gateway to reconcile this order.'
                  : `This order is in a terminal state (${order.status}). No further manual transitions are allowed.`}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span className="stat-label">Advance Status:</span>
                {nextAllowed.map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={['cancelled', 'refunded'].includes(st) ? 'btn-admin-danger' : 'btn-admin-primary'}
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => setTransitionModal({ open: true, targetStatus: st, reason: '' })}
                  >
                    Transition to "{st}" →
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Interactive Event Timeline */}
          <div className="table-panel" style={{ margin: 0, padding: '20px' }}>
            <strong style={{ fontSize: '13px', display: 'block', marginBottom: '16px' }}>Operational Timeline</strong>
            <div className="admin-timeline">
              <div className="timeline-step done">
                <span className="timeline-dot" />
                <span className="timeline-title">Order Created</span>
                <span className="timeline-time">{formatAdminDateTime(order.created_at)}</span>
              </div>

              {payment && (
                <div className="timeline-step done">
                  <span className="timeline-dot" />
                  <span className="timeline-title">Crypto Invoice Created ({payment.currency})</span>
                  <span className="timeline-time">{formatAdminDateTime(payment.created_at)}</span>
                </div>
              )}

              <div className={`timeline-step ${isPaymentConfirmed ? 'done' : ''}`}>
                <span className="timeline-dot" />
                <span className="timeline-title">Payment Confirmed</span>
                <span className="timeline-time">
                  {isPaymentConfirmed
                    ? 'Settled on blockchain'
                    : order.status === 'failed'
                      ? `Not confirmed — order failed (${paymentStatus || 'no payment status'})`
                      : `Awaiting confirmation (${paymentStatus || 'no payment status'})`}
                </span>
              </div>

              <div className={`timeline-step ${['package_delivered', 'setup_completed'].includes(order.fulfillment_status) ? 'done' : ''}`}>
                <span className="timeline-dot" />
                <span className="timeline-title">Secure Fulfillment Dispatched</span>
                <span className="timeline-time">
                  {formatAdminDateTime(order.delivered_at, 'Pending delivery')}
                </span>
              </div>
            </div>
          </div>

          {/* Audit History Log */}
          {auditHistory.length > 0 && (
            <div className="table-panel" style={{ margin: 0, padding: '16px 20px' }}>
              <strong style={{ fontSize: '13px', display: 'block', marginBottom: '12px' }}>Order Audit History</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {auditHistory.map((aud) => (
                  <div key={aud.id} style={{ borderBottom: '1px solid var(--admin-border)', paddingBottom: '8px', fontSize: '11.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--admin-text-secondary)' }}>
                      <strong>{aud.action}</strong>
                      <span className="font-mono">{formatAdminTime(aud.created_at)}</span>
                    </div>
                    <div style={{ color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                      By: {aud.actor_admin_email} | {aud.previous_state} → {aud.new_state}
                    </div>
                    {aud.reason && (
                      <div style={{ color: 'var(--admin-text-primary)', marginTop: '2px', fontStyle: 'italic' }}>
                        "{aud.reason}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* State Transition Confirmation Modal */}
      {transitionModal.open && (
        <div className="admin-modal-overlay" onClick={() => setTransitionModal({ open: false, targetStatus: '', reason: '' })}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Confirm Status Transition</h3>
              <button type="button" className="admin-modal-close" onClick={() => setTransitionModal({ open: false, targetStatus: '', reason: '' })}>✕</button>
            </div>
            <div className="admin-modal-body">
              <p style={{ fontSize: '12.5px', color: 'var(--admin-text-secondary)' }}>
                Are you sure you want to transition Order <strong>#{order.id}</strong> from <strong>{order.status}</strong> to <strong>{transitionModal.targetStatus}</strong>?
              </p>
              <div>
                <label className="login-label" htmlFor="transition-reason">Operational Reason / Notes</label>
                <input
                  id="transition-reason"
                  type="text"
                  className="admin-input"
                  placeholder="e.g. Configuration files verified and delivered to client"
                  value={transitionModal.reason}
                  onChange={(e) => setTransitionModal({ ...transitionModal, reason: e.target.value })}
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-admin-secondary"
                onClick={() => setTransitionModal({ open: false, targetStatus: '', reason: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-admin-primary"
                onClick={handleExecuteTransition}
                disabled={transitioning}
              >
                {transitioning ? 'Updating...' : 'Confirm Transition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Verification Modal (Super Admin) */}
      {manualVerifyModal.open && (
        <div className="admin-modal-overlay" onClick={() => setManualVerifyModal({ open: false, reason: '', txHash: '' })}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Manual Payment Verification (Super Admin)</h3>
              <button type="button" className="admin-modal-close" onClick={() => setManualVerifyModal({ open: false, reason: '', txHash: '' })}>✕</button>
            </div>
            <div className="admin-modal-body">
              <div className="attention-banner danger" style={{ margin: 0 }}>
                ⚠️ Manual verification will permanently mark this order as PAID and trigger digital asset fulfillment. This action is permanently audited.
              </div>
              <div>
                <label className="login-label" htmlFor="manual-tx">Transaction Hash (Optional)</label>
                <input
                  id="manual-tx"
                  type="text"
                  className="admin-input font-mono"
                  placeholder="0x..."
                  value={manualVerifyModal.txHash}
                  onChange={(e) => setManualVerifyModal({ ...manualVerifyModal, txHash: e.target.value })}
                />
              </div>
              <div>
                <label className="login-label" htmlFor="manual-reason">Mandatory Justification (Min 10 chars)*</label>
                <textarea
                  id="manual-reason"
                  className="admin-input"
                  style={{ height: '70px', padding: '8px 12px' }}
                  placeholder="e.g. Verified transaction on Tronscan explorer manually due to webhook delay"
                  value={manualVerifyModal.reason}
                  onChange={(e) => setManualVerifyModal({ ...manualVerifyModal, reason: e.target.value })}
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-admin-secondary"
                onClick={() => setManualVerifyModal({ open: false, reason: '', txHash: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-admin-danger"
                onClick={handleExecuteManualVerify}
                disabled={verifyingPayment}
              >
                {verifyingPayment ? 'Verifying...' : 'Authorize Manual Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
