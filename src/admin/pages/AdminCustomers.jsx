import React, { useEffect, useState } from 'react';
import { formatAdminDate } from '../dateUtils';

export default function AdminCustomers({ navigate, lastSyncedAt }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Selected Customer Modal / Drawer
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/customers');
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch customers.');
      setCustomers(data.customers || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [lastSyncedAt]);

  const openCustomerDetail = async (email) => {
    setSelectedEmail(email);
    setCustomerDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${encodeURIComponent(email)}`);
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load customer history.');
      setCustomerDetail(data.customer);
    } catch (err) {
      console.error('Customer fetch error:', err);
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    if (!search) return true;
    return c.email.toLowerCase().includes(search.toLowerCase());
  });

  const totalSpentAll = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);

  return (
    <div>
      {/* Metrics Row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="stat-card">
          <span className="stat-label">Total Unique Customers</span>
          <span className="stat-value">{customers.length}</span>
          <span className="stat-sub">Across all registered checkouts</span>
        </div>
        <div className="stat-card featured">
          <span className="stat-label">Total Customer Volume</span>
          <span className="stat-value">${totalSpentAll.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          <span className="stat-sub font-mono">
            Avg: ${customers.length > 0 ? (totalSpentAll / customers.length).toFixed(2) : '0.00'} / customer
          </span>
        </div>
      </div>

      <div className="table-panel">
        <div className="table-header-controls">
          <div className="search-input-wrap">
            <input
              type="text"
              className="admin-input"
              placeholder="Search customers by email address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
                <th>Customer Email</th>
                <th>Total Orders</th>
                <th>Total Spent (USD)</th>
                <th>First Order</th>
                <th>Last Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && customers.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} style={{ padding: '16px', color: 'var(--admin-text-muted)', textAlign: 'center' }}>
                      Loading customer directory...
                    </td>
                  </tr>
                ))
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
                    No customer accounts match your search.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => (
                  <tr key={cust.email} className="clickable" onClick={() => openCustomerDetail(cust.email)}>
                    <td style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>{cust.email}</td>
                    <td className="font-mono">{cust.order_count}</td>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--admin-accent)' }}>
                      ${Number(cust.total_spent || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="font-mono">{formatAdminDate(cust.first_order_at)}</td>
                    <td className="font-mono">{formatAdminDate(cust.last_order_at)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-admin-secondary"
                        style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openCustomerDetail(cust.email);
                        }}
                      >
                        History →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Detail Profile Modal */}
      {selectedEmail && (
        <div className="admin-modal-overlay" onClick={() => setSelectedEmail(null)}>
          <div className="admin-modal-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h3 className="admin-modal-title" style={{ fontFamily: 'var(--admin-font-mono)' }}>{selectedEmail}</h3>
                <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>Customer Purchase History</span>
              </div>
              <button type="button" className="admin-modal-close" onClick={() => setSelectedEmail(null)}>✕</button>
            </div>

            <div className="admin-modal-body">
              {detailLoading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>Loading history...</div>
              ) : detailError ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ color: 'var(--admin-danger, #e05252)', marginBottom: '12px' }}>{detailError}</div>
                  <button type="button" className="btn-admin-secondary" onClick={() => openCustomerDetail(selectedEmail)}>Retry</button>
                </div>
              ) : !customerDetail ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>No history found.</div>
              ) : (
                <>
                  <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', margin: 0 }}>
                    <div className="stat-card">
                      <span className="stat-label">Lifetime Orders</span>
                      <span className="stat-value">{customerDetail.total_orders}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Purchased Workflows</span>
                      <span className="stat-value">{customerDetail.purchased_workflows?.length || 0}</span>
                    </div>
                  </div>

                  <div>
                    <strong style={{ fontSize: '12.5px', display: 'block', marginBottom: '8px' }}>Order Records</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {customerDetail.orders?.map((ord) => (
                        <div
                          key={ord.id}
                          className="clickable"
                          style={{
                            padding: '10px 12px',
                            background: 'var(--admin-surface-subtle)',
                            border: '1px solid var(--admin-border)',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          onClick={() => {
                            setSelectedEmail(null);
                            navigate(`/admin/orders/${ord.id}`);
                          }}
                        >
                          <div>
                            <span className="font-mono" style={{ fontWeight: 700, color: 'var(--admin-text-primary)', display: 'block' }}>
                              #{ord.id}
                            </span>
                            <span className="font-mono" style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
                              {formatAdminDate(ord.created_at)} · ${Number(ord.total_usd || 0).toFixed(2)} USD
                            </span>
                          </div>
                          <span className={`status-badge ${ord.status}`}>{ord.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="admin-modal-footer">
              <button type="button" className="btn-admin-secondary" onClick={() => setSelectedEmail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
