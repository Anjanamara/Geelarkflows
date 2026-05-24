import { useFilter } from '../context/FilterContext';
import FlowCard from './FlowCard';
import AccountCard from './AccountCard';
import './ProductGrid.css';

export default function ProductGrid() {
  const { filteredProducts, clearFilters } = useFilter();

  if (filteredProducts.length === 0) {
    return (
      <div className="empty-grid-container">
        <div className="empty-illustration">
          <div className="terminal-box">
            <div className="terminal-header">
              <span className="terminal-dot red" />
              <span className="terminal-dot yellow" />
              <span className="terminal-dot green" />
              <span className="terminal-title mono">vault_search.sh</span>
            </div>
            <div className="terminal-body mono">
              <p className="cyan">&gt; NEXUS_VAULT_QUERY --execute</p>
              <p className="yellow">Searching database sectors...</p>
              <p className="red">ERR: 0 MATCHES_FOUND_IN_VAULT</p>
              <p className="muted">All automation modules and account batches are secure. No assets matched active filters.</p>
            </div>
          </div>
        </div>
        <h3 className="empty-title">No Secure Assets Found</h3>
        <p className="empty-description">
          Adjust your sidebar filter parameters, reset active platform chips, or reset your search query to locate digital assets.
        </p>
        <button className="reset-filters-btn" onClick={clearFilters}>
          Initialize Search Module (Reset Filters)
        </button>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {filteredProducts.map((product) => {
        if (product.type === 'flow') {
          return <FlowCard key={product.id} product={product} />;
        } else {
          return <AccountCard key={product.id} product={product} />;
        }
      })}
    </div>
  );
}
