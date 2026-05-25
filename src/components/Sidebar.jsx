import { useState } from 'react';
import { useFilter } from '../context/FilterContext';
import './Sidebar.css';

export default function Sidebar() {
  const {
    selectedCategory,
    setSelectedCategory,
    instockOnly,
    setInstockOnly,
  } = useFilter();

  const [accountsExpanded, setAccountsExpanded] = useState(true);

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">
          <span>◈</span>
        </div>
        <div className="brand-title">
          <h2>NEXUS VAULT</h2>
          <span className="brand-subtitle">CYBER ASSETS</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">CATEGORIES</div>
        <ul className="nav-list">
          {/* All Assets */}
          <li className="nav-item">
            <button
              className={`nav-link ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => handleCategorySelect('all')}
            >
              <span className="nav-icon">◈</span>
              <span className="nav-label">All Assets</span>
            </button>
          </li>

          {/* GeeLark Flows */}
          <li className="nav-item">
            <button
              className={`nav-link ${selectedCategory === 'flows' ? 'active' : ''}`}
              onClick={() => handleCategorySelect('flows')}
            >
              <span className="nav-icon">⚡</span>
              <span className="nav-label">GeeLark Flows</span>
            </button>
          </li>

          {/* Aged Accounts Accordion */}
          <li className="nav-item-accordion">
            <div className={`nav-link-parent ${selectedCategory.startsWith('accounts') ? 'active-parent' : ''}`}>
              <button
                className="nav-link parent-btn"
                onClick={() => handleCategorySelect('accounts')}
              >
                <span className="nav-icon">◎</span>
                <span className="nav-label">Aged Accounts</span>
              </button>
              <button
                className={`accordion-toggle ${accountsExpanded ? 'expanded' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setAccountsExpanded(!accountsExpanded);
                }}
                aria-label="Toggle Aged Accounts subcategories"
              >
                ▼
              </button>
            </div>

            {accountsExpanded && (
              <ul className="nav-sub-list">
                <li>
                  <button
                    className={`nav-sub-link ${
                      selectedCategory === 'accounts-instagram' ? 'active' : ''
                    }`}
                    onClick={() => handleCategorySelect('accounts-instagram')}
                  >
                    <span className="sub-icon instagram">●</span>
                    <span>Instagram</span>
                  </button>
                </li>
                <li>
                  <button
                    className={`nav-sub-link ${
                      selectedCategory === 'accounts-tiktok' ? 'active' : ''
                    }`}
                    onClick={() => handleCategorySelect('accounts-tiktok')}
                  >
                    <span className="sub-icon tiktok">▶</span>
                    <span>TikTok</span>
                  </button>
                </li>
                <li>
                  <button
                    className={`nav-sub-link ${
                      selectedCategory === 'accounts-gmail' ? 'active' : ''
                    }`}
                    onClick={() => handleCategorySelect('accounts-gmail')}
                  >
                    <span className="sub-icon gmail">✉</span>
                    <span>Gmail</span>
                  </button>
                </li>
              </ul>
            )}
          </li>
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="filter-toggle-container">
          <button
            className={`stock-toggle-btn ${instockOnly ? 'active' : ''}`}
            onClick={() => setInstockOnly(!instockOnly)}
            role="switch"
            aria-checked={instockOnly}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span className="toggle-label">Instock Only</span>
              <span className="toggle-sublabel">Hide sold out assets</span>
            </div>
            <span className="toggle-switch" />
          </button>
        </div>

        <div className="system-status">
          <span className="status-dot green animate-breathe" />
          <span className="status-text">NETWORK SECURE (99.9% uptime)</span>
        </div>
      </div>
    </aside>
  );
}
