import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { products } from '../../data/products';
import { formatAdminDateTime } from '../dateUtils';
import { redirectIfUnauthorized } from '../apiUtils';

const EMPTY_FORM = {
  title: '',
  message: '',
  targeting_preset: 'engaged',
  audience_type: 'all',
  behavior_trigger: 'engaged',
  product_id: '',
  coupon_id: '',
  cta_label: 'Explore flows',
  cta_url: '/',
  starts_at: '',
  expires_at: '',
  push_enabled: false,
  active: true,
};

const TARGETING_PRESETS = {
  engaged: { audience_type: 'all', behavior_trigger: 'engaged', label: 'Engaged visitors', help: 'After 10 seconds, a second page, or 50% scroll. Recommended for useful offers.' },
  deep_scroll: { audience_type: 'all', behavior_trigger: 'deep_scroll', label: 'Deep scrollers', help: 'Only visitors who reached 90% of a page.' },
  product_view: { audience_type: 'all', behavior_trigger: 'product_view', label: 'Viewed a selected flow', help: 'People who opened one specific workflow page.' },
  active_cart: { audience_type: 'active_cart', behavior_trigger: 'immediate', label: 'Any active cart', help: 'People who currently have at least one flow in their cart.' },
  product_cart: { audience_type: 'product_cart', behavior_trigger: 'immediate', label: 'Selected flow in cart', help: 'People whose cart contains one specific workflow.' },
  all: { audience_type: 'all', behavior_trigger: 'immediate', label: 'Every visitor immediately', help: 'Broadest reach. Use sparingly for essential storefront updates.' },
};

function notificationAudienceLabel(notification) {
  const match = Object.values(TARGETING_PRESETS).find((preset) => (
    preset.audience_type === notification.audience_type
    && preset.behavior_trigger === (notification.behavior_trigger || 'immediate')
  ));
  return match?.label || 'Custom audience';
}

