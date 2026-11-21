import { useFilter } from '../context/FilterContext';
import FlowCard from './FlowCard';
import './ProductGrid.css';

export default function ProductGrid({ onViewDetails }) {
  const { filteredProducts, clearFilters } = useFilter();

  if (filteredProducts.length === 0) {
    return (
      <div className="empty-grid-container">
        <h3 className="empty-title">No flows match that search.</h3>
        <p className="empty-description">Try another platform or a different word. Or ask us to build it.</p>
        <button type="button" className="reset-filters-btn" onClick={clearFilters}>
          Clear search
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
