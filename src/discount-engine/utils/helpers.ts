// src/discount-engine/utils/helpers.ts
import type { SpecificDiscountRuleConfig } from '@/types';

/**
 * A generic function to evaluate a standard discount rule configuration.
 * @param ruleConfig The configuration object for the rule.
 * @param itemPrice The price of a single unit of the item.
 * @param itemQuantity The quantity of the item in the line.
 * @param lineTotalValue The total value of the line (price * quantity).
 * @param valueToTestCondition The value to test against the rule's min/max conditions.
 * @returns The calculated discount amount, or 0 if the rule doesn't apply.
 */
export function evaluateRule(
  ruleConfig: SpecificDiscountRuleConfig | null,
  itemPrice: number,
  itemQuantity: number,
  lineTotalValue: number,
  valueToTestCondition?: number
): number {
  if (!ruleConfig || !ruleConfig.isEnabled) return 0;
  
  const value = valueToTestCondition ?? lineTotalValue;

  const conditionMet =
    value >= (ruleConfig.conditionMin ?? 0) &&
    value <= (ruleConfig.conditionMax ?? Infinity);

  if (!conditionMet) return 0;

  let discountAmount = 0;
  if (ruleConfig.type === 'fixed') {
    discountAmount = ruleConfig.value;
  } else { // percentage
    discountAmount = lineTotalValue * (ruleConfig.value / 100);
  }
  
  // Ensure discount is not more than the line's total value.
  return Math.max(0, Math.min(discountAmount, lineTotalValue));
}
