import React, { useState } from 'react';

export default function AdminLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Action': '1',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed.');
      }

      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-wrap">
      <div className="login-card">
        <div className="login-brand-header">
          <div className="sidebar-logo-badge" style={{ width: '32px', height: '32px' }} aria-hidden="true">
            <img src="/logo-mark.svg" alt="" />
          </div>
          <div>
            <h1 className="login-title">GeeLark Admin</h1>
            <p className="login-subtitle">Internal Order Operations & Fulfillment</p>
          </div>
        </div>

        {error && (
          <div className="login-error-alert" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <label className="login-label" htmlFor="admin-email">Administrator Email</label>
            <input
              id="admin-email"
              type="email"
              required
              className="admin-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@geelarkflows.com"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div>
            <label className="login-label" htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              required
              className="admin-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn-admin-primary"
            style={{ width: '100%', height: '40px', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign in to Dashboard →'}
          </button>
        </form>
      </div>
    </div>
  );
}
