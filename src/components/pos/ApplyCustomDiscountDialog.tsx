
'use client';

import React, { useState, useEffect } from 'react';
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import type { SaleItem } from '@/types';

interface ApplyCustomDiscountDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: SaleItem | null;
  onApplyDiscount: (itemId: string, type: 'percentage' | 'fixed', value: number) => void;
  onRemoveDiscount: (itemId: string) => void;
}

export function ApplyCustomDiscountDialog({
  isOpen,
  onOpenChange,
  item,
  onApplyDiscount,
  onRemoveDiscount,
}: ApplyCustomDiscountDialogProps) {
  const { toast } = useToast();
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<string>('');

  useEffect(() => {
    if (item) {
      setDiscountType(item.customDiscountType || 'percentage');
      setDiscountValue(item.customDiscountValue?.toString() || '');
    }
  }, [item]);

  if (!item) return null;

  const handleApply = () => {
    const value = parseFloat(discountValue);
    if (isNaN(value) || value < 0) {
      toast({ title: "Invalid Value", description: "Please enter a valid non-negative number.", variant: "destructive" });
      return;
    }
    if (discountType === 'percentage' && value > 100) {
      toast({ title: "Invalid Percentage", description: "Percentage cannot be greater than 100.", variant: "destructive" });
      return;
    }
    onApplyDiscount(item.saleItemId, discountType, value);
    onOpenChange(false);
  };

  const handleRemove = () => {
    onRemoveDiscount(item.saleItemId);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border shadow-xl">
        <DialogHeader>
          <DialogTitle>Custom Discount for: {item.name}</DialogTitle>
          <DialogDescription>
            Apply a specific discount to this item. This will override any campaign discounts for this item only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <RadioGroup
            value={discountType}
            onValueChange={(value: 'percentage' | 'fixed') => setDiscountType(value)}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="percentage" id="type-percentage" />
              <Label htmlFor="type-percentage">Percentage (%)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="fixed" id="type-fixed" />
              <Label htmlFor="type-fixed">Fixed Amount (Rs.)</Label>
            </div>
          </RadioGroup>
          <div>
            <Label htmlFor="discount-value">Discount Value</Label>
            <Input
              id="discount-value"
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percentage' ? 'e.g., 10 for 10%' : 'e.g., 50 for Rs. 50'}
              className="bg-input border-border focus:ring-primary"
            />
          </div>
        </div>
        <DialogFooter className="justify-between">
          <Button type="button" variant="destructive" onClick={handleRemove} disabled={!item.customDiscountValue}>
            Remove Discount
          </Button>
          <div className="flex space-x-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleApply}>Apply Discount</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
