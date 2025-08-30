// src/discount-engine/core/context.ts
import type { SaleItem, User, ProductBatch } from '@/types';

/**
 * Represents a single line in the shopping cart, enhanced for the discount engine.
 */
export interface LineItemData extends SaleItem {
  lineId: string; // A unique identifier for this line item in this specific sale (e.g., saleItemId)
  productId: string;
  batchId?: string | null;
}

/**
 * Represents the entire context of a sale, providing all necessary information
 * for discount rules to make their decisions.
 */
export interface DiscountContext {
  items: LineItemData[];
  customer?: User; // For customer-specific discounts in the future
  // Other context like date, store location, etc., can be added here.
}
