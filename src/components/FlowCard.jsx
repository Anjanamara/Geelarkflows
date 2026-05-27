import { useCart } from '../context/CartContext';
import './FlowCard.css';

export default function FlowCard({ product, onViewDetails }) {
  const { addToCart, lastAddedId } = useCart();

  const { title, price, details } = product;
  const isAdded = lastAddedId === product.id;

  return (
    <>
      <div className="flow-card" onClick={() => onViewDetails(product)}>
        {/* Card Cover Gradient */}
        <div className="card-cover geelark-gradient">
          <div className="platform-icon-floating">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M13 3L4 14h7v7l9-11h-7V3z"/></svg>
          </div>
        </div>

        {/* Card Header */}
        <div className="card-header">
          <div className="card-header-main">
            <div className="card-title-wrap">
              <h3 className="card-title">{title}</h3>
              <span className="card-subtitle">GeeLark Flow Blueprint</span>
            </div>
          </div>
          <span className="price-tag">${price.toFixed(2)}</span>
        </div>

        {/* Flow Pipeline Visualizer */}
        <div className="flow-pipeline-container">
          <div className="flow-pipeline">
            <div className="pipeline-node active">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            </div>
            <div className="pipeline-line"></div>
            <div className="pipeline-node active">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <div className="pipeline-line"></div>
            <div className="pipeline-node">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
          </div>
        </div>

        {/* Metric Tags */}
        <div className="card-metrics">
          <span className="metric-tag success-rate">
            ✓ {details.successRate}% Success
          </span>
          <span className="metric-tag">
            {details.nodeCount} Nodes
          </span>
          {details.features.slice(0, 2).map((feature, idx) => (
            <span key={idx} className="metric-tag">{feature}</span>
          ))}
        </div>

        {/* Buy Info & Actions */}
        <div className="card-footer">
          <button
            className="btn-secondary"
          >
            View Flow Details
          </button>
          <button
            className="btn-primary"
            onClick={(e) => { e.stopPropagation(); addToCart(product); }}
          >
            {isAdded ? 'Added ✓' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </>
  );
}
