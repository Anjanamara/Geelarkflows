import React, { useEffect, useState } from 'react';

export default function AdminWorkflows({ lastSyncedAt }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [platformFilter, setPlatformFilter] = useState('all');

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/workflows');
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch workflows.');
      setWorkflows(data.workflows || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, [lastSyncedAt]);

  const filteredWorkflows = workflows.filter((wf) => {
    if (platformFilter === 'all') return true;
    return wf.platform === platformFilter;
  });

  const totalCatalogUnits = workflows.reduce((sum, wf) => sum + (wf.units_sold || 0), 0);
  const totalCatalogSales = workflows.reduce((sum, wf) => sum + (wf.total_sales_usd || 0), 0);

  return (
    <div>
      {/* Metrics Row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card">
          <span className="stat-label">Active Flow Products</span>
          <span className="stat-value">{workflows.length}</span>
          <span className="stat-sub">Across 8 platform categories</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Workflow Units Sold</span>
          <span className="stat-value">{totalCatalogUnits}</span>
          <span className="stat-sub">Completed customer purchases</span>
        </div>
        <div className="stat-card featured">
          <span className="stat-label">Workflow Gross Volume</span>
          <span className="stat-value">${totalCatalogSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          <span className="stat-sub font-mono">Aggregated from paid orders</span>
        </div>
      </div>

      <div className="table-panel">
        <div className="table-header-controls">
          <div>
            <strong style={{ fontSize: '13px', display: 'block' }}>Workflow Product Catalog Analytics</strong>
            <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
              Real-time purchase volume and revenue generated per automation workflow.
            </span>
          </div>

          <div className="filter-group">
            <select className="admin-select" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
              <option value="all">All Platforms (8)</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="snapchat">Snapchat</option>
              <option value="reddit">Reddit</option>
              <option value="facebook">Facebook</option>
              <option value="youtube">YouTube</option>
              <option value="threads">Threads</option>
              <option value="dating">Dating Apps</option>
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
                <th>Workflow ID</th>
                <th>Title</th>
                <th>Platform</th>
                <th>Category</th>
                <th>Unit Price</th>
                <th>Units Sold</th>
                <th>Total Volume (USD)</th>
              </tr>
            </thead>
            <tbody>
              {loading && workflows.length === 0 ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} style={{ padding: '16px', color: 'var(--admin-text-muted)', textAlign: 'center' }}>
                      Loading workflow catalog...
                    </td>
                  </tr>
                ))
              ) : filteredWorkflows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
                    No workflows match this platform filter.
                  </td>
                </tr>
              ) : (
                filteredWorkflows.map((wf) => (
                  <tr key={wf.id}>
                    <td className="font-mono" style={{ fontSize: '11.5px', color: 'var(--admin-text-primary)' }}>
                      {wf.id}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--admin-text-primary)' }}>{wf.title}</td>
                    <td>
                      <span className="network-badge" style={{ textTransform: 'capitalize' }}>
                        {wf.platform}
                      </span>
                    </td>
                    <td>{wf.category}</td>
                    <td className="font-mono" style={{ fontWeight: 700 }}>
                      ${wf.price}.00
                    </td>
                    <td className="font-mono" style={{ fontWeight: 700 }}>
                      {wf.units_sold || 0}
                    </td>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--admin-accent)' }}>
                      ${Number(wf.total_sales_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
