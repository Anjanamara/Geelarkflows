import { useState } from 'react';
import { useCart } from '../context/CartContext';
import './FlowCard.css';

export default function FlowCard({ product }) {
  const { addToCart, lastAddedId } = useCart();
  const [showDetails, setShowDetails] = useState(false);

  const { title, price, stock, details } = product;
  const isAdded = lastAddedId === product.id;

  return (
    <>
      <div className="flow-card">
        {/* Card Header */}
        <div className="card-header">
          <div className="platform-tag">
            <span className="platform-tag-icon">⚡</span>
            <span className="platform-tag-text uppercase">GEELARK FLOW</span>
          </div>
          <div className="success-badge">
            <span className="pulse-dot green animate-pulse-glow" />
            <span className="success-rate-text mono">{details.successRate}% Success</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="card-title">{title}</h3>

        {/* Code Snippet Visual */}
        <div className="code-snippet-container">
          <div className="code-header">
            <div className="code-dots">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
            <span className="code-filename mono">{product.id}.json</span>
          </div>
          <pre className="code-content mono">
            <code>{details.codePreview}</code>
          </pre>
        </div>

        {/* Action Tags */}
        <div className="features-list">
          {details.features.slice(0, 3).map((feature, idx) => (
            <span key={idx} className="feature-pill">
              {feature}
            </span>
          ))}
          {details.features.length > 3 && (
            <span className="feature-pill multiplier">+{details.features.length - 3}</span>
          )}
        </div>

        {/* Buy Info & Actions */}
        <div className="card-footer">
          <div className="price-group">
            <span className="price-label">PRICE</span>
            <span className="price-value mono">${price.toFixed(2)}</span>
          </div>
          <div className="actions-group">
            <button
              className="details-trigger-btn"
              onClick={() => setShowDetails(true)}
            >
              Details
            </button>
            <button
              className={`add-to-cart-btn ${isAdded ? 'success-bounce' : ''}`}
              onClick={() => addToCart(product)}
            >
              {isAdded ? 'Added! ✓' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal Overlay */}
      {showDetails && (
        <div className="modal-backdrop" onClick={() => setShowDetails(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowDetails(false)}>
              ✕
            </button>

            <div className="modal-header">
              <div className="platform-tag">
                <span className="platform-tag-icon">⚡</span>
                <span className="platform-tag-text uppercase">GEELARK FLOW TEMPLATE</span>
              </div>
              <div className="success-badge">
                <span className="pulse-dot green animate-pulse-glow" />
                <span className="success-rate-text mono">{details.successRate}% Success Rate</span>
              </div>
            </div>

            <h2 className="modal-title">{title}</h2>
            <p className="modal-description">{details.description}</p>

            <div className="modal-grid">
              <div className="modal-specs">
                <h4 className="specs-title">Flow Blueprint Specs</h4>
                <div className="spec-table">
                  <div className="spec-row">
                    <span className="spec-key">Asset ID</span>
                    <span className="spec-val mono">{product.id}</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-key">Integration Type</span>
                    <span className="spec-val uppercase font-semibold">{details.flowType}</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-key">Total Logic Nodes</span>
                    <span className="spec-val mono">{details.nodeCount} steps</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-key">System Stock</span>
                    <span className="spec-val mono">{stock > 0 ? `${stock} available` : 'Sold out'}</span>
                  </div>
                </div>

                <h4 className="specs-title secondary">Flow Features</h4>
                <ul className="modal-features-list">
                  {details.features.map((feature, idx) => (
                    <li key={idx} className="modal-feature-item">
                      <span className="check-icon">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="modal-code-view">
                <div className="code-view-header">
                  <span className="mono">flow_definition.json</span>
                </div>
                <pre className="modal-pre mono">
                  <code>{`{
  "id": "${product.id}",
  "title": "${title}",
  "type": "rpa_flow",
  "category": "${details.flowType}",
  "successRate": ${details.successRate},
  "nodesCount": ${details.nodeCount},
  "dependencies": ["GeeLark Virtual Android", "Residential Proxy"],
  "triggers": {
    "cron": "*/15 * * * *",
    "webhook": true
  },
  "features": ${JSON.stringify(details.features, null, 2)}
}`}</code>
                </pre>
              </div>
            </div>

            <div className="modal-footer">
              <div className="modal-price-group">
                <span className="modal-price-label">TOTAL AMOUNT</span>
                <span className="modal-price-value mono">${price.toFixed(2)}</span>
              </div>
              <button
                className="modal-buy-btn"
                onClick={() => {
                  addToCart(product);
                  setShowDetails(false);
                }}
              >
                Purchase & Import to GeeLark
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
