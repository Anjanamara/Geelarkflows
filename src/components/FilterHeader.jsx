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
    sortBy,
    setSortBy,
    clearFilters,
  } = useFilter();

  const hasFilters = searchQuery || selectedPlatforms.length || sortBy !== 'featured';

  return (
    <div className="filter-panel">
      <div className="filter-primary-row">
        <label className="catalog-search">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by platform or task, e.g. warmup"
            aria-label="Search automation flows"
          />
        </label>

        <label className="catalog-sort">
          <span>Sort</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort flows">
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </label>
      </div>

      <div className="filter-platform-row">
        <div className="platform-chips" role="group" aria-label="Filter by platform">
          <button
            type="button"
            className={`platform-chip ${selectedPlatforms.length === 0 ? 'active' : ''}`}
            aria-pressed={selectedPlatforms.length === 0}
            onClick={() => setSelectedPlatforms([])}
          >
            All
          </button>
          {platforms.map((platform) => {
            const active = selectedPlatforms.includes(platform.id);
            return (
              <button
                type="button"
                key={platform.id}
                className={`platform-chip ${active ? 'active' : ''}`}
                aria-pressed={active}
                onClick={() => togglePlatform(platform.id)}
              >
                {platform.label}
              </button>
            );
          })}
        </div>

        <div className="filter-results" aria-live="polite">
          <span>{filteredProducts.length} {filteredProducts.length === 1 ? 'flow' : 'flows'}</span>
          {hasFilters && <button type="button" onClick={clearFilters}>Clear</button>}
        </div>
      </div>
    </div>
  );
}
