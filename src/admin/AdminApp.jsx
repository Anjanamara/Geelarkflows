import React, { useEffect, useState, useCallback } from 'react';
import AdminSidebar from './components/AdminSidebar';
import AdminLogin from './pages/AdminLogin';
import AdminOverview from './pages/AdminOverview';
import AdminOrders from './pages/AdminOrders';
import AdminOrderDetail from './pages/AdminOrderDetail';
import AdminPayments from './pages/AdminPayments';
import AdminFulfillment from './pages/AdminFulfillment';
import AdminWorkflows from './pages/AdminWorkflows';
import AdminCustomers from './pages/AdminCustomers';
import AdminCustomRequests from './pages/AdminCustomRequests';
import AdminMail from './pages/AdminMail';
import AdminActivity from './pages/AdminActivity';
import AdminSettings from './pages/AdminSettings';
import './AdminApp.css';

export default function AdminApp() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(Date.now());
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(20); // seconds (0 = off)
  const [unreadMailCount, setUnreadMailCount] = useState(0);

  // Sync Unread Mail Badge
  const syncUnreadMail = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/mail?filter=unread&pageSize=1');
      const data = await res.json();
      if (res.ok && data.success && data.unread_count !== undefined) {
        setUnreadMailCount(data.unread_count);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (user) {
      syncUnreadMail();
    }
  }, [user, lastSyncedAt, syncUnreadMail]);

  // 1. Session Verification
  const verifySession = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth/me');
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  // 2. Client Routing
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
    }
  };

  // 3. Auto-Polling System (Pauses on Blur)
  useEffect(() => {
    if (!user || autoRefreshInterval <= 0) return;

    let timer = null;
    const tick = () => {
      if (!document.hidden) {
        setLastSyncedAt(Date.now());
      }
    };

    timer = setInterval(tick, autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [user, autoRefreshInterval]);

  // 4. Logout Action
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Action': '1',
        },
      });
    } catch (e) {}
    setUser(null);
    navigate('/admin/login');
  };

  if (checkingAuth) {
    return (
      <div className="login-screen-wrap" style={{ color: 'var(--admin-text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="sidebar-logo-badge" aria-hidden="true">
            <img src="/logo-mark.svg" alt="" />
          </div>
          <span>Verifying admin session...</span>
        </div>
      </div>
    );
  }

  // If unauthenticated or on login page
  if (!user || currentPath === '/admin/login') {
    return <AdminLogin onLoginSuccess={(u) => { setUser(u); navigate('/admin'); }} />;
  }

  // Route Dispatcher
  const renderCurrentView = () => {
    if (currentPath === '/admin' || currentPath === '/admin/') {
      return <AdminOverview navigate={navigate} lastSyncedAt={lastSyncedAt} />;
    }
    if (currentPath === '/admin/orders' || currentPath === '/admin/orders/') {
      return <AdminOrders navigate={navigate} lastSyncedAt={lastSyncedAt} />;
    }
    const orderMatch = currentPath.match(/^\/admin\/orders\/([^/]+)\/?$/);
    if (orderMatch) {
      return (
        <AdminOrderDetail
          orderId={orderMatch[1]}
          navigate={navigate}
          user={user}
          onActionSuccess={() => setLastSyncedAt(Date.now())}
        />
      );
    }
    if (currentPath.startsWith('/admin/payments')) {
      return <AdminPayments navigate={navigate} lastSyncedAt={lastSyncedAt} />;
    }
    if (currentPath.startsWith('/admin/fulfillment')) {
      return <AdminFulfillment navigate={navigate} lastSyncedAt={lastSyncedAt} />;
    }
    if (currentPath.startsWith('/admin/workflows')) {
      return <AdminWorkflows lastSyncedAt={lastSyncedAt} />;
    }
    if (currentPath.startsWith('/admin/customers')) {
      return <AdminCustomers navigate={navigate} lastSyncedAt={lastSyncedAt} />;
    }
    if (currentPath.startsWith('/admin/custom-requests')) {
      return <AdminCustomRequests navigate={navigate} lastSyncedAt={lastSyncedAt} user={user} />;
    }
    if (currentPath.startsWith('/admin/mail')) {
      return <AdminMail navigate={navigate} lastSyncedAt={lastSyncedAt} user={user} onActionSuccess={() => setLastSyncedAt(Date.now())} />;
    }
    if (currentPath.startsWith('/admin/activity')) {
      return <AdminActivity lastSyncedAt={lastSyncedAt} />;
    }
    if (currentPath.startsWith('/admin/settings')) {
      return <AdminSettings user={user} onLogout={handleLogout} />;
    }

    return <AdminOverview navigate={navigate} lastSyncedAt={lastSyncedAt} />;
  };

  const getPageTitle = () => {
    if (currentPath.startsWith('/admin/orders/')) return 'Order Details';
    if (currentPath.startsWith('/admin/orders')) return 'Orders Management';
    if (currentPath.startsWith('/admin/payments')) return 'Cryptocurrency Payments';
    if (currentPath.startsWith('/admin/fulfillment')) return 'Fulfillment Dispatch';
    if (currentPath.startsWith('/admin/workflows')) return 'Workflows Analytics';
    if (currentPath.startsWith('/admin/customers')) return 'Customer Directory';
    if (currentPath.startsWith('/admin/custom-requests')) return 'Custom Requests Management';
    if (currentPath.startsWith('/admin/mail')) return 'Internal Mail Inbox';
    if (currentPath.startsWith('/admin/activity')) return 'System Audit Trail';
    if (currentPath.startsWith('/admin/settings')) return 'Operations Settings';
    return 'Operations Overview';
  };

  return (
    <div className="admin-root">
      <div className="admin-layout">
        <AdminSidebar
          currentPath={currentPath}
          navigate={navigate}
          user={user}
          onLogout={handleLogout}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          unreadMailCount={unreadMailCount}
        />

        <div className="admin-main">
          <header className="admin-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button
                type="button"
                className="btn-admin-secondary"
                style={{ display: 'inline-flex', padding: '0 8px', height: '30px' }}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title="Toggle Navigation Menu"
              >
                ☰
              </button>
              <h1 className="admin-header-title">{getPageTitle()}</h1>
            </div>

            <div className="admin-header-actions">
              <div className="sync-status-indicator">
                <span className="sync-dot" />
                <span>Synced {new Date(lastSyncedAt).toLocaleTimeString()}</span>
              </div>

              <select
                className="admin-select"
                style={{ height: '30px', fontSize: '11px' }}
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                title="Auto Refresh Rate"
              >
                <option value={10}>Refresh 10s</option>
                <option value={20}>Refresh 20s</option>
                <option value={60}>Refresh 60s</option>
                <option value={0}>Manual only</option>
              </select>

              <button
                type="button"
                className="btn-admin-secondary"
                style={{ height: '30px', padding: '0 10px', fontSize: '11.5px' }}
                onClick={() => setLastSyncedAt(Date.now())}
                title="Force refresh data now"
              >
                🔄 Refresh
              </button>
            </div>
          </header>

          <main className="admin-content">
            {renderCurrentView()}
          </main>
        </div>
      </div>
    </div>
  );
}
