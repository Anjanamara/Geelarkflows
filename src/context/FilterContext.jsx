import { createContext, useContext, useState, useMemo } from 'react';
import { products } from '../data/products';

const FilterContext = createContext(null);

export function FilterProvider({ children }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [instockOnly, setInstockOnly] = useState(false);

  const togglePlatform = (platformId) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedPlatforms([]);
    setSelectedCategory('all');
    setInstockOnly(false);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // 1. Instock Filter
      if (instockOnly && product.stock <= 0) {
        return false;
      }

      // 2. Category Filter
      // Categories: 'all', 'flows', 'accounts-instagram', 'accounts-tiktok', 'accounts-gmail'
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'flows') {
          if (product.type !== 'flow') return false;
        } else if (selectedCategory.startsWith('accounts-')) {
          const targetPlatform = selectedCategory.replace('accounts-', '');
          if (product.type !== 'account' || product.platform !== targetPlatform) {
            return false;
          }
        } else if (selectedCategory === 'accounts') {
          if (product.type !== 'account') return false;
        }
      }

      // 3. Platform Multi-select Filter
      if (selectedPlatforms.length > 0) {
        if (!selectedPlatforms.includes(product.platform)) {
          return false;
        }
      }

      // 4. Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = product.title.toLowerCase().includes(query);
        const matchesType = product.type.toLowerCase().includes(query);
        const matchesPlatform = product.platform.toLowerCase().includes(query);
        
        let matchesFeatures = false;
        if (product.details && product.details.features) {
          matchesFeatures = product.details.features.some((f) =>
            f.toLowerCase().includes(query)
          );
        }

        let matchesFlowType = false;
        if (product.details && product.details.flowType) {
          matchesFlowType = product.details.flowType.toLowerCase().includes(query);
        }

        if (!matchesTitle && !matchesType && !matchesPlatform && !matchesFeatures && !matchesFlowType) {
          return false;
        }
      }

      return true;
    });
  }, [selectedCategory, selectedPlatforms, searchQuery, instockOnly]);

  const value = useMemo(
    () => ({
      searchQuery,
      setSearchQuery,
      selectedPlatforms,
      setSelectedPlatforms,
      togglePlatform,
      selectedCategory,
      setSelectedCategory,
      instockOnly,
      setInstockOnly,
      filteredProducts,
      clearFilters,
    }),
    [searchQuery, selectedPlatforms, selectedCategory, instockOnly, filteredProducts]
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
}
