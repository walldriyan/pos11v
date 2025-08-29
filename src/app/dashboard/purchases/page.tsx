
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PurchaseBillCreateInputSchema, PurchasePaymentMethodEnumSchema } from '@/lib/zodSchemas';
import type { PurchaseBillFormData, Party, Product as ProductType, PurchasePaymentMethodEnum } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CalendarIcon, PlusCircle, Trash2, ShoppingCartIcon, ArrowLeft, Search, DollarSign, Info, ListFilter, CreditCard, AlertTriangle } from 'lucide-react';
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { ProductSearch } from '@/components/pos/ProductSearch';
import { getAllProductsAction } from '@/app/actions/productActions';
import { getAllSuppliersAction, createPurchaseBillAction } from '@/app/actions/purchaseActions';
import { useDispatch, useSelector } from 'react-redux';
import { _internalUpdateProduct, _internalAddNewProduct, initializeAllProducts } from '@/store/slices/saleSlice';
import { selectCurrentUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import { Separator } from '@/components/ui/separator';
import { usePermissions } from '@/hooks/usePermissions';


export default function PurchasesPage() {
  const { toast } = useToast();
  const dispatch: AppDispatch = useDispatch();
  const currentUser = useSelector(selectCurrentUser);
  const { can } = usePermissions();
  const canCreatePurchase = can('create', 'PurchaseBill');
  
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [allProducts, setAllProducts] = useState<ProductType[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isSuperAdminWithoutCompany = currentUser?.id === 'root-user' || (currentUser?.role?.name === 'Admin' && !currentUser?.companyId);

  const {
    control,
    handleSubmit,
    register,
    reset,
    watch,
    formState: { errors, isValid: isFormValid },
  } = useForm<PurchaseBillFormData>({
    resolver: zodResolver(PurchaseBillCreateInputSchema),
    defaultValues: {
      supplierId: null,
      purchaseDate: new Date(),
      items: [],
      notes: '',
      amountPaid: 0,
      initialPaymentMethod: null,
      paymentReference: '',
      paymentNotes: '',
    },
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
    keyName: 'fieldId',
  });

  const fetchInitialData = useCallback(async () => {
    if (!currentUser?.id || isSuperAdminWithoutCompany) {
        setIsLoadingSuppliers(false);
        setIsLoadingProducts(false);
        return;
    }
    setIsLoadingSuppliers(true);
    setIsLoadingProducts(true);
    try {
      const [suppliersResult, productsResult] = await Promise.all([
        getAllSuppliersAction(currentUser.id),
        getAllProductsAction(currentUser.id),
      ]);

      if (suppliersResult.success && suppliersResult.data) {
        setSuppliers(suppliersResult.data);
      } else {
        if (!isSuperAdminWithoutCompany) { // Only show toast if it's an actual error for a company user
            toast({ title: "Error fetching suppliers", description: suppliersResult.error, variant: "destructive" });
        }
      }

      if (productsResult.success && productsResult.data) {
        setAllProducts(productsResult.data);
        dispatch(initializeAllProducts(productsResult.data));
      } else {
         if (!isSuperAdminWithoutCompany) {
            toast({ title: "Error fetching products", description: productsResult.error, variant: "destructive" });
         }
      }
    } catch (error) {
      toast({ title: "Error fetching initial data", variant: "destructive" });
    } finally {
      setIsLoadingSuppliers(false);
      setIsLoadingProducts(false);
    }
  }, [toast, dispatch, currentUser, isSuperAdminWithoutCompany]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleProductSelect = (product: ProductType) => {
    const existingItemIndex = fields.findIndex(field => field.productId === product.id);
    if (existingItemIndex !== -1) {
      toast({ title: "Product already added", description: `${product.name} is already in the purchase list. You can adjust its quantity.`, variant: "default" });
      return;
    }
    append({
      productId: product.id,
      name: product.name,
      units: product.units,
      quantityPurchased: 1,
      costPriceAtPurchase: product.costPrice || 0,
      batchNumber: '',
      expiryDate: null,
      currentStock: product.stock,
      currentSellingPrice: product.sellingPrice,
    });
  };

  const watchedItems = watch('items');
  const watchedAmountPaid = watch('amountPaid');

  const calculateTotalAmount = useCallback(() => {
    return watchedItems.reduce((total, item) => {
      const quantity = Number(item.quantityPurchased) || 0;
      const cost = Number(item.costPriceAtPurchase) || 0;
      return total + (quantity * cost);
    }, 0);
  }, [watchedItems]);

  const totalBillAmount = calculateTotalAmount();
  const amountDue = useMemo(() => {
    const paid = Number(watchedAmountPaid) || 0;
    return totalBillAmount - paid;
  }, [totalBillAmount, watchedAmountPaid]);


  const onSubmitPurchase = async (data: PurchaseBillFormData) => {
    if (!currentUser?.id) {
      setFormError("User not authenticated. Cannot save purchase.");
      return;
    }
    setIsSubmitting(true);
    setFormError(null);

    const dataForAction = {
        ...data,
        amountPaid: data.amountPaid ? Number(data.amountPaid) : 0,
    };

    const result = await createPurchaseBillAction(dataForAction, currentUser.id);

    if (result.success && result.data) {
      toast({ title: "Purchase Bill Created", description: `Bill from supplier recorded. ID: ${result.data.id}. Status: ${result.data.paymentStatus}` });
      
      const productsResult = await getAllProductsAction(currentUser.id);
      if (productsResult.success && productsResult.data) {
          dispatch(initializeAllProducts(productsResult.data));
          setAllProducts(productsResult.data);
      }

      reset({
          supplierId: null,
          purchaseDate: new Date(),
          items: [],
          notes: '',
          amountPaid: 0,
          initialPaymentMethod: null,
          paymentReference: '',
          paymentNotes: '',
      });
    } else {
      setFormError(result.error || "Failed to create purchase bill.");
      if (result.fieldErrors) {
        console.error("Field errors:", result.fieldErrors);
         if (result.fieldErrors.initialPaymentMethod) {
          toast({ title: "Validation Error", description: result.fieldErrors.initialPaymentMethod.join(', '), variant: "destructive" });
        }
      }
      toast({ title: "Error", description: result.error || "Could not create purchase bill.", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  if (isLoadingSuppliers || isLoadingProducts) {
    return <div className="p-6 text-center text-muted-foreground">Loading initial data...</div>;
  }
  
  const isFormDisabled = !canCreatePurchase || isSuperAdminWithoutCompany;

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
            <ShoppingCartIcon className="mr-3 h-7 w-7" /> Create Purchase Bill (GRN)
          </h1>
        </div>
        <div className="flex items-center space-x-2 self-end sm:self-center">
            <Button asChild variant="outline" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">
                <Link href="/dashboard/purchases/payments">
                    <CreditCard className="mr-2 h-4 w-4" /> Manage Purchase Payments
                </Link>
            </Button>
        </div>
      </header>

      {isSuperAdminWithoutCompany && (
        <Card className="mb-4 border-yellow-500/50 bg-yellow-950/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-400" />
            <div>
              <p className="font-semibold text-yellow-300">Super Admin Notice</p>
              <p className="text-xs text-yellow-400">
                Purchase bills are company-specific. This feature is disabled because your Super Admin account is not associated with a company.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmitPurchase)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column for Main Form */}
          <div className="lg:col-span-2 space-y-6">
             <fieldset disabled={isFormDisabled} className="space-y-6">
                <Card className="bg-card border-border shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-card-foreground">Supplier & Bill Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {formError && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{formError}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="supplierId" className="text-card-foreground">Supplier*</Label>
                        <Controller
                          name="supplierId"
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value || ''}
                              onValueChange={field.onChange}
                              disabled={suppliers.length === 0}
                            >
                              <SelectTrigger id="supplierId" className="bg-input border-border focus:ring-primary text-card-foreground">
                                <SelectValue placeholder={suppliers.length === 0 ? "No suppliers available" : "Select supplier"} />
                              </SelectTrigger>
                              <SelectContent>
                                {suppliers.map(supplier => (
                                  <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.supplierId && <p className="text-xs text-destructive mt-1">{errors.supplierId.message}</p>}
                      </div>
                      <div>
                        <Label htmlFor="supplierBillNumber" className="text-card-foreground">Supplier Bill Number</Label>
                        <Input
                          id="supplierBillNumber"
                          {...register('supplierBillNumber')}
                          className="bg-input border-border focus:ring-primary text-card-foreground"
                          placeholder="e.g., INV-12345"
                        />
                        {errors.supplierBillNumber && <p className="text-xs text-destructive mt-1">{errors.supplierBillNumber.message}</p>}
                      </div>
                      <div>
                        <Label htmlFor="purchaseDate" className="text-card-foreground">Purchase Date*</Label>
                        <Controller
                          name="purchaseDate"
                          control={control}
                          render={({ field }) => (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full justify-start text-left font-normal bg-input border-border hover:bg-input/80 text-card-foreground",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          )}
                        />
                        {errors.purchaseDate && <p className="text-xs text-destructive mt-1">{errors.purchaseDate.message}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-card-foreground">Purchased Items</CardTitle>
                    <ProductSearch allProducts={allProducts.filter(p => !p.isService)} onProductSelect={handleProductSelect} />
                     {errors.items && typeof errors.items.message === 'string' && <p className="text-xs text-destructive mt-1">{errors.items.message}</p>}
                     {errors.items?.root && <p className="text-xs text-destructive mt-1">{errors.items.root.message}</p>}
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-muted-foreground">Product</TableHead>
                          <TableHead className="text-muted-foreground w-36">Batch No.</TableHead>
                          <TableHead className="text-muted-foreground w-40">Expiry Date</TableHead>
                          <TableHead className="text-muted-foreground w-32">Qty Purchased</TableHead>
                          <TableHead className="text-muted-foreground w-36">Cost Price/Unit</TableHead>
                          <TableHead className="text-muted-foreground w-40">New Selling Price</TableHead>
                          <TableHead className="text-muted-foreground text-right w-36">Subtotal</TableHead>
                          <TableHead className="text-muted-foreground w-16">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.map((item, index) => (
                          <TableRow key={item.fieldId}>
                            <TableCell className="text-card-foreground">
                              {item.name} <span className="text-xs text-muted-foreground">({item.units.baseUnit})</span>
                              <p className="text-xs text-muted-foreground">Current Stock: {item.currentStock}, Current Sell Price: Rs. {item.currentSellingPrice?.toFixed(2)}</p>
                            </TableCell>
                             <TableCell>
                              <Input
                                {...register(`items.${index}.batchNumber`)}
                                className="bg-input border-border focus:ring-primary text-card-foreground h-8 text-sm"
                                placeholder="Optional"
                              />
                            </TableCell>
                            <TableCell>
                               <Controller
                                  control={control}
                                  name={`items.${index}.expiryDate`}
                                  render={({ field }) => (
                                     <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-8 text-xs px-2", !field.value && "text-muted-foreground")}>
                                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                          {field.value ? format(field.value, "P") : <span>No Expiry</span>}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date || null)} initialFocus />
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                {...register(`items.${index}.quantityPurchased`, { valueAsNumber: true })}
                                className="bg-input border-border focus:ring-primary text-card-foreground h-8 text-sm"
                                min="1"
                              />
                              {errors.items?.[index]?.quantityPurchased && <p className="text-xs text-destructive mt-1">{errors.items?.[index]?.quantityPurchased?.message}</p>}
                            </TableCell>
                            <TableCell>
                              <Controller
                                  name={`items.${index}.costPriceAtPurchase`}
                                  control={control}
                                  render={({ field: { onChange, onBlur, value } }) => (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={value === undefined || value === null ? '' : String(value)}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        onChange(val === '' ? undefined : parseFloat(val));
                                      }}
                                      onBlur={onBlur}
                                      className="bg-input border-border focus:ring-primary text-card-foreground h-8 text-sm"
                                      min="0"
                                    />
                                  )}
                                />
                              {errors.items?.[index]?.costPriceAtPurchase && <p className="text-xs text-destructive mt-1">{errors.items?.[index]?.costPriceAtPurchase?.message}</p>}
                            </TableCell>
                            <TableCell>
                              <Controller
                                  name={`items.${index}.currentSellingPrice`}
                                  control={control}
                                  render={({ field: { onChange, onBlur, value } }) => (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={value === undefined || value === null ? '' : String(value)}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        onChange(val === '' ? undefined : parseFloat(val));
                                      }}
                                      onBlur={onBlur}
                                      className="bg-input border-border focus:ring-primary text-card-foreground h-8 text-sm"
                                      min="0"
                                    />
                                  )}
                                />
                              {errors.items?.[index]?.currentSellingPrice && <p className="text-xs text-destructive mt-1">{errors.items?.[index]?.currentSellingPrice?.message}</p>}
                            </TableCell>
                            <TableCell className="text-right text-card-foreground">
                              Rs. {( (Number(watchedItems?.[index]?.quantityPurchased) || 0) * (Number(watchedItems?.[index]?.costPriceAtPurchase) || 0) ).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:text-destructive/80">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {fields.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-4">
                              No products added to this purchase bill yet. Use search above.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
            </fieldset>
          </div>
          
          {/* Right Column for Summary & Actions */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-card border-border shadow-lg sticky top-6">
              <CardHeader>
                <CardTitle className="text-card-foreground">Payment & Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="amountPaid" className="text-card-foreground">Amount Paid Now (Optional)</Label>
                  <Controller
                      name="amountPaid"
                      control={control}
                      render={({ field }) => (
                          <Input
                          id="amountPaid"
                          type="number"
                          step="0.01"
                          value={field.value === null || field.value === undefined ? '' : String(field.value)}
                          onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                          className="bg-input border-border focus:ring-primary text-card-foreground"
                          placeholder="0.00"
                          min="0"
                          disabled={isFormDisabled}
                          />
                      )}
                  />
                  {errors.amountPaid && <p className="text-xs text-destructive mt-1">{errors.amountPaid.message}</p>}
                </div>
              
                {(watchedAmountPaid !== null && watchedAmountPaid !== undefined && watchedAmountPaid > 0) && (
                     <>
                      <div className="space-y-4 pt-2">
                        <div>
                            <Label htmlFor="initialPaymentMethod" className="text-card-foreground">Payment Method*</Label>
                            <Controller
                            name="initialPaymentMethod"
                            control={control}
                            render={({ field }) => (
                                <Select value={field.value || ''} onValueChange={(value) => field.onChange(value as PurchasePaymentMethodEnum || null)} disabled={isFormDisabled}>
                                <SelectTrigger id="initialPaymentMethod" className="bg-input border-border focus:ring-primary text-card-foreground">
                                    <SelectValue placeholder="Select payment method" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.values(PurchasePaymentMethodEnumSchema.Enum).map(method => (
                                    <SelectItem key={method} value={method}>{method.replace('_', ' ')}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                            )}
                            />
                            {errors.initialPaymentMethod && <p className="text-xs text-destructive mt-1">{errors.initialPaymentMethod.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="paymentReference" className="text-card-foreground">Payment Reference</Label>
                            <Input
                            id="paymentReference"
                            {...register('paymentReference')}
                            className="bg-input border-border focus:ring-primary text-card-foreground"
                            placeholder="e.g., Cheque No, Txn ID"
                            disabled={isFormDisabled}
                            />
                            {errors.paymentReference && <p className="text-xs text-destructive mt-1">{errors.paymentReference.message}</p>}
                        </div>
                      </div>
                   </>
                )}

                <Separator className="my-4 bg-border/50" />
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Bill Amount:</span>
                    <span className="font-semibold text-card-foreground">Rs. {totalBillAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Paid Now:</span>
                    <span className="font-semibold text-green-400">Rs. {(Number(watchedAmountPaid) || 0).toFixed(2)}</span>
                  </div>
                  <Separator className="my-1 bg-border/50" />
                  <div className="flex justify-between text-lg">
                    <span className="font-bold text-primary">Amount Due:</span>
                    <span className={`font-bold ${amountDue >=0 ? 'text-red-400' : 'text-green-500'}`}>
                      Rs. {amountDue.toFixed(2)}
                      {amountDue < 0 && <span className="text-xs"> (Overpaid)</span>}
                    </span>
                  </div>
                   {totalBillAmount > 0 && <p className="text-xs text-muted-foreground mt-1 text-right">
                      <Info size={12} className="inline mr-1" />
                      Status will be auto-set as {
                          (Number(watchedAmountPaid) || 0) >= totalBillAmount ? "PAID" :
                          (Number(watchedAmountPaid) || 0) > 0 ? "PARTIALLY_PAID" : "COMPLETED"
                      }.
                  </p>}
                </div>
                <div className="pt-4">
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3"
                    disabled={isSubmitting || !isFormValid || fields.length === 0 || isFormDisabled}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Purchase Bill'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
