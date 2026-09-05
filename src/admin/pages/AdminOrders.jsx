import React, { useEffect, useState } from 'react';
import { formatAdminDate } from '../dateUtils';
import { formatStatusLabel } from '../formatUtils';

export default function AdminOrders({ navigate, lastSyncedAt }) {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters State
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [network, setNetwork] = useState('all');
  const [fulfillment, setFulfillment] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  const fetchOrders = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '25',
        search,
        status,
        network,
        fulfillment,
        sortBy,
        sortOrder,
      });

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch orders.');

      setOrders(data.orders || []);
      setPagination(data.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 1 });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(1);
  }, [search, status, network, fulfillment, sortBy, sortOrder, lastSyncedAt]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchOrders(newPage);
  };

  return (
    <div>
      <div className="table-panel">
        {/* Controls & Filter Bar */}
        <div className="table-header-controls">
          <div className="search-input-wrap">
            <input
              type="text"
              className="admin-input"
              placeholder="Search by Order ID, Email, Payment ID, Tx Hash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="awaiting_payment">Awaiting Payment</option>
              <option value="paid">Paid</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>

            <select className="admin-select" value={network} onChange={(e) => setNetwork(e.target.value)}>
              <option value="all">All Networks</option>
              <option value="TRC-20">TRC-20 (TRON)</option>
              <option value="BEP-20">BEP-20 (BNB)</option>
              <option value="ERC-20">ERC-20 (ETH)</option>
              <option value="SOL">SOL (Solana)</option>
            </select>

            <select className="admin-select" value={fulfillment} onChange={(e) => setFulfillment(e.target.value)}>
              <option value="all">All Fulfillment</option>
              <option value="not_ready">Not Ready</option>
              <option value="fulfillment_pending">Fulfillment Pending</option>
              <option value="package_preparing">Package Preparing</option>
              <option value="package_delivered">Package Delivered</option>
              <option value="setup_pending">Setup Pending</option>
              <option value="setup_in_progress">Setup In Progress</option>
              <option value="setup_completed">Setup Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div style={{ padding: '20px', color: 'var(--admin-danger)', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Table Content */}
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Workflows</th>
                <th>Delivery</th>
                <th>Total USD</th>
                <th>Payment Network</th>
                <th>Payment Status</th>
                <th>Order Status</th>
                <th>Fulfillment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && orders.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={11} style={{ padding: '16px', color: 'var(--admin-text-muted)', textAlign: 'center' }}>
                      Loading orders...
                    </td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '36px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
                    No orders match your filter criteria.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord.id} className="clickable" onClick={() => navigate(`/admin/orders/${ord.id}`)}>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--admin-text-primary)' }}>
                      {ord.id}
                    </td>
                    <td className="font-mono">{formatAdminDate(ord.created_at)}</td>
                    <td title={ord.customer_email}>{ord.customer_email}</td>
                    <td>
                      <span title={ord.itemsSummary}>
                        {ord.itemsCount} {ord.itemsCount === 1 ? 'workflow' : 'workflows'}
                      </span>
                    </td>
                    <td>
                      <span className="network-badge" style={{ fontSize: '10.5px' }}>
                        {ord.delivery_method === 'geelark_setup' ? 'GeeLark Setup' : 'Downloadable'}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--admin-text-primary)' }}>
                      ${Number(ord.total_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className="network-badge">{ord.payment_currency || 'USDT'}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${ord.payment_status || 'waiting'}`}>
                        {formatStatusLabel(ord.payment_status || 'waiting')}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${ord.status}`}>{ord.status}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${ord.fulfillment_status || 'not_ready'}`}>
                        {formatStatusLabel(ord.fulfillment_status || 'not_ready')}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-admin-secondary"
                        style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/orders/${ord.id}`);
                        }}
                      >
                        Inspect →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="table-pagination">
          <span>
            Showing {orders.length} of {pagination.total} orders (Page {pagination.page} of {pagination.totalPages})
          </span>
          <div className="pagination-buttons">
            <button
              type="button"
              className="btn-page"
              disabled={pagination.page <= 1 || loading}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="btn-page"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
