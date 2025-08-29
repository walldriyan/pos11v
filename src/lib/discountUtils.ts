
import type { SaleItem, DiscountSet, AppliedRuleInfo, SpecificDiscountRuleConfig, Product, BuyGetRule } from '@/types';

function evaluateRule(
  ruleConfig: SpecificDiscountRuleConfig | null,
  itemPrice: number,
  itemQuantity: number,
  itemLineTotalValue: number,
  ruleContext: 'item_value' | 'item_quantity' | 'specific_qty' | 'specific_unit_price'
): number {
  if (!ruleConfig || !ruleConfig.isEnabled) return 0;

  let conditionMet = false;
  let valueToTestCondition = 0;

  switch (ruleContext) {
    case 'item_value': valueToTestCondition = itemLineTotalValue; break;
    case 'item_quantity': valueToTestCondition = itemQuantity; break;
    case 'specific_qty': valueToTestCondition = itemQuantity; break;
    case 'specific_unit_price': valueToTestCondition = itemPrice; break;
    default: return 0;
  }

  conditionMet = (valueToTestCondition >= (ruleConfig.conditionMin ?? 0)) &&
                 (valueToTestCondition <= (ruleConfig.conditionMax ?? Infinity));

  if (!conditionMet) return 0;

  let discountAmount = 0;
  if (ruleConfig.type === 'fixed') {
    if (ruleConfig.applyFixedOnce) {
        discountAmount = ruleConfig.value;
    } else {
        if (ruleContext === 'item_quantity' || ruleContext === 'specific_qty') {
            discountAmount = ruleConfig.value * itemQuantity;
        } else {
            discountAmount = ruleConfig.value * itemQuantity; 
        }
    }
  } else { // percentage
    if (ruleConfig.applyFixedOnce) {
        discountAmount = itemLineTotalValue * (ruleConfig.value / 100);
    } else {
        if (ruleContext === 'item_value') {
             discountAmount = itemLineTotalValue * (ruleConfig.value / 100);
        } else {
            discountAmount = (itemPrice * (ruleConfig.value / 100)) * itemQuantity;
        }
    }
  }
  return Math.max(0, Math.min(discountAmount, itemLineTotalValue));
};


interface CalculateDiscountsInput {
  saleItems: SaleItem[];
  activeCampaign: DiscountSet | null;
  allProducts: Product[];
}

interface CalculatedDiscountsOutput {
  itemDiscounts: Map<string, {
    ruleName: string;
    ruleCampaignName: string;
    perUnitEquivalentAmount: number;
    totalCalculatedDiscountForLine: number;
    ruleType: AppliedRuleInfo['ruleType'];
    appliedOnce: boolean;
  }>;
  cartDiscountsAppliedDetails: AppliedRuleInfo[];
  totalItemDiscountAmount: number;
  totalCartDiscountAmount: number;
  fullAppliedDiscountSummary: AppliedRuleInfo[];
}

