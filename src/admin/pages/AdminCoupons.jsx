import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatAdminDateTime } from '../dateUtils';
import { redirectIfUnauthorized } from '../apiUtils';

const EMPTY_FORM = {
  code: '',
  description: '',
  discount_type: 'percentage',
  discount_value: '10',
  min_subtotal_usd: '0',
  max_redemptions: '',
  starts_at: '',
  expires_at: '',
  active: true,
};

export default function AdminCoupons({ lastSyncedAt, user }) {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const canManage = user?.role === 'SUPER_ADMIN';

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/coupons', { cache: 'no-store' });
      if (response.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Coupons could not be loaded.');
      setCoupons(data.coupons || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons, lastSyncedAt]);

  const metrics = useMemo(() => ({
    total: coupons.length,
    active: coupons.filter((coupon) => coupon.active).length,
    redemptions: coupons.reduce((sum, coupon) => sum + Number(coupon.redemption_count || 0), 0),
  }), [coupons]);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!canManage || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Action': '1' },
        body: JSON.stringify(form),
      });
      if (redirectIfUnauthorized(response)) return;
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Coupon could not be created.');
      setForm(EMPTY_FORM);
      setNotice(data.message || 'Coupon created.');
      await fetchCoupons();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleCoupon = async (coupon) => {
    if (!canManage) return;
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/coupons/${encodeURIComponent(coupon.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Action': '1' },
        body: JSON.stringify({ active: !coupon.active }),
      });
      if (redirectIfUnauthorized(response)) return;
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Coupon status could not be updated.');
      setCoupons((current) => current.map((item) => (
        item.id === coupon.id ? { ...item, active: data.active } : item
      )));
      setNotice(`${coupon.code} is now ${data.active ? 'active' : 'inactive'}.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDate = (value) => value ? formatAdminDateTime(value) : 'No limit';

  return (
    <div className="coupon-admin-page">
      <div className="analytics-stats-grid">
        <div className="stat-card"><span className="stat-label">Coupon Codes</span><strong className="stat-value">{metrics.total}</strong><span className="stat-subtext">Configured promotions</span></div>
        <div className="stat-card"><span className="stat-label">Active</span><strong className="stat-value">{metrics.active}</strong><span className="stat-subtext">Currently accepted</span></div>
        <div className="stat-card"><span className="stat-label">Checkout Uses</span><strong className="stat-value">{metrics.redemptions}</strong><span className="stat-subtext">Invoices created with coupons</span></div>
      </div>

      {canManage && (
        <form className="table-panel coupon-create-panel" onSubmit={handleCreate}>
          <div className="table-header-controls">
            <div>
              <strong>Create Coupon</strong>
              <p className="coupon-panel-copy">Discounts apply to workflows only; setup fees remain unchanged.</p>
            </div>
            <button type="submit" className="btn-admin-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Coupon'}
            </button>
          </div>

          <div className="coupon-form-grid">
            <label className="coupon-field"><span>Code</span><input className="admin-input font-mono" value={form.code} onChange={(e) => updateForm('code', e.target.value.toUpperCase())} placeholder="WELCOME10" maxLength={32} required /></label>
            <label className="coupon-field"><span>Description</span><input className="admin-input" value={form.description} onChange={(e) => updateForm('description', e.target.value)} placeholder="Launch promotion" maxLength={120} /></label>
            <label className="coupon-field"><span>Discount Type</span><select className="admin-select" value={form.discount_type} onChange={(e) => updateForm('discount_type', e.target.value)}><option value="percentage">Percentage</option><option value="fixed_amount">Fixed USD amount</option></select></label>
            <label className="coupon-field"><span>{form.discount_type === 'percentage' ? 'Percentage (1–100)' : 'Amount (USD)'}</span><input className="admin-input" type="number" min="1" max={form.discount_type === 'percentage' ? '100' : undefined} step={form.discount_type === 'percentage' ? '1' : '0.01'} value={form.discount_value} onChange={(e) => updateForm('discount_value', e.target.value)} required /></label>
            <label className="coupon-field"><span>Minimum Workflow Subtotal</span><input className="admin-input" type="number" min="0" step="0.01" value={form.min_subtotal_usd} onChange={(e) => updateForm('min_subtotal_usd', e.target.value)} /></label>
            <label className="coupon-field"><span>Maximum Uses</span><input className="admin-input" type="number" min="1" step="1" value={form.max_redemptions} onChange={(e) => updateForm('max_redemptions', e.target.value)} placeholder="Unlimited" /></label>
            <label className="coupon-field"><span>Starts At</span><input className="admin-input" type="datetime-local" value={form.starts_at} onChange={(e) => updateForm('starts_at', e.target.value)} /></label>
            <label className="coupon-field"><span>Expires At</span><input className="admin-input" type="datetime-local" value={form.expires_at} onChange={(e) => updateForm('expires_at', e.target.value)} /></label>
          </div>
        </form>
      )}

      {error && <div className="attention-banner danger" role="alert">{error}</div>}
      {notice && <div className="attention-banner warning" role="status">✓ {notice}</div>}

      <div className="table-panel">
        <div className="table-header-controls">
          <div><strong>Coupon Inventory</strong><p className="coupon-panel-copy">Financial terms are immutable after creation; deactivate a code to stop it.</p></div>
          <button type="button" className="btn-admin-secondary" onClick={fetchCoupons}>Refresh</button>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table coupon-table">
            <thead><tr><th>Code</th><th>Discount</th><th>Minimum</th><th>Uses</th><th>Schedule</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {loading && coupons.length === 0 ? (
                <tr><td colSpan={7} className="analytics-empty-cell">Loading coupons…</td></tr>
              ) : coupons.length === 0 ? (
                <tr><td colSpan={7} className="analytics-empty-cell">No coupon codes yet. Create the first one above.</td></tr>
              ) : coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td><strong className="font-mono coupon-code-token">{coupon.code}</strong>{coupon.description && <small className="analytics-table-note">{coupon.description}</small>}</td>
                  <td>{coupon.discount_value_display}</td>
                  <td className="font-mono">${Number(coupon.min_subtotal_usd || 0).toFixed(2)}</td>
                  <td className="font-mono">{coupon.redemption_count}{coupon.max_redemptions ? ` / ${coupon.max_redemptions}` : ' / ∞'}</td>
                  <td><small>Starts: {formatDate(coupon.starts_at)}</small><small className="analytics-table-note">Ends: {formatDate(coupon.expires_at)}</small></td>
                  <td><span className={`status-badge ${coupon.active ? 'confirmed' : 'failed'}`}>{coupon.active ? 'Active' : 'Inactive'}</span></td>
                  <td><button type="button" className={coupon.active ? 'btn-admin-danger' : 'btn-admin-secondary'} onClick={() => toggleCoupon(coupon)} disabled={!canManage}>{coupon.active ? 'Deactivate' : 'Activate'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
