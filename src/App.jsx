import { useState, useEffect } from 'react';
import { CartProvider } from './context/CartContext';
import { FilterProvider } from './context/FilterContext';
import Sidebar from './components/Sidebar';
import FilterHeader from './components/FilterHeader';
import ProductGrid from './components/ProductGrid';
import CartDrawer from './components/CartDrawer';
import CartButton from './components/CartButton';
import ProductModal from './components/ProductModal';
import CustomRequestModal from './components/CustomRequestModal';
import './App.css';

export default function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isCustomRequestModalOpen, setIsCustomRequestModalOpen] = useState(false);
  const [customRequestType, setCustomRequestType] = useState('flow'); // 'flow' or 'consulting'

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
            onOpenCustomRequest={(type) => {
              setCustomRequestType(type);
              setIsCustomRequestModalOpen(true);
            }}
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

          <CustomRequestModal
            isOpen={isCustomRequestModalOpen}
            onClose={() => setIsCustomRequestModalOpen(false)}
            requestType={customRequestType}
          />
        </div>
      </FilterProvider>
    </CartProvider>
  );
}
