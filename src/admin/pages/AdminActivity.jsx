import React, { useEffect, useState } from 'react';

export default function AdminActivity({ lastSyncedAt }) {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const fetchActivity = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '50',
        action: actionFilter,
        entity: entityFilter,
      });

      const res = await fetch(`/api/admin/activity?${params.toString()}`);
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch activity log.');

      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, pageSize: 50, total: 0, totalPages: 1 });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity(1);
  }, [actionFilter, entityFilter, lastSyncedAt]);

  return (
    <div>
      <div className="table-panel">
        <div className="table-header-controls">
          <div>
            <strong style={{ fontSize: '13px', display: 'block' }}>Append-Only System Audit Log</strong>
            <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
              Permanent record of all operational, financial, and authentication events.
            </span>
          </div>

          <div className="filter-group">
            <select className="admin-select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="">All Actions</option>
              <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
              <option value="LOGIN_FAILED_INVALID_PASSWORD">LOGIN_FAILED</option>
              <option value="ORDER_STATUS_TRANSITION">ORDER_STATUS_TRANSITION</option>
              <option value="MANUAL_PAYMENT_VERIFIED">MANUAL_PAYMENT_VERIFIED</option>
              <option value="FULFILLMENT_RESENT">FULFILLMENT_RESENT</option>
              <option value="NOWPAYMENTS_LIVE_SYNC">NOWPAYMENTS_LIVE_SYNC</option>
            </select>

            <select className="admin-select" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
              <option value="">All Entities</option>
              <option value="order">Order</option>
              <option value="payment">Payment</option>
              <option value="auth">Auth</option>
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
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Target ID</th>
                <th>State Change</th>
                <th>Reason / Metadata</th>
                <th>Actor IP</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} style={{ padding: '16px', color: 'var(--admin-text-muted)', textAlign: 'center' }}>
                      Loading audit logs...
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
                    No audit records found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="font-mono" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>{log.actor_admin_email}</td>
                    <td>
                      <span className="network-badge" style={{ fontSize: '10px' }}>
                        {log.action}
                      </span>
                    </td>
                    <td>{log.entity_type}</td>
                    <td className="font-mono" style={{ fontSize: '11.5px' }}>{log.entity_id}</td>
                    <td className="font-mono" style={{ fontSize: '11px' }}>
                      {log.previous_state || log.new_state ? (
                        <span>{log.previous_state || '—'} → <strong style={{ color: 'var(--admin-accent)' }}>{log.new_state}</strong></span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ fontSize: '11.5px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.reason || log.metadata_json}>
                      {log.reason || log.metadata_json || '—'}
                    </td>
                    <td className="font-mono" style={{ fontSize: '10.5px' }}>{log.actor_ip || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-pagination">
          <span>
            Showing {logs.length} of {pagination.total} entries (Page {pagination.page} of {pagination.totalPages})
          </span>
          <div className="pagination-buttons">
            <button
              type="button"
              className="btn-page"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchActivity(pagination.page - 1)}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="btn-page"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchActivity(pagination.page + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
