import { useCart } from '../context/CartContext';
import { platforms } from '../data/products';
import './FlowCard.css';

export default function FlowCard({ product, onViewDetails }) {
  const { addToCart, lastAddedId } = useCart();
  const platform = platforms.find((item) => item.id === product.platform);
  const isAdded = lastAddedId === product.id;
  const { details } = product;

  return (
    <article
      className="flow-card"
      onClick={() => onViewDetails(product)}
      style={{ '--platform-accent': platform?.color || 'var(--accent-lime)' }}
    >
      <div className="card-visual">
        <div className="card-visual-grid" />
        <div className="card-platform-pill">
          <span>{platform?.shortLabel || 'GF'}</span>
          {platform?.label || product.platform}
        </div>
        <div className="card-flow-diagram" aria-hidden="true">
          <i className="diagram-node">IN</i><b />
          <i className="diagram-node active">RUN</i><b />
          <i className="diagram-node">OK</i>
        </div>
        <div className="reusable-badge"><i /> Reusable workflow</div>
      </div>

      {details.demoVideo && (
        <div className="card-video-wrap" onClick={(event) => event.stopPropagation()}>
          <video
            controls
            preload="metadata"
            poster={details.demoPoster || undefined}
            aria-label={`${product.title} video demo`}
          >
            <source src={details.demoVideo} />
            Your browser does not support video playback.
          </video>
        </div>
      )}

      <div className="flow-card-body">
        <div className="card-category">{details.category}</div>
        <div className="card-title-price">
          <h3>{product.title}</h3>
          <div className="flow-price">
            <strong>${product.price.toLocaleString('en-US')}</strong>
            <span>USD</span>
          </div>
        </div>
        <p className="flow-description">{details.description}</p>

        <div className="included-block">
          <span>Included in this workflow</span>
          <ul className="flow-features">
            {details.features.map((feature) => <li key={feature}>{feature}</li>)}
          </ul>
        </div>

        {details.supportedPlatforms.length > 0 && (
          <div className="supported-apps">
            {details.supportedPlatforms.map((name) => <span key={name}>{name}</span>)}
          </div>
        )}

        <div className="unlimited-runs">
          <strong>Unlimited runs</strong>
          <span>{details.usageNote}</span>
        </div>
      </div>

      <div className="card-footer">
        <a
          className="btn-secondary"
          href={`/flows/${product.id}/`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onViewDetails(product);
          }}
        >
          Full details
        </a>
        <button
          type="button"
          className="btn-primary"
          onClick={(event) => {
            event.stopPropagation();
            addToCart(product);
          }}
        >
          {isAdded ? 'Added ✓' : 'Get this flow'}
        </button>
      </div>
    </article>
  );
}
