
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { AppliedRuleInfo, SpecificDiscountRuleConfig } from "@/types";

interface DiscountInfoDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  ruleInfo: AppliedRuleInfo;
  ruleConfig?: SpecificDiscountRuleConfig;
}

function getSinhalaExplanation(ruleInfo: AppliedRuleInfo, ruleConfig?: SpecificDiscountRuleConfig): string {
  const ruleName = ruleInfo.sourceRuleName;
  const discountValue = ruleConfig?.value ?? 0;
  const discountType = ruleConfig?.type === 'percentage' ? '%' : 'ක ස්ථිර වට්ටමක්';
  const conditionMin = ruleConfig?.conditionMin;
  const conditionMax = ruleConfig?.conditionMax;
  const applyOnce = ruleConfig?.applyFixedOnce; // Use applyFixedOnce from ruleConfig

  let explanation = `"${ruleName}" නම් වට්ටම් රීතිය යටතේ ඔබට රු. ${ruleInfo.totalCalculatedDiscount.toFixed(2)} ක මුදලක් ඉතිරි වී ඇත. `;

  switch (ruleInfo.ruleType) {
    case 'item_price':
      explanation += `මෙම භාණ්ඩයේ මුළු වටිනාකම (මිල × ප්‍රමාණය)`;
      if (conditionMin !== undefined && conditionMax !== undefined) {
        explanation += ` රු. ${conditionMin} සහ රු. ${conditionMax} අතර වූ නිසා, `;
      } else if (conditionMin !== undefined) {
        explanation += ` රු. ${conditionMin} ට වඩා වැඩි වූ නිසා, `;
      } else {
        explanation += ` සඳහා නියමිත කොන්දේසි මත පදනම්ව `;
      }
      if (applyOnce) {
        if (ruleConfig?.type === 'fixed') {
            explanation += `මෙම සම්පූර්ණ භාණ්ඩ පෙළටම රු. ${discountValue}ක වට්ටමක් එක් වරක් ලැබී ඇත.`;
            explanation += ` උදා: මෙම භාණ්ඩයේ මුළු වටිනාකම රු. ${conditionMin ?? 0} ඉක්මවන්නේ නම්, රු. ${discountValue}ක තනි වට්ටමක් හිමි වේ.`;
        } else { // percentage applied once
             explanation += `මෙම සම්පූර්ණ භාණ්ඩ පෙළේ මුළු වටිනාකමෙන් ${discountValue}%ක වට්ටමක් එක් වරක් ලැබී ඇත.`;
             explanation += ` උදා: මෙම භාණ්ඩ පෙළේ මුළු වටිනාකම රු. ${conditionMin ?? 0} ඉක්මවන්නේ නම්, එම මුළු වටිනාකමෙන් ${discountValue}%ක තනි වට්ටමක් හිමි වේ.`;
        }
      } else { // Applied per unit
        explanation += `ඒකකයකට ${discountValue}${discountType} ලැබී ඇත.`;
        explanation += ` උදා: භාණ්ඩයක මිල රු. ${conditionMin ?? 0} ට වැඩි නම්, ${discountValue}${discountType} ලැබේ.`;
      }
      break;
    case 'item_quantity':
      explanation += `මෙම භාණ්ඩයේ ඔබ මිලදී ගත් ප්‍රමාණය`;
      if (conditionMin !== undefined && conditionMax !== undefined) {
        explanation += ` ඒකක ${conditionMin} සහ ${conditionMax} අතර වූ නිසා, `;
      } else if (conditionMin !== undefined) {
        explanation += ` ඒකක ${conditionMin} ට වඩා වැඩි වූ නිසා, `;
      } else {
        explanation += ` සඳහා නියමිත කොන්දේසි මත පදනම්ව `;
      }
       if (applyOnce) {
        if (ruleConfig?.type === 'fixed') {
            explanation += `මෙම සම්පූර්ණ භාණ්ඩ පෙළටම රු. ${discountValue}ක වට්ටමක් එක් වරක් ලැබී ඇත.`;
            explanation += ` උදා: ඔබ මෙම භාණ්ඩයෙන් ඒකක ${conditionMin ?? 0} ක් මිලදී ගන්නේ නම්, රු. ${discountValue}ක තනි වට්ටමක් හිමි වේ.`;
        } else { // percentage applied once
             explanation += `මෙම සම්පූර්ණ භාණ්ඩ පෙළේ මුළු වටිනාකමෙන් ${discountValue}%ක වට්ටමක් එක් වරක් ලැබී ඇත.`;
             explanation += ` උදා: ඔබ මෙම භාණ්ඩයෙන් ඒකක ${conditionMin ?? 0} ක් මිලදී ගෙන, එම භාණ්ඩ පෙළේ මුළු වටිනාකමෙන් ${discountValue}%ක තනි වට්ටමක් හිමි වේ.`;
        }
      } else { // Applied per unit
        explanation += `එක් භාණ්ඩයකට ${discountValue}${discountType} ලැබී ඇත.`;
        explanation += ` උදා: ඔබ මෙම භාණ්ඩයෙන් ඒකක ${conditionMin ?? 0} ක් මිලදී ගන්නේ නම්, එක් ඒකකයකට ${discountValue}${discountType} හිමි වේ.`;
      }
      break;
    case 'cart_price': // Cart rules are inherently applied once
      explanation += `ඔබගේ සම්පූර්ණ බිලේ වටිනාකම`;
       if (conditionMin !== undefined && conditionMax !== undefined) {
        explanation += ` රු. ${conditionMin} සහ රු. ${conditionMax} අතර වූ නිසා, සම්පූර්ණ බිලට ${discountValue}${discountType} ලැබී ඇත.`;
        explanation += ` උදා: ඔබගේ මුළු බිල රු. ${conditionMin ?? 0} ඉක්මවන්නේ නම්, ${discountValue}${discountType} හිමි වේ.`;
      } else if (conditionMin !== undefined) {
        explanation += ` රු. ${conditionMin} ට වඩා වැඩි වූ නිසා, සම්පූර්ණ බිලට ${discountValue}${discountType} ලැබී ඇත.`;
        explanation += ` උදා: ඔබගේ මුළු බිල රු. ${conditionMin ?? 0} ඉක්මවන්නේ නම්, ${discountValue}${discountType} හිමි වේ.`;
      } else {
        explanation += ` සඳහා නියමිත කොන්දේසි මත පදනම්ව මෙම වට්ටම ලැබී ඇත.`;
      }
      break;
    case 'cart_quantity': // Cart rules are inherently applied once
      explanation += `ඔබගේ සම්පූර්ණ බිලේ ඇති භාණ්ඩ ප්‍රමාණය`;
      if (conditionMin !== undefined && conditionMax !== undefined) {
        explanation += ` ඒකක ${conditionMin} සහ ${conditionMax} අතර වූ නිසා, සම්පූර්ණ බිලට ${discountValue}${discountType} ලැබී ඇත.`;
        explanation += ` උදා: ඔබගේ බිලේ භාණ්ඩ ${conditionMin ?? 0} කට වඩා තිබේ නම්, ${discountValue}${discountType} හිමි වේ.`;
      } else if (conditionMin !== undefined) {
        explanation += ` ඒකක ${conditionMin} ට වඩා වැඩි වූ නිසා, සම්පූර්ණ බිලට ${discountValue}${discountType} ලැබී ඇත.`;
        explanation += ` උදා: ඔබගේ බිලේ භාණ්ඩ ${conditionMin ?? 0} කට වඩා තිබේ නම්, ${discountValue}${discountType} හිමි වේ.`;
      } else {
        explanation += ` සඳහා නියමිත කොන්දේසි මත පදනම්ව මෙම වට්ටම ලැබී ඇත.`;
      }
      break;
    default:
      explanation += `නියමිත කොන්දේසි සපුරා ඇති නිසා මෙම වට්ටම ලැබී ඇත.`;
  }
  return explanation;
}


