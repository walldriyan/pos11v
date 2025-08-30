// src/discount-engine/core/result.ts
import { DiscountContext, LineItemData } from './context';
import type { AppliedRuleInfo } from '@/types';

/**
 * Represents the discount applied to a single line item.
 */
export interface DiscountApplication {
  ruleId: string; // A unique identifier for the rule that was applied
  discountAmount: number; // The amount of discount applied by this rule
  description: string; // A description of why the discount was applied
  // Add other metadata as needed, e.g., the original rule config
  appliedRuleInfo: AppliedRuleInfo;
}

/**
 * Holds the results of discount calculations for a single line item.
 */
export class LineItemResult {
  lineId: string;
  productId: string;
  batchId?: string | null;
  originalPrice: number;
  quantity: number;
  totalDiscount: number = 0;
  appliedRules: DiscountApplication[] = [];

  constructor(lineItem: LineItemData) {
    this.lineId = lineItem.lineId;
    this.productId = lineItem.productId;
    this.batchId = lineItem.batchId;
    this.originalPrice = lineItem.price;
    this.quantity = lineItem.quantity;
  }

  addDiscount(application: DiscountApplication): void {
    const originalLineTotal = this.originalPrice * this.quantity;
    // Ensure the discount doesn't exceed the remaining value of the line item
    const applicableDiscount = Math.min(
      application.discountAmount,
      originalLineTotal - this.totalDiscount
    );

    if (applicableDiscount > 0) {
      this.totalDiscount += applicableDiscount;
      this.appliedRules.push({ ...application, discountAmount: applicableDiscount });
    }
  }

  get netPrice(): number {
    return this.originalPrice * this.quantity - this.totalDiscount;
  }
}

/**
 * Aggregates all discount results for an entire sale.
 */
export class DiscountResult {
  lineItems: LineItemResult[];
  totalItemDiscount: number = 0;
  totalCartDiscount: number = 0;
  appliedCartRules: DiscountApplication[] = [];

  constructor(context: DiscountContext) {
    this.lineItems = context.items.map((item) => new LineItemResult(item));
  }

  getLineItem(lineId: string): LineItemResult | undefined {
    return this.lineItems.find((li) => li.lineId === lineId);
  }

  addCartDiscount(application: DiscountApplication): void {
     // Ensure cart discount doesn't exceed remaining subtotal
    const subtotalAfterItemDiscounts = this.lineItems.reduce((sum, li) => sum + li.netPrice, 0);
    const applicableDiscount = Math.min(application.discountAmount, subtotalAfterItemDiscounts - this.totalCartDiscount);

    if (applicableDiscount > 0) {
      this.totalCartDiscount += applicableDiscount;
      this.appliedCartRules.push({ ...application, discountAmount: applicableDiscount });
    }
  }

  /**
   * Finalizes the totals after all rules have been applied.
   */
  finalize(): void {
    this.totalItemDiscount = this.lineItems.reduce(
      (sum, item) => sum + item.totalDiscount,
      0
    );
    // Cart discount is already calculated via addCartDiscount
  }

  /**
   * Generates a flat list of all applied rules for summary purposes.
   */
  getAppliedRulesSummary(): AppliedRuleInfo[] {
    const summary: AppliedRuleInfo[] = [];

    this.lineItems.forEach((line) => {
      line.appliedRules.forEach((app) => {
        summary.push(app.appliedRuleInfo);
      });
    });

    this.appliedCartRules.forEach((app) => {
      summary.push(app.appliedRuleInfo);
    });

    return summary;
  }
}
