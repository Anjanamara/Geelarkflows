import { useState, useEffect } from 'react';
import { CartProvider } from './context/CartContext';
import { FilterProvider } from './context/FilterContext';
import Sidebar from './components/Sidebar';
import FilterHeader from './components/FilterHeader';
import ProductGrid from './components/ProductGrid';
import CartDrawer from './components/CartDrawer';
import CartButton from './components/CartButton';
import ProductModal from './components/ProductModal';
import './App.css';

export default function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, [isDarkMode]);

  return (
    <CartProvider>
      <FilterProvider>
        <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Sidebar 
            isCollapsed={isSidebarCollapsed} 
            toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
            isDarkMode={isDarkMode}
            toggleTheme={() => setIsDarkMode(!isDarkMode)}
          />
          
          <main className="main-content">
            <FilterHeader />
            <ProductGrid onViewDetails={setSelectedProduct} />
          </main>

          <CartDrawer />
          <CartButton />
          
          <ProductModal 
            product={selectedProduct} 
            onClose={() => setSelectedProduct(null)} 
          />
        </div>
      </FilterProvider>
    </CartProvider>
  );
}
