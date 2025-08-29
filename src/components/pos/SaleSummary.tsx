
'use client';

import { Separator } from "@/components/ui/separator";
import type { AppliedRuleInfo } from "@/types";
import { Button } from "@/components/ui/button";
import { Info, Gift, Tag, ShoppingCart } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";


interface SaleSummaryProps {
  subtotalOriginal: number;
  totalItemDiscountAmount: number;
  totalCartDiscountAmount: number;
  tax: number;
  total: number;
  taxRate: number;
  appliedDiscountSummary: AppliedRuleInfo[];
  onOpenDiscountInfoDialog: (ruleInfo: AppliedRuleInfo) => void;
}

export function SaleSummary({
  subtotalOriginal,
  totalItemDiscountAmount,
  totalCartDiscountAmount,
  tax,
  total,
  taxRate,
  appliedDiscountSummary,
  onOpenDiscountInfoDialog,
}: SaleSummaryProps) {
  const subtotalAfterItemDiscounts = subtotalOriginal - totalItemDiscountAmount;
  const netSubtotal = subtotalAfterItemDiscounts - totalCartDiscountAmount;
  const totalAllAppliedDiscountsValue = totalItemDiscountAmount + totalCartDiscountAmount;

  const itemLevelDiscounts = appliedDiscountSummary.filter(d => 
    (d.ruleType.startsWith('product_config_') || 
    d.ruleType.startsWith('campaign_default_')) &&
    d.ruleType !== 'buy_get_free' &&
    d.ruleType !== 'custom_item_discount'
  );
  
  const customDiscounts = appliedDiscountSummary.filter(d => d.ruleType === 'custom_item_discount');

  const buyGetDiscounts = appliedDiscountSummary.filter(d => d.ruleType === 'buy_get_free');

  const cartLevelDiscounts = appliedDiscountSummary.filter(d => d.ruleType.startsWith('campaign_global_'));


  return (
    <Card className="bg-muted/20 border-border/40 p-4 h-full">
        <div className="space-y-3 text-sm text-card-foreground">
            <div className="space-y-2">
                <div className="flex justify-between">
                    <span>Subtotal (Original)</span>
                    <span className="font-medium">Rs. {subtotalOriginal.toFixed(2)}</span>
                </div>

                {totalAllAppliedDiscountsValue > 0 && (
                    <div className="flex justify-between text-green-400">
                    <span>Total Discounts</span>
                    <span className="font-medium">-Rs. {totalAllAppliedDiscountsValue.toFixed(2)}</span>
                    </div>
                )}

                <div className="flex justify-between">
                    <span>Tax ({ (taxRate * 100).toFixed(taxRate === 0 ? 0 : (taxRate * 100 % 1 === 0 ? 0 : 2)) }%)</span>
                    <span className="font-medium">Rs. {tax.toFixed(2)}</span>
                </div>
            </div>

            {appliedDiscountSummary.length > 0 && (
                <Accordion type="single" collapsible className="w-full text-xs">
                <AccordionItem value="item-1" className="border rounded-lg bg-background/50 border-border/40">
                    <AccordionTrigger className="px-3 py-2 text-muted-foreground hover:text-foreground [&[data-state=open]>svg]:text-primary">
                    View Applied Discount Details
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-2 px-3 space-y-3">
                    
                    {customDiscounts.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-xs font-semibold text-muted-foreground flex items-center"><Tag className="mr-2 h-4 w-4 text-primary"/>Custom Item Discounts</div>
                            {customDiscounts.map((discount, index) => (
                                <div key={`custom-${discount.productIdAffected}-${index}`} className="flex justify-between items-center text-primary text-xs pl-2">
                                <span>{discount.sourceRuleName}</span>
                                <span>-Rs. {discount.totalCalculatedDiscount.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {itemLevelDiscounts.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-xs font-semibold text-muted-foreground flex items-center"><Tag className="mr-2 h-4 w-4"/>Item Level Discounts</div>
                            {itemLevelDiscounts.map((discount, index) => (
                                <div key={`${discount.sourceRuleName}-${discount.productIdAffected || 'item'}-${index}`} className="flex justify-between items-center text-green-400 text-xs pl-2">
                                <div className="flex items-center">
                                    <span>{discount.sourceRuleName} ({discount.discountCampaignName})</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 text-blue-400 hover:text-blue-600" onClick={() => onOpenDiscountInfoDialog(discount)}>
                                        <Info className="h-3 w-3" />
                                    </Button>
                                </div>
                                <span>-Rs. {discount.totalCalculatedDiscount.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                        )}
                        
                    {buyGetDiscounts.length > 0 && (
                        <div className="space-y-1 pt-2">
                            <div className="text-xs font-semibold text-muted-foreground flex items-center"><Gift className="mr-2 h-4 w-4"/>"Buy & Get" Offers</div>
                            {buyGetDiscounts.map((discount, index) => (
                                <div key={`buy-get-${discount.sourceRuleName}-${index}`} className="flex justify-between items-center text-rose-400 text-xs pl-2">
                                    <div className="flex items-center">
                                    <span>{discount.sourceRuleName}</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 text-blue-400 hover:text-blue-600" onClick={() => onOpenDiscountInfoDialog(discount)}>
                                        <Info className="h-3 w-3" />
                                    </Button>
                                    </div>
                                    <span>-Rs. {discount.totalCalculatedDiscount.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                        )}
                    
                    {cartLevelDiscounts.length > 0 && (
                        <div className="space-y-1 pt-2">
                            <div className="text-xs font-semibold text-muted-foreground flex items-center"><ShoppingCart className="mr-2 h-4 w-4"/>Cart Level Discounts</div>
                            {cartLevelDiscounts.map((discount, index) => (
                                <div key={`${discount.sourceRuleName}-cart-${index}`} className="flex justify-between items-center text-green-400 text-xs pl-2">
                                <div className="flex items-center">
                                    <span>{discount.sourceRuleName} ({discount.discountCampaignName})</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 text-blue-400 hover:text-blue-600" onClick={() => onOpenDiscountInfoDialog(discount)}>
                                        <Info className="h-3 w-3" />
                                    </Button>
                                </div>
                                <span>-Rs. {discount.totalCalculatedDiscount.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                        )}
                    
                    </AccordionContent>
                </AccordionItem>
                </Accordion>
            )}
            
            <div className="p-4 rounded-lg bg-background">
                <div className="flex justify-between items-center font-bold text-lg text-primary">
                <span>GRAND TOTAL</span>
                <span className="text-2xl">Rs. {total.toFixed(2)}</span>
                </div>
            </div>
        </div>
    </Card>
  );
}
