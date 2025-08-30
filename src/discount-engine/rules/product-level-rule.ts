// src/discount-engine/rules/product-level-rule.ts
import { IDiscountRule } from './interface';
import { DiscountContext } from '../core/context';
import { DiscountResult } from '../core/result';
import type { ProductDiscountConfiguration } from '@/types';
import { evaluateRule } from '../utils/helpers';

export class ProductLevelRule implements IDiscountRule {
  private config: ProductDiscountConfiguration;

  constructor(config: ProductDiscountConfiguration) {
    this.config = config;
  }

  apply(context: DiscountContext, result: DiscountResult): void {
    if (!this.config.isActiveForProductInCampaign) {
      return;
    }

    context.items.forEach((item) => {
      // Rule only applies to matching product ID
      if (item.productId !== this.config.productId) {
        return;
      }
      
      const lineResult = result.getLineItem(item.lineId);
      // If a higher-priority discount (e.g., custom) is already applied, skip.
      if (!lineResult || lineResult.totalDiscount > 0) {
        return;
      }

      const lineTotal = item.price * item.quantity;
      const rulesToConsider = [
          { config: this.config.lineItemValueRuleJson, type: 'product_config_line_item_value' as const, context: 'item_value' as const },
          { config: this.config.lineItemQuantityRuleJson, type: 'product_config_line_item_quantity' as const, context: 'item_quantity' as const },
          { config: this.config.specificQtyThresholdRuleJson, type: 'product_config_specific_qty_threshold' as const, context: 'specific_qty' as const },
          { config: this.config.specificUnitPriceThresholdRuleJson, type: 'product_config_specific_unit_price' as const, context: 'specific_unit_price' as const }
      ];

      rulesToConsider.forEach(ruleEntry => {
        if(ruleEntry.config?.isEnabled) {
            const discountAmount = evaluateRule(
                ruleEntry.config,
                item.price,
                item.quantity,
                lineTotal
            );

            if (discountAmount > 0) {
                 lineResult.addDiscount({
                    ruleId: `product-${this.config.id}-${ruleEntry.type}`,
                    discountAmount,
                    description: `Product-specific rule '${ruleEntry.config.name}' applied.`,
                    appliedRuleInfo: {
                        discountCampaignName: this.config.discountSet?.name || 'N/A',
                        sourceRuleName: ruleEntry.config.name,
                        totalCalculatedDiscount: discountAmount,
                        ruleType: ruleEntry.type,
                        productIdAffected: item.productId,
                        appliedOnce: !!ruleEntry.config.applyFixedOnce
                    }
                });
            }
        }
      });
    });
  }
}
