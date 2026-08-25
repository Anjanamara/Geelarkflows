import React, { useEffect, useState, useCallback } from 'react';

export default function AdminMail({ navigate, lastSyncedAt, user, onActionSuccess }) {
  const [emails, setEmails] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [activeFilter, setActiveFilter] = useState('all'); // all | unread | read | archived
  const [searchQuery, setSearchQuery] = useState('');

  // Active Selected Email & Detail
  const [selectedId, setSelectedId] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [viewMode, setViewMode] = useState('html'); // html | text

  // Modals & Composer
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyNotice, setReplyNotice] = useState(null);
  const [composerFocused, setComposerFocused] = useState(false);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [targetOrderId, setTargetOrderId] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState(null);

  // 1. Fetch Email List
  const fetchEmails = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        filter: activeFilter,
        search: searchQuery,
      });

      const res = await fetch(`/api/admin/mail?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load emails.');
      }

      setEmails(data.emails || []);
      setUnreadCount(data.unread_count || 0);

      // If nothing selected or selected email no longer in list, auto-select first on desktop
      if (!selectedId && data.emails && data.emails.length > 0 && window.innerWidth >= 900) {
        setSelectedId(data.emails[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [activeFilter, searchQuery, selectedId]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails, lastSyncedAt]);

  // 2. Fetch Selected Email Details
  const fetchEmailDetail = useCallback(async (id) => {
    if (!id) {
      setSelectedEmail(null);
      return;
    }

    setDetailLoading(true);
    setReplyNotice(null);
    setReplyText('');

    try {
      const res = await fetch(`/api/admin/mail/${id}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch email details.');
      }

      setSelectedEmail(data.email);
      if (data.email) {
        // Update local read state in list
        setEmails((prev) =>
          prev.map((e) => (e.id === id ? { ...e, is_read: 1 } : e))
        );
        setTargetOrderId(data.email.order_id || '');
      }
    } catch (err) {
      console.error('Email detail error:', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchEmailDetail(selectedId);
    }
  }, [selectedId, fetchEmailDetail]);

  // 3. Mark Read / Unread
  const handleToggleRead = async (emailId, currentIsRead) => {
    const newStatus = currentIsRead ? 0 : 1;
    try {
      const res = await fetch(`/api/admin/mail/${emailId}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Action': '1',
        },
        body: JSON.stringify({ is_read: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setEmails((prev) =>
          prev.map((e) => (e.id === emailId ? { ...e, is_read: newStatus } : e))
        );
        if (selectedEmail && selectedEmail.id === emailId) {
          setSelectedEmail({ ...selectedEmail, is_read: newStatus });
        }
        if (onActionSuccess) onActionSuccess();
      }
    } catch (e) {
      console.error('Toggle read error:', e);
    }
  };

  // 4. Archive / Unarchive
  const handleToggleArchive = async (emailId, currentIsArchived) => {
    const newStatus = currentIsArchived ? 0 : 1;
    try {
      const res = await fetch(`/api/admin/mail/${emailId}/archive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Action': '1',
        },
        body: JSON.stringify({ is_archived: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        // Refresh list
        fetchEmails(true);
        if (selectedEmail && selectedEmail.id === emailId) {
          setSelectedEmail({ ...selectedEmail, is_archived: newStatus });
        }
        if (onActionSuccess) onActionSuccess();
      }
    } catch (e) {
      console.error('Toggle archive error:', e);
    }
  };

  // 5. Link Order Action
  const handleSaveOrderLink = async () => {
    if (!selectedEmail) return;
    setLinkLoading(true);
    setLinkError(null);

    try {
      const res = await fetch(`/api/admin/mail/${selectedEmail.id}/link-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Action': '1',
        },
        body: JSON.stringify({ order_id: targetOrderId.trim() || null }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update order association.');
      }

      setShowLinkModal(false);
      fetchEmailDetail(selectedEmail.id);
      fetchEmails(true);
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      setLinkError(err.message);
    } finally {
      setLinkLoading(false);
    }
  };

  // 6. Send Outbound Reply
  const handleSendReply = async () => {
    if (!selectedEmail || !replyText.trim()) return;
    setReplying(true);
    setReplyNotice(null);

    try {
      const res = await fetch(`/api/admin/mail/${selectedEmail.id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Action': '1',
        },
        body: JSON.stringify({ text: replyText }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to dispatch reply.');
      }

      setReplyNotice({ type: 'success', text: `Reply successfully dispatched to ${selectedEmail.from_address}.` });
      setReplyText('');
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      setReplyNotice({ type: 'error', text: err.message });
    } finally {
      setReplying(false);
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="admin-page-container">
      {/* Top Banner & Overview */}
      <div className="section-header" style={{ marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--admin-text-primary)', margin: 0 }}>
            Internal Mail & Inbound Inquiries
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '4px 0 0 0' }}>
            Inbound customer emails received via Resend Receiving (@geelarkflows.com) with automatic order matching.
          </p>
        </div>
      </div>

      {/* Split Inbox View */}
      <div className="admin-mail-split-container">
        {/* Left Column: Email List */}
        <div className={`admin-mail-list-panel ${selectedId && window.innerWidth < 900 ? 'mobile-hidden' : ''}`}>
          {/* Filter Bar */}
          <div className="admin-mail-list-header">
            <div className="admin-mail-tabs">
              {[
                { id: 'all', label: 'All' },
                { id: 'unread', label: `Unread (${unreadCount})` },
                { id: 'read', label: 'Read' },
                { id: 'archived', label: 'Archived' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`admin-mail-tab ${activeFilter === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="admin-mail-search-box">
              <input
                type="text"
                placeholder="Search sender, subject, order #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="admin-input"
                style={{ height: '30px', fontSize: '12px' }}
              />
            </div>
          </div>

          {/* Email Items List */}
          <div className="admin-mail-items-scroll">
            {loading ? (
              <div className="admin-table-loading" style={{ padding: '40px 20px' }}>
                <span className="sync-dot" />
                <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Loading inbox messages...</span>
              </div>
            ) : error ? (
              <div style={{ padding: '20px', color: 'var(--admin-danger)', fontSize: '12px' }}>
                Error: {error}
              </div>
            ) : emails.length === 0 ? (
              <div className="admin-empty-state" style={{ padding: '48px 16px' }}>
                <span style={{ fontSize: '28px', marginBottom: '8px' }}>📭</span>
                <p style={{ margin: 0, fontWeight: 500, color: 'var(--admin-text-primary)' }}>No messages found</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: 'var(--admin-text-muted)' }}>
                  {searchQuery ? 'Try clearing your search query.' : 'Inbound emails from customers will appear here.'}
                </p>
              </div>
            ) : (
              emails.map((email) => {
                const isSelected = email.id === selectedId;
                const isUnread = !email.is_read;

                return (
                  <div
                    key={email.id}
                    className={`admin-mail-item ${isSelected ? 'selected' : ''} ${isUnread ? 'unread' : ''}`}
                    onClick={() => setSelectedId(email.id)}
                  >
                    <div className="mail-item-top">
                      <div className="mail-item-sender">
                        {isUnread && <span className="mail-unread-dot" title="Unread" />}
                        <strong className="mail-sender-name">
                          {email.from_name || email.from_address}
                        </strong>
                      </div>
                      <span className="mail-item-time">{formatTimeAgo(email.received_at)}</span>
                    </div>

                    <div className="mail-item-subject">
                      {email.subject}
                    </div>

                    <div className="mail-item-snippet">
                      {email.snippet || '(No text preview available)'}
                    </div>

                    <div className="mail-item-footer">
                      {email.order_id ? (
                        <span className="mail-order-pill" title="Matched Order">
                          📦 #{email.order_id}
                        </span>
                      ) : (
                        <span style={{ fontSize: '10.5px', color: 'var(--admin-text-muted)' }}>
                          {email.from_address}
                        </span>
                      )}

                      {email.attachment_count > 0 && (
                        <span className="mail-attachment-indicator" title={`${email.attachment_count} attachment(s)`}>
                          📎 {email.attachment_count}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Email Detail View */}
        <div className={`admin-mail-detail-panel ${!selectedId && window.innerWidth < 900 ? 'mobile-hidden' : ''}`}>
          {!selectedId ? (
            <div className="admin-empty-state" style={{ height: '100%', minHeight: '400px' }}>
              <span style={{ fontSize: '36px', marginBottom: '12px' }}>✉️</span>
              <p style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>Select an email to view</p>
              <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '4px 0 0 0' }}>
                Choose a customer communication from the left panel to inspect details and respond.
              </p>
            </div>
          ) : detailLoading || !selectedEmail ? (
            <div className="admin-table-loading" style={{ height: '100%', minHeight: '300px' }}>
              <span className="sync-dot" />
              <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Fetching email details...</span>
            </div>
          ) : (
            <div className="admin-mail-detail-content">
              {/* Back to list button on mobile */}
              <div className="mobile-back-bar">
                <button
                  type="button"
                  className="btn-admin-secondary"
                  style={{ height: '28px', fontSize: '11px' }}
                  onClick={() => setSelectedId(null)}
                >
                  ← Back to Inbox
                </button>
              </div>

              {/* Action Toolbar */}
              <div className="admin-mail-actions-bar">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn-admin-secondary"
                    style={{ height: '28px', fontSize: '11px' }}
                    onClick={() => handleToggleRead(selectedEmail.id, selectedEmail.is_read)}
                    title={selectedEmail.is_read ? 'Mark as Unread' : 'Mark as Read'}
                  >
                    {selectedEmail.is_read ? '📩 Mark Unread' : '✉️ Mark Read'}
                  </button>

                  <button
                    type="button"
                    className="btn-admin-secondary"
                    style={{ height: '28px', fontSize: '11px' }}
                    onClick={() => handleToggleArchive(selectedEmail.id, selectedEmail.is_archived)}
                    title={selectedEmail.is_archived ? 'Move to Inbox' : 'Archive Message'}
                  >
                    {selectedEmail.is_archived ? '📥 Move to Inbox' : '🗄️ Archive'}
                  </button>

                  <button
                    type="button"
                    className="btn-admin-secondary"
                    style={{ height: '28px', fontSize: '11px' }}
                    onClick={() => setShowLinkModal(true)}
                  >
                    🔗 {selectedEmail.order_id ? 'Change Order Link' : 'Link to Order'}
                  </button>
                </div>

                <div className="view-mode-toggle">
                  <button
                    type="button"
                    className={`mode-btn ${viewMode === 'html' ? 'active' : ''}`}
                    onClick={() => setViewMode('html')}
                  >
                    HTML
                  </button>
                  <button
                    type="button"
                    className={`mode-btn ${viewMode === 'text' ? 'active' : ''}`}
                    onClick={() => setViewMode('text')}
                  >
                    Plain Text
                  </button>
                </div>
              </div>

              {/* Header Info */}
              <div className="mail-detail-header-card">
                <h3 className="mail-detail-subject">{selectedEmail.subject}</h3>

                <div className="mail-meta-grid">
                  <div className="mail-meta-row">
                    <span className="mail-meta-label">From:</span>
                    <span className="mail-meta-value">
                      <strong>{selectedEmail.from_name || selectedEmail.from_address}</strong>{' '}
                      <span style={{ color: 'var(--admin-text-muted)' }}>&lt;{selectedEmail.from_address}&gt;</span>
                    </span>
                  </div>

                  <div className="mail-meta-row">
                    <span className="mail-meta-label">To:</span>
                    <span className="mail-meta-value" style={{ color: 'var(--admin-text-muted)' }}>
                      {(selectedEmail.to_addresses || []).join(', ') || 'noreply@geelarkflows.com'}
                    </span>
                  </div>

                  <div className="mail-meta-row">
                    <span className="mail-meta-label">Received:</span>
                    <span className="mail-meta-value">
                      {new Date(selectedEmail.received_at).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Linked Order Panel (Deterministic Order Association) */}
              {selectedEmail.order_id ? (
                <div className="mail-order-panel">
                  <div className="mail-order-panel-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>📦</span>
                      <strong style={{ color: 'var(--admin-text-primary)' }}>
                        Associated Order #{selectedEmail.order_id}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="btn-admin-secondary"
                      style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
                      onClick={() => navigate(`/admin/orders/${selectedEmail.order_id}`)}
                    >
                      View Order Details →
                    </button>
                  </div>

                  <div className="mail-order-meta-row">
                    <span>Customer: <strong>{selectedEmail.customer_email || selectedEmail.from_address}</strong></span>
                    <span>Provider Message ID: <code>{selectedEmail.provider_email_id}</code></span>
                  </div>
                </div>
              ) : (
                <div className="mail-order-panel unlinked">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ color: 'var(--admin-text-muted)', fontSize: '11.5px' }}>
                      ℹ️ No order currently associated with this message.
                    </span>
                    <button
                      type="button"
                      className="btn-admin-secondary"
                      style={{ height: '24px', fontSize: '10.5px', padding: '0 8px' }}
                      onClick={() => setShowLinkModal(true)}
                    >
                      + Associate Order
                    </button>
                  </div>
                </div>
              )}

              {/* Attachments Section */}
              {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                <div className="mail-attachments-box">
                  <strong style={{ fontSize: '12px', color: 'var(--admin-text-primary)', display: 'block', marginBottom: '8px' }}>
                    📎 Attachments ({selectedEmail.attachments.length})
                  </strong>
                  <div className="attachment-chips-list">
                    {selectedEmail.attachments.map((att) => (
                      <div key={att.id} className="attachment-chip">
                        <span style={{ fontSize: '12px' }}>📄</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 500, fontSize: '11.5px', color: 'var(--admin-text-primary)' }}>
                            {att.filename}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--admin-text-muted)' }}>
                            {Math.round((att.size_bytes || 0) / 1024)} KB · {att.content_type}
                          </span>
                        </div>
                        {att.id && (
                          <a
                            href={`/api/admin/mail/${selectedEmail.id}/attachments/${att.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-admin-secondary"
                            style={{ height: '22px', fontSize: '10px', padding: '0 6px', textDecoration: 'none', marginLeft: 'auto' }}
                          >
                            Download
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Body */}
              <div className="mail-body-container">
                {viewMode === 'html' && selectedEmail.html_body ? (
                  <iframe
                    title="Sanitized Email Content"
                    className="mail-html-iframe"
                    sandbox=""
                    srcDoc={`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <meta charset="utf-8" />
                          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src 'none'; media-src 'none'; frame-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'" />
                          <meta name="referrer" content="no-referrer" />
                          <style>
                            body {
                              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                              font-size: 13.5px;
                              line-height: 1.6;
                              color: #222;
                              background: #fff;
                              margin: 0;
                              padding: 16px;
                              word-break: break-word;
                            }
                            a { color: #0066cc; }
                            pre, code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-size: 12px; }
                            blockquote { border-left: 3px solid #ccc; margin: 8px 0; padding-left: 12px; color: #555; }
                          </style>
                        </head>
                        <body>
                          ${selectedEmail.html_body}
                        </body>
                      </html>
                    `}
                  />
                ) : (
                  <pre className="mail-plaintext-view">
                    {selectedEmail.text_body || (selectedEmail.html_body ? selectedEmail.html_body.replace(/<[^>]+>/g, '') : '(Empty body)')}
                  </pre>
                )}
              </div>

              {/* Reply Composer */}
              <div className="mail-reply-composer" style={{ background: '#121714', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', padding: '16px' }}>
                <div className="composer-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>💬</span>
                    <strong style={{ fontSize: '13px', color: 'var(--admin-text-primary)' }}>
                      Reply to {selectedEmail.from_address}
                    </strong>
                  </div>
                  <span style={{ fontSize: '10.5px', background: 'rgba(167, 255, 79, 0.12)', color: 'var(--admin-accent)', border: '1px solid rgba(167, 255, 79, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ✨ Support Template Active
                  </span>
                </div>

                <p style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                  Your reply will be formatted automatically inside the official <strong>GeeLark Customer Support</strong> branded email template with thread headers preserved.
                </p>

                {replyNotice && (
                  <div className={`attention-banner ${replyNotice.type === 'success' ? 'warning' : 'danger'}`} style={{ margin: '0 0 12px 0' }}>
                    {replyNotice.text}
                  </div>
                )}

                <textarea
                  className="admin-textarea"
                  rows={5}
                  placeholder={`Write your response to ${selectedEmail.from_name || selectedEmail.from_address || 'the customer'}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => setComposerFocused(true)}
                  onBlur={() => setComposerFocused(false)}
                  style={{
                    width: '100%',
                    minHeight: '130px',
                    backgroundColor: '#0c100e',
                    color: '#f0f3f1',
                    border: composerFocused ? '1px solid #a7ff4f' : '1px solid rgba(255, 255, 255, 0.18)',
                    boxShadow: composerFocused ? '0 0 0 3px rgba(167, 255, 79, 0.18)' : 'none',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '13.5px',
                    lineHeight: '1.6',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    caretColor: '#a7ff4f',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    display: 'block',
                    marginBottom: '12px',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
                    Original thread headers: <code style={{ fontFamily: 'monospace', color: '#9aa49e' }}>{selectedEmail.message_id ? 'In-Reply-To active' : 'Direct delivery'}</code>
                  </span>

                  <button
                    type="button"
                    className="btn-admin-primary"
                    disabled={replying || !replyText.trim()}
                    onClick={handleSendReply}
                    style={{ minWidth: '120px' }}
                  >
                    {replying ? 'Sending via Resend...' : '✉️ Send Reply'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Order Link Modal */}
      {showLinkModal && (
        <div className="admin-modal-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="admin-modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px' }}>Associate Order</h3>
            <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '14px' }}>
              Link this incoming customer email to a specific GeeLark order record.
            </p>

            {linkError && (
              <div className="attention-banner danger" style={{ marginBottom: '12px' }}>
                {linkError}
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', marginBottom: '6px', color: 'var(--admin-text-muted)' }}>
                Order ID (e.g. ord_5710mi3)
              </label>
              <input
                type="text"
                className="admin-input"
                placeholder="ord_..."
                value={targetOrderId}
                onChange={(e) => setTargetOrderId(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn-admin-secondary"
                onClick={() => setShowLinkModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-admin-primary"
                disabled={linkLoading}
                onClick={handleSaveOrderLink}
              >
                {linkLoading ? 'Saving...' : 'Save Association'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
