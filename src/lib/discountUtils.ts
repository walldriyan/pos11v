// src/lib/discountUtils.ts
import { DiscountEngine } from '@/discount-engine';
import {
  type Product,
  type SaleItem,
  type DiscountSet,
  type AppliedRuleInfo,
  type ProductBatch,
} from '@/types';

interface CalculateDiscountsInput {
  saleItems: SaleItem[];
  activeCampaign: DiscountSet | null;
  allProducts: Product[]; // Keep this for now for compatibility, though engine might not need it directly
}

interface CalculatedDiscountsOutput {
  itemDiscounts: Map<
    string,
    {
      ruleName: string;
      ruleCampaignName: string;
      perUnitEquivalentAmount: number;
      totalCalculatedDiscountForLine: number;
      ruleType: AppliedRuleInfo['ruleType'];
      appliedOnce: boolean;
    }
  >;
  cartDiscountsAppliedDetails: AppliedRuleInfo[];
  totalItemDiscountAmount: number;
  totalCartDiscountAmount: number;
  fullAppliedDiscountSummary: AppliedRuleInfo[];
}

/**
 * Acts as a bridge between the existing application structure and the new Discount Engine.
 * It prepares the context for the engine and formats the results back into the structure
 * the application currently expects.
 * @param input - The sale context including items and the active campaign.
 * @returns A structured result of all calculated discounts.
 */
export function calculateDiscountsForItems(
  input: CalculateDiscountsInput
): CalculatedDiscountsOutput {
  const { saleItems, activeCampaign } = input;

  if (!activeCampaign || saleItems.length === 0) {
    return {
      itemDiscounts: new Map(),
      cartDiscountsAppliedDetails: [],
      totalItemDiscountAmount: 0,
      totalCartDiscountAmount: 0,
      fullAppliedDiscountSummary: [],
    };
  }

  // 1. Initialize the Discount Engine
  const engine = new DiscountEngine(activeCampaign);

  // 2. Create the context for the calculation
  const context = {
    items: saleItems.map((item) => ({
      ...item,
      lineId: item.saleItemId, // Use saleItemId as the unique line identifier
      productId: item.id,
      batchId: item.selectedBatchId,
    })),
    // customer: undefined, // Customer-specific discounts can be added here in the future
  };

  // 3. Run the engine
  const result = engine.process(context);

  // 4. Format the engine's result into the old structure for compatibility
  const itemDiscounts = new Map<
    string,
    {
      ruleName: string;
      ruleCampaignName: string;
      perUnitEquivalentAmount: number;
      totalCalculatedDiscountForLine: number;
      ruleType: AppliedRuleInfo['ruleType'];
      appliedOnce: boolean;
    }
  >();

  result.lineItems.forEach((line) => {
    if (line.totalDiscount > 0) {
      // Aggregate rule names if multiple rules applied to one line
      const ruleNames = line.appliedRules.map((r) => r.name).join(', ');
      itemDiscounts.set(line.lineId, {
        ruleName: ruleNames,
        ruleCampaignName: activeCampaign.name,
        perUnitEquivalentAmount:
          line.quantity > 0 ? line.totalDiscount / line.quantity : 0,
        totalCalculatedDiscountForLine: line.totalDiscount,
        ruleType: 'custom_item_discount', // Using a generic type for the summary view
        appliedOnce: false, // This detail is in the full summary
      });
    }
  });

  const fullAppliedDiscountSummary: AppliedRuleInfo[] =
    result.getAppliedRulesSummary();

  return {
    itemDiscounts,
    cartDiscountsAppliedDetails: fullAppliedDiscountSummary.filter((rule) =>
      rule.ruleType.startsWith('campaign_global_')
    ),
    totalItemDiscountAmount: result.totalItemDiscount,
    totalCartDiscountAmount: result.totalCartDiscount,
    fullAppliedDiscountSummary,
  };
}
