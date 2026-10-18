import React, { useState } from 'react';
import './LegalPage.css';

export default function LeadUnsubscribePage({ navigate }) {
  const [state, setState] = useState('idle');
  const token = new URLSearchParams(window.location.search).get('token') || '';

  const unsubscribe = async () => {
    setState('working');
    try {
      const response = await fetch('/api/leads/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json();
      setState(response.ok && payload.success ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="legal-page-shell">
      <main className="legal-page-main">
        <article className="legal-article-container">
          <div className="legal-doc-header">
            <span className="legal-kicker">EMAIL PREFERENCES</span>
            <h1 className="legal-doc-title">Control your GeeLark Flows emails.</h1>
            {state === 'done' ? (
              <p className="legal-doc-summary" role="status">You are unsubscribed from optional marketing emails. Requested previews, order updates, and support replies are unaffected.</p>
            ) : (
              <p className="legal-doc-summary">Stop optional product updates and promotional offers. Transactional order and support messages remain available when you request them.</p>
            )}
          </div>
          {state !== 'done' && (
            <button className="btn-primary" type="button" onClick={unsubscribe} disabled={!token || state === 'working'}>
              {state === 'working' ? 'Updating…' : 'Unsubscribe from offers'}
            </button>
          )}
          {state === 'error' && <p role="alert">This preference link is invalid or expired. Contact support@geelarkflows.com for help.</p>}
          <button className="btn-secondary" type="button" onClick={() => navigate('/')}>Return to marketplace</button>
        </article>
      </main>
    </div>
  );
}
