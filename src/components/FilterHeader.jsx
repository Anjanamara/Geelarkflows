import { useFilter } from '../context/FilterContext';
import { platforms } from '../data/products';
import './FilterHeader.css';

export default function FilterHeader() {
  const {
    searchQuery,
    setSearchQuery,
    selectedPlatforms,
    setSelectedPlatforms,
    togglePlatform,
    filteredProducts,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    clearFilters,
  } = useFilter();

  const hasFilters = searchQuery || selectedPlatforms.length || minPrice || maxPrice;

  return (
    <div className="filter-panel">
      <div className="filter-primary-row">
        <label className="catalog-search">
          <span>⌕</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search creation, warmup, posting, Tinder..."
            aria-label="Search automation flows"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search">×</button>
          )}
        </label>

        <div className="price-range" aria-label="Filter by price">
          <span>PRICE</span>
          <label>
            <b>$</b>
            <input
              type="number"
              min="0"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder="Min"
              aria-label="Minimum price"
            />
          </label>
          <i>—</i>
          <label>
            <b>$</b>
            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="Max"
              aria-label="Maximum price"
            />
          </label>
        </div>
      </div>

      <div className="filter-platform-row">
        <div className="platform-chips" aria-label="Filter by platform">
          <button
            type="button"
            className={`platform-chip ${selectedPlatforms.length === 0 ? 'active' : ''}`}
            onClick={() => setSelectedPlatforms([])}
          >
            All platforms
          </button>
          {platforms.map((platform) => {
            const active = selectedPlatforms.includes(platform.id);
            return (
              <button
                type="button"
                key={platform.id}
                className={`platform-chip ${active ? 'active' : ''}`}
                style={{ '--chip-accent': platform.color }}
                onClick={() => togglePlatform(platform.id)}
              >
                <i /> {platform.label}
              </button>
            );
          })}
        </div>

        <div className="filter-results">
          <strong>{String(filteredProducts.length).padStart(2, '0')}</strong>
          <span>flows</span>
          {hasFilters && <button type="button" onClick={clearFilters}>Clear</button>}
        </div>
      </div>
    </div>
  );
}
