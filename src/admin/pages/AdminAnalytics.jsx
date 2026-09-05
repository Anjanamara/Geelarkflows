import React, { useEffect, useMemo, useState } from 'react';

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(`${value}Z`.replace('ZZ', 'Z')).toLocaleString();
}

function formatLocation(event) {
  return [event.city, event.region, event.country_code].filter(Boolean).join(', ') || 'Unknown';
}

export default function AdminAnalytics({ lastSyncedAt }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/analytics?days=${days}`)
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = '/admin/login';
          return null;
        }
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Analytics could not be loaded.');
        return payload.data;
      })
      .then((payload) => {
        if (!cancelled && payload) {
          setData(payload);
          setError('');
        }
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [days, lastSyncedAt]);

  const maxDailyVisitors = useMemo(
    () => Math.max(1, ...(data?.daily || []).map((row) => row.unique_visitors)),
    [data],
  );

  if (loading && !data) {
    return (
      <div className="analytics-loading-grid">
        {[...Array(6)].map((_, index) => (
          <div className="stat-card" key={index}>
            <span className="stat-label">Loading analytics…</span>
            <span className="stat-value">—</span>
          </div>
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="table-panel analytics-error-panel">
        <strong>Analytics unavailable</strong>
        <p>{error}</p>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const popularFlows = data?.popular_flows || [];
  const trafficSources = data?.traffic_sources || [];
  const locations = data?.locations || [];
  const activeCarts = data?.active_carts || [];
  const recentEvents = data?.recent_cart_additions || [];

  return (
    <div className="analytics-page">
      <div className="analytics-page-intro">
        <div>
          <span className="analytics-kicker">FIRST-PARTY STOREFRONT SIGNALS</span>
          <h2>Visitor & Cart Analytics</h2>
          <p>
            Anonymous visitor activity, flow interest, and cart intent. Network addresses are masked;
            no raw visitor IP or full user-agent string is retained.
          </p>
        </div>
        <label className="analytics-range-control">
          Reporting window
          <select className="admin-select" value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
      </div>

      {error && <div className="analytics-inline-warning">Latest refresh failed: {error}</div>}

      <div className="analytics-stats-grid">
        <div className="stat-card featured">
          <span className="stat-label">Unique Visitors</span>
          <span className="stat-value">{metrics.unique_visitors || 0}</span>
          <span className="stat-sub">Anonymous browsers in {days} days</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Cart Visitors</span>
          <span className="stat-value">{metrics.cart_visitors || 0}</span>
          <span className="stat-sub">Visitors who added ≥1 flow</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Cart Additions</span>
          <span className="stat-value">{metrics.cart_additions || 0}</span>
          <span className="stat-sub">All add-to-cart actions</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Last-known Active Carts</span>
          <span className="stat-value">{metrics.active_carts || 0}</span>
          <span className="stat-sub">Non-empty browser carts in this window</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Visitor → Cart Rate</span>
          <span className="stat-value">{metrics.cart_visitor_rate || 0}%</span>
          <span className="stat-sub">Unique cart visitors / visitors</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Page Views</span>
          <span className="stat-value">{metrics.page_views || 0}</span>
          <span className="stat-sub">One view per session and path</span>
        </div>
      </div>

      <section className="table-panel">
        <div className="table-header-controls">
          <div>
            <strong>Traffic sources</strong>
            <span className="analytics-table-note">Original landing hostname for each browser session; Direct and Internal visits remain separate.</span>
          </div>
          <span>{days}-day acquisition view</span>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table analytics-sources-table">
            <thead><tr><th>Source</th><th>Sessions</th><th>Visitors</th><th>Page Views</th><th>Cart Visitors</th><th>Cart Adds</th></tr></thead>
            <tbody>
              {trafficSources.length === 0 ? (
                <tr><td colSpan={6} className="analytics-empty-cell">New traffic-source data will appear as visitors arrive.</td></tr>
              ) : trafficSources.map((source) => (
                <tr key={source.referrer_host}>
                  <td><strong>{source.referrer_host || 'Direct'}</strong></td>
                  <td className="font-mono">{source.sessions}</td>
                  <td className="font-mono">{source.unique_visitors}</td>
                  <td className="font-mono">{source.page_views}</td>
                  <td className="font-mono">{source.cart_visitors}</td>
                  <td className="font-mono">{source.cart_additions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="analytics-two-column">
        <section className="table-panel analytics-chart-panel">
          <div className="table-header-controls">
            <strong>Daily unique visitors</strong>
            <span>{days}-day trend</span>
          </div>
          {(data?.daily || []).length === 0 ? (
            <div className="analytics-empty">Visitor data will appear after the new tracker receives traffic.</div>
          ) : (
            <div className="analytics-bars" aria-label="Daily unique visitor chart">
              {data.daily.map((row) => (
                <div className="analytics-bar-column" key={row.day} title={`${row.day}: ${row.unique_visitors} visitors, ${row.cart_additions} cart additions`}>
                  <div className="analytics-bar-track">
                    <span style={{ height: `${Math.max(5, (row.unique_visitors / maxDailyVisitors) * 100)}%` }} />
                  </div>
                  <strong>{row.unique_visitors}</strong>
                  <small>{new Date(`${row.day}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="table-panel">
          <div className="table-header-controls">
            <strong>Most-added flows</strong>
            <span>Cart intent</span>
          </div>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead><tr><th>Flow</th><th>Adds</th><th>Visitors</th><th>Share</th></tr></thead>
              <tbody>
                {popularFlows.length === 0 ? (
                  <tr><td colSpan={4} className="analytics-empty-cell">No cart additions in this period.</td></tr>
                ) : popularFlows.map((flow) => (
                  <tr key={flow.product_id}>
                    <td><strong>{flow.title}</strong><small className="analytics-product-id">{flow.product_id}</small></td>
                    <td className="font-mono">{flow.cart_additions}</td>
                    <td className="font-mono">{flow.unique_visitors}</td>
                    <td className="font-mono">{flow.share}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="analytics-two-column">
        <section className="table-panel">
          <div className="table-header-controls">
            <div>
              <strong>Visitor locations</strong>
              <span className="analytics-table-note">Cloudflare-provided coarse location; recognized bots excluded.</span>
            </div>
            <span>Audience & cart intent</span>
          </div>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead><tr><th>Location</th><th>Visitors</th><th>Cart Visitors</th><th>Adds</th><th>Rate</th></tr></thead>
              <tbody>
                {locations.length === 0 ? (
                  <tr><td colSpan={5} className="analytics-empty-cell">No location data in this period.</td></tr>
                ) : locations.map((location, index) => (
                  <tr key={`${location.country_code}-${location.region}-${location.city}-${index}`}>
                    <td><strong>{formatLocation(location)}</strong></td>
                    <td className="font-mono">{location.unique_visitors}</td>
                    <td className="font-mono">{location.cart_visitors}</td>
                    <td className="font-mono">{location.cart_additions}</td>
                    <td className="font-mono">{location.cart_visitor_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="table-panel">
          <div className="table-header-controls">
            <div>
              <strong>Last-known active carts</strong>
              <span className="analytics-table-note">Updated when a visitor adds, removes, or clears a flow.</span>
            </div>
            <span>{days}-day window</span>
          </div>
          <div className="admin-table-wrapper">
            <table className="admin-table analytics-active-carts-table">
              <thead><tr><th>Updated</th><th>Visitor</th><th>Cart</th><th>Value</th><th>Location</th><th>Device</th></tr></thead>
              <tbody>
                {activeCarts.length === 0 ? (
                  <tr><td colSpan={6} className="analytics-empty-cell">No last-known active carts in this period.</td></tr>
                ) : activeCarts.map((cart, index) => (
                  <tr key={`${cart.visitor_id}-${cart.updated_at}-${index}`}>
                    <td className="font-mono analytics-nowrap">{formatDateTime(cart.updated_at)}</td>
                    <td><span className="analytics-visitor-id">{cart.visitor_id || 'unknown'}</span></td>
                    <td>
                      <strong>{cart.item_count} {cart.item_count === 1 ? 'flow' : 'flows'}</strong>
                      {(cart.items || []).map((item) => <small className="analytics-product-id" key={item.product_id}>{item.title}</small>)}
                    </td>
                    <td className="font-mono">${Number(cart.cart_value_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>{formatLocation(cart)}<small className="analytics-product-id font-mono">{cart.ip_network || 'Network not retained'}</small></td>
                    <td>{cart.device_type || 'Unknown'}<small className="analytics-product-id">{cart.browser_family} · {cart.os_family}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="table-panel">
        <div className="table-header-controls">
          <div>
            <strong>Recent cart additions</strong>
            <span className="analytics-table-note">Anonymous visitor IDs are shortened for display.</span>
          </div>
          <span>Rolling {data?.retention_days || 90}-day retention</span>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table analytics-events-table">
            <thead>
              <tr><th>Time</th><th>Visitor</th><th>Flow</th><th>Network</th><th>Location</th><th>Device</th><th>Source</th></tr>
            </thead>
            <tbody>
              {recentEvents.length === 0 ? (
                <tr><td colSpan={7} className="analytics-empty-cell">No cart additions in this period.</td></tr>
              ) : recentEvents.map((event, index) => (
                <tr key={`${event.visitor_id}-${event.created_at}-${index}`}>
                  <td className="font-mono analytics-nowrap">{formatDateTime(event.created_at)}</td>
                  <td><span className="analytics-visitor-id">{event.visitor_id || 'unknown'}</span></td>
                  <td><strong>{event.title}</strong><small className="analytics-product-id">{event.page_path}</small></td>
                  <td className="font-mono">{event.ip_network || 'Not retained'}</td>
                  <td>{formatLocation(event)}</td>
                  <td>{event.device_type || 'Unknown'}<small className="analytics-product-id">{event.browser_family} · {event.os_family}</small></td>
                  <td>{event.referrer_host || 'Direct'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
