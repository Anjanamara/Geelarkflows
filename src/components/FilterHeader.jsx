import { useFilter } from '../context/FilterContext';
import { useCart } from '../context/CartContext';
import { platforms } from '../data/products';
import './FilterHeader.css';

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

export default function FilterHeader() {
  const {
    searchQuery,
    setSearchQuery,
    selectedPlatforms,
    togglePlatform,
    filteredProducts,
  } = useFilter();

  const { cartItemCount, openCart } = useCart();

  const getPlatformIcon = (platformId) => {
    switch (platformId) {
      case 'instagram': return <InstagramIcon />;
      case 'tiktok': return <TikTokIcon />;
      case 'gmail': return <GmailIcon />;
      case 'geelark': return <GeelarkIcon />;
      default: return '◈';
    }
  };

  return (
    <header className="filter-header">
      <div className="filter-top-row">
        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search automation flows, aged profiles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>

        <div className="header-meta-group">
          <div className="results-count">
            <span className="count-number mono">{filteredProducts.length}</span>
            <span className="count-text">assets found</span>
          </div>

          <button className="cart-trigger-btn" onClick={openCart} aria-label="Open Shopping Cart">
            <span className="cart-btn-icon">🛒</span>
            <span className="cart-btn-text">Cart</span>
            {cartItemCount > 0 && (
              <span className="cart-badge mono">
                ({cartItemCount})
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="filter-bottom-row">
        <div className="platform-chips-container">
          <span className="chips-label">Platform:</span>
          <div className="platform-chips">
            {platforms.map((platform) => {
              const isActive = selectedPlatforms.includes(platform.id);
              const activeStyle = isActive
                ? {
                    borderColor: platform.color,
                    backgroundColor: `rgba(${
                      platform.id === 'instagram' ? '225, 48, 108' :
                      platform.id === 'tiktok' ? '0, 242, 234' :
                      platform.id === 'gmail' ? '234, 67, 53' :
                      '129, 140, 248'
                    }, 0.15)`,
                    color: '#0f172a',
                  }
                : {};

              return (
                <button
                  key={platform.id}
                  className={`platform-chip ${isActive ? 'active' : ''}`}
                  onClick={() => togglePlatform(platform.id)}
                  style={activeStyle}
                >
                  <span className="chip-icon" style={{ display: 'flex' }}>{getPlatformIcon(platform.id)}</span>
                  <span>{platform.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
