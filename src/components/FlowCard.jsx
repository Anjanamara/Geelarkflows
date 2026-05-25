import { useState } from 'react';
import { useCart } from '../context/CartContext';
import './FlowCard.css';

export default function FlowCard({ product }) {
  const { addToCart, lastAddedId } = useCart();
  const [showDetails, setShowDetails] = useState(false);

  const { title, price, details } = product;
  const isAdded = lastAddedId === product.id;

  return (
    <>
      <div className="flow-card">
        {/* Card Header */}
        <div className="card-header">
          <div className="card-header-main">
            <div className="platform-icon">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M13 3L4 14h7v7l9-11h-7V3z"/></svg>
            </div>
            <div className="card-title-wrap">
              <h3 className="card-title">{title}</h3>
              <span className="card-subtitle">GeeLark Flow Blueprint</span>
            </div>
          </div>
          <span className="price-tag">${price.toFixed(2)}</span>
        </div>

        {/* Code Snippet Visual */}
        <div className="code-preview-container">
          <div className="code-window">
            <div className="code-header">
              <span className="code-dot"></span>
              <span className="code-dot"></span>
              <span className="code-dot"></span>
            </div>
            <div className="code-content">{details.codePreview}</div>
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
            onClick={() => setShowDetails(true)}
          >
            View Flow Details
          </button>
          <button
            className="btn-primary"
            onClick={() => addToCart(product)}
          >
            {isAdded ? 'Added ✓' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </>
  );
}
