// src/discount-engine/rules/interface.ts
import { DiscountContext } from '../core/context';
import { DiscountResult } from '../core/result';

/**
 * Defines the contract for all discount rules.
 * Each rule must implement the `apply` method.
 */
export interface IDiscountRule {
  /**
   * Evaluates the rule against the current sale context and applies
   * discounts to the result object if conditions are met.
   * @param context The current state of the sale (items, customer, etc.).
   * @param result The object to which applied discounts should be added.
   */
  apply(context: DiscountContext, result: DiscountResult): void;
}
