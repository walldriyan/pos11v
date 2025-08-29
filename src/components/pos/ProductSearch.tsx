
'use client';

import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectAllProducts, selectSaleItems } from '@/store/slices/saleSlice';
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { Product, ProductBatch, SaleItem } from "@/types";
import { Search, Check, Package, Layers } from "lucide-react";
import { cn } from '@/lib/utils';

interface ProductSearchProps {
  onProductSelect: (product: Product, selectedBatch?: ProductBatch) => void;
  barcodeError: boolean;
}

export interface ProductSearchHandle {
  focusSearchInput: () => void;
}

interface SearchSuggestion {
  type: 'product' | 'batch';
  product: Product;
  batch?: ProductBatch;
  id: string; // Unique key for rendering
}

const ProductSearch = React.forwardRef<ProductSearchHandle, ProductSearchProps>(
  ({ onProductSelect, barcodeError }, ref) => {
    const allProductsFromStore = useSelector(selectAllProducts);
    const saleItems = useSelector(selectSaleItems);

    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const internalInputRef = useRef<HTMLInputElement>(null);
    const popoverContentRef = useRef<HTMLDivElement>(null);

    const productsWithLiveStock = useMemo(() => {
        // Create a map of quantities in the cart for quick lookup, keyed by BATCH ID.
        const saleItemsByBatch = saleItems.reduce((acc, item) => {
            const key = item.selectedBatchId;
            if (key) {
                acc.set(key, (acc.get(key) || 0) + item.quantity);
            }
            return acc;
        }, new Map<string, number>());
        
        // This is the IMMUTABLE approach. We create new product and batch objects.
        return allProductsFromStore.map(p => {
            // Create a deep copy of the product to avoid mutating the Redux state
            const productCopy: Product = { 
                ...p,
                batches: p.batches ? [...p.batches] : [], // Ensure batches array is new
            };

            if (p.batches && p.batches.length > 0) {
                // Create new batch objects with updated quantities
                productCopy.batches = p.batches.map(b => {
                    const batchInCartQty = saleItemsByBatch.get(b.id) || 0;
                    // Create a new batch object with the live quantity
                    return { ...b, quantity: b.quantity - batchInCartQty };
                });
                
                // Recalculate the product's total stock based on the new batch quantities
                productCopy.stock = productCopy.batches.reduce((sum, b) => sum + b.quantity, 0);
            } else {
                 // If no batches, just reduce the main stock. This case is less likely with the new model but safe to handle.
                 const productInCartQty = saleItems.reduce((sum, item) => item.id === p.id ? sum + item.quantity : sum, 0);
                 productCopy.stock = p.stock - productInCartQty;
            }

            return productCopy;
        });
    }, [allProductsFromStore, saleItems]);


    useImperativeHandle(ref, () => ({
      focusSearchInput: () => {
        if (document.activeElement !== internalInputRef.current) {
          internalInputRef.current?.focus();
        }
      }
    }));

    useEffect(() => {
      if (searchTerm.trim() === '') {
        setSuggestions([]);
        setActiveIndex(-1);
        return;
      }

      const lowerSearchTerm = searchTerm.toLowerCase();
      const filteredSuggestions: SearchSuggestion[] = [];

      productsWithLiveStock.forEach(product => {
        const hasBatchesWithStock = product.batches && product.batches.some(b => b.quantity > 0);
        
        const productMatches = product.name.toLowerCase().includes(lowerSearchTerm) ||
                               (product.category && product.category.toLowerCase().includes(lowerSearchTerm)) ||
                               (product.code && product.code.toLowerCase().includes(lowerSearchTerm));

        if (productMatches) {
            if (product.isService) {
                 filteredSuggestions.push({ type: 'product', product, id: product.id });
            } else if (hasBatchesWithStock) {
                // Add individual batches with stock and their own selling price
                product.batches?.forEach(batch => {
                    if (batch.quantity > 0) {
                        filteredSuggestions.push({ type: 'batch', product, batch, id: batch.id });
                    }
                });
            }
        }
      });

      setSuggestions(filteredSuggestions);
      setIsSuggestionsOpen(filteredSuggestions.length > 0);
      setActiveIndex(-1);
    }, [searchTerm, productsWithLiveStock]);

    const handleSelect = useCallback((suggestion: SearchSuggestion) => {
       const originalProductFromStore = allProductsFromStore.find(p => p.id === suggestion.product.id);
       if (!originalProductFromStore) return;

       if (suggestion.type === 'product') {
           onProductSelect(originalProductFromStore);
       } else if (suggestion.type === 'batch' && suggestion.batch) {
           const originalBatchFromStore = originalProductFromStore.batches?.find(b => b.id === suggestion.batch!.id);
           if (originalBatchFromStore) {
               onProductSelect(originalProductFromStore, originalBatchFromStore);
           }
       }
      setSearchTerm('');
      setSuggestions([]);
      setIsSuggestionsOpen(false);
      setActiveIndex(-1);
      internalInputRef.current?.focus();
    }, [onProductSelect, allProductsFromStore]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setIsSuggestionsOpen(false);
        setActiveIndex(-1);
        return;
      }
      if (isSuggestionsOpen && suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const newIndex = (activeIndex + 1) % suggestions.length;
          setActiveIndex(newIndex);
          scrollToSuggestion(newIndex);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const newIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
          setActiveIndex(newIndex);
          scrollToSuggestion(newIndex);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < suggestions.length) {
            handleSelect(suggestions[activeIndex]);
          } else if (suggestions.length > 0) {
            handleSelect(suggestions[0]);
          }
        }
      } else if (e.key === 'Enter' && searchTerm.trim() !== '' && suggestions.length > 0) {
        e.preventDefault();
        handleSelect(suggestions[0]);
      } else if (e.key === 'Enter' && searchTerm.trim() !== '' && suggestions.length === 0) {
        setIsSuggestionsOpen(false);
      }
    };

    const scrollToSuggestion = (index: number) => {
      if (popoverContentRef.current) {
        const suggestionElement = popoverContentRef.current.children[0]?.children[index] as HTMLElement;
        if (suggestionElement) {
          suggestionElement.scrollIntoView({ block: 'nearest' });
        }
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
    };

    const handleFocus = () => {
      if (searchTerm.trim() !== '' && suggestions.length > 0) {
        setIsSuggestionsOpen(true);
      }
    };
    
    const handleBlur = () => {
        setTimeout(() => {
            if (!popoverContentRef.current?.contains(document.activeElement)) {
                 setIsSuggestionsOpen(false);
            }
        }, 150);
    };

    return (
      <Popover open={isSuggestionsOpen} onOpenChange={setIsSuggestionsOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              ref={internalInputRef} type="text" placeholder="Search products by name, code, or category..."
              className={cn(
                "pl-10 w-full bg-background border-border focus:ring-primary",
                barcodeError && "border-destructive ring-destructive ring-1 focus:ring-destructive"
              )}
              value={searchTerm} onChange={handleInputChange} onKeyDown={handleKeyDown}
              onFocus={handleFocus} onBlur={handleBlur} aria-label="Search products" autoComplete="off"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          ref={popoverContentRef}
          className="w-[--radix-popover-trigger-width] p-0 max-h-80 overflow-y-auto shadow-lg rounded-md mt-1"
          align="start" onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {suggestions.length > 0 && (
            <div className="py-1" role="listbox" aria-activedescendant={activeIndex > -1 ? `suggestion-${activeIndex}` : undefined}>
              {suggestions.map((suggestion, index) => {
                const isBatch = suggestion.type === 'batch';
                const sellingPrice = isBatch ? suggestion.batch!.sellingPrice : suggestion.product.sellingPrice;
                const stock = suggestion.product.isService ? 'N/A' : (isBatch ? suggestion.batch!.quantity : suggestion.product.stock);

                return (
                <Button
                  key={suggestion.id} id={`suggestion-${index}`} role="option" aria-selected={index === activeIndex}
                  variant="ghost"
                  className={cn(
                    'w-full justify-start h-auto py-2 px-3 text-left rounded-md',
                    isBatch ? 'font-normal' : 'font-semibold bg-muted/30',
                    index === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                  )}
                  onClick={() => handleSelect(suggestion)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <div className="flex items-center w-full">
                     {isBatch ? <Layers className="h-4 w-4 mr-2 text-primary flex-shrink-0" /> : <Package className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />}
                     <div className="flex flex-col w-full">
                        <span className="text-sm">
                          {suggestion.product.name} 
                          {isBatch && <span className="text-xs text-muted-foreground"> (Batch: {suggestion.batch?.batchNumber || '...'})</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            Sell Price: <span className="font-semibold text-green-400">Rs. {sellingPrice.toFixed(2)}</span> |
                            Stock: <span className="font-semibold text-foreground">{stock}</span>
                        </span>
                     </div>
                  </div>
                  {index === activeIndex && <Check className="ml-auto h-4 w-4 flex-shrink-0" />}
                </Button>
              )})}
            </div>
          )}
          {searchTerm.trim() !== '' && suggestions.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">No products or batches found for "{searchTerm}".</p>
          )}
        </PopoverContent>
      </Popover>
    );
  }
);

ProductSearch.displayName = "ProductSearch";
export { ProductSearch };
