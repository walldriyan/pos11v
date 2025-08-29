// Optimized product list with virtualization
'use client';

import React, { memo, useMemo, useCallback } from 'react';
import { useVirtualization } from '@/hooks/useVirtualization';
import { useBatchSelector } from '@/hooks/useOptimizedSelector';
import { selectAllProducts, selectSaleItems } from '@/store/slices/saleSlice';
import type { RootState } from '@/store/store';
import type { Product } from '@/types/product';

interface OptimizedProductListProps {
  onProductSelect: (product: Product) => void;
  searchTerm?: string;
  containerHeight: number;
}

// Memoized product item component
const ProductItem = memo(({ 
  product, 
  onSelect, 
  isInCart 
}: { 
  product: Product; 
  onSelect: (product: Product) => void;
  isInCart: boolean;
}) => {
  const handleClick = useCallback(() => {
    onSelect(product);
  }, [product, onSelect]);

  return (
    <div 
      className={`p-3 border rounded cursor-pointer transition-colors ${
        isInCart ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
      }`}
      onClick={handleClick}
    >
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-medium text-sm">{product.name}</h3>
          <p className="text-xs text-gray-500">{product.code}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">${product.sellingPrice}</p>
          <p className="text-xs text-gray-500">Stock: {product.stock}</p>
        </div>
      </div>
    </div>
  );
});

ProductItem.displayName = 'ProductItem';

export const OptimizedProductList = memo(({ 
  onProductSelect, 
  searchTerm = '',
  containerHeight 
}: OptimizedProductListProps) => {
  // Use batch selector to reduce re-renders
  const { allProducts, saleItems } = useBatchSelector({
    allProducts: selectAllProducts,
    saleItems: selectSaleItems
  });

  // Memoize filtered products
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return allProducts;
    
    const term = searchTerm.toLowerCase();
    return allProducts.filter(product => 
      product.name.toLowerCase().includes(term) ||
      product.code.toLowerCase().includes(term) ||
      product.barcode?.toLowerCase().includes(term)
    );
  }, [allProducts, searchTerm]);

  // Memoize products in cart for quick lookup
  const productsInCart = useMemo(() => {
    return new Set(saleItems.map(item => item.productId));
  }, [saleItems]);

  // Virtual scrolling for large lists
  const {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll
  } = useVirtualization(filteredProducts, {
    itemHeight: 80,
    containerHeight,
    overscan: 5
  });

  const handleProductSelect = useCallback((product: Product) => {
    onProductSelect(product);
  }, [onProductSelect]);

  if (filteredProducts.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        {searchTerm ? 'No products found' : 'No products available'}
      </div>
    );
  }

  return (
    <div 
      className="overflow-auto"
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div 
          style={{ 
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((product, index) => (
            <div key={product.id} style={{ height: 80 }}>
              <ProductItem
                product={product}
                onSelect={handleProductSelect}
                isInCart={productsInCart.has(product.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

OptimizedProductList.displayName = 'OptimizedProductList';