// src/discount-engine/rules/batch-specific-rule.ts
import { IDiscountRule } from './interface';
import { DiscountContext } from '../core/context';
import { DiscountResult } from '../core/result';
import { evaluateRule } from '../utils/helpers';
import type { BatchDiscountConfiguration } from '@/types';

export class BatchSpecificRule implements IDiscountRule {
  private config: BatchDiscountConfiguration;

  constructor(config: BatchDiscountConfiguration) {
    this.config = config;
  }

  apply(context: DiscountContext, result: DiscountResult): void {
    if (!this.config.isActiveForBatchInCampaign) {
      return;
    }

    // Find the line item that corresponds to this specific batch
    const targetLineItem = context.items.find(
      (item) => item.batchId === this.config.productBatchId
    );

    if (!targetLineItem) {
      return;
    }
    
    const lineResult = result.getLineItem(targetLineItem.lineId);
    if (!lineResult || lineResult.totalDiscount > 0) return; // Skip if a higher-priority discount exists
    
    const lineTotal = targetLineItem.price * targetLineItem.quantity;
    const rulesToConsider = [
      { config: this.config.lineItemValueRuleJson, type: 'product_config_line_item_value' as const, context: 'item_value' as const },
      { config: this.config.lineItemQuantityRuleJson, type: 'product_config_line_item_quantity' as const, context: 'item_quantity' as const },
    ];
    
    rulesToConsider.forEach(ruleEntry => {
        if(ruleEntry.config?.isEnabled) {
            const discountAmount = evaluateRule(
                ruleEntry.config,
                targetLineItem.price,
                targetLineItem.quantity,
                lineTotal
            );

            if (discountAmount > 0) {
                 lineResult.addDiscount({
                    ruleId: `batch-${this.config.id}-${ruleEntry.type}`,
                    discountAmount,
                    description: `Batch-specific rule '${ruleEntry.config.name}' applied.`,
                    appliedRuleInfo: {
                        discountCampaignName: this.config.discountSet?.name || 'N/A',
                        sourceRuleName: ruleEntry.config.name,
                        totalCalculatedDiscount: discountAmount,
                        ruleType: 'product_config_line_item_value', // Simplified for now
                        productIdAffected: targetLineItem.productId,
                        appliedOnce: !!ruleEntry.config.applyFixedOnce
                    }
                });
            }
        }
    });

  }
}
