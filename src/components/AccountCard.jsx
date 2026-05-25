import { useCart } from '../context/CartContext';
import './AccountCard.css';

export default function AccountCard({ product }) {
  const { addToCart, lastAddedId } = useCart();
  const { title, price, details, platform } = product;
  const isAdded = lastAddedId === product.id;

  const getPlatformIcon = () => {
    switch(platform) {
      case 'instagram': return <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M7.75 2h8.5A5.75 5.75 0 0122 7.75v8.5A5.75 5.75 0 0116.25 22h-8.5A5.75 5.75 0 012 16.25v-8.5A5.75 5.75 0 017.75 2zm0 1.5A4.25 4.25 0 003.5 7.75v8.5A4.25 4.25 0 007.75 20.5h8.5a4.25 4.25 0 004.25-4.25v-8.5A4.25 4.25 0 0016.25 3.5h-8.5zM12 7.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9zm0 1.5a3 3 0 100 6 3 3 0 000-6zm4.75-2a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5z"/></svg>;
      case 'tiktok': return <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.12-3.44-3.17-3.61-5.66-.21-3.32 1.99-6.38 5.17-7.23 1.15-.31 2.37-.36 3.54-.15.02 1.34.01 2.68.01 4.02-.75-.24-1.57-.34-2.35-.15-.81.18-1.55.7-2.01 1.39-.77 1.16-.76 2.82.02 3.97 1.16 1.73 3.84 1.92 5.25.32 1.05-1.17 1.05-2.92 1.04-4.47-.02-5.1-.03-10.2-.04-15.3z"/></svg>;
      case 'gmail': return <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M2.5 4h19c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5h-19C1.7 20 1 19.3 1 18.5v-13C1 4.7 1.7 4 2.5 4zm0 1.5v.7l9.5 6 9.5-6v-.7h-19zm19 1.8l-9.5 6-9.5-6v10.7h19V7.3z"/></svg>;
      default: return null;
    }
  };

  return (
    <div className={`account-card platform-${platform}`}>
      {/* Card Header */}
      <div className="card-header">
        <div className={`platform-icon ${platform}`}>
          {getPlatformIcon()}
        </div>
        <span className="price-tag">${price.toFixed(2)}</span>
      </div>

      <div style={{ padding: '0 16px 12px 16px' }}>
        <h3 className="card-title">{title}</h3>
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
      <div className="card-footer">
        <button
          className="btn-primary"
          onClick={() => addToCart(product)}
        >
          {isAdded ? 'Added to Cart ✓' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
