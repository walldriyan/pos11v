
import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import type { Product, SaleItem, DiscountSet, SpecificDiscountRuleConfig, AppliedRuleInfo, ProductDiscountConfiguration, UnitDefinition, ProductBatch } from '@/types';
import { calculateDiscountsForItems } from '@/lib/discountUtils';

interface SaleState {
  allProducts: Product[];
  saleItems: SaleItem[];
  discountSets: DiscountSet[];
  activeDiscountSetId: string | null;
  taxRate: number;
  discountSetsLoaded: boolean;
}
const initialState: SaleState = {
  allProducts: [],
  saleItems: [],
  discountSets: [],
  activeDiscountSetId: null,
  taxRate: 0.00,
  discountSetsLoaded: false,
};

let saleItemIdCounter = 0;

export const saleSlice = createSlice({
  name: 'sale',
  initialState,
  reducers: {
    initializeAllProducts: (state, action: PayloadAction<Product[]>) => {
      state.allProducts = action.payload;
    },
    initializeDiscountSets: (state, action: PayloadAction<DiscountSet[]>) => {
      state.discountSets = action.payload;
      state.discountSetsLoaded = true;
      const defaultSet = action.payload.find(ds => ds.isDefault && ds.isActive);
      if (defaultSet && state.activeDiscountSetId === null) {
        state.activeDiscountSetId = defaultSet.id;
      }
    },
    initializeTaxRate: (state, action: PayloadAction<number>) => {
      state.taxRate = action.payload;
    },

    _internalAddDiscountSet: (state, action: PayloadAction<DiscountSet>) => {
      state.discountSets.push(action.payload);
       if (action.payload.isDefault && action.payload.isActive) {
        state.discountSets.forEach(ds => {
          if (ds.id !== action.payload.id) ds.isDefault = false;
        });
        state.activeDiscountSetId = action.payload.id;
      }
    },
    _internalUpdateDiscountSet: (state, action: PayloadAction<DiscountSet>) => {
      const updatedSet = action.payload;
      state.discountSets = state.discountSets.map(set => set.id === updatedSet.id ? updatedSet : set);
      if (updatedSet.isDefault && updatedSet.isActive) {
         state.discountSets.forEach(ds => {
          if (ds.id !== updatedSet.id) ds.isDefault = false;
        });
        state.activeDiscountSetId = updatedSet.id;
      } else if (updatedSet.isDefault && !updatedSet.isActive && state.activeDiscountSetId === updatedSet.id) {
        const newDefaultActive = state.discountSets.find(ds => ds.isDefault && ds.isActive);
        state.activeDiscountSetId = newDefaultActive ? newDefaultActive.id : null;
      } else if (!updatedSet.isActive && state.activeDiscountSetId === updatedSet.id) {
         const newDefaultActive = state.discountSets.find(ds => ds.isDefault && ds.isActive);
        state.activeDiscountSetId = newDefaultActive ? newDefaultActive.id : null;
      }
    },
    _internalDeleteDiscountSet: (state, action: PayloadAction<{ id: string }>) => {
      const { id } = action.payload;
      state.discountSets = state.discountSets.filter(set => set.id !== id);
      if (state.activeDiscountSetId === id) {
         const newDefaultActive = state.discountSets.find(ds => ds.isDefault && ds.isActive);
        state.activeDiscountSetId = newDefaultActive ? newDefaultActive.id : null;
      }
    },
    _internalSetTaxRate: (state, action: PayloadAction<number>) => {
      state.taxRate = action.payload;
    },

    addProductToSale: (state, action: PayloadAction<{product: Product, batch?: ProductBatch}>) => {
      const { product: productToAdd, batch: selectedBatch } = action.payload;
      const dbProduct = state.allProducts.find(p => p.id === productToAdd.id);

      if (!dbProduct || !dbProduct.isActive) return;

      const stockLimit = selectedBatch ? selectedBatch.quantity : dbProduct.stock;
      if (!dbProduct.isService && stockLimit <= 0) return;

      const existingItemIndex = state.saleItems.findIndex(item => 
        item.id === productToAdd.id && item.selectedBatchId === selectedBatch?.id
      );

      if (existingItemIndex !== -1) {
         const existingItem = state.saleItems[existingItemIndex];
         if (dbProduct.isService || existingItem.quantity < stockLimit) {
            existingItem.quantity += (dbProduct.defaultQuantity || 1);
          }
      } else {
         if (dbProduct.isService || stockLimit > 0) {
           saleItemIdCounter += 1;
           state.saleItems.push({
             ...dbProduct,
             saleItemId: `sale-item-${Date.now()}-${saleItemIdCounter}`,
             price: selectedBatch?.sellingPrice ?? dbProduct.sellingPrice,
             quantity: dbProduct.defaultQuantity || 1,
             selectedBatchId: selectedBatch?.id,
             selectedBatchNumber: selectedBatch?.batchNumber
            });
         }
      }
    },
    updateItemQuantity: (state, action: PayloadAction<{ saleItemId: string; newQuantity: number }>) => {
      const { saleItemId, newQuantity } = action.payload;
      const itemIndex = state.saleItems.findIndex(item => item.saleItemId === saleItemId);

      if (itemIndex !== -1) {
        const item = state.saleItems[itemIndex];
        const dbProduct = state.allProducts.find(p => p.id === item.id);
        if(!dbProduct) return;
        
        const batchInStore = item.selectedBatchId ? dbProduct.batches?.find(b => b.id === item.selectedBatchId) : null;
        const stockLimit = batchInStore ? batchInStore.quantity : dbProduct.stock;

        if (newQuantity <= 0) {
          state.saleItems.splice(itemIndex, 1);
        } else if (!item.isService && newQuantity > stockLimit) {
          state.saleItems[itemIndex].quantity = stockLimit;
        } else {
          state.saleItems[itemIndex].quantity = newQuantity;
        }
      }
    },
    removeItemFromSale: (state, action: PayloadAction<{ saleItemId: string }>) => {
      const { saleItemId } = action.payload;
      state.saleItems = state.saleItems.filter(item => item.saleItemId !== saleItemId);
    },
    clearSale: (state) => {
      state.saleItems = [];
      const defaultSet = state.discountSets.find(ds => ds.isDefault && ds.isActive);
      state.activeDiscountSetId = defaultSet ? defaultSet.id : null;
    },

    _internalUpdateMultipleProductStock: (state, action: PayloadAction<{ productId: string; newStock: number }[]>) => {
      action.payload.forEach(({ productId, newStock }) => {
        const productIndex = state.allProducts.findIndex(p => p.id === productId);
        if (productIndex !== -1 && !state.allProducts[productIndex].isService) {
          state.allProducts[productIndex].stock = Math.max(0, newStock);
        }
        const saleItemIndex = state.saleItems.findIndex(item => item.id === productId);
        if (saleItemIndex !== -1 && !state.saleItems[saleItemIndex].isService) {
          state.saleItems[saleItemIndex].stock = Math.max(0, newStock);
           if (state.saleItems[saleItemIndex].quantity > newStock) {
               state.saleItems[saleItemIndex].quantity = Math.max(0, newStock);
           }
        }
      });
    },
    _internalAddNewProduct: (state, action: PayloadAction<Product>) => {
      state.allProducts.push(action.payload);
      state.allProducts.sort((a, b) => a.name.localeCompare(b.name));
    },
    _internalUpdateProduct: (state, action: PayloadAction<Product>) => {
      const updatedProduct = action.payload;
      state.allProducts = state.allProducts.map(p =>
        p.id === updatedProduct.id ? updatedProduct : p
      ).sort((a, b) => a.name.localeCompare(b.name));

      state.saleItems = state.saleItems.map(item => {
        if (item.id === updatedProduct.id) {
          return {
            ...item,
            ...updatedProduct,
            price: updatedProduct.sellingPrice,
            quantity: updatedProduct.isService ? item.quantity : Math.min(item.quantity, updatedProduct.stock),
          };
        }
        return item;
      }).filter(item => item.isService || item.quantity > 0);
    },
    _internalDeleteProduct: (state, action: PayloadAction<{id: string}>) => {
      const productId = action.payload.id;
      state.allProducts = state.allProducts.filter(product => product.id !== productId);
      state.saleItems = state.saleItems.filter(item => item.id !== productId);
    },
    setActiveDiscountSetId: (state, action: PayloadAction<string | null>) => {
      if (action.payload === null || action.payload === "none") {
        state.activeDiscountSetId = null;
      } else {
        const selectedSet = state.discountSets.find(ds => ds.id === action.payload);
        if (selectedSet && selectedSet.isActive) {
          state.activeDiscountSetId = action.payload;
        } else if (selectedSet && !selectedSet.isActive) {
           state.activeDiscountSetId = null;
        }
      }
    },
    applyCustomDiscount: (state, action: PayloadAction<{ saleItemId: string; type: 'percentage' | 'fixed'; value: number }>) => {
      const { saleItemId, type, value } = action.payload;
      const itemIndex = state.saleItems.findIndex(item => item.saleItemId === saleItemId);
      if (itemIndex !== -1) {
        state.saleItems[itemIndex].customDiscountType = type;
        state.saleItems[itemIndex].customDiscountValue = value;
      }
    },
    removeCustomDiscount: (state, action: PayloadAction<{ saleItemId: string }>) => {
      const { saleItemId } = action.payload;
      const itemIndex = state.saleItems.findIndex(item => item.saleItemId === saleItemId);
      if (itemIndex !== -1) {
        state.saleItems[itemIndex].customDiscountType = null;
        state.saleItems[itemIndex].customDiscountValue = null;
      }
    },
  },
});

