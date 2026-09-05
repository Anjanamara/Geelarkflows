import React, { useEffect, useState } from 'react';
import { formatAdminDate } from '../dateUtils';
import { redirectIfUnauthorized } from '../apiUtils';
import { formatStatusLabel } from '../formatUtils';

export default function AdminPayments({ navigate, lastSyncedAt }) {
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [network, setNetwork] = useState('all');
  const [status, setStatus] = useState('all');

  const fetchPayments = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '25',
        search,
        network,
        status,
      });

      const res = await fetch(`/api/admin/payments?${params.toString()}`);
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch payments.');

      setPayments(data.payments || []);
      setPagination(data.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 1 });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments(1);
  }, [search, network, status, lastSyncedAt]);

  const handleSyncPayment = async (e, paymentId) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Action': '1',
        },
      });
      if (redirectIfUnauthorized(res)) return;
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Sync failed.');
      fetchPayments(pagination.page);
      alert(`Payment ${paymentId} synced. Live status: ${data.status}`);
    } catch (err) {
      alert(`Sync notice: ${err.message}`);
    }
  };

  return (
    <div>
      <div className="table-panel">
        <div className="table-header-controls">
          <div className="search-input-wrap">
            <input
              type="text"
              className="admin-input"
              placeholder="Search by Payment ID, Order ID, Address, Tx Hash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <select className="admin-select" value={network} onChange={(e) => setNetwork(e.target.value)}>
              <option value="all">All Networks</option>
              <option value="TRC-20">TRC-20 (TRON)</option>
              <option value="BEP-20">BEP-20 (BNB Chain)</option>
              <option value="ERC-20">ERC-20 (Ethereum)</option>
              <option value="SOL">SOL (Solana)</option>
            </select>

            <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="waiting">Waiting</option>
              <option value="confirming">Confirming</option>
              <option value="confirmed">Confirmed</option>
              <option value="finished">Finished</option>
              <option value="expired">Expired</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
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
                <th>Payment ID</th>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Network</th>
                <th>Crypto Amount</th>
                <th>Receiving Address</th>
                <th>Tx Hash</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && payments.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={10} style={{ padding: '16px', color: 'var(--admin-text-muted)', textAlign: 'center' }}>
                      Loading payments...
                    </td>
                  </tr>
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
                    No cryptocurrency payments match your search criteria.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => navigate(`/admin/orders/${p.order_id}`)}>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--admin-text-primary)' }}>
                      {p.id}
                    </td>
                    <td className="font-mono">{p.order_id}</td>
                    <td>{p.customer_email || '—'}</td>
                    <td>
                      <span className="network-badge">{p.currency}</span>
                    </td>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--admin-accent)' }}>
                      {p.pay_amount_crypto} USDT
                    </td>
                    <td className="font-mono" style={{ fontSize: '11px' }}>
                      {p.pay_address ? `${p.pay_address.slice(0, 8)}...${p.pay_address.slice(-6)}` : '—'}
                    </td>
                    <td className="font-mono" style={{ fontSize: '11px' }}>
                      {p.tx_hash ? `${p.tx_hash.slice(0, 10)}...` : '—'}
                    </td>
                    <td>
                      <span className={`status-badge ${p.status}`}>{formatStatusLabel(p.status)}</span>
                    </td>
                    <td className="font-mono">{formatAdminDate(p.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {/^\d+$/.test(p.id) && (
                          <button
                            type="button"
                            className="btn-admin-secondary"
                            style={{ height: '24px', padding: '0 6px', fontSize: '10.5px' }}
                            onClick={(e) => handleSyncPayment(e, p.id)}
                            title="Force sync from NOWPayments"
                          >
                            🔄 Sync
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-admin-secondary"
                          style={{ height: '24px', padding: '0 6px', fontSize: '10.5px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/orders/${p.order_id}`);
                          }}
                        >
                          Order →
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-pagination">
          <span>
            Showing {payments.length} of {pagination.total} payments (Page {pagination.page} of {pagination.totalPages})
          </span>
          <div className="pagination-buttons">
            <button
              type="button"
              className="btn-page"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchPayments(pagination.page - 1)}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="btn-page"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchPayments(pagination.page + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