export function calculateDiscountsForItems(
  input: CalculateDiscountsInput
): CalculatedDiscountsOutput {
  const { saleItems, activeCampaign, allProducts } = input;

  const itemLevelDiscountsMap = new Map<string, {
    ruleName: string; ruleCampaignName: string; perUnitEquivalentAmount: number;
    totalCalculatedDiscountForLine: number; ruleType: AppliedRuleInfo['ruleType']; appliedOnce: boolean;
  }>();
  let totalItemDiscountSum = 0;
  const globalCartRulesAppliedDetails: AppliedRuleInfo[] = [];
  let totalGlobalCartDiscountSum = 0;
  const detailedAppliedDiscountSummary: AppliedRuleInfo[] = [];


  if (saleItems.length === 0) {
    return {
      itemDiscounts: itemLevelDiscountsMap,
      cartDiscountsAppliedDetails: globalCartRulesAppliedDetails,
      totalItemDiscountAmount: 0,
      totalCartDiscountAmount: 0,
      fullAppliedDiscountSummary: [],
    };
  }

  // 1. Evaluate Item-Level Discounts (Custom and Campaign)
  saleItems.forEach(saleItem => {
    const productDetails = allProducts.find(p => p.id === saleItem.id);
    if (!productDetails) return;

    const itemOriginalLineValue = saleItem.price * saleItem.quantity;
    let totalDiscountForThisLine = 0;
    
    // --- START: CUSTOM DISCOUNT CHECK ---
    if (saleItem.customDiscountValue && saleItem.customDiscountValue > 0) {
        if (saleItem.customDiscountType === 'fixed') {
            totalDiscountForThisLine = saleItem.customDiscountValue * saleItem.quantity;
        } else { // percentage
            totalDiscountForThisLine = itemOriginalLineValue * (saleItem.customDiscountValue / 100);
        }
        
        totalDiscountForThisLine = Math.max(0, Math.min(totalDiscountForThisLine, itemOriginalLineValue));
        
        if (totalDiscountForThisLine > 0) {
            detailedAppliedDiscountSummary.push({
                discountCampaignName: "Custom",
                sourceRuleName: "Custom Item Discount",
                totalCalculatedDiscount: totalDiscountForThisLine,
                ruleType: 'custom_item_discount',
                productIdAffected: saleItem.id,
                appliedOnce: false,
            });
             itemLevelDiscountsMap.set(saleItem.saleItemId, {
                ruleName: "Custom Discount", ruleCampaignName: "Custom", 
                perUnitEquivalentAmount: saleItem.quantity > 0 ? totalDiscountForThisLine / saleItem.quantity : 0,
                totalCalculatedDiscountForLine: totalDiscountForThisLine,
                ruleType: 'custom_item_discount', appliedOnce: false
            });
            totalItemDiscountSum += totalDiscountForThisLine;
        }
        // If a custom discount is applied, we skip campaign rules for this item.
        return; 
    }
    // --- END: CUSTOM DISCOUNT CHECK ---

    if (!activeCampaign || !activeCampaign.isActive) return; // Skip campaign rules if none active

    const productConfigInCampaign = activeCampaign.productConfigurations?.find(
      pc => pc.productId === saleItem.id && pc.isActiveForProductInCampaign
    );

    const rulesToConsiderForItem: { config: SpecificDiscountRuleConfig | null; type: AppliedRuleInfo['ruleType']; context: 'item_value' | 'item_quantity' | 'specific_qty' | 'specific_unit_price' }[] = [];

    if (productConfigInCampaign) {
      rulesToConsiderForItem.push(
        { config: productConfigInCampaign.lineItemValueRuleJson, type: 'product_config_line_item_value', context: 'item_value' },
        { config: productConfigInCampaign.lineItemQuantityRuleJson, type: 'product_config_line_item_quantity', context: 'item_quantity' },
        { config: productConfigInCampaign.specificQtyThresholdRuleJson, type: 'product_config_specific_qty_threshold', context: 'specific_qty' },
        { config: productConfigInCampaign.specificUnitPriceThresholdRuleJson, type: 'product_config_specific_unit_price', context: 'specific_unit_price' }
      );
    } else { // Use campaign's default item rules
      rulesToConsiderForItem.push(
        { config: activeCampaign.defaultLineItemValueRuleJson, type: 'campaign_default_line_item_value', context: 'item_value' },
        { config: activeCampaign.defaultLineItemQuantityRuleJson, type: 'campaign_default_line_item_quantity', context: 'item_quantity' },
        { config: activeCampaign.defaultSpecificQtyThresholdRuleJson, type: 'campaign_default_specific_qty_threshold', context: 'specific_qty' },
        { config: activeCampaign.defaultSpecificUnitPriceThresholdRuleJson, type: 'campaign_default_specific_unit_price', context: 'specific_unit_price' }
      );
    }

    rulesToConsiderForItem.forEach(ruleEntry => {
      if (ruleEntry.config && ruleEntry.config.isEnabled) {
        const discountFromThisRule = evaluateRule(ruleEntry.config, saleItem.price, saleItem.quantity, itemOriginalLineValue, ruleEntry.context);
        if (discountFromThisRule > 0) {
            totalDiscountForThisLine += discountFromThisRule;
            detailedAppliedDiscountSummary.push({
                discountCampaignName: activeCampaign.name,
                sourceRuleName: ruleEntry.config.name,
                totalCalculatedDiscount: discountFromThisRule,
                ruleType: ruleEntry.type,
                productIdAffected: saleItem.id,
                appliedOnce: !!ruleEntry.config.applyFixedOnce,
            });
        }
      }
    });
    
    // --- START: "Buy & Get" Rule Evaluation PER LINE ITEM (CORRECTED LOGIC) ---
    if (activeCampaign.buyGetRulesJson) {
      activeCampaign.buyGetRulesJson.forEach(rule => {
        // This rule applies only if the item is BOTH the "buy" and "get" item, AND its quantity meets the condition.
        if (rule.buyProductId === saleItem.id && rule.getProductId === saleItem.id && saleItem.quantity >= rule.buyQuantity) {
          
          const timesRuleApplies = rule.isRepeatable ? Math.floor(saleItem.quantity / rule.buyQuantity) : 1;
          const numberOfFreeItems = timesRuleApplies * rule.getQuantity;
          
          // Ensure we don't give more free items than are being purchased in this line
          const actualFreeItems = Math.min(saleItem.quantity, numberOfFreeItems);
          
          if (actualFreeItems > 0) {
            let discountPerUnit = 0;
            if (rule.discountType === 'percentage') {
              // Discount is on the "get" item, which is the same as the "buy" item here.
              discountPerUnit = saleItem.price * (rule.discountValue / 100);
            } else { // Fixed discount
              discountPerUnit = rule.discountValue;
            }
            
            const discountFromThisRule = discountPerUnit * actualFreeItems;
            
            if (discountFromThisRule > 0) {
              totalDiscountForThisLine += discountFromThisRule;
              detailedAppliedDiscountSummary.push({
                discountCampaignName: activeCampaign.name,
                sourceRuleName: "Buy/Get Offer", // Using a generic name for now
                totalCalculatedDiscount: discountFromThisRule,
                ruleType: 'buy_get_free',
                productIdAffected: saleItem.id,
                appliedOnce: !rule.isRepeatable
              });
            }
          }
        }
      });
    }
    // --- END: "Buy & Get" Rule Evaluation ---


    if (totalDiscountForThisLine > 0) {
      const perUnitEquivalent = saleItem.quantity > 0 ? totalDiscountForThisLine / saleItem.quantity : 0;
      itemLevelDiscountsMap.set(saleItem.saleItemId, {
        ruleName: detailedAppliedDiscountSummary.filter(d=>d.productIdAffected === saleItem.id).map(d=>d.sourceRuleName).join(', '),
        ruleCampaignName: activeCampaign.name,
        perUnitEquivalentAmount: perUnitEquivalent,
        totalCalculatedDiscountForLine: totalDiscountForThisLine,
        ruleType: 'product_config_line_item_value', // This type might need refinement if multiple rule types apply
        appliedOnce: false, // This is a summary, individual rule's appliedOnce is in detailed summary
      });
      totalItemDiscountSum += totalDiscountForThisLine;
    }
  });


  // 3. Apply Global Cart-Level Discounts
  const subtotalAfterAllItemDiscounts = saleItems.reduce((sum, saleItem) => {
    const itemOriginalLineValue = saleItem.price * saleItem.quantity;
    const itemDiscountForLine = itemLevelDiscountsMap.get(saleItem.saleItemId)?.totalCalculatedDiscountForLine || 0;
    return sum + itemOriginalLineValue - itemDiscountForLine;
  }, 0);
  const totalCartQuantity = saleItems.reduce((sum, item) => sum + item.quantity, 0);

  if (activeCampaign && activeCampaign.isActive) {
    const globalCartRulesToProcess = [
      { config: activeCampaign.globalCartPriceRuleJson, type: 'campaign_global_cart_price' as AppliedRuleInfo['ruleType'] },
      { config: activeCampaign.globalCartQuantityRuleJson, type: 'campaign_global_cart_quantity' as AppliedRuleInfo['ruleType'] },
    ];

    globalCartRulesToProcess.forEach(cartRuleEntry => {
      if (cartRuleEntry.config && cartRuleEntry.config.isEnabled) {
        const cartRule = cartRuleEntry.config;
        let conditionMet = false;
        let valueToTestCondition = 0;

        if (cartRuleEntry.type === 'campaign_global_cart_price') valueToTestCondition = subtotalAfterAllItemDiscounts;
        else if (cartRuleEntry.type === 'campaign_global_cart_quantity') valueToTestCondition = totalCartQuantity;

        conditionMet = (valueToTestCondition >= (cartRule.conditionMin ?? 0)) && (valueToTestCondition <= (cartRule.conditionMax ?? Infinity));

        if (conditionMet) {
          let cartDiscountAmountApplied: number;
          if (cartRule.type === 'fixed') cartDiscountAmountApplied = cartRule.value;
          else cartDiscountAmountApplied = subtotalAfterAllItemDiscounts * (cartRule.value / 100);

          cartDiscountAmountApplied = Math.max(0, Math.min(cartDiscountAmountApplied, subtotalAfterAllItemDiscounts));

          if (cartDiscountAmountApplied > 0) {
              const cartRuleInfo: AppliedRuleInfo = {
                  discountCampaignName: activeCampaign.name,
                  sourceRuleName: cartRule.name,
                  totalCalculatedDiscount: cartDiscountAmountApplied,
                  ruleType: cartRuleEntry.type,
                  appliedOnce: true,
              };
              totalGlobalCartDiscountSum += cartDiscountAmountApplied;
              globalCartRulesAppliedDetails.push(cartRuleInfo);
              detailedAppliedDiscountSummary.push(cartRuleInfo);
          }
        }
      }
    });
  }

  return {
    itemDiscounts: itemLevelDiscountsMap,
    cartDiscountsAppliedDetails: globalCartRulesAppliedDetails,
    totalItemDiscountAmount: totalItemDiscountSum,
    totalCartDiscountAmount: totalGlobalCartDiscountSum,
    fullAppliedDiscountSummary: detailedAppliedDiscountSummary,
  };
}
