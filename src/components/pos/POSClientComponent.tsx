
"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useDispatch, useStore } from 'react-redux';
import { useBatchSelector, useOptimizedSelector } from '@/hooks/useOptimizedSelector';
import type { RootState, AppDispatch } from '@/store/store';
import { useRouter } from 'next/navigation';

import {
  addProductToSale,
  updateItemQuantity,
  removeItemFromSale,
  clearSale,
  selectAllProducts,
  selectSaleItems,
  selectTaxRate,
  selectSaleSubtotalOriginal,
  selectCalculatedTax,
  selectSaleTotal,
  selectAppliedDiscountSummary,
  selectDiscountSets,
  selectActiveDiscountSetId,
  setActiveDiscountSetId,
  selectCalculatedDiscounts,
  selectActiveDiscountSet,
  initializeDiscountSets,
  initializeTaxRate,
  initializeAllProducts,
  _internalUpdateMultipleProductStock,
  applyCustomDiscount,
  removeCustomDiscount,
} from '@/store/slices/saleSlice';
import { selectCurrentUser, selectAuthStatus, clearUser, setUser } from '@/store/slices/authSlice';


import { saveSaleRecordAction } from '@/app/actions/saleActions';
import { logoutAction } from '@/app/actions/authActions';
import { getAllProductsAction } from '@/app/actions/productActions'; // Import the action to fetch products
import type { Product, SaleItem, DiscountSet, AppliedRuleInfo, SpecificDiscountRuleConfig, PaymentMethod, SaleRecordType, SaleStatus, SaleRecordItemInput, SaleRecordInput, UnitDefinition, CreditPaymentStatus, ProductBatch } from "@/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ProductSearch, type ProductSearchHandle } from "@/components/pos/ProductSearch";
import { SaleSummary } from "@/components/pos/SaleSummary";
import { CurrentSaleItemsTable } from "@/components/pos/CurrentSaleItemsTable";
import { SettingsDialog } from "@/components/pos/SettingsDialog";
import { DiscountInfoDialog } from "@/components/pos/DiscountInfoDialog";
import { PaymentDialog, PaymentFormContent } from "@/components/pos/PaymentDialog";
import { ApplyCustomDiscountDialog } from './ApplyCustomDiscountDialog';
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, CreditCard, DollarSign, ShoppingBag, Settings as SettingsIcon, ArchiveRestore, LayoutDashboard, LogOut, CheckSquare, XCircle, ArrowLeft, DoorClosed, Tag, ChevronsUpDown, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import BarcodeReader from 'react-barcode-reader';
import { CreditPaymentStatusEnumSchema } from '@/lib/zodSchemas';
import { store } from '@/store/store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';

type CheckoutMode = 'popup' | 'inline';


interface POSClientComponentProps {
    serverState: RootState;
}