export default function AdminNotifications({ lastSyncedAt, user }) {
  const [notifications, setNotifications] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pushConfigured, setPushConfigured] = useState(false);
  const [activePushSubscribers, setActivePushSubscribers] = useState(0);
  const canManage = user?.role === 'SUPER_ADMIN';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [notificationResponse, couponResponse] = await Promise.all([
        fetch('/api/admin/notifications', { cache: 'no-store' }),
        fetch('/api/admin/coupons', { cache: 'no-store' }),
      ]);
      if (notificationResponse.status === 401 || couponResponse.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const [notificationData, couponData] = await Promise.all([
        notificationResponse.json(),
        couponResponse.json(),
      ]);
      if (!notificationResponse.ok || !notificationData.success) throw new Error(notificationData.error || 'Notifications could not be loaded.');
      if (!couponResponse.ok || !couponData.success) throw new Error(couponData.error || 'Coupons could not be loaded.');
      setNotifications(notificationData.notifications || []);
      setCoupons(couponData.coupons || []);
      setPushConfigured(Boolean(notificationData.push_configured));
      setActivePushSubscribers(Number(notificationData.active_push_subscribers || 0));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, lastSyncedAt]);

  const metrics = useMemo(() => ({
    total: notifications.length,
    active: notifications.filter((notification) => notification.active).length,
    delivered: notifications.reduce((sum, notification) => sum + Number(notification.delivered_count || 0), 0),
    read: notifications.reduce((sum, notification) => sum + Number(notification.read_count || 0), 0),
    pushSent: notifications.reduce((sum, notification) => sum + Number(notification.push_sent_count || 0), 0),
  }), [notifications]);

  const updateForm = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'targeting_preset') {
        const preset = TARGETING_PRESETS[value];
        next.audience_type = preset.audience_type;
        next.behavior_trigger = preset.behavior_trigger;
        next.product_id = ['product_view', 'product_cart'].includes(value) ? current.product_id : '';
        if (!current.coupon_id) {
          next.cta_label = ['active_cart', 'product_cart'].includes(value) ? 'View cart' : 'Explore flows';
          next.cta_url = ['active_cart', 'product_cart'].includes(value) ? '/cart' : '/';
        }
      }
      if (field === 'coupon_id') {
        const cartTarget = ['active_cart', 'product_cart'].includes(current.targeting_preset);
        next.cta_label = value ? (cartTarget ? 'Use coupon' : 'Explore with coupon') : (cartTarget ? 'View cart' : 'Explore flows');
        next.cta_url = value && cartTarget ? '/checkout' : (cartTarget ? '/cart' : '/');
      }
      return next;
    });
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!canManage || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Action': '1' },
        body: JSON.stringify(form),
      });
      if (redirectIfUnauthorized(response)) return;
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Notification campaign could not be created.');
      setForm(EMPTY_FORM);
      setNotice(data.message || 'Notification campaign created.');
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleNotification = async (notification) => {
    if (!canManage) return;
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/notifications/${encodeURIComponent(notification.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Action': '1' },
        body: JSON.stringify({ active: !notification.active }),
      });
      if (redirectIfUnauthorized(response)) return;
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Notification status could not be updated.');
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, active: data.active } : item
      )));
      setNotice(`Campaign is now ${data.active ? 'active' : 'inactive'}.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDate = (value) => value ? formatAdminDateTime(value) : 'No limit';

  return (
    <div className="notification-admin-page">
      <div className="analytics-page-intro">
        <div><span className="analytics-kicker">FIRST-PARTY STOREFRONT MESSAGING</span><h2>Website notifications</h2><p>Reach anonymous visitors by meaningful intent: time on site, pages viewed, scroll depth, a viewed flow, or an active cart. Browser push remains opt-in.</p></div>
      </div>

      <div className="analytics-stats-grid">
        <div className="stat-card"><span className="stat-label">Campaigns</span><strong className="stat-value">{metrics.total}</strong><span className="stat-subtext">Created notifications</span></div>
        <div className="stat-card"><span className="stat-label">Active</span><strong className="stat-value">{metrics.active}</strong><span className="stat-subtext">Currently eligible</span></div>
        <div className="stat-card"><span className="stat-label">Delivered</span><strong className="stat-value">{metrics.delivered}</strong><span className="stat-subtext">Anonymous browser feeds</span></div>
        <div className="stat-card"><span className="stat-label">Read</span><strong className="stat-value">{metrics.read}</strong><span className="stat-subtext">Opened notification feeds</span></div>
        <div className="stat-card"><span className="stat-label">Push Subscribers</span><strong className="stat-value">{activePushSubscribers}</strong><span className="stat-subtext">{metrics.pushSent} browser pushes sent</span></div>
      </div>

      {canManage && (
        <form className="table-panel notification-create-panel" onSubmit={handleCreate}>
          <div className="table-header-controls">
            <div><strong>Create Notification</strong><p className="coupon-panel-copy">Start with engaged visitors. Use immediate broadcast only for essential updates; coupon campaigns stop when the coupon is unavailable.</p></div>
            <button type="submit" className="btn-admin-primary" disabled={saving}>{saving ? 'Publishing…' : 'Publish Notification'}</button>
          </div>
          <div className="notification-form-grid">
            <label className="coupon-field"><span>Title</span><input className="admin-input" value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="A cart offer for you" minLength={3} maxLength={80} required /></label>
            <label className="coupon-field notification-message-field"><span>Message</span><textarea className="admin-input" value={form.message} onChange={(event) => updateForm('message', event.target.value)} placeholder="Complete your cart with this limited coupon." minLength={5} maxLength={280} required /><small>{form.message.length}/280</small></label>
            <label className="coupon-field notification-target-field"><span>Who should receive it?</span><select className="admin-select" value={form.targeting_preset} onChange={(event) => updateForm('targeting_preset', event.target.value)}>{Object.entries(TARGETING_PRESETS).map(([value, preset]) => <option value={value} key={value}>{preset.label}</option>)}</select><small>{TARGETING_PRESETS[form.targeting_preset].help}</small></label>
            {['product_view', 'product_cart'].includes(form.targeting_preset) && <label className="coupon-field"><span>{form.targeting_preset === 'product_view' ? 'Flow Viewed' : 'Flow in Cart'}</span><select className="admin-select" value={form.product_id} onChange={(event) => updateForm('product_id', event.target.value)} required><option value="">Choose flow…</option>{products.map((product) => <option value={product.id} key={product.id}>{product.title}</option>)}</select></label>}
            <label className="coupon-field"><span>Coupon (Optional)</span><select className="admin-select" value={form.coupon_id} onChange={(event) => updateForm('coupon_id', event.target.value)}><option value="">No coupon</option>{coupons.filter((coupon) => coupon.active).map((coupon) => <option value={coupon.id} key={coupon.id}>{coupon.code} · {coupon.discount_value_display}</option>)}</select></label>
            <label className="coupon-field"><span>Button Label</span><input className="admin-input" value={form.cta_label} onChange={(event) => updateForm('cta_label', event.target.value)} maxLength={40} placeholder="View cart" /></label>
            <label className="coupon-field"><span>Internal Button Path</span><input className="admin-input font-mono" value={form.cta_url} onChange={(event) => updateForm('cta_url', event.target.value)} maxLength={200} placeholder="/cart" required /></label>
            <label className="coupon-field"><span>Starts At</span><input className="admin-input" type="datetime-local" value={form.starts_at} onChange={(event) => updateForm('starts_at', event.target.value)} /></label>
            <label className="coupon-field"><span>Expires At</span><input className="admin-input" type="datetime-local" value={form.expires_at} onChange={(event) => updateForm('expires_at', event.target.value)} /></label>
            <label className={`notification-push-option ${!pushConfigured ? 'is-disabled' : ''}`}>
              <input type="checkbox" checked={form.push_enabled} onChange={(event) => updateForm('push_enabled', event.target.checked)} disabled={!pushConfigured} />
              <span><strong>Also send browser push now</strong><small>{pushConfigured ? `Sends immediately to eligible opted-in browsers (${activePushSubscribers} active).` : 'VAPID push keys are not configured.'}</small></span>
            </label>
          </div>
        </form>
      )}

      {error && <div className="attention-banner danger" role="alert">{error}</div>}
      {notice && <div className="attention-banner warning" role="status">✓ {notice}</div>}

      <div className="table-panel">
        <div className="table-header-controls"><div><strong>Campaign History</strong><p className="coupon-panel-copy">Campaign text and targeting stay immutable for an accurate audit trail. Deactivate a campaign to stop it.</p></div><button type="button" className="btn-admin-secondary" onClick={fetchData}>Refresh</button></div>
        <div className="admin-table-wrapper">
          <table className="admin-table notification-table">
            <thead><tr><th>Notification</th><th>Audience</th><th>Coupon</th><th>Schedule</th><th>In-site</th><th>Browser Push</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {loading && notifications.length === 0 ? <tr><td colSpan={8} className="analytics-empty-cell">Loading notifications…</td></tr>
                : notifications.length === 0 ? <tr><td colSpan={8} className="analytics-empty-cell">No in-site notification campaigns yet.</td></tr>
                  : notifications.map((notification) => (
                    <tr key={notification.id}>
                      <td><strong>{notification.title}</strong><small className="notification-admin-message">{notification.message}</small></td>
                      <td>{notificationAudienceLabel(notification)}{notification.product_id && <small className="analytics-table-note">{products.find((product) => product.id === notification.product_id)?.title || notification.product_id}</small>}</td>
                      <td>{notification.coupon_code ? <strong className="font-mono coupon-code-token">{notification.coupon_code}</strong> : '—'}</td>
                      <td><small>Starts: {formatDate(notification.starts_at)}</small><small className="analytics-table-note">Ends: {formatDate(notification.expires_at)}</small></td>
                      <td className="font-mono">{notification.read_count} read<small className="analytics-table-note">{notification.delivered_count} delivered · {notification.dismissed_count} dismissed</small></td>
                      <td>{notification.push_enabled ? <span className="font-mono">{notification.push_sent_count} sent<small className="analytics-table-note">{notification.push_failed_count + notification.push_gone_count} failed/expired</small></span> : 'Not sent'}</td>
                      <td><span className={`status-badge ${notification.active ? 'confirmed' : 'failed'}`}>{notification.active ? 'Active' : 'Inactive'}</span></td>
                      <td><button type="button" className={notification.active ? 'btn-admin-danger' : 'btn-admin-secondary'} onClick={() => toggleNotification(notification)} disabled={!canManage}>{notification.active ? 'Deactivate' : 'Activate'}</button></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
