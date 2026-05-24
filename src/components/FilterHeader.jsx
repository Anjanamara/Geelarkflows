import { useFilter } from '../context/FilterContext';
import { useCart } from '../context/CartContext';
import { platforms } from '../data/products';
import './FilterHeader.css';

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
      case 'instagram':
        return '📸';
      case 'tiktok':
        return '🎵';
      case 'gmail':
        return '✉';
      case 'geelark':
        return '⚡';
      default:
        return '◈';
    }
  };

  return (
    <header className="filter-header">
      <div className="search-bar-container">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder="Search automation flows, aged profiles, PVA accounts, features..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
            ✕
          </button>
        )}
      </div>

      <div className="filter-actions-row">
        <div className="platform-chips-container">
          <span className="chips-label">Platform:</span>
          <div className="chips-group">
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
                    color: '#f8fafc',
                    boxShadow: `0 0 12px ${
                      platform.id === 'instagram' ? 'var(--color-instagram-glow)' :
                      platform.id === 'tiktok' ? 'var(--color-tiktok-glow)' :
                      platform.id === 'gmail' ? 'var(--color-gmail-glow)' :
                      'var(--color-geelark-glow)'
                    }`,
                  }
                : {};

              return (
                <button
                  key={platform.id}
                  className={`platform-chip ${isActive ? 'active' : ''}`}
                  onClick={() => togglePlatform(platform.id)}
                  style={activeStyle}
                >
                  <span className="chip-icon">{getPlatformIcon(platform.id)}</span>
                  <span>{platform.label}</span>
                </button>
              );
            })}
          </div>
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
              <span className="cart-badge mono animate-badge-bounce">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
