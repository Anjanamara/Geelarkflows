import { useCart } from '../context/CartContext';
import { platforms } from '../data/products';
import './FlowCard.css';

export default function FlowCard({ product, onViewDetails }) {
  const { cart, addToCartWithAnimation, openCart, lastAddedId } = useCart();
  const platform = platforms.find((item) => item.id === product.platform);
  const isInCart = cart.some((item) => item.id === product.id);
  const isJustAdded = lastAddedId === product.id;
  const { details } = product;

  const handleCartAction = (event) => {
    event.stopPropagation();
    if (isInCart) {
      openCart();
      return;
    }
    addToCartWithAnimation(product, event.currentTarget);
  };

  return (
    <article className="flow-card" style={{ '--platform-accent': platform?.color || 'var(--accent-lime-dark)' }}>
      {details.demoVideo && (
        <div className="card-video-wrap">
          <video controls preload="metadata" poster={details.demoPoster || undefined} aria-label={`${product.title} video demo`}>
            <source src={details.demoVideo} />
            Your browser does not support video playback.
          </video>
        </div>
      )}

      <div className="flow-card-body">
        <div className="card-meta-row">
          <span className="card-platform-token">{platform?.shortLabel || 'GF'}</span>
          <span className="card-platform-name">{platform?.label || product.platform}</span>
          <span className="card-category">{details.category}</span>
        </div>

        <div className="card-title-price">
          <h3>{product.title}</h3>
          <div className="flow-price"><strong>${product.price.toLocaleString('en-US')}</strong><span>USD</span></div>
        </div>

        <p className="flow-description">{details.description}</p>

        <ul className="flow-features" aria-label="Included actions">
          {details.features.slice(0, 3).map((feature) => <li key={feature}>{feature}</li>)}
        </ul>

        {details.supportedPlatforms.length > 0 && (
          <div className="supported-apps" aria-label="Supported apps">
            {details.supportedPlatforms.map((name) => <span key={name}>{name}</span>)}
          </div>
        )}

        <div className="card-reuse-note"><span>↻</span><p><strong>Reusable after delivery</strong><small>Run it as many times as needed</small></p></div>
      </div>

      <div className="card-footer">
        <a href={`/flows/${product.id}/`} onClick={(event) => { event.preventDefault(); onViewDetails(product); }}>
          View scope <span aria-hidden="true">↗</span>
        </a>
        <button type="button" className={isInCart ? 'in-cart' : ''} onClick={handleCartAction}>
          {isJustAdded ? 'Added ✓' : isInCart ? 'View cart' : 'Add to cart'}
        </button>
      </div>
    </article>
  );
}
