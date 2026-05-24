import { useCart } from '../context/CartContext';
import './AccountCard.css';

export default function AccountCard({ product }) {
  const { addToCart, lastAddedId } = useCart();

  const { title, platform, price, stock, details } = product;
  const isAdded = lastAddedId === product.id;

  const getPlatformLabel = () => {
    switch (platform) {
      case 'instagram':
        return 'Instagram';
      case 'tiktok':
        return 'TikTok';
      case 'gmail':
        return 'Gmail';
      default:
        return 'Aged Account';
    }
  };

  const getPlatformIcon = () => {
    switch (platform) {
      case 'instagram':
        return '📸';
      case 'tiktok':
        return '🎵';
      case 'gmail':
        return '✉';
      default:
        return '◎';
    }
  };

  const formatFollowers = (count) => {
    if (count === 0) return 'N/A';
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  return (
    <div className={`account-card platform-${platform}`}>
      {/* Header */}
      <div className="card-header">
        <div className={`platform-tag tag-${platform}`}>
          <span className="platform-tag-icon">{getPlatformIcon()}</span>
          <span className="platform-tag-text uppercase">{getPlatformLabel()}</span>
        </div>

        <div className="stock-indicator">
          <span className={`status-dot ${stock > 0 ? 'green animate-breathe' : 'red'}`} />
          <span className="stock-label mono">
            {stock > 0 ? `${stock} left` : 'Sold out'}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className="card-title">{title}</h3>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-box">
          <span className="metric-key">Creation Year</span>
          <span className="metric-val mono">{details.age}</span>
        </div>
        <div className="metric-box">
          <span className="metric-key">Phone Verified</span>
          <span className={`metric-val mono ${details.pvaStatus ? 'green' : 'muted'}`}>
            {details.pvaStatus ? 'YES' : 'NO'}
          </span>
        </div>
        <div className="metric-box">
          <span className="metric-key">Followers</span>
          <span className="metric-val mono">{formatFollowers(details.followers)}</span>
        </div>
        <div className="metric-box">
          <span className="metric-key">Cookies Included</span>
          <span className={`metric-val mono ${details.cookiesIncluded ? 'blue' : 'muted'}`}>
            {details.cookiesIncluded ? 'YES' : 'NO'}
          </span>
        </div>
      </div>

      {/* Feature Bullet Summary */}
      <div className="account-specs-summary">
        {details.features.slice(0, 2).map((feat, idx) => (
          <div key={idx} className="spec-bullet">
            <span className="bullet-dot" />
            <span className="bullet-text">{feat}</span>
          </div>
        ))}
      </div>

      {/* Footer / CTA */}
      <div className="card-footer">
        <div className="price-group">
          <span className="price-label">PRICE</span>
          <span className="price-value mono">${price.toFixed(2)}</span>
        </div>

        <button
          className={`quick-purchase-btn ${isAdded ? 'success-bounce' : ''}`}
          disabled={stock <= 0}
          onClick={() => addToCart(product)}
        >
          {isAdded ? 'Added! ✓' : 'Quick Purchase'}
        </button>
      </div>
    </div>
  );
}
