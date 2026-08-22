import React, { useEffect, useState } from 'react';

export default function AdminOverview({ navigate, lastSyncedAt }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load dashboard.');
      setData(json.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [lastSyncedAt]);

  if (loading && !data) {
    return (
      <div>
        <div className="stats-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="stat-card" style={{ opacity: 0.6 }}>
              <div className="stat-label">Loading...</div>
              <div className="stat-value">---</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="table-panel" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--admin-danger)', marginBottom: '16px' }}>{error}</p>
        <button type="button" className="btn-admin-secondary" onClick={fetchDashboard}>
          Retry Loading
        </button>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const alerts = data?.attention_alerts || [];
  const recentOrders = data?.recent_orders || [];
  const networkDistribution = data?.network_distribution || [];

  return (
    <div>
      {/* Attention Banners */}
      {alerts.length > 0 && (
        <div className="attention-banner-list">
          {alerts.map((alert) => (
            <div key={alert.id} className={`attention-banner ${alert.type}`}>
              <span>⚠️ {alert.title}</span>
              <button
                type="button"
                className="attention-btn"
                onClick={() => navigate(alert.link)}
              >
                Resolve Action →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Top Level Metric KPIs */}
      <div className="stats-grid">
        <div className="stat-card featured">
          <span className="stat-label">Net Revenue</span>
          <span className="stat-value">${metrics.net_revenue?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          <span className="stat-sub font-mono">Gross: ${metrics.gross_revenue?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Total Orders</span>
          <span className="stat-value">{metrics.total_orders}</span>
          <span className="stat-sub font-mono">{metrics.completed} Completed</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Paid / Processing</span>
          <span className="stat-value" style={{ color: 'var(--admin-success)' }}>
            {(metrics.paid || 0) + (metrics.processing || 0)}
          </span>
          <span className="stat-sub font-mono">{metrics.fulfillment_pending} Pending Delivery</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Awaiting Payment</span>
          <span className="stat-value" style={{ color: 'var(--admin-warning)' }}>
            {(metrics.awaiting_payment || 0) + (metrics.pending || 0)}
          </span>
          <span className="stat-sub font-mono">{metrics.verifying} On-Chain Verifying</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Cancelled / Refunded</span>
          <span className="stat-value" style={{ color: 'var(--admin-text-muted)' }}>
            {(metrics.cancelled || 0) + (metrics.refunded || 0)}
          </span>
          <span className="stat-sub font-mono">-${metrics.refunded_amount?.toFixed(2)} USD</span>
        </div>
      </div>

      {/* 2-Column Grid: Network Breakdown + Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Network Share Panel */}
        <div className="table-panel" style={{ margin: 0 }}>
          <div className="table-header-controls">
            <strong style={{ fontSize: '13px', color: 'var(--admin-text-primary)' }}>Sales by USDT Network</strong>
            <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', fontFamily: 'var(--admin-font-mono)' }}>Live Settlement</span>
          </div>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Network</th>
                  <th>Transactions</th>
                  <th>Volume (USD)</th>
                </tr>
              </thead>
              <tbody>
                {networkDistribution.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--admin-text-muted)', padding: '24px' }}>
                      No confirmed network transactions yet.
                    </td>
                  </tr>
                ) : (
                  networkDistribution.map((net, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className={`network-badge ${String(net.currency).toLowerCase().replace(/[^a-z0-9]/g, '')}`}>
                          {net.currency}
                        </span>
                      </td>
                      <td className="font-mono">{net.tx_count}</td>
                      <td className="font-mono" style={{ fontWeight: 700, color: 'var(--admin-text-primary)' }}>
                        ${Number(net.total_volume || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Operations Actions Panel */}
        <div className="table-panel" style={{ margin: 0, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <strong style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>Operations Shortcuts</strong>
            <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '16px' }}>
              Jump directly to specific operational task queues.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                className="btn-admin-secondary"
                style={{ justifyContent: 'flex-start', width: '100%' }}
                onClick={() => navigate('/admin/fulfillment')}
              >
                ⚡ View Fulfillment Queue ({metrics.fulfillment_pending} pending)
              </button>
              <button
                type="button"
                className="btn-admin-secondary"
                style={{ justifyContent: 'flex-start', width: '100%' }}
                onClick={() => navigate('/admin/orders?status=paid')}
              >
                📦 View Paid Orders Queue
              </button>
              <button
                type="button"
                className="btn-admin-secondary"
                style={{ justifyContent: 'flex-start', width: '100%' }}
                onClick={() => navigate('/admin/payments')}
              >
                💳 Inspect Crypto Blockchain Payments
              </button>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)', fontFamily: 'var(--admin-font-mono)', marginTop: '16px' }}>
            System Sync: {new Date(data?.synced_at || Date.now()).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Recent Orders Table Panel */}
      <div className="table-panel">
        <div className="table-header-controls">
          <strong style={{ fontSize: '13px', color: 'var(--admin-text-primary)' }}>Recent Orders</strong>
          <button
            type="button"
            className="btn-admin-secondary"
            style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
            onClick={() => navigate('/admin/orders')}
          >
            View all orders →
          </button>
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Payment Network</th>
                <th>Status</th>
                <th>Fulfillment</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--admin-text-muted)', padding: '32px' }}>
                    No orders recorded yet.
                  </td>
                </tr>
              ) : (
                recentOrders.map((ord) => (
                  <tr key={ord.id} className="clickable" onClick={() => navigate(`/admin/orders/${ord.id}`)}>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--admin-text-primary)' }}>
                      {ord.id}
                    </td>
                    <td className="font-mono">{new Date(ord.created_at).toLocaleDateString()}</td>
                    <td>{ord.customer_email}</td>
                    <td className="font-mono" style={{ fontWeight: 700 }}>
                      ${Number(ord.total_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className="network-badge">{ord.payment_currency || 'USDT'}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${ord.status}`}>{ord.status}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${ord.fulfillment_status || 'not_ready'}`}>
                        {ord.fulfillment_status || 'not_ready'}
                      </span>
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
