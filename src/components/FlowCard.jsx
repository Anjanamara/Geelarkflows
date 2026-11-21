import { platforms } from '../data/products';
import './FlowCard.css';

// One flow as a single quiet row: what it is, what it costs, one way forward.
export default function FlowCard({ product, onViewDetails }) {
  const platform = platforms.find((item) => item.id === product.platform);
  const { details } = product;
  const open = (event) => {
    event.preventDefault();
    onViewDetails(product);
  };

  return (
    <article className="flow-card">
      <div className="flow-card-body">
        <p className="card-meta-row">
          <span className="card-platform-name">{platform?.label || product.platform}</span>
          <span aria-hidden="true">·</span>
          <span className="card-category">{details.category}</span>
        </p>
        <h3>
          <a href={`/flows/${product.id}/`} onClick={open}>{product.title}</a>
        </h3>
        <p className="flow-description">{details.description}</p>
      </div>

      <div className="card-footer">
        <div className="flow-price"><strong>${product.price.toLocaleString('en-US')}</strong><span>USD · one-time</span></div>
        <span className="flow-row-action" aria-hidden="true">View details <i>→</i></span>
      </div>
    </article>
  );
}