export const {
  initializeAllProducts, initializeDiscountSets, initializeTaxRate,
  _internalAddDiscountSet, _internalUpdateDiscountSet, _internalDeleteDiscountSet, _internalSetTaxRate,
  addProductToSale, updateItemQuantity, removeItemFromSale, clearSale,
  _internalUpdateMultipleProductStock, _internalAddNewProduct, _internalUpdateProduct, _internalDeleteProduct,
  setActiveDiscountSetId, applyCustomDiscount, removeCustomDiscount,
} = saleSlice.actions;

export const selectAllProducts = (state: RootState) => state.sale.allProducts;
export const selectSaleItems = (state: RootState) => state.sale.saleItems;
export const selectDiscountSets = (state: RootState) => state.sale.discountSets;
export const selectDiscountSetsLoaded = (state: RootState) => state.sale.discountSetsLoaded;
export const selectActiveDiscountSetId = (state: RootState) => state.sale.activeDiscountSetId;
export const selectTaxRate = (state: RootState) => state.sale.taxRate;

export const selectActiveDiscountSet = createSelector(
  [selectDiscountSets, selectActiveDiscountSetId],
  (discountSets, activeDiscountSetId) => {
    if (!activeDiscountSetId) return null;
    const set = discountSets.find(set => set.id === activeDiscountSetId);
    return (set && set.isActive) ? set : null;
  }
);

