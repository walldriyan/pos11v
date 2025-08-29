
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StockAdjustmentFormSchema, StockAdjustmentReasonEnumSchema } from '@/lib/zodSchemas';
import type { StockAdjustmentFormData, Product as ProductType, StockAdjustmentReasonEnum } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArchiveX, Save, Layers } from 'lucide-react';
import { getAllProductsAction } from '@/app/actions/productActions';
import { adjustStockAction } from '@/app/actions/stockAdjustmentActions';
import { Skeleton } from '@/components/ui/skeleton';
import { getDisplayQuantityAndUnit } from '@/lib/unitUtils';
import { useDispatch, useSelector } from 'react-redux';
import { _internalUpdateProduct } from '@/store/slices/saleSlice';
import { selectCurrentUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import { usePermissions } from '@/hooks/usePermissions';

type AdjustmentFormData = Omit<StockAdjustmentFormData, 'userId'>;

const defaultValues: AdjustmentFormData = {
  productId: '',
  quantity: 0,
  reason: 'DAMAGED',
  notes: '',
};

export default function LostDamagePage() {
  const { toast } = useToast();
  const dispatch: AppDispatch = useDispatch();
  const currentUser = useSelector(selectCurrentUser);
  const { can } = usePermissions();
  const canAdjustStock = can('update', 'Product');

  const [products, setProducts] = useState<ProductType[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    register,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm<AdjustmentFormData>({
    resolver: zodResolver(StockAdjustmentFormSchema.omit({ userId: true })),
    defaultValues,
    mode: 'onChange',
  });

  const selectedProductId = watch('productId');
  const selectedProduct = products.find(p => p.id === selectedProductId);

  const fetchProducts = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsLoadingProducts(true);
    const result = await getAllProductsAction(currentUser.id);
    if (result.success && result.data) {
      setProducts(result.data.filter(p => !p.isService)); // Filter out service items
    } else {
      toast({ title: 'Error fetching products', description: result.error, variant: 'destructive' });
    }
    setIsLoadingProducts(false);
  }, [toast, currentUser]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const onSubmitForm = async (data: AdjustmentFormData) => {
    if (!currentUser?.id) {
        setFormError("User not authenticated.");
        return;
    }

    setIsSubmitting(true);
    setFormError(null);

    if (!selectedProduct) {
      setFormError("Invalid product selected.");
      setIsSubmitting(false);
      return;
    }

    const quantityNum = Number(data.quantity);
    if (['LOST', 'DAMAGED', 'CORRECTION_SUBTRACT'].includes(data.reason) && quantityNum > selectedProduct.stock) {
      toast({
        title: 'Adjustment Error',
        description: `Cannot ${data.reason.toLowerCase().replace('_', ' ')} ${quantityNum} units. Only ${selectedProduct.stock} ${selectedProduct.units.baseUnit} in stock.`,
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }


    const result = await adjustStockAction(data, currentUser.id);
    if (result.success) {
      toast({ title: 'Stock Adjusted', description: 'Product stock has been updated successfully.' });
      
      // After successful adjustment, refetch all products to get the most accurate state
      // including updated average cost price which the client cannot calculate.
      const freshProductsResult = await getAllProductsAction(currentUser.id);
      if (freshProductsResult.success && freshProductsResult.data) {
          const updatedProductFromServer = freshProductsResult.data.find(p => p.id === selectedProduct.id);
          if (updatedProductFromServer) {
             dispatch(_internalUpdateProduct(updatedProductFromServer));
             setProducts(freshProductsResult.data.filter(p => !p.isService));
          }
      }
      
      reset(defaultValues);
    } else {
      setFormError(result.error || 'Failed to adjust stock.');
      if (result.fieldErrors) {
        // Handle specific field errors if your form needs it
        console.error("Field errors:", result.fieldErrors);
      }
      toast({ title: 'Error', description: result.error || 'Could not adjust stock.', variant: 'destructive' });
    }
    setIsSubmitting(false);
  };
  
  const currentStockDisplay = selectedProduct
    ? `${getDisplayQuantityAndUnit(selectedProduct.stock, selectedProduct.units).displayQuantity} ${getDisplayQuantityAndUnit(selectedProduct.stock, selectedProduct.units).displayUnit}`
    : 'N/A';

  return (
    <div className="flex flex-col flex-1 p-4 md:p-6 bg-gradient-to-br from-background to-secondary text-foreground">
      <header className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-3">
          <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground self-start sm:self-center">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center">
            <ArchiveX className="mr-3 h-7 w-7" /> Lost &amp; Damage Stock Adjustment
          </h1>
        </div>
      </header>

      <Card className="bg-card border-border shadow-xl">
        <CardHeader>
          <CardTitle className="text-card-foreground">Adjust Product Stock</CardTitle>
          <CardDescription className="text-muted-foreground">
            Record stock changes due to loss, damage, or other corrections. This action is logged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingProducts ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
              {formError && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{formError}</p>}
              
              <fieldset disabled={!canAdjustStock} className="space-y-6">
                <div>
                  <Label htmlFor="productId" className="text-card-foreground">Product*</Label>
                  <Controller
                    name="productId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={products.length === 0 || !canAdjustStock}
                      >
                        <SelectTrigger id="productId" className="bg-input border-border focus:ring-primary text-card-foreground">
                          <SelectValue placeholder={products.length === 0 ? "No non-service products available" : "Select a product"} />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map(product => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} ({product.code || 'No Code'}) - Stock: {getDisplayQuantityAndUnit(product.stock, product.units).displayQuantity} {getDisplayQuantityAndUnit(product.stock, product.units).displayUnit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.productId && <p className="text-xs text-destructive mt-1">{errors.productId.message}</p>}
                  {selectedProduct && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selected: {selectedProduct.name} (Current Stock: {currentStockDisplay})
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity" className="text-card-foreground">Quantity to Adjust*</Label>
                    <Input
                      id="quantity"
                      type="number"
                      {...register('quantity', { valueAsNumber: true })}
                      className="bg-input border-border focus:ring-primary text-card-foreground"
                      placeholder="e.g., 5"
                      min="0.01" step="any"
                    />
                    {errors.quantity && <p className="text-xs text-destructive mt-1">{errors.quantity.message}</p>}
                    {selectedProduct && <p className="text-xs text-muted-foreground mt-1">Adjusting in {selectedProduct.units.baseUnit}.</p>}
                  </div>

                  <div>
                    <Label htmlFor="reason" className="text-card-foreground">Reason*</Label>
                    <Controller
                      name="reason"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="reason" className="bg-input border-border focus:ring-primary text-card-foreground">
                            <SelectValue placeholder="Select a reason" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.values(StockAdjustmentReasonEnumSchema.Enum).map(reasonValue => (
                              <SelectItem key={reasonValue} value={reasonValue}>
                                {reasonValue.replace('_', ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.reason && <p className="text-xs text-destructive mt-1">{errors.reason.message}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes" className="text-card-foreground">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    {...register('notes')}
                    className="bg-input border-border focus:ring-primary text-card-foreground min-h-[80px]"
                    placeholder="Any additional details about this stock adjustment..."
                  />
                  {errors.notes && <p className="text-xs text-destructive mt-1">{errors.notes.message}</p>}
                </div>
              </fieldset>
              
              {!canAdjustStock && (
                <p className="text-sm text-yellow-500 bg-yellow-500/10 p-3 rounded-md">You do not have permission to adjust stock.</p>
              )}


              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
                  disabled={isSubmitting || !isValid || !selectedProductId || !canAdjustStock}
                >
                  <Layers className="mr-2 h-4 w-4" />
                  {isSubmitting ? 'Adjusting Stock...' : 'Confirm Stock Adjustment'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
