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
            


            <ProductGrid />
          </main>

          <CartDrawer />
          <CartButton />
        </div>
      </FilterProvider>
    </CartProvider>
  );
}
