import { useFilter } from '../context/FilterContext';
import FlowCard from './FlowCard';
import './ProductGrid.css';

export default function ProductGrid({ onViewDetails }) {
  const { filteredProducts, clearFilters } = useFilter();

  if (filteredProducts.length === 0) {
    return (
      <div className="empty-grid-container">
        <span className="empty-code">NO_MATCH / 00</span>
        <h3 className="empty-title">No flows match those filters.</h3>
        <p className="empty-description">
          Try another platform, remove the price range, or search for a different operation.
        </p>
        <button className="reset-filters-btn" onClick={clearFilters}>
          Reset all filters
        </button>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {filteredProducts.map((product) => (
        <FlowCard key={product.id} product={product} onViewDetails={onViewDetails} />
      ))}
    </div>
  );
}
