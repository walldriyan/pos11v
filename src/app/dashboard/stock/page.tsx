
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '@/store/store';
import {
  getAllProductsAction,
  updateProductStockAction,
} from '@/app/actions/productActions';
import {
  initializeAllProducts,
  selectAllProducts,
} from '@/store/slices/saleSlice';
import { selectCurrentUser } from '@/store/slices/authSlice';
import type { Product as ProductType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, PackageSearch, RefreshCw, Edit, ArchiveIcon } from 'lucide-react';
import { getDisplayQuantityAndUnit } from '@/lib/unitUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';

export default function StockManagementPage() {
  const dispatch: AppDispatch = useDispatch();
  const { toast } = useToast();
  const currentUser = useSelector(selectCurrentUser);
  const productsFromStore = useSelector(selectAllProducts);
  const { can } = usePermissions();
  const canAdjustStock = can('update', 'Product');

  const [localProducts, setLocalProducts] = useState<ProductType[]>(productsFromStore);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isStockSheetOpen, setIsStockSheetOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<ProductType | null>(null);
  const [stockChangeAmount, setStockChangeAmount] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProducts = useCallback(async () => {
    if (!currentUser?.id) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    const result = await getAllProductsAction(currentUser.id);
    if (result.success && result.data) {
      dispatch(initializeAllProducts(result.data));
      setLocalProducts(result.data);
    } else {
      toast({
        title: 'Error Fetching Products',
        description: `${result.error || 'Could not load products.'} ${result.detailedError ? `Details: ${result.detailedError}` : ''}`,
        variant: 'destructive',
      });
      setLocalProducts([]);
    }
    setIsLoading(false);
  }, [dispatch, toast, currentUser]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    setLocalProducts(productsFromStore);
  }, [productsFromStore]);


  const handleOpenStockAdjustSheet = (product: ProductType) => {
    if (product.isService) {
        toast({ title: "Cannot Adjust Stock", description: `${product.name} is a service item and does not have stock.`, variant: "default" });
        return;
    }
    setAdjustingProduct(product);
    setStockChangeAmount('');
    setIsStockSheetOpen(true);
  };

  const handleStockAdjustmentSubmit = async () => {
    if (!adjustingProduct || stockChangeAmount === '' || !currentUser?.id) {
      toast({ title: 'Error', description: 'Product not selected or user not authenticated.', variant: 'destructive' });
      return;
    }

    const change = parseInt(stockChangeAmount, 10);
    if (isNaN(change)) {
      toast({ title: 'Invalid Input', description: 'Please enter a valid number for stock change.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const result = await updateProductStockAction(adjustingProduct.id, change, currentUser.id);
    
    if (result.success && result.data) {
      toast({ title: 'Stock Updated', description: `Stock for "${result.data.name}" has been adjusted.` });
      
      // CRITICAL FIX: After a successful adjustment, always re-fetch the entire product list
      // from the server to ensure the Redux store has the single source of truth.
      await fetchProducts();
      
      setIsStockSheetOpen(false);
      setAdjustingProduct(null);
    } else {
      toast({ title: 'Error Updating Stock', description: result.error || 'Could not update stock.', variant: 'destructive' });
    }
    
    setIsSubmitting(false);
  };
  
  const newStockPreview = useMemo(() => {
    if (!adjustingProduct) return 0;
    const change = parseInt(stockChangeAmount, 10);
    return isNaN(change) ? adjustingProduct.stock : adjustingProduct.stock + change;
  }, [adjustingProduct, stockChangeAmount]);


  const filteredProducts = useMemo(() => {
    if (!searchTerm) return localProducts;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return localProducts.filter(product =>
      product.name.toLowerCase().includes(lowerSearchTerm) ||
      (product.category && product.category.toLowerCase().includes(lowerSearchTerm)) ||
      (product.code && product.code.toLowerCase().includes(lowerSearchTerm))
    );
  }, [localProducts, searchTerm]);

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
               <ArchiveIcon className="mr-3 h-7 w-7" /> Stock Management
            </h1>
          </div>
          <div className="flex space-x-2 self-end sm:self-center">
            <Button onClick={fetchProducts} variant="outline" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground" disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh List
            </Button>
          </div>
        </header>

        <Card className="bg-card border-border shadow-xl flex-1">
          <CardHeader>
            <CardTitle className="text-2xl text-card-foreground">Product Stock Levels</CardTitle>
            <CardDescription className="text-muted-foreground">
              View and adjust current stock levels for your products.
            </CardDescription>
             <div className="mt-4">
                <Input
                    placeholder="Search by name, category, or code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-input border-border focus:ring-primary text-card-foreground"
                />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && filteredProducts.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={`skel-stock-${i}`} className="flex items-center space-x-4 p-4 border-b border-border/30">
                  <Skeleton className="h-10 w-1/4 rounded bg-muted/50" />
                  <Skeleton className="h-10 w-1/4 rounded bg-muted/50" />
                  <Skeleton className="h-10 w-1/4 rounded bg-muted/50" />
                  <Skeleton className="h-10 w-1/4 rounded bg-muted/50" />
                </div>
              ))
            ) : !isLoading && filteredProducts.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <PackageSearch className="mx-auto h-12 w-12 mb-4 text-primary" />
                <p className="text-lg font-medium">
                    {searchTerm ? `No products found matching "${searchTerm}".` : 'No products found.'}
                </p>
                {!searchTerm && <p className="text-sm">Add products via Product Management to see them here.</p>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-border/50 hover:bg-muted/20">
                      <TableHead className="text-muted-foreground">Name</TableHead>
                      <TableHead className="text-muted-foreground">Category</TableHead>
                      <TableHead className="text-muted-foreground">Code</TableHead>
                      <TableHead className="text-right text-muted-foreground">Current Stock</TableHead>
                      <TableHead className="text-center text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => {
                      const { displayQuantity: stockDisplayQty, displayUnit: stockDisplayUnit } = getDisplayQuantityAndUnit(product.stock, product.units);
                      return (
                        <TableRow key={product.id} className="border-b-border/30 hover:bg-muted/10">
                          <TableCell className="font-medium text-card-foreground">{product.name}</TableCell>
                          <TableCell className="text-card-foreground">{product.category || 'N/A'}</TableCell>
                          <TableCell className="text-card-foreground text-xs">{product.code || 'N/A'}</TableCell>
                          <TableCell className="text-right text-card-foreground">
                            {product.isService ? (
                              <Badge variant="outline">Service</Badge>
                            ) : (
                              <div>
                                <span>{`${product.stock} ${product.units.baseUnit}`}</span>
                                {stockDisplayUnit !== product.units.baseUnit && (
                                  <span className="block text-xs text-muted-foreground">
                                    (Equals: {stockDisplayQty} {stockDisplayUnit})
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleOpenStockAdjustSheet(product)}
                                disabled={product.isService || !canAdjustStock}
                                className="h-8 border-primary text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Edit className="mr-1.5 h-3.5 w-3.5" /> Adjust Stock
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {isStockSheetOpen && adjustingProduct && (
          <Sheet open={isStockSheetOpen} onOpenChange={(open) => {
            setIsStockSheetOpen(open);
            if (!open) setAdjustingProduct(null);
          }}>
            <SheetContent className="sm:max-w-md w-full bg-card border-border shadow-xl">
              <SheetHeader className="pb-4">
                <SheetTitle className="text-card-foreground">Adjust Stock for: {adjustingProduct.name}</SheetTitle>
                <SheetDescription className="text-muted-foreground">
                  Current Stock: {getDisplayQuantityAndUnit(adjustingProduct.stock, adjustingProduct.units).displayQuantity} {getDisplayQuantityAndUnit(adjustingProduct.stock, adjustingProduct.units).displayUnit}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="stockChangeAmount" className="text-card-foreground">
                    Quantity Change (in {adjustingProduct.units.baseUnit})
                  </Label>
                  <Input
                    id="stockChangeAmount"
                    type="number"
                    value={stockChangeAmount}
                    onChange={(e) => setStockChangeAmount(e.target.value)}
                    placeholder="e.g., 10 to add, -5 to subtract"
                    className="bg-input border-border focus:ring-primary text-card-foreground mt-1"
                  />
                   <p className="text-xs text-muted-foreground mt-1">Enter a positive number to add stock, negative to subtract.</p>
                </div>
                <div>
                    <Label className="text-card-foreground">New Stock After Change</Label>
                    <p className={`mt-1 text-lg font-semibold ${newStockPreview < 0 ? 'text-destructive' : 'text-accent'}`}>
                        {getDisplayQuantityAndUnit(newStockPreview, adjustingProduct.units).displayQuantity} {getDisplayQuantityAndUnit(newStockPreview, adjustingProduct.units).displayUnit}
                        {newStockPreview < 0 && <span className="text-xs text-destructive ml-2">(Cannot be negative)</span>}
                    </p>
                </div>
              </div>
              <SheetFooter className="mt-6">
                <SheetClose asChild>
                  <Button type="button" variant="outline" className="border-muted text-muted-foreground hover:bg-muted/80">Cancel</Button>
                </SheetClose>
                <Button 
                    type="button" 
                    onClick={handleStockAdjustmentSubmit} 
                    disabled={isSubmitting || stockChangeAmount === '' || newStockPreview < 0}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isSubmitting ? "Saving..." : "Save Stock Change"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        )}
      </div>
  );
}
