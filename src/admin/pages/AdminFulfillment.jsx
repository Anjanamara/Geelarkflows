import React, { useEffect, useState } from 'react';
import { formatAdminDateTime } from '../dateUtils';
import { redirectIfUnauthorized } from '../apiUtils';
import { formatStatusLabel } from '../formatUtils';

export default function AdminFulfillment({ navigate, lastSyncedAt }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchFulfillmentQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/fulfillment');
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch fulfillment queue.');
      setQueue(data.fulfillment_queue || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFulfillmentQueue();
  }, [lastSyncedAt]);

  const handleResend = async (orderId) => {
    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/admin/fulfillment/${orderId}/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Action': '1',
        },
        body: JSON.stringify({
          idempotency_key: `fulfillment_queue_resend_${orderId}_${Date.now()}`,
          reason: 'Admin triggered re-delivery from fulfillment dashboard',
        }),
      });
      if (redirectIfUnauthorized(res)) return;
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Resend failed.');
      fetchFulfillmentQueue();
      alert(`Secure fulfillment email sent for order #${orderId}`);
    } catch (err) {
      alert(`Fulfillment notice: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <div className="table-panel">
        <div className="table-header-controls">
          <div>
            <strong style={{ fontSize: '13px', display: 'block' }}>Digital Workflow Fulfillment Queue</strong>
            <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
              Tracks automated digital package delivery and technical onboarding emails via Resend.
            </span>
          </div>
          <button type="button" className="btn-admin-secondary" onClick={fetchFulfillmentQueue}>
            🔄 Refresh Queue
          </button>
        </div>

        {error && (
          <div style={{ padding: '20px', color: 'var(--admin-danger)', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Recipient Email</th>
                <th>Order Status</th>
                <th>Payment Status</th>
                <th>Amount (USD)</th>
                <th>Fulfillment Status</th>
                <th>Delivered At</th>
                <th>Attempts</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && queue.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} style={{ padding: '16px', color: 'var(--admin-text-muted)', textAlign: 'center' }}>
                      Loading fulfillment queue...
                    </td>
                  </tr>
                ))
              ) : queue.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
                    No paid orders in fulfillment queue.
                  </td>
                </tr>
              ) : (
                queue.map((item) => (
                  <tr key={item.id} className="clickable" onClick={() => navigate(`/admin/orders/${item.id}`)}>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--admin-text-primary)' }}>
                      {item.id}
                    </td>
                    <td>{item.customer_email}</td>
                    <td>
                      <span className={`status-badge ${item.status}`}>{item.status}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${item.payment_status || 'waiting'}`}>
                        {formatStatusLabel(item.payment_status || 'waiting')}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontWeight: 700 }}>
                      ${Number(item.total_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={`status-badge ${item.fulfillment_status || 'not_ready'}`}>
                        {formatStatusLabel(item.fulfillment_status || 'not_ready')}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontSize: '11px' }}>
                      {formatAdminDateTime(item.delivered_at, 'Pending')}
                    </td>
                    <td className="font-mono">{item.attempt_count || 1}</td>
                    <td>
                      {['paid', 'processing', 'completed'].includes(item.status) ? (
                        <button
                          type="button"
                          className="btn-admin-secondary"
                          style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResend(item.id);
                          }}
                          disabled={actionLoading === item.id}
                        >
                          {actionLoading === item.id ? 'Dispatching...' : '⚡ Deliver securely'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>Awaiting Payment</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