export function DiscountInfoDialog({ isOpen, onOpenChange, ruleInfo, ruleConfig }: DiscountInfoDialogProps) {
  if (!isOpen || !ruleInfo) {
    return null;
  }

  const sinhalaExplanation = getSinhalaExplanation(ruleInfo, ruleConfig);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-gradient-to-br from-card/95 via-background/90 to-card/95 border-border/70 backdrop-blur-sm shadow-2xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Discount Information</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Details about the applied discount rule.
          </DialogDescription>
        </DialogHeader>
        <Separator className="my-3 bg-border/50" />
        <div className="space-y-3 text-sm text-card-foreground max-h-[60vh] overflow-y-auto pr-2">
          <p>
            <span className="font-medium">Discount Set Name:</span> {ruleInfo.ruleSetName}
          </p>
          <p>
            <span className="font-medium">Rule Name:</span> {ruleInfo.sourceRuleName}
          </p>
          <p>
            <span className="font-medium">Total Calculated Discount:</span> Rs. {ruleInfo.totalCalculatedDiscount.toFixed(2)}
          </p>
          <p>
            <span className="font-medium">Rule Type:</span> {ruleInfo.ruleType.replace('_', ' ').toUpperCase()}
          </p>
          {ruleConfig && (
            <>
              <p>
                <span className="font-medium">Discount Value:</span> {ruleConfig.value}{ruleConfig.type === 'percentage' ? '%' : ' Rs.'}
              </p>
              {!ruleInfo.ruleType.startsWith('cart_') && ( // Only show for item-level rules
                 <p>
                    <span className="font-medium">Application:</span> {ruleConfig.applyFixedOnce ? 'Applied once for the item line' : 'Applied per qualifying unit/value'}
                 </p>
              )}
              {ruleConfig.conditionMin !== undefined && (
                <p>
                  <span className="font-medium">Minimum Condition:</span> {ruleConfig.conditionMin} {ruleInfo.ruleType.includes('price') || ruleInfo.ruleType.startsWith('cart_price') ? 'Rs.' : 'Units'}
                </p>
              )}
              {ruleConfig.conditionMax !== undefined && (
                <p>
                  <span className="font-medium">Maximum Condition:</span> {ruleConfig.conditionMax} {ruleInfo.ruleType.includes('price') || ruleInfo.ruleType.startsWith('cart_price') ? 'Rs.' : 'Units'}
                </p>
              )}
            </>
          )}
           <Separator className="my-3 bg-border/50" />
           <p className="font-medium">විස්තරය (Description in Sinhala):</p>
           <p className="text-muted-foreground italic p-3 border border-dashed border-border/50 rounded-md bg-background/70">
            {sinhalaExplanation}
           </p>
        </div>
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    