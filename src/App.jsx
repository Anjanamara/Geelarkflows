import { CartProvider } from './context/CartContext';
import { FilterProvider } from './context/FilterContext';
import Sidebar from './components/Sidebar';
import FilterHeader from './components/FilterHeader';
import ProductGrid from './components/ProductGrid';
import CartDrawer from './components/CartDrawer';
import CartButton from './components/CartButton';
import './App.css';

export default function App() {
  return (
    <CartProvider>
      <FilterProvider>
        <div className="app-container">
          <Sidebar />
          
          <main className="main-content">
            <FilterHeader />
            
            {/* Cyber Industrial Hero/Welcome Section */}
            <section className="marketplace-hero">
              <div className="hero-grid-bg" />
              <div className="hero-content">
                <div className="hero-tag mono">
                  <span className="pulse-dot green animate-pulse-glow" />
                  DATABASE_ONLINE // SECURE_MARKETPLACE
                </div>
                <h1 className="hero-title">
                  Digital Automation <span className="text-gradient">&amp;</span> Social Assets
                </h1>
                <p className="hero-description">
                  Acquire premium virtual cloud phone automation flow blueprints and high-quality aged communication nodes. Leased and authenticated cryptographically.
                </p>
                <div className="hero-stats-row">
                  <div className="hero-stat-box">
                    <span className="val mono text-gradient">20+</span>
                    <span className="lbl">Active Systems</span>
                  </div>
                  <div className="hero-stat-box">
                    <span className="val mono text-gradient">99.8%</span>
                    <span className="lbl">SLA Success</span>
                  </div>
                  <div className="hero-stat-box">
                    <span className="val mono text-gradient">&lt; 1s</span>
                    <span className="lbl">Digital Delivery</span>
                  </div>
                </div>
              </div>
            </section>

            <ProductGrid />
          </main>

          <CartDrawer />
          <CartButton />
        </div>
      </FilterProvider>
    </CartProvider>
  );
}
