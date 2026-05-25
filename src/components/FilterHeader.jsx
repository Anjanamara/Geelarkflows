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
      case 'instagram': return '📸';
      case 'tiktok': return '🎵';
      case 'gmail': return '✉';
      case 'geelark': return '⚡';
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
                  <span className="chip-icon">{getPlatformIcon(platform.id)}</span>
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
