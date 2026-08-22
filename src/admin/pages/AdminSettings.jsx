import React, { useEffect, useState } from 'react';

export default function AdminSettings({ user, onLogout }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load system settings.');
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <div>
      {/* Admin Profile Panel */}
      <div className="table-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--admin-text-primary)' }}>
          Administrator Profile
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div>
            <span className="stat-label">Email</span>
            <span className="font-mono" style={{ display: 'block', color: 'var(--admin-text-primary)', marginTop: '4px' }}>
              {user?.email}
            </span>
          </div>
          <div>
            <span className="stat-label">Role Authority</span>
            <span className="network-badge" style={{ marginTop: '4px' }}>
              {user?.role || 'ADMIN'}
            </span>
          </div>
          <div>
            <span className="stat-label">Session Authentication</span>
            <span style={{ fontSize: '12px', color: 'var(--admin-success)', display: 'block', marginTop: '4px' }}>
              ✓ Secure HttpOnly Cookie
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn-admin-danger" onClick={onLogout}>
            Log out of session
          </button>
        </div>
      </div>

      {/* System Infrastructure Health Panel */}
      <div className="table-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--admin-text-primary)' }}>
              Production Infrastructure Health
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
              Environment variable bindings and external API status (secret keys are redacted).
            </span>
          </div>
          <button type="button" className="btn-admin-secondary" onClick={fetchSettings}>
            🔄 Check Health
          </button>
        </div>

        {error && <div style={{ color: 'var(--admin-danger)', marginBottom: '16px' }}>{error}</div>}

        {loading && !settings ? (
          <p style={{ color: 'var(--admin-text-muted)' }}>Checking system components...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--admin-surface-subtle)', borderRadius: '6px' }}>
              <span>Cloudflare D1 Database</span>
              <span className={`status-badge ${settings?.health?.database_d1 === 'healthy' ? 'confirmed' : 'failed'}`}>
                {settings?.health?.database_d1}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--admin-surface-subtle)', borderRadius: '6px' }}>
              <span>Cloudflare R2 Digital Asset Bucket</span>
              <span className={`status-badge ${settings?.health?.storage_r2 === 'configured' ? 'confirmed' : 'waiting'}`}>
                {settings?.health?.storage_r2}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--admin-surface-subtle)', borderRadius: '6px' }}>
              <span>NOWPayments Gateway API</span>
              <span className={`status-badge ${settings?.health?.nowpayments_gateway === 'configured' ? 'confirmed' : 'failed'}`}>
                {settings?.health?.nowpayments_gateway}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--admin-surface-subtle)', borderRadius: '6px' }}>
              <span>Resend Email Delivery API</span>
              <span className={`status-badge ${settings?.health?.resend_email === 'configured' ? 'confirmed' : 'waiting'}`}>
                {settings?.health?.resend_email}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--admin-surface-subtle)', borderRadius: '6px' }}>
              <span>Crypto Webhook HMAC-SHA512 Verification</span>
              <span className={`status-badge ${settings?.health?.crypto_webhook_hmac === 'configured' ? 'confirmed' : 'waiting'}`}>
                {settings?.health?.crypto_webhook_hmac}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
