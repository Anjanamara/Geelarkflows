import React, { useEffect, useState, useCallback } from 'react';

export default function AdminCustomRequests({ navigate, lastSyncedAt, user }) {
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Request Detail Modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [statusSuccess, setStatusSuccess] = useState(null);

  const fetchRequests = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        status: statusFilter,
      });

      const res = await fetch(`/api/admin/custom-requests?${params.toString()}`);
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load custom requests.');
      }

      setRequests(json.data || []);
      setPagination(json.pagination || { page: 1, limit: 50, total: 0 });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests(1);
  }, [fetchRequests, lastSyncedAt]);

  const openDetail = (req) => {
    setSelectedRequest(req);
    setNewStatus(req.status);
    setStatusError(null);
    setStatusSuccess(null);
  };

  const closeDetail = () => {
    setSelectedRequest(null);
    setStatusError(null);
    setStatusSuccess(null);
  };

  const handleStatusUpdate = async () => {
    if (!selectedRequest || newStatus === selectedRequest.status) return;

    setUpdatingStatus(true);
    setStatusError(null);
    setStatusSuccess(null);

    try {
      const res = await fetch(`/api/admin/custom-requests/${encodeURIComponent(selectedRequest.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Action': '1',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update request status.');
      }

      // Update in local state
      const updatedReq = { ...selectedRequest, status: newStatus };
      setSelectedRequest(updatedReq);
      setRequests((prev) =>
        prev.map((r) => (r.id === selectedRequest.id ? { ...r, status: newStatus } : r))
      );
      setStatusSuccess(`Status updated to "${newStatus.replace('_', ' ')}".`);
    } catch (err) {
      setStatusError(err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Client-side search filtering
  const filteredRequests = requests.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (r.id && r.id.toLowerCase().includes(term)) ||
      (r.customer_name && r.customer_name.toLowerCase().includes(term)) ||
      (r.customer_email && r.customer_email.toLowerCase().includes(term)) ||
      (r.request_type && r.request_type.toLowerCase().includes(term))
    );
  });

  // Aggregate Metrics
  const countNew = requests.filter((r) => r.status === 'new').length;
  const countInReview = requests.filter((r) => r.status === 'in_review').length;
  const countContacted = requests.filter((r) => r.status === 'contacted').length;
  const countNotifAttention = requests.filter(
    (r) => r.internal_notification_status === 'failed' || r.internal_notification_status === 'skipped'
  ).length;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'new':
        return <span className="status-badge pending">New Lead</span>;
      case 'in_review':
        return <span className="status-badge processing">In Review</span>;
      case 'contacted':
        return <span className="status-badge paid">Contacted</span>;
      case 'closed':
        return <span className="status-badge delivered">Closed</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  const getNotificationBadge = (notifStatus) => {
    switch (notifStatus) {
      case 'sent':
        return <span className="badge-tag delivered" title="Notification email dispatched">Sent</span>;
      case 'failed':
        return <span className="badge-tag alert" title="Email dispatch failed - follow up directly">Failed</span>;
      case 'skipped':
        return <span className="badge-tag pending" title="Email service skipped / not configured">Skipped</span>;
      case 'pending':
        return <span className="badge-tag" title="Notification pending dispatch">Pending</span>;
      default:
        return <span className="badge-tag">{notifStatus || 'n/a'}</span>;
    }
  };

  return (
    <div>
      {/* Metrics Row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '20px' }}>
        <div className="stat-card">
          <span className="stat-label">Total Custom Leads</span>
          <span className="stat-value">{pagination.total || requests.length}</span>
          <span className="stat-sub">Persisted in database</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">New Requests</span>
          <span className="stat-value" style={{ color: 'var(--admin-warning)' }}>{countNew}</span>
          <span className="stat-sub">Awaiting first review</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">In Review</span>
          <span className="stat-value">{countInReview}</span>
          <span className="stat-sub">Under technical feasibility check</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Contacted</span>
          <span className="stat-value" style={{ color: 'var(--admin-accent)' }}>{countContacted}</span>
          <span className="stat-sub">In direct dialogue</span>
        </div>
        {countNotifAttention > 0 && (
          <div className="stat-card" style={{ borderColor: 'var(--admin-danger)' }}>
            <span className="stat-label">Notification Attention</span>
            <span className="stat-value" style={{ color: 'var(--admin-danger)' }}>{countNotifAttention}</span>
            <span className="stat-sub">Failed or skipped email dispatch</span>
          </div>
        )}
      </div>

      {/* Main Panel */}
      <div className="table-panel">
        <div className="table-header-controls">
          <div className="search-input-wrap">
            <input
              type="text"
              className="admin-input"
              placeholder="Search by Request ID, name, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <select
              className="admin-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="in_review">In Review</option>
              <option value="contacted">Contacted</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {error && (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--admin-danger)', marginBottom: '12px' }}>{error}</p>
            <button type="button" className="btn-admin-secondary" onClick={() => fetchRequests(1)}>
              Retry Loading
            </button>
          </div>
        )}

        {loading && !requests.length && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
            Loading custom automation requests...
          </div>
        )}

        {!loading && !error && filteredRequests.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
            {searchTerm || statusFilter !== 'all' ? (
              <p>No requests match this status or search filter.</p>
            ) : (
              <div>
                <p style={{ fontSize: '15px', marginBottom: '8px', color: 'var(--admin-text-main)' }}>No custom requests yet.</p>
                <p style={{ fontSize: '12.5px' }}>Customer automation requests submitted from the store will appear here.</p>
              </div>
            )}
          </div>
        )}

        {filteredRequests.length > 0 && (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Type</th>
                  <th>Lead Status</th>
                  <th>Notification</th>
                  <th>Submitted Date</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <button
                        type="button"
                        className="btn-order-id font-mono"
                        onClick={() => openDetail(req)}
                        title="View request details"
                      >
                        {req.id}
                      </button>
                    </td>
                    <td>
                      <strong>{req.customer_name}</strong>
                    </td>
                    <td>
                      <a
                        href={`mailto:${encodeURIComponent(req.customer_email)}?subject=${encodeURIComponent(`GeeLark Automation Inquiry [${req.id}]`)}`}
                        className="customer-link"
                        title="Email customer"
                      >
                        {req.customer_email}
                      </a>
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize', fontSize: '12px' }}>
                        {req.request_type === 'consulting' ? 'Consulting' : 'Custom Flow'}
                      </span>
                    </td>
                    <td>{getStatusBadge(req.status)}</td>
                    <td>{getNotificationBadge(req.internal_notification_status)}</td>
                    <td style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)' }}>
                      {req.created_at ? new Date(req.created_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-admin-secondary"
                        style={{ height: '28px', padding: '0 10px', fontSize: '11.5px' }}
                        onClick={() => openDetail(req)}
                      >
                        Inspect →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal Dialog */}
      {selectedRequest && (
        <>
          <div className="admin-modal-overlay" onClick={closeDetail} />
          <div className="admin-modal" style={{ maxWidth: '640px' }}>
            <div className="admin-modal-header">
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--admin-text-main)' }}>
                  Custom Request Details
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span className="font-mono" style={{ fontSize: '12px', color: 'var(--admin-accent)' }}>
                    {selectedRequest.id}
                  </span>
                  <span style={{ color: 'var(--admin-text-muted)', fontSize: '11.5px' }}>
                    Submitted {selectedRequest.created_at ? new Date(selectedRequest.created_at).toLocaleString() : ''}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-admin-secondary"
                style={{ padding: '4px 8px', lineHeight: 1 }}
                onClick={closeDetail}
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              {/* Operational Notification Warning Banner */}
              {(selectedRequest.internal_notification_status === 'failed' ||
                selectedRequest.internal_notification_status === 'skipped') && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: 'var(--admin-danger)',
                    fontSize: '12.5px',
                    marginBottom: '16px',
                    lineHeight: 1.4,
                  }}
                >
                  <strong>⚠️ Notification Attention:</strong> Internal support email was{' '}
                  {selectedRequest.internal_notification_status === 'failed'
                    ? 'not delivered by the email provider'
                    : 'skipped (email provider not configured)'}
                  . Please follow up with the customer directly via email.
                </div>
              )}

              {/* Customer Contact Summary */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  background: 'var(--admin-bg-base)',
                  padding: '14px',
                  borderRadius: '6px',
                  border: '1px solid var(--admin-border)',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <span className="stat-label" style={{ fontSize: '11px' }}>Customer Name</span>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', marginTop: '2px' }}>
                    {selectedRequest.customer_name}
                  </div>
                </div>
                <div>
                  <span className="stat-label" style={{ fontSize: '11px' }}>Email Address</span>
                  <div style={{ marginTop: '2px' }}>
                    <a
                      href={`mailto:${encodeURIComponent(selectedRequest.customer_email)}?subject=${encodeURIComponent(`GeeLark Automation Inquiry [${selectedRequest.id}]`)}`}
                      className="customer-link"
                      style={{ fontSize: '13px' }}
                    >
                      {selectedRequest.customer_email} ↗
                    </a>
                  </div>
                </div>
                <div>
                  <span className="stat-label" style={{ fontSize: '11px' }}>Service Type</span>
                  <div style={{ fontSize: '13px', marginTop: '2px', textTransform: 'capitalize' }}>
                    {selectedRequest.request_type === 'consulting' ? 'Technical Consulting' : 'Custom Automation Flow'}
                  </div>
                </div>
              </div>

              {/* Project Requirements (Text-escaped safely, no raw HTML) */}
              <div style={{ marginBottom: '18px' }}>
                <label className="admin-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Project Requirements & Description
                </label>
                <div
                  style={{
                    background: 'var(--admin-bg-base)',
                    border: '1px solid var(--admin-border)',
                    borderRadius: '6px',
                    padding: '14px',
                    fontSize: '13px',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: 'var(--admin-text-main)',
                    maxHeight: '260px',
                    overflowY: 'auto',
                  }}
                >
                  {selectedRequest.details}
                </div>
              </div>

              {/* Status Update Control */}
              <div
                style={{
                  background: 'var(--admin-bg-base)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: '6px',
                  padding: '14px',
                }}
              >
                <label className="admin-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Manage Lead Status
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <select
                    className="admin-select"
                    style={{ flex: '1', minWidth: '160px' }}
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    disabled={updatingStatus}
                  >
                    <option value="new">New Lead</option>
                    <option value="in_review">In Review</option>
                    <option value="contacted">Contacted</option>
                    <option value="closed">Closed</option>
                  </select>

                  <button
                    type="button"
                    className="btn-admin-primary"
                    onClick={handleStatusUpdate}
                    disabled={updatingStatus || newStatus === selectedRequest.status}
                    style={{ height: '36px', padding: '0 16px' }}
                  >
                    {updatingStatus ? 'Updating...' : 'Update Status'}
                  </button>
                </div>

                {statusSuccess && (
                  <div style={{ color: 'var(--admin-accent)', fontSize: '12px', marginTop: '8px' }}>
                    ✓ {statusSuccess}
                  </div>
                )}
                {statusError && (
                  <div style={{ color: 'var(--admin-danger)', fontSize: '12px', marginTop: '8px' }}>
                    ⚠️ {statusError}
                  </div>
                )}
              </div>
            </div>

            <div className="admin-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a
                href={`mailto:${encodeURIComponent(selectedRequest.customer_email)}?subject=${encodeURIComponent(`GeeLark Automation Inquiry [${selectedRequest.id}]`)}`}
                className="btn-admin-secondary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                ✉️ Email Customer
              </a>

              <button type="button" className="btn-admin-secondary" onClick={closeDetail}>
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
