import { useState } from 'react';
import { useFilter } from '../context/FilterContext';
import './Sidebar.css';

// SVG Icons
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M7.8,2H16.2C19.4,2 22,4.6 22,7.8V16.2A5.8,5.8 0 0,1 16.2,22H7.8C4.6,22 2,19.4 2,16.2V7.8A5.8,5.8 0 0,1 7.8,2M7.6,4A3.6,3.6 0 0,0 4,7.6V16.4C4,18.39 5.61,20 7.6,20H16.4A3.6,3.6 0 0,0 20,16.4V7.6C20,5.61 18.39,4 16.4,4H7.6M17.25,5.5A1.25,1.25 0 0,1 18.5,6.75A1.25,1.25 0 0,1 17.25,8A1.25,1.25 0 0,1 16,6.75A1.25,1.25 0 0,1 17.25,5.5M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9Z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.12-3.44-3.17-3.61-5.66-.21-3.32 1.99-6.38 5.17-7.23 1.15-.31 2.37-.36 3.54-.15.02 1.34.01 2.68.01 4.02-.75-.24-1.57-.34-2.35-.15-.81.18-1.55.7-2.01 1.39-.77 1.16-.76 2.82.02 3.97 1.16 1.73 3.84 1.92 5.25.32 1.05-1.17 1.05-2.92 1.04-4.47-.02-5.1-.03-10.2-.04-15.3z"/>
  </svg>
);

const GmailIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
  </svg>
);

const GeelarkIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
);

const AllAssetsIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"></rect>
    <rect x="14" y="3" width="7" height="7"></rect>
    <rect x="14" y="14" width="7" height="7"></rect>
    <rect x="3" y="14" width="7" height="7"></rect>
  </svg>
);

export default function Sidebar({ isCollapsed, toggleCollapse, isDarkMode, toggleTheme }) {
  const {
    selectedCategory,
    setSelectedCategory,
    instockOnly,
    setInstockOnly,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
  } = useFilter();

  const [accountsExpanded, setAccountsExpanded] = useState(true);

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div 
          className="brand-icon clickable-logo" 
          title="Toggle Sidebar" 
          onClick={toggleCollapse}
          role="button"
          tabIndex={0}
        >
          <GeelarkIcon />
        </div>
        {!isCollapsed && (
          <div className="brand-title">
            <h2>GEELARK</h2>
            <span className="brand-subtitle">FLOWS</span>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {!isCollapsed && <div className="nav-section-title">CATEGORIES</div>}
        <ul className="nav-list">
          {/* All Assets */}
          <li className="nav-item">
            <button
              className={`nav-link ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => handleCategorySelect('all')}
              title={isCollapsed ? "All Assets" : ""}
            >
              <span className="nav-icon"><AllAssetsIcon /></span>
              {!isCollapsed && <span className="nav-label">All Assets</span>}
            </button>
          </li>

          {/* GeeLark Flows */}
          <li className="nav-item">
            <button
              className={`nav-link ${selectedCategory === 'flows' ? 'active' : ''}`}
              onClick={() => handleCategorySelect('flows')}
              title={isCollapsed ? "GeeLark Flows" : ""}
            >
              <span className="nav-icon"><GeelarkIcon /></span>
              {!isCollapsed && <span className="nav-label">GeeLark Flows</span>}
            </button>
          </li>

          {/* Aged Accounts Accordion */}
          <li className="nav-item-accordion">
            <div className={`nav-link-parent ${selectedCategory.startsWith('accounts') ? 'active-parent' : ''}`}>
              <button
                className="nav-link parent-btn"
                onClick={() => handleCategorySelect('accounts')}
                title={isCollapsed ? "Aged Accounts" : ""}
              >
                <span className="nav-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                {!isCollapsed && <span className="nav-label">Aged Accounts</span>}
              </button>
              {!isCollapsed && (
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
              )}
            </div>

            {(!isCollapsed && accountsExpanded) && (
              <ul className="nav-sub-list">
                <li>
                  <button
                    className={`nav-sub-link ${
                      selectedCategory === 'accounts-instagram' ? 'active' : ''
                    }`}
                    onClick={() => handleCategorySelect('accounts-instagram')}
                  >
                    <span className="sub-icon instagram"><InstagramIcon /></span>
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
                    <span className="sub-icon tiktok"><TikTokIcon /></span>
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
                    <span className="sub-icon gmail"><GmailIcon /></span>
                    <span>Gmail</span>
                  </button>
                </li>
              </ul>
            )}
          </li>
        </ul>

        {/* Pricing Filter */}
        {!isCollapsed && (
          <div className="nav-section-title" style={{ marginTop: 'var(--sp-6)' }}>PRICE RANGE</div>
        )}
        {!isCollapsed && (
          <div className="price-filter">
            <input 
              type="number" 
              placeholder="Min $" 
              value={minPrice} 
              onChange={(e) => setMinPrice(e.target.value)} 
              min="0"
              className="price-input"
            />
            <span className="price-separator">-</span>
            <input 
              type="number" 
              placeholder="Max $" 
              value={maxPrice} 
              onChange={(e) => setMaxPrice(e.target.value)} 
              min="0"
              className="price-input"
            />
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="filter-toggle-container">
          <button
            className={`stock-toggle-btn ${instockOnly ? 'active' : ''}`}
            onClick={() => setInstockOnly(!instockOnly)}
            role="switch"
            aria-checked={instockOnly}
            title={isCollapsed ? "Toggle Instock Only" : ""}
          >
            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span className="toggle-label">Instock Only</span>
                <span className="toggle-sublabel">Hide sold out assets</span>
              </div>
            )}
            <span className="toggle-switch" style={{ margin: isCollapsed ? '0 auto' : '0' }} />
          </button>
        </div>

        <button className="theme-toggle-btn" onClick={toggleTheme} title={isCollapsed ? "Toggle Theme" : ""}>
          {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>

        <div className="system-status" style={{ padding: isCollapsed ? '8px 0' : '8px' }}>
          <span className="status-dot green animate-breathe" />
          {!isCollapsed && <span className="status-text">SYSTEM ACTIVE (99.9% uptime)</span>}
        </div>
      </div>
    </aside>
  );
}
