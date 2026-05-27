import { useCart } from '../context/CartContext';
import './AccountCard.css';

export default function AccountCard({ product, onViewDetails }) {
  const { addToCart, lastAddedId } = useCart();
  const { title, price, details, platform } = product;
  const isAdded = lastAddedId === product.id;

  const getPlatformIcon = () => {
    switch(platform) {
      case 'instagram': return <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7.8,2H16.2C19.4,2 22,4.6 22,7.8V16.2A5.8,5.8 0 0,1 16.2,22H7.8C4.6,22 2,19.4 2,16.2V7.8A5.8,5.8 0 0,1 7.8,2M7.6,4A3.6,3.6 0 0,0 4,7.6V16.4C4,18.39 5.61,20 7.6,20H16.4A3.6,3.6 0 0,0 20,16.4V7.6C20,5.61 18.39,4 16.4,4H7.6M17.25,5.5A1.25,1.25 0 0,1 18.5,6.75A1.25,1.25 0 0,1 17.25,8A1.25,1.25 0 0,1 16,6.75A1.25,1.25 0 0,1 17.25,5.5M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9Z"/></svg>;
      case 'tiktok': return <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.12-3.44-3.17-3.61-5.66-.21-3.32 1.99-6.38 5.17-7.23 1.15-.31 2.37-.36 3.54-.15.02 1.34.01 2.68.01 4.02-.75-.24-1.57-.34-2.35-.15-.81.18-1.55.7-2.01 1.39-.77 1.16-.76 2.82.02 3.97 1.16 1.73 3.84 1.92 5.25.32 1.05-1.17 1.05-2.92 1.04-4.47-.02-5.1-.03-10.2-.04-15.3z"/></svg>;
      case 'gmail': return <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>;
      default: return null;
    }
  };

  return (
    <div className={`account-card platform-${platform}`} onClick={() => onViewDetails(product)}>
      {/* Card Cover Gradient */}
      <div className={`card-cover ${platform}-gradient`}>
        <div className="platform-icon-floating">
          {getPlatformIcon()}
        </div>
      </div>

      {/* Card Header */}
      <div className="card-header">
        <div className="card-title-wrap">
          <h3 className="card-title">{title}</h3>
          <span className="card-subtitle">Aged Profile</span>
        </div>
        <span className="price-tag">${price.toFixed(2)}</span>
      </div>

      {/* Metrics Grid */}
      <div className="account-metrics-grid">
        <div className="metric-item">
          <span className="lbl">Creation Age</span>
          <span className="val">{details.age}</span>
        </div>
        <div className="metric-item">
          <span className="lbl">Phone Verified</span>
          <span className="val">{details.pvaStatus ? 'Yes (PVA)' : 'No'}</span>
        </div>
      </div>

      {/* Features */}
      <div className="account-features">
        {details.features.map((feature, idx) => (
          <div key={idx} className="feature-line">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            <span>{feature}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="card-footer" style={{ display: 'flex', gap: '8px', padding: '16px' }}>
        <button
          className="btn-secondary"
          style={{ flex: 1, padding: '8px 12px', fontSize: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s ease' }}
          onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-indigo)'; e.currentTarget.style.color = 'var(--accent-indigo)'; }}
          onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          View Details
        </button>
        <button
          className="btn-primary"
          onClick={(e) => { e.stopPropagation(); addToCart(product); }}
          style={{ flex: 1, padding: '8px 12px', fontSize: '14px', borderRadius: 'var(--radius-md)', background: 'var(--accent-indigo)', color: 'white', border: 'none', cursor: 'pointer', transition: 'all 0.15s ease' }}
        >
          {isAdded ? 'Added ✓' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
