import { useCart } from '../context/CartContext';
import './ProductModal.css';

export default function ProductModal({ product, onClose }) {
  const { addToCart, lastAddedId } = useCart();
  
  if (!product) return null;
  
  const isAdded = lastAddedId === product.id;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>
        
        <div className="modal-header">
          <div className="modal-platform-badge">
            {product.platform === 'instagram' ? 'Instagram' : 
             product.platform === 'tiktok' ? 'TikTok' : 
             product.platform === 'gmail' ? 'Gmail' : 'GeeLark Flow'}
          </div>
          <h2 className="modal-title">{product.title}</h2>
          <div className="modal-price">${product.price.toFixed(2)}</div>
        </div>

        <div className="modal-body">
          {product.category === 'flows' ? (
            <>
              <div className="modal-section">
                <h3>Flow Description</h3>
                <p>This premium automation script is built specifically for GeeLark RPA. It includes advanced anti-detection features, randomized human-like delays, and robust error handling.</p>
              </div>
              <div className="modal-section">
                <h3>Technical Details</h3>
                <ul className="modal-feature-list">
                  <li><strong>Nodes:</strong> {product.details.nodeCount}</li>
                  <li><strong>Success Rate:</strong> {product.details.successRate}%</li>
                  {product.details.features.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
              <div className="modal-code-preview">
                <h4>Script Preview</h4>
                <div className="code-block">{product.details.codePreview}</div>
              </div>
            </>
          ) : (
            <>
              <div className="modal-section">
                <h3>Account Details</h3>
                <p>Aged, high-trust social media account warmed up using premium residential proxies. Ready for immediate automation deployment.</p>
              </div>
              <div className="modal-section">
                <h3>Metadata</h3>
                <ul className="modal-feature-list">
                  <li><strong>Account Age:</strong> {product.details.age}</li>
                  <li><strong>PVA Status:</strong> {product.details.pvaStatus ? 'Phone Verified' : 'Unverified'}</li>
                  {product.details.features.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button 
            className="btn-primary modal-buy-btn" 
            onClick={() => addToCart(product)}
          >
            {isAdded ? 'Added to Cart ✓' : 'Add to Cart — $' + product.price.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