export function POSClientComponent({ serverState }: POSClientComponentProps) {
  const router = useRouter();
  const dispatch: AppDispatch = useDispatch();
  const { toast } = useToast();
  const productSearchRef = useRef<ProductSearchHandle>(null);

  // Initialize store with server-fetched data only once
   useEffect(() => {
    dispatch(initializeAllProducts(serverState.sale.allProducts));
    dispatch(initializeDiscountSets(serverState.sale.discountSets));
    dispatch(initializeTaxRate(serverState.sale.taxRate));
    if (serverState.auth.user) {
        dispatch(setUser(serverState.auth.user));
    }
  }, [dispatch, serverState]);


  // Optimized batch selector to reduce re-renders
  const {
    currentUser,
    authStatus,
    allProductsFromStore,
    saleItems,
    discountSets,
    activeDiscountSetId,
    activeDiscountSet,
    taxRate,
    subtotalOriginal,
    tax,
    total,
    calculatedDiscountsSelectorResult,
    appliedDiscountSummaryFromSelector
  } = useBatchSelector({
    currentUser: selectCurrentUser,
    authStatus: selectAuthStatus,
    allProductsFromStore: selectAllProducts,
    saleItems: selectSaleItems,
    discountSets: selectDiscountSets,
    activeDiscountSetId: selectActiveDiscountSetId,
    activeDiscountSet: selectActiveDiscountSet,
    taxRate: selectTaxRate,
    subtotalOriginal: selectSaleSubtotalOriginal,
    tax: selectCalculatedTax,
    total: selectSaleTotal,
    calculatedDiscountsSelectorResult: selectCalculatedDiscounts,
    appliedDiscountSummaryFromSelector: selectAppliedDiscountSummary
  });

  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isDiscountInfoDialogOpen, setIsDiscountInfoDialogOpen] = useState(false);
  const [selectedDiscountRuleForInfo, setSelectedDiscountRuleForInfo] = useState<{ rule: AppliedRuleInfo, config?: SpecificDiscountRuleConfig } | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<PaymentMethod | null>(null);
  const [currentBillNumber, setCurrentBillNumber] = useState('');
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>('popup');
  const [isInlinePaymentView, setIsInlinePaymentView] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isMounting, setIsMounting] = useState(true);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [isProcessingBarcode, setIsProcessingBarcode] = useState(false);
  const [isCustomDiscountDialogOpen, setIsCustomDiscountDialogOpen] = useState(false);
  const [itemForCustomDiscount, setItemForCustomDiscount] = useState<SaleItem | null>(null);
  const [isDiscountPopoverOpen, setIsDiscountPopoverOpen] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
    setIsMounting(false);
    const savedMode = localStorage.getItem('posCheckoutMode') as CheckoutMode;
    if (savedMode === 'inline' || savedMode === 'popup') {
      setCheckoutMode(savedMode);
    }
  }, []);

  const handleCheckoutModeChange = (mode: CheckoutMode) => {
    setCheckoutMode(mode);
    localStorage.setItem('posCheckoutMode', mode);
    toast({ title: "Checkout Mode Updated", description: `Switched to ${mode === 'inline' ? 'Inline' : 'Popup'} payment mode.` });
  };


  useEffect(() => {
    if (authStatus !== 'loading' && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authStatus, router]);

  useEffect(() => {
    if (isClient && currentUser) {
      productSearchRef.current?.focusSearchInput();
    }
  }, [isClient, currentUser]);

  useEffect(() => {
    if (!isClient) return;

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTypingInInput = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable;
      
      const isButton = target.tagName === 'BUTTON';
      const isWithinPopper = target.closest('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]') !== null;


      if (isTypingInInput || isButton || isWithinPopper) {
        return; 
      }
      
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        productSearchRef.current?.focusSearchInput();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isClient]);


  const handleProductSelectionFromSearch = useCallback((productToAdd: Product, selectedBatch?: ProductBatch) => {
    const productInStore = allProductsFromStore.find(p => p.id === productToAdd.id);
    if (!productInStore) {
        toast({ title: "Error", description: "Product not found in current inventory.", variant: "destructive"});
        return;
    }
    
    if (!productInStore.isActive) {
      toast({ title: "Product Inactive", description: `${productInStore.name} is not active and cannot be added.`, variant: "destructive"});
      return;
    }

    const stockAvailable = selectedBatch ? selectedBatch.quantity : productInStore.stock;
    if (!productInStore.isService && stockAvailable <=0) {
       toast({ title: "Out of Stock", description: `${productInStore.name} is out of stock.`, variant: "destructive"});
       return;
    }

    dispatch(addProductToSale({ product: productInStore, batch: selectedBatch }));

    const existingItem = saleItems.find((item) => 
        item.id === productInStore.id && item.selectedBatchId === selectedBatch?.id
    );

     if (existingItem) {
      if (productInStore.isService || existingItem.quantity < stockAvailable) {
      } else if (!productInStore.isService) {
        toast({ title: "Stock limit reached", description: `Cannot add more ${productInStore.name}.`, variant: "destructive" });
      }
    }
  }, [dispatch, saleItems, toast, allProductsFromStore]);

  const handleQuantityChange = useCallback((saleItemId: string, newQuantity: number) => {
    const itemToUpdate = saleItems.find(item => item.saleItemId === saleItemId);
    if (!itemToUpdate) return;

    const productInStore = allProductsFromStore.find(p => p.id === itemToUpdate.id);
    if (!productInStore) return;
    
    const batchInStore = itemToUpdate.selectedBatchId 
        ? productInStore.batches?.find(b => b.id === itemToUpdate.selectedBatchId) 
        : null;

    const stockLimit = batchInStore ? batchInStore.quantity : productInStore.stock;


    let toastInfo: { title: string; description: string; variant?: 'default' | 'destructive' } | null = null;

    if (newQuantity <= 0) {
    } else if (!itemToUpdate.isService && newQuantity > stockLimit) {
      toastInfo = { title: "Stock Limit Reached", description: `Max stock for ${itemToUpdate.name} is ${stockLimit}. Quantity set to max.`, variant: "destructive" };
    }

    dispatch(updateItemQuantity({ saleItemId, newQuantity }));
    if(toastInfo) {
        setTimeout(() => toast(toastInfo!),0);
    }
  }, [dispatch, saleItems, toast, allProductsFromStore]);

  const handleRemoveItem = useCallback((saleItemId: string) => {
    dispatch(removeItemFromSale({ saleItemId }));
  }, [dispatch]);


  const handleNewSale = () => {
    dispatch(clearSale());
    setIsInlinePaymentView(false);
    toast({ title: "New Sale Started", description: "Current sale has been cleared." });
    productSearchRef.current?.focusSearchInput();
  };

  const handleOpenPaymentDialog = (method: PaymentMethod) => {
    if (saleItems.length === 0 || saleItems.every(item => item.quantity <=0)) {
      toast({ title: "Empty Sale", description: "Add items with valid quantities to the sale before payment.", variant: "destructive" });
      return;
    }
    setCurrentPaymentMethod(method);
    const uniquePart1 = Date.now().toString().slice(-4);
    const uniquePart2 = Math.random().toString().slice(2, 6); // 4 random digits
    setCurrentBillNumber(`BN-${uniquePart1}-${uniquePart2}`);
    
    if (checkoutMode === 'popup') {
      setIsPaymentDialogOpen(true);
    } else {
      setIsInlinePaymentView(true);
    }
  };
  
   const handleLogout = async () => {
    await logoutAction();
    dispatch(clearUser());
    router.push('/login');
  };

  const handlePaymentSuccess = async (paymentDetails: {
    customerName?: string;
    customerId?: string | null;
    amountPaid?: number; 
    changeDue?: number; 
  }) => {
    if (!currentUser?.id) {
        toast({
            title: "Authentication Error",
            description: "You must be logged in to complete a sale.",
            variant: "destructive",
        });
        return;
    }

     // --- CRITICAL FIX: Get a snapshot of the current state before any async operations or dispatches. ---
     const currentState = store.getState();
     const currentSaleItems = selectSaleItems(currentState);
     const currentSubtotalOriginal = selectSaleSubtotalOriginal(currentState);
     const currentTaxRate = selectTaxRate(currentState);
     const currentCalculatedTax = selectCalculatedTax(currentState);
     const currentCalculatedTotal = selectSaleTotal(currentState);
     const currentAllProducts = selectAllProducts(currentState);
     const {
        itemDiscounts: currentItemDiscountsMap,
        totalItemDiscountAmount: currentTotalItemDiscount,
        totalCartDiscountAmount: currentTotalCartDiscount
     } = selectCalculatedDiscounts(currentState);
     const currentAppliedDiscountSummary = selectAppliedDiscountSummary(currentState);
     const currentActiveDiscountSetId = selectActiveDiscountSetId(currentState);
     // --- END OF SNAPSHOT ---

     const validSaleItems = currentSaleItems.filter(item => item.quantity > 0);

     if (validSaleItems.length === 0) {
        toast({
            title: "Empty Sale",
            description: "No valid items to process for payment.",
            variant: "destructive",
        });
        return;
     }

     const saleRecordItems: SaleRecordItemInput[] = validSaleItems.map(item => {
        const productDetails = currentAllProducts.find(p => p.id === item.id);
        const originalItemPrice = item.price; 
        const itemDiscountDetails = currentItemDiscountsMap.get(item.id);

        let totalDiscountAppliedToThisLine = itemDiscountDetails?.totalCalculatedDiscountForLine ?? 0;
        let effectivePricePaidPerUnitValue = originalItemPrice;
        
        if (item.customDiscountValue) {
            totalDiscountAppliedToThisLine = item.customDiscountType === 'fixed'
                ? item.customDiscountValue * item.quantity
                : item.price * item.quantity * (item.customDiscountValue / 100);
        }

        effectivePricePaidPerUnitValue = originalItemPrice - (item.quantity > 0 ? totalDiscountAppliedToThisLine / item.quantity : 0);
        effectivePricePaidPerUnitValue = Math.max(0, effectivePricePaidPerUnitValue);

        const unitsToStore: UnitDefinition = {
            baseUnit: productDetails?.units?.baseUnit || item.units?.baseUnit || "pcs",
            derivedUnits: productDetails?.units?.derivedUnits || item.units?.derivedUnits || [],
        };
        if (!unitsToStore.baseUnit) unitsToStore.baseUnit = "pcs";

        return {
            productId: item.id, name: productDetails?.name || item.name, price: originalItemPrice,
            category: productDetails?.category, imageUrl: productDetails?.imageUrl, units: unitsToStore,
            quantity: item.quantity, priceAtSale: originalItemPrice,
            effectivePricePaidPerUnit: effectivePricePaidPerUnitValue, totalDiscountOnLine: totalDiscountAppliedToThisLine,
            costPriceAtSale: item.costPrice || 0,
            batchId: item.selectedBatchId,
            batchNumber: item.selectedBatchNumber,
            customDiscountType: item.customDiscountType,
            customDiscountValue: item.customDiscountValue,
        };
     });
    
    const actualAmountPaidByCustomer = paymentDetails.amountPaid || 0;
    let creditOutstandingAmt: number | null = null;
    let creditPayStatus: CreditPaymentStatus | null = null;

    if (currentPaymentMethod === 'credit') {
        creditOutstandingAmt = Math.max(0, currentCalculatedTotal - actualAmountPaidByCustomer);
        if (creditOutstandingAmt <= 0.009) { 
            creditPayStatus = CreditPaymentStatusEnumSchema.Enum.FULLY_PAID;
            creditOutstandingAmt = 0; 
        } else if (actualAmountPaidByCustomer > 0) {
            creditPayStatus = CreditPaymentStatusEnumSchema.Enum.PARTIALLY_PAID;
        } else {
            creditPayStatus = CreditPaymentStatusEnumSchema.Enum.PENDING;
        }
    }


     const saleRecord: SaleRecordInput = {
        recordType: 'SALE' as SaleRecordType, billNumber: currentBillNumber,
        date: new Date().toISOString(), customerName: paymentDetails.customerName || null,
        customerId: paymentDetails.customerId || null,
        items: saleRecordItems, subtotalOriginal: currentSubtotalOriginal,
        totalItemDiscountAmount: currentTotalItemDiscount, totalCartDiscountAmount: currentTotalCartDiscount,
        netSubtotal: currentSubtotalOriginal - currentTotalItemDiscount - currentTotalCartDiscount,
        appliedDiscountSummary: currentAppliedDiscountSummary,
        activeDiscountSetId: currentActiveDiscountSetId || null,
        taxRate: currentTaxRate, taxAmount: currentCalculatedTax, totalAmount: currentCalculatedTotal,
        paymentMethod: currentPaymentMethod!,
        amountPaidByCustomer: actualAmountPaidByCustomer,
        changeDueToCustomer: paymentDetails.changeDue || 0,
        status: 'COMPLETED_ORIGINAL' as SaleStatus, returnedItemsLog: [], originalSaleRecordId: null,
        isCreditSale: currentPaymentMethod === 'credit',
        creditOutstandingAmount: creditOutstandingAmt,
        creditPaymentStatus: creditPayStatus,
        creditLastPaymentDate: actualAmountPaidByCustomer > 0 && currentPaymentMethod === 'credit' ? new Date().toISOString() : null,
     };

    if (!saleRecord.items || !Array.isArray(saleRecord.items) || saleRecord.items.length === 0) {
      console.error("Invalid saleRecord.items on client before sending (empty or invalid):", saleRecord.items);
      toast({
        title: "Client Error",
        description: "No valid sale items to save. Please check cart.",
        variant: "destructive",
        duration: 7000,
      });
      return;
    }

     try {
        const result = await saveSaleRecordAction(saleRecord, currentUser.id);
        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to save sale to server.");
        }
        
        // --- THE ONLY RELIABLE WAY: RE-FETCH FROM THE "SINGLE SOURCE OF TRUTH" ---
        const productsAfterSaleResult = await getAllProductsAction(currentUser.id);
        if (productsAfterSaleResult.success && productsAfterSaleResult.data) {
          dispatch(initializeAllProducts(productsAfterSaleResult.data));
        } else {
          toast({
            title: "Data Sync Warning",
            description: "Sale saved, but failed to refresh product stock data. Please refresh the page manually.",
            variant: "destructive",
          });
        }
        // --- END OF RE-FETCH ---

        let successMessage = `Paid Rs. ${actualAmountPaidByCustomer.toFixed(2)} via ${currentPaymentMethod}. Sale completed & saved. Bill: ${result.data?.billNumber || currentBillNumber}`;
        if (currentPaymentMethod === 'credit') {
            successMessage += `. Outstanding: Rs. ${(creditOutstandingAmt ?? 0).toFixed(2)}. Status: ${creditPayStatus || 'N/A'}`;
        }

        toast({
          title: "Payment Successful!",
          description: successMessage,
        });
      } catch (error) {
        console.error("Failed to save sale via server action:", error);
        toast({
          title: "Save Error",
          description: `Payment successful, but failed to save sale record. ${error instanceof Error ? error.message : 'Please check server logs.'}`,
          variant: "destructive",
          duration: 7000,
        });
      }

      // This should only run after all async operations are complete.
      dispatch(clearSale());
      setIsPaymentDialogOpen(false);
      setIsInlinePaymentView(false);
      setCurrentPaymentMethod(null);
      setCurrentBillNumber('');
      productSearchRef.current?.focusSearchInput();
  };

  const handleActiveDiscountSetChange = (setId: string) => {
    dispatch(setActiveDiscountSetId(setId === "none" ? null : setId));
    setIsDiscountPopoverOpen(false);
  };

  const handleOpenDiscountInfoDialog = useCallback((ruleInfo: AppliedRuleInfo) => {
    let originalConfig: SpecificDiscountRuleConfig | undefined = undefined;
    if (activeDiscountSet) {
        const ruleSourceType = ruleInfo.ruleType as keyof DiscountSet;
        const ruleContainer = activeDiscountSet[ruleSourceType as 'productConfigurations' | 'globalCartPriceRuleJson' | 'globalCartQuantityRuleJson' | 'defaultLineItemValueRuleJson' | 'defaultLineItemQuantityRuleJson' | 'defaultSpecificQtyThresholdRuleJson' | 'defaultSpecificUnitPriceThresholdRuleJson'];
        
        if (ruleInfo.ruleType.startsWith('product_config_')) {
            const prodConfig = activeDiscountSet.productConfigurations?.find(pc => pc.productId === ruleInfo.productIdAffected);
            if (prodConfig) {
                if (ruleInfo.ruleType === 'product_config_line_item_value' && prodConfig.lineItemValueRuleJson?.name === ruleInfo.sourceRuleName) originalConfig = prodConfig.lineItemValueRuleJson;
                else if (ruleInfo.ruleType === 'product_config_line_item_quantity' && prodConfig.lineItemQuantityRuleJson?.name === ruleInfo.sourceRuleName) originalConfig = prodConfig.lineItemQuantityRuleJson;
                else if (ruleInfo.ruleType === 'product_config_specific_qty_threshold' && prodConfig.specificQtyThresholdRuleJson?.name === ruleInfo.sourceRuleName) originalConfig = prodConfig.specificQtyThresholdRuleJson;
                else if (ruleInfo.ruleType === 'product_config_specific_unit_price' && prodConfig.specificUnitPriceThresholdRuleJson?.name === ruleInfo.sourceRuleName) originalConfig = prodConfig.specificUnitPriceThresholdRuleJson;
            }
        } else if (ruleInfo.ruleType.startsWith('campaign_default_')) {
            if (ruleInfo.ruleType === 'campaign_default_line_item_value' && activeDiscountSet.defaultLineItemValueRuleJson?.name === ruleInfo.sourceRuleName) originalConfig = activeDiscountSet.defaultLineItemValueRuleJson;
            else if (ruleInfo.ruleType === 'campaign_default_line_item_quantity' && activeDiscountSet.defaultLineItemQuantityRuleJson?.name === ruleInfo.sourceRuleName) originalConfig = activeDiscountSet.defaultLineItemQuantityRuleJson;
            else if (ruleInfo.ruleType === 'campaign_default_specific_qty_threshold' && activeDiscountSet.defaultSpecificQtyThresholdRuleJson?.name === ruleInfo.sourceRuleName) originalConfig = activeDiscountSet.defaultSpecificQtyThresholdRuleJson;
            else if (ruleInfo.ruleType === 'campaign_default_specific_unit_price' && activeDiscountSet.defaultSpecificUnitPriceThresholdRuleJson?.name === ruleInfo.sourceRuleName) originalConfig = activeDiscountSet.defaultSpecificUnitPriceThresholdRuleJson;
        }
         else if (ruleInfo.ruleType.startsWith('campaign_global_') && ruleContainer && typeof ruleContainer === 'object' && 'name' in ruleContainer && (ruleContainer as SpecificDiscountRuleConfig).name === ruleInfo.sourceRuleName) {
            originalConfig = ruleContainer as SpecificDiscountRuleConfig;
        }
    }
    setSelectedDiscountRuleForInfo({ rule: ruleInfo, config: originalConfig });
    setIsDiscountInfoDialogOpen(true);
  }, [activeDiscountSet]);

  const handleBarcodeScan = (data: string) => {
    if (isProcessingBarcode) return;
    const trimmedData = data?.trim();
    if (!trimmedData) return;
    
    setIsProcessingBarcode(true);
    setBarcodeError(null);

    const currentProducts = store.getState().sale.allProducts;
    const productFound = currentProducts.find(p => p.barcode === trimmedData);

    if (productFound) {
      if (productFound.isActive) {
        handleProductSelectionFromSearch(productFound);
      } else {
        toast({
            title: "Product Inactive",
            description: `${productFound.name} is inactive and cannot be added.`,
            variant: "destructive",
        });
      }
    } else {
        toast({
            title: "Barcode Not Found",
            description: `No product found with barcode: ${trimmedData}`,
            variant: "destructive",
        });
        setBarcodeError(trimmedData);
        setTimeout(() => setBarcodeError(null), 3000);
    }
    productSearchRef.current?.focusSearchInput();
    setIsProcessingBarcode(false);
  };

  const handleBarcodeError = (err: any) => {
    if (typeof err === 'string' && err.trim().length > 3 && /^\d+$/.test(err.trim())) {
        console.error("Barcode reader error:", err);
    }
  };

  const handleOpenCustomDiscountDialog = (item: SaleItem) => {
    setItemForCustomDiscount(item);
    setIsCustomDiscountDialogOpen(true);
  };

  const handleApplyCustomDiscount = (itemId: string, type: 'percentage' | 'fixed', value: number) => {
    dispatch(applyCustomDiscount({ saleItemId: itemId, type, value }));
  };

  const handleRemoveCustomDiscount = (itemId: string) => {
    dispatch(removeCustomDiscount({ saleItemId: itemId }));
  };

  // Conditional returns are now at the end
  if (authStatus === 'loading' || !currentUser || (isMounting && isClient)) {
    return (
        <div className="flex h-screen bg-background text-foreground font-body items-center justify-center">
            <div className="flex flex-col items-center space-y-3">
                <ShoppingBag className="h-16 w-16 text-primary animate-pulse" />
                <p className="text-xl text-muted-foreground">{authStatus === 'loading' ? 'Authenticating...' : 'Loading POS System...'}</p>
            </div>
        </div>
    );
  }
  
  if (isInlinePaymentView) {
    return (
      <div className="h-screen bg-background text-foreground font-body flex flex-col">
          <PaymentFormContent
              paymentMethod={currentPaymentMethod!}
              billNumber={currentBillNumber}
              onPaymentSuccess={handlePaymentSuccess}
              onBackToCart={() => setIsInlinePaymentView(false)}
          />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-body">
      {isClient && (
        <BarcodeReader
            onError={handleBarcodeError}
            onScan={handleBarcodeScan}
        />
      )}
      <div className="w-3/5 flex flex-col border-r border-border overflow-hidden">
        <header className="p-4 bg-card shadow-sm space-y-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
                <ShoppingBag className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-headline font-semibold">POS</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Link href="/dashboard" passHref>
                <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </Button>
              </Link>
            </div>
          </div>
          <ProductSearch
            ref={productSearchRef}
            onProductSelect={handleProductSelectionFromSearch}
            barcodeError={!!barcodeError}
          />
           {barcodeError && (
              <p className="text-sm text-orange-500 mt-1">Barcode not found: {barcodeError}</p>
            )}
        </header>
        <div className="flex-1 p-4 overflow-y-auto">
           <CurrentSaleItemsTable
             items={saleItems}
             onQuantityChange={handleQuantityChange}
             onRemoveItem={handleRemoveItem}
             onOpenCustomDiscountDialog={handleOpenCustomDiscountDialog}
           />
        </div>
      </div>

      <div className="w-2/5 flex flex-col bg-card">
        {isClient ? (
          <>
             <div className="p-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-card-foreground">Sale Summary</h2>
                <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-9 w-9 p-0">
                              <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                                  {currentUser?.username ? currentUser.username.charAt(0).toUpperCase() : 'G'}
                                  </AvatarFallback>
                              </Avatar>
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                          <DropdownMenuLabel className="font-normal">
                              <div className="flex flex-col space-y-1">
                                  <p className="text-sm font-medium leading-none">{currentUser.username}</p>
                                  <p className="text-xs leading-none text-muted-foreground">{currentUser.role?.name}</p>
                                  <p className="text-xs leading-none text-primary/80">{currentUser.company?.name || 'Super Admin'}</p>
                              </div>
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                              <DropdownMenuLabel className="text-xs">Checkout Mode</DropdownMenuLabel>
                              <DropdownMenuItem onSelect={() => handleCheckoutModeChange('popup')}>
                                  {checkoutMode === 'popup' ? <CheckSquare className="mr-2 h-4 w-4 text-primary" /> : <XCircle className="mr-2 h-4 w-4" />}
                                  <span>Popup Dialog</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleCheckoutModeChange('inline')}>
                                  {checkoutMode === 'inline' ? <CheckSquare className="mr-2 h-4 w-4 text-primary" /> : <XCircle className="mr-2 h-4 w-4" />}
                                  <span>Inline View</span>
                              </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setIsSettingsDialogOpen(true)}>
                              <SettingsIcon className="mr-2 h-4 w-4" />
                              <span>POS Screen Settings</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                           <AlertDialogTrigger asChild>
                               <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-400 focus:bg-destructive/20 focus:text-red-300">
                                  <LogOut className="mr-2 h-4 w-4" />
                                  <span>Logout</span>
                              </DropdownMenuItem>
                          </AlertDialogTrigger>
                      </DropdownMenuContent>
                  </DropdownMenu>
                   <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                          <AlertDialogDescription>
                              How would you like to proceed? Your shift will remain open.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-2">
                           <Button onClick={() => { router.push('/dashboard/cash-register'); setIsLogoutDialogOpen(false); }} className="w-full justify-center">
                              <DoorClosed className="mr-2 h-4 w-4" /> Go to End Shift Page
                            </Button>
                           <Button variant="secondary" onClick={() => { handleLogout(); setIsLogoutDialogOpen(false); }} className="w-full">
                              <LogOut className="mr-2 h-4 w-4" /> Logout Only (Keep Shift Open)
                            </Button>
                          <AlertDialogCancel className="w-full mt-2">Cancel</AlertDialogCancel>
                      </AlertDialogFooter>
                   </AlertDialogContent>
                </AlertDialog>
            </div>

            <div className="px-4 space-y-3">
                <div className="space-y-2">
                    <Label htmlFor="active-discount-set" className="text-sm font-medium">Active Discount Set</Label>
                    <Popover open={isDiscountPopoverOpen} onOpenChange={setIsDiscountPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={isDiscountPopoverOpen}
                                className="w-full justify-between bg-input border-border"
                            >
                                <span className="truncate">
                                    {activeDiscountSetId
                                    ? discountSets.find((ds) => ds.id === activeDiscountSetId)?.name
                                    : "No Discount Set Applied"}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Search discount set..." />
                                <CommandList>
                                    <CommandEmpty>No discount set found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem onSelect={() => handleActiveDiscountSetChange("none")}>
                                            <Check className={cn("mr-2 h-4 w-4", !activeDiscountSetId ? "opacity-100" : "opacity-0")} />
                                            <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
                                            No Discount Set
                                        </CommandItem>
                                        {discountSets.map((ds) => (
                                            <CommandItem
                                            key={ds.id}
                                            value={ds.name}
                                            onSelect={() => handleActiveDiscountSetChange(ds.id)}
                                            >
                                            <Check className={cn("mr-2 h-4 w-4", activeDiscountSetId === ds.id ? "opacity-100" : "opacity-0")}/>
                                            <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
                                            {ds.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
            <Separator className="bg-border my-4" />

            <div className="flex-1 p-4 pt-0 overflow-y-auto">
              {saleItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Your cart is empty.</p>
                  <p className="text-sm text-muted-foreground">Search for products to add them to the sale.</p>
                </div>
              ) : (
                 <SaleSummary
                    subtotalOriginal={subtotalOriginal}
                    totalItemDiscountAmount={calculatedDiscountsSelectorResult.totalItemDiscountAmount}
                    totalCartDiscountAmount={calculatedDiscountsSelectorResult.totalCartDiscountAmount}
                    tax={tax}
                    total={total}
                    taxRate={taxRate}
                    appliedDiscountSummary={appliedDiscountSummaryFromSelector}
                    onOpenDiscountInfoDialog={handleOpenDiscountInfoDialog}
                 />
              )}
            </div>

            <div className="p-4 space-y-3 sticky bottom-0 bg-card">
              {saleItems.length > 0 && <Separator className="bg-border mb-3" />}
              <div className="grid grid-cols-1 gap-2">
                <Button onClick={handleNewSale} variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground" disabled={saleItems.length === 0}>
                  <PlusCircle className="mr-2 h-4 w-4" /> New Sale
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button onClick={() => handleOpenPaymentDialog('cash')} className="bg-green-500 hover:bg-green-600 text-white py-3" disabled={saleItems.length === 0 || saleItems.every(item => item.quantity <=0)}>
                  <DollarSign className="mr-2 h-4 w-4" /> Cash
                </Button>
                <Button onClick={() => handleOpenPaymentDialog('credit')} className="bg-blue-500 hover:bg-blue-500 text-white py-3" disabled={saleItems.length === 0 || saleItems.every(item => item.quantity <=0)}>
                  <CreditCard className="mr-2 h-4 w-4" /> Credit / Card
                </Button>
              </div>
              <div className="mt-2">
                <Link href="/returns" passHref>
                  <Button variant="outline" className="w-full border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-white">
                    <ArchiveRestore className="mr-2 h-4 w-4" /> Return Item
                  </Button>
                </Link>
              </div>
            </div>
          </>
        ) : (
            <>
            <div className="p-4 space-y-3">
              <h2 className="text-xl font-semibold text-card-foreground">Sale Summary</h2>
              <div className="space-y-2">
                <Label htmlFor="active-discount-set" className="text-sm font-medium">Active Discount Set</Label>
                <div className="w-full h-10 rounded-md border border-input bg-input animate-pulse" aria-label="Loading discount sets..."></div>
              </div>
            </div>
            <Separator className="bg-border my-0" />
            <div className="flex-1 p-4 overflow-y-auto flex flex-col items-center justify-center text-center">
                <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Loading POS...</p>
            </div>
            <div className="p-4 border-t border-border space-y-3 sticky bottom-0 bg-card">
              <div className="grid grid-cols-1 gap-2">
                <div className="w-full h-10 rounded-md border border-primary bg-primary/20 animate-pulse"></div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="w-full h-10 rounded-md bg-green-500/50 animate-pulse"></div>
                <div className="w-full h-10 rounded-md bg-blue-500/50 animate-pulse"></div>
              </div>
               <div className="mt-2">
                <div className="w-full h-10 rounded-md border border-amber-500 bg-amber-500/20 animate-pulse"></div>
              </div>
            </div>
          </>
        )}
      </div>

      <SettingsDialog
        isOpen={isSettingsDialogOpen}
        onOpenChange={setIsSettingsDialogOpen}
      />
      {selectedDiscountRuleForInfo && (
        <DiscountInfoDialog
            isOpen={isDiscountInfoDialogOpen}
            onOpenChange={setIsDiscountInfoDialogOpen}
            ruleInfo={selectedDiscountRuleForInfo.rule}
            ruleConfig={selectedDiscountRuleForInfo.config}
        />
      )}
      {checkoutMode === 'popup' && currentPaymentMethod && (
        <PaymentDialog
            isOpen={isPaymentDialogOpen}
            onOpenChange={setIsPaymentDialogOpen}
            paymentMethod={currentPaymentMethod}
            billNumber={currentBillNumber}
            onPaymentSuccess={handlePaymentSuccess}
        />
      )}
      <ApplyCustomDiscountDialog
        isOpen={isCustomDiscountDialogOpen}
        onOpenChange={setIsCustomDiscountDialogOpen}
        item={itemForCustomDiscount}
        onApplyDiscount={handleApplyCustomDiscount}
        onRemoveDiscount={handleRemoveCustomDiscount}
      />
    </div>
  );
}
