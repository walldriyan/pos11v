// src/discount-engine/rules/buy-x-get-y-rule.ts
import { IDiscountRule } from './interface';
import { DiscountContext } from '../core/context';
import { DiscountResult } from '../core/result';
import type { BuyGetRule } from '@/types';

export class BuyXGetYRule implements IDiscountRule {
  private config: BuyGetRule;

  constructor(config: BuyGetRule) {
    this.config = config;
  }

  apply(context: DiscountContext, result: DiscountResult): void {
    const {
      buyProductId,
      buyQuantity,
      getProductId,
      getQuantity,
      discountType,
      discountValue,
      isRepeatable,
    } = this.config;

    // Find all items that match the "buy" condition
    const buyItems = context.items.filter((item) => item.productId === buyProductId);
    const totalBuyQuantity = buyItems.reduce((sum, item) => sum + item.quantity, 0);

    if (totalBuyQuantity < buyQuantity) {
      return; // Not enough items to trigger the offer
    }

    // Find all items that are eligible to be the "get" item
    const getItems = context.items.filter((item) => item.productId === getProductId);
    if (getItems.length === 0) {
      return; // No item to apply the discount to
    }

    const timesRuleApplies = isRepeatable
      ? Math.floor(totalBuyQuantity / buyQuantity)
      : 1;
    let freeItemsToDistribute = timesRuleApplies * getQuantity;

    // Apply the discount to the "get" items
    for (const getItem of getItems) {
      if (freeItemsToDistribute <= 0) break;

      const lineResult = result.getLineItem(getItem.lineId);
      if (!lineResult) continue;

      const originalLineTotal = getItem.price * getItem.quantity;
      // Cannot discount more than what's already on the line
      const alreadyDiscounted = lineResult.totalDiscount;
      const maxDiscountForThisLine = originalLineTotal - alreadyDiscounted;
      if (maxDiscountForThisLine <= 0) continue;

      // Determine how many items in this line can get the discount
      const itemsInLineToDiscount = Math.min(getItem.quantity, freeItemsToDistribute);

      let discountAmountForThisLine = 0;
      if (discountType === 'percentage') {
        discountAmountForThisLine = getItem.price * (discountValue / 100) * itemsInLineToDiscount;
      } else { // fixed
        // This is tricky. Let's assume fixed means the final price of the item is `discountValue`.
        // A better approach might be "fixed amount off". Assuming "fixed amount off".
        discountAmountForThisLine = discountValue * itemsInLineToDiscount;
      }

      const finalDiscount = Math.min(discountAmountForThisLine, maxDiscountForThisLine);

      if (finalDiscount > 0) {
        lineResult.addDiscount({
          ruleId: `bogo-${buyProductId}-${getProductId}`,
          discountAmount: finalDiscount,
          description: `Buy ${buyQuantity} of ${buyProductId}, Get ${getQuantity} of ${getProductId} offer.`,
          appliedRuleInfo: {
            discountCampaignName: "BOGO Campaign", // Needs context from campaign
            sourceRuleName: `Buy ${buyQuantity} Get ${getQuantity}`,
            totalCalculatedDiscount: finalDiscount,
            ruleType: 'buy_get_free',
            productIdAffected: getItem.productId,
          },
        });
        freeItemsToDistribute -= itemsInLineToDiscount;
      }
    }
  }
}
