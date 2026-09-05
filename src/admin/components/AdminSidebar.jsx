import React from 'react';

export default function AdminSidebar({
  currentPath,
  navigate,
  user,
  onLogout,
  isOpen,
  onClose,
  attentionCount = 0,
  unreadMailCount = 0,
}) {
  const navItems = [
    { path: '/admin', label: 'Overview', icon: '📊' },
    { path: '/admin/orders', label: 'Orders', icon: '📦' },
    { path: '/admin/payments', label: 'Payments', icon: '💳' },
    { path: '/admin/fulfillment', label: 'Fulfillment', icon: '⚡', badge: attentionCount > 0 ? attentionCount : null },
    { path: '/admin/workflows', label: 'Workflows', icon: '⚙️' },
    { path: '/admin/coupons', label: 'Coupons', icon: '🏷️' },
    { path: '/admin/notifications', label: 'Notifications', icon: '🔔' },
    { path: '/admin/analytics', label: 'Visitor Analytics', icon: '📈' },
    { path: '/admin/customers', label: 'Customers', icon: '👥' },
    { path: '/admin/custom-requests', label: 'Custom Requests', icon: '📝' },
    { path: '/admin/mail', label: 'Mail', icon: '✉️', badge: unreadMailCount > 0 ? unreadMailCount : null },
    { path: '/admin/activity', label: 'Activity Log', icon: '📜' },
    { path: '/admin/settings', label: 'Settings', icon: '🔧' },
  ];

  return (
    <>
      {isOpen && <div className="admin-modal-overlay" style={{ zIndex: 35 }} onClick={onClose} />}
      <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo-badge" aria-hidden="true">
            <img src="/logo-mark.svg" alt="" />
          </div>
          <div className="sidebar-title">
            <strong>GeeLark Admin</strong>
            <span>Operations</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = currentPath === item.path || (item.path !== '/admin' && currentPath.startsWith(item.path));
            return (
              <button
                key={item.path}
                type="button"
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  navigate(item.path);
                  if (onClose) onClose();
                }}
              >
                <div className="sidebar-nav-left">
                  <span className="sidebar-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="sidebar-badge alert">{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-user-name" title={user?.email}>{user?.email || 'admin'}</span>
            <span className="sidebar-user-role">{user?.role || 'ADMIN'}</span>
          </div>
          <button type="button" className="btn-logout" onClick={onLogout} title="Log out">
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