export const selectCalculatedDiscounts = createSelector(
  [selectSaleItems, selectActiveDiscountSet, selectAllProducts],
  (saleItems, activeCampaign, allProducts) => {
    return calculateDiscountsForItems({ saleItems, activeCampaign, allProducts });
  }
);

export const selectSaleSubtotalOriginal = createSelector(
    [selectSaleItems],
    (saleItems) => {
        return saleItems.reduce((sum, saleItem) => {
            const itemPrice = saleItem.price || 0;
            return sum + itemPrice * saleItem.quantity;
        }, 0);
    }
);

export const selectAppliedDiscountSummary = createSelector(
  [selectCalculatedDiscounts, selectSaleItems],
  (calculatedDiscounts, saleItems): AppliedRuleInfo[] => {
    if (saleItems.length === 0 || !calculatedDiscounts) return [];
    return calculatedDiscounts.fullAppliedDiscountSummary;
  }
);

export const selectCalculatedTax = createSelector(
    [selectSaleItems, selectSaleSubtotalOriginal, selectCalculatedDiscounts, selectTaxRate, selectAllProducts],
    (saleItems, subtotalOriginal, calculatedDiscounts, globalTaxRate, allProducts) => {
        let totalTax = 0;
        if (!calculatedDiscounts || saleItems.length === 0) return 0;

        saleItems.forEach(item => {
            const productDetails = allProducts.find(p => p.id === item.id);
            if (!productDetails) return;

            const itemOriginalPrice = item.price;
            const itemOriginalLineValue = itemOriginalPrice * item.quantity;

            let itemLevelDiscountForLine = calculatedDiscounts.itemDiscounts.get(item.id)?.totalCalculatedDiscountForLine || 0;
            const netValueAfterItemDiscount = itemOriginalLineValue - itemLevelDiscountForLine;

            const subtotalNetOfItemDiscountsOnly = subtotalOriginal - calculatedDiscounts.totalItemDiscountAmount;
            let itemProportionalCartDiscount = 0;
            if (subtotalNetOfItemDiscountsOnly > 0 && calculatedDiscounts.totalCartDiscountAmount > 0) {
                 itemProportionalCartDiscount = (netValueAfterItemDiscount / subtotalNetOfItemDiscountsOnly) * calculatedDiscounts.totalCartDiscountAmount;
            }

            const itemNetValueBeforeTax = netValueAfterItemDiscount - itemProportionalCartDiscount;
            
            const productTaxRateDecimal = (productDetails.productSpecificTaxRate ?? globalTaxRate * 100) / 100;
            totalTax += Math.max(0, itemNetValueBeforeTax) * productTaxRateDecimal;
        });

        return Math.max(0, totalTax);
    }
);


export const selectSaleTotal = createSelector(
  [selectSaleSubtotalOriginal, selectCalculatedDiscounts, selectCalculatedTax],
  (subtotalOriginal, calculatedDiscounts, tax) => {
    if (!calculatedDiscounts) return subtotalOriginal + tax;
    const total = subtotalOriginal - calculatedDiscounts.totalItemDiscountAmount - calculatedDiscounts.totalCartDiscountAmount + tax;
    return Math.max(0, total);
  }
);

export default saleSlice.reducer;
