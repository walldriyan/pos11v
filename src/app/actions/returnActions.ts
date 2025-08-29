
'use server';

import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ReturnedItemDetailSchema, UnitDefinitionSchema } from '@/lib/zodSchemas';
import type { SaleRecord as SaleRecordType, ReturnedItemDetail as ReturnedItemDetailType, SaleRecordItem, SaleRecordInput, SaleItem, UnitDefinition, DiscountSet } from '@/types';
import { saveSaleRecordAction } from '@/app/actions/saleActions';
import { calculateDiscountsForItems } from '@/lib/discountUtils';
import { getDiscountSetsAction, getTaxRateAction } from '@/app/actions/settingsActions';
import { getAllProductsAction as fetchAllProductsForServerLogic } from '@/app/actions/productActions';

interface ReturnProcessingInput {
  pristineOriginalSaleId: string;
  currentActiveSaleStateId: string;
  itemsToReturn: {
    productId: string;
    returnQuantity: number;
    effectivePricePaidPerUnit: number;
    name: string;
    units: UnitDefinition;
    priceAtSale: number;
    originalBatchId?: string | null; 
  }[];
}


export async function processFullReturnWithRecalculationAction(
  input: ReturnProcessingInput,
  userId: string,
): Promise<{ success: boolean; data?: { returnTransactionId: string; adjustedSaleId: string; }; error?: string }> {
  if (!userId) {
    return { success: false, error: 'User not authenticated.' };
  }

  const { pristineOriginalSaleId, currentActiveSaleStateId, itemsToReturn } = input;

  if (itemsToReturn.length === 0) {
    return { success: false, error: 'No items specified for return.' };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.companyId) {
      return { success: false, error: 'Cannot process return: User is not associated with a company.' };
    }
    const actorCompanyId = user.companyId;

    const allProductsForCalcResult = await fetchAllProductsForServerLogic(userId);
    if (!allProductsForCalcResult.success || !allProductsForCalcResult.data) {
      throw new Error("Failed to fetch products for discount recalculation.");
    }
    const allProductsForCalc = allProductsForCalcResult.data;

    const allDiscountSetsResult = await getDiscountSetsAction(userId);
    if (!allDiscountSetsResult.success || !allDiscountSetsResult.data) {
      throw new Error("Failed to fetch discount sets for recalculation.");
    }
    const allDiscountSetsForCalc = allDiscountSetsResult.data;
    
    // Fetch global tax rate from the DB
    const taxRateResult = await getTaxRateAction();
    if (!taxRateResult.success || taxRateResult.data === undefined) {
      throw new Error("Failed to fetch global tax rate for recalculation.");
    }
    const globalTaxRate = taxRateResult.data.value;


    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch the state needed for the transaction
      const pristineOriginalSale = await tx.saleRecord.findUnique({ where: { id: pristineOriginalSaleId } });
      const currentActiveSaleState = await tx.saleRecord.findUnique({ where: { id: currentActiveSaleStateId } });

      if (!pristineOriginalSale || !currentActiveSaleState) {
        throw new Error("Original or current sale state not found.");
      }

      // **FIX**: Get the companyId from the original sale to apply to new records.
      const companyId = pristineOriginalSale.companyId;
      if (!companyId || companyId !== actorCompanyId) {
        throw new Error("Could not determine the company for this transaction or permission denied. Original sale is missing a company ID or does not belong to your company.");
      }
      
      const originalSaleItems = pristineOriginalSale.items as unknown as SaleRecordItem[];

      const activeDiscountSetForOriginalSale = pristineOriginalSale.activeDiscountSetId
            ? allDiscountSetsForCalc.find(ds => ds.id === pristineOriginalSale.activeDiscountSetId)
            : null;

      // 2. Create the Return Transaction Record
      let totalRefundFromThisTransaction = 0;
      const itemsBeingReturnedInThisTransaction: SaleRecordItem[] = itemsToReturn.map(item => {
        // Find the corresponding item in the *original* sale to get the price the customer *actually* paid.
        const originalItemFromPristineSale = originalSaleItems.find(
            origItem => origItem.productId === item.productId && origItem.batchId === item.originalBatchId
        );
        // The refund amount should be based on what was ACTUALLY paid per unit, not the original selling price.
        const refundAmountPerUnit = originalItemFromPristineSale?.effectivePricePaidPerUnit ?? 0;
        
        const refundForThisItemLine = refundAmountPerUnit * item.returnQuantity;
        totalRefundFromThisTransaction += refundForThisItemLine;
        
        const originalProduct = allProductsForCalc.find(p => p.id === item.productId);
        const originalBatch = originalProduct?.batches?.find(b => b.id === item.originalBatchId);

        return {
          productId: item.productId,
          name: item.name,
          quantity: item.returnQuantity,
          priceAtSale: item.priceAtSale,
          effectivePricePaidPerUnit: refundAmountPerUnit, // This is the refund amount per unit
          totalDiscountOnLine: 0, // Not relevant for the return receipt itself
          price: item.priceAtSale, // Original price for record keeping
          units: item.units,
          batchId: item.originalBatchId, 
          batchNumber: originalBatch?.batchNumber,
          costPriceAtSale: 0, // Not relevant for return transaction record
        };
      });

      const returnTransactionRecord = await tx.saleRecord.create({
        data: {
          recordType: 'RETURN_TRANSACTION',
          billNumber: `RTN-${pristineOriginalSale.billNumber}-${Date.now().toString().slice(-5)}`,
          date: new Date(),
          customerId: pristineOriginalSale.customerId,
          isCreditSale: false,
          items: itemsBeingReturnedInThisTransaction as Prisma.JsonValue,
          subtotalOriginal: itemsBeingReturnedInThisTransaction.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0),
          totalItemDiscountAmount: 0,
          totalCartDiscountAmount: 0,
          netSubtotal: totalRefundFromThisTransaction,
          appliedDiscountSummary: [],
          activeDiscountSetId: pristineOriginalSale.activeDiscountSetId,
          taxRate: 0,
          taxAmount: 0,
          totalAmount: totalRefundFromThisTransaction,
          paymentMethod: 'REFUND',
          status: 'RETURN_TRANSACTION_COMPLETED',
          originalSaleRecordId: pristineOriginalSale.id,
          createdByUserId: userId,
          companyId: companyId, // **FIX**: Associate with company
        }
      });
      const newReturnTransactionId = returnTransactionRecord.id;

      // 3. Update stock for returned items
      for (const item of itemsToReturn) {
        const productForStock = await tx.product.findUnique({ where: { id: item.productId }});
        if (productForStock && !productForStock.isService) {
          const batchToReturnTo = item.originalBatchId ? 
              await tx.productBatch.findUnique({ where: { id: item.originalBatchId } }) : 
              null;

          if(batchToReturnTo){
               await tx.productBatch.update({
                  where: { id: batchToReturnTo.id },
                  data: { quantity: { increment: item.returnQuantity } },
              });
          } else {
             // Fallback: If original batch is gone or wasn't specified, add to a generic "RETURNED_STOCK" batch
              const existingReturnBatch = await tx.productBatch.findFirst({
                where: { productId: item.productId, batchNumber: 'RETURNED_STOCK' },
              });

              if (existingReturnBatch) {
                await tx.productBatch.update({ where: { id: existingReturnBatch.id }, data: { quantity: { increment: item.returnQuantity } } });
              } else {
                await tx.productBatch.create({
                  data: { 
                    productId: item.productId, 
                    batchNumber: 'RETURNED_STOCK', 
                    quantity: item.returnQuantity, 
                    costPrice: item.effectivePricePaidPerUnit, // Approximate cost with refund value
                    sellingPrice: item.priceAtSale, 
                    expiryDate: null 
                  },
                });
              }
          }
        }
      }

      // 4. Prepare and Recalculate the new ADJUSTED_ACTIVE sale state
      const newReturnLogEntries: ReturnedItemDetailType[] = itemsToReturn.map(item => {
         const originalItemFromPristineSale = originalSaleItems.find(
            origItem => origItem.productId === item.productId && origItem.batchId === item.originalBatchId
        );
        const refundAmountPerUnit = originalItemFromPristineSale?.effectivePricePaidPerUnit ?? 0;
        
        return {
            id: `log-${newReturnTransactionId}-${item.productId}-${item.originalBatchId || 'nobatch'}`,
            itemId: item.productId, name: item.name,
            returnedQuantity: item.returnQuantity,
            units: item.units,
            refundAmountPerUnit: refundAmountPerUnit, // What was actually paid
            totalRefundForThisReturnEntry: refundAmountPerUnit * item.returnQuantity,
            returnDate: new Date().toISOString(),
            returnTransactionId: newReturnTransactionId,
            processedByUserId: userId,
            isUndone: false,
            originalBatchId: item.originalBatchId,
        };
      });
      
      const existingValidLogs = ((currentActiveSaleState.returnedItemsLog as Prisma.JsonArray) || []).filter((log: any) => log && !log.isUndone) as ReturnedItemDetailType[];
      
      const combinedReturnLogs = [...existingValidLogs, ...newReturnLogEntries];

      const pristineItems = pristineOriginalSale.items as unknown as SaleRecordItem[];
      const keptItems: SaleRecordItem[] = [];

      pristineItems.forEach(originalItem => {
          let totalReturnedForThisLineItem = 0;
          combinedReturnLogs.forEach(log => {
            // Match both product and the batch it came from
            if (log.itemId === originalItem.productId && log.originalBatchId === originalItem.batchId) {
                totalReturnedForThisLineItem += log.returnedQuantity;
            }
          });
          const keptQuantity = originalItem.quantity - totalReturnedForThisLineItem;
          if (keptQuantity > 0) {
            keptItems.push({ ...originalItem, quantity: keptQuantity });
          }
      });
      
      const keptItemsAsSaleItemsForCalc: SaleItem[] = keptItems.map(item => {
        const productInfo = allProductsForCalc.find(p => p.id === item.productId);
        const batchInfo = productInfo?.batches?.find(b => b.id === item.batchId);
        return {
          id: item.productId, name: item.name, price: batchInfo?.sellingPrice || productInfo?.sellingPrice || item.priceAtSale, stock: productInfo?.stock || 0,
          category: productInfo?.category, imageUrl: productInfo?.imageUrl, units: (productInfo?.units as UnitDefinition) || item.units,
          defaultQuantity: productInfo?.defaultQuantity || 1, isActive: productInfo?.isActive || true,
          isService: productInfo?.isService || false, productSpecificTaxRate: productInfo?.productSpecificTaxRate,
          costPrice: item.costPriceAtSale, quantity: item.quantity, description: productInfo?.description,
          barcode: productInfo?.barcode, code: productInfo?.code,
          sellingPrice: batchInfo?.sellingPrice || productInfo?.sellingPrice || item.priceAtSale,
          saleItemId: `sale-item-${item.productId}`, // dummy id
          // **BUG FIX**: Pass the original custom discount info for recalculation
          customDiscountType: item.customDiscountType,
          customDiscountValue: item.customDiscountValue,
        };
      });

      // Recalculate discounts for the items that are kept
      const discountResultsForKeptItems = calculateDiscountsForItems({
        saleItems: keptItemsAsSaleItemsForCalc,
        activeCampaign: activeDiscountSetForOriginalSale,
        allProducts: allProductsForCalc,
      });

      const updatedItemsKeptItems: SaleRecordItem[] = keptItems.map(keptItem => {
        const productDetails = allProductsForCalc.find(p => p.id === keptItem.productId);
        const batchDetails = productDetails?.batches?.find(b => b.id === keptItem.batchId);
        const originalSellingPrice = batchDetails?.sellingPrice ?? productDetails?.sellingPrice ?? keptItem.priceAtSale;

        const itemDiscountInfo = discountResultsForKeptItems.itemDiscounts.get(keptItem.productId);
        
        let calculatedDiscountForLine = itemDiscountInfo?.totalCalculatedDiscountForLine ?? 0;
        
        let effectivePricePaidPerUnit = originalSellingPrice;
        if (calculatedDiscountForLine > 0 && keptItem.quantity > 0) {
          effectivePricePaidPerUnit = originalSellingPrice - (calculatedDiscountForLine / keptItem.quantity);
        }
        return {
            ...keptItem,
            price: originalSellingPrice,
            priceAtSale: originalSellingPrice,
            effectivePricePaidPerUnit: Math.max(0, effectivePricePaidPerUnit),
            totalDiscountOnLine: calculatedDiscountForLine,
        };
      });
      
      const adjSubtotalOriginal = updatedItemsKeptItems.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
      const adjTotalItemDiscount = discountResultsForKeptItems.totalItemDiscountAmount;
      
      const subtotalNetOfItemDiscounts = adjSubtotalOriginal - adjTotalItemDiscount;
      
      let adjTotalCartDiscountAmount = discountResultsForKeptItems.totalCartDiscountAmount;

      const adjNetSubtotal = subtotalNetOfItemDiscounts - adjTotalCartDiscountAmount;
      const taxRateForAdjusted = (pristineOriginalSale.taxRate as number) ?? 0;
      
      let adjTaxAmount = 0;
      updatedItemsKeptItems.forEach(item => {
          const productDetails = allProductsForCalc.find(p => p.id === item.productId);
          if (!productDetails) return;
          const itemNetValueAfterItemDiscount = (item.priceAtSale * item.quantity) - item.totalDiscountOnLine;
          let itemProportionalCartDiscount = 0;
          if (subtotalNetOfItemDiscounts > 0 && adjTotalCartDiscountAmount > 0) {
            itemProportionalCartDiscount = (itemNetValueAfterItemDiscount / subtotalNetOfItemDiscounts) * adjTotalCartDiscountAmount;
          }
          const finalValueForTax = itemNetValueAfterItemDiscount - itemProportionalCartDiscount;
          const taxRateForItemAsDecimal = ((productDetails.productSpecificTaxRate ?? globalTaxRate) || taxRateForAdjusted) / 100;
          adjTaxAmount += Math.max(0, finalValueForTax) * taxRateForItemAsDecimal;
      });

      const adjTotalAmount = adjNetSubtotal + Math.max(0, adjTaxAmount);

      const isFirstAdjustment = currentActiveSaleState.id === pristineOriginalSale.id;
      const adjustedSaleBillNumber = isFirstAdjustment 
            ? `${pristineOriginalSale.billNumber}-ADJ-${Date.now().toString().slice(-4)}` 
            : currentActiveSaleState.billNumber;

      const creditOutstandingAmt = pristineOriginalSale.isCreditSale ? Math.max(0, adjTotalAmount - ((pristineOriginalSale.amountPaidByCustomer as number) || 0)) : null;
      const creditPayStatus = pristineOriginalSale.isCreditSale 
          ? ( creditOutstandingAmt <= 0.009 ? 'FULLY_PAID' : (((pristineOriginalSale.amountPaidByCustomer as number) || 0) > 0 || totalRefundFromThisTransaction > 0 ? 'PARTIALLY_PAID' : 'PENDING') ) 
          : null;


      const adjustedSaleRecord = await tx.saleRecord.upsert({
          where: { id: isFirstAdjustment ? 'this-id-wont-exist' : currentActiveSaleState.id }, // Hack to force create on first adjustment
          create: {
              billNumber: adjustedSaleBillNumber,
              recordType: 'SALE', status: 'ADJUSTED_ACTIVE',
              isCreditSale: pristineOriginalSale.isCreditSale as boolean,
              date: new Date(),
              customerId: pristineOriginalSale.customerId,
              items: updatedItemsKeptItems as any,
              subtotalOriginal: adjSubtotalOriginal,
              totalItemDiscountAmount: adjTotalItemDiscount,
              totalCartDiscountAmount: adjTotalCartDiscountAmount,
              netSubtotal: adjNetSubtotal,
              appliedDiscountSummary: discountResultsForKeptItems.fullAppliedDiscountSummary as any,
              activeDiscountSetId: pristineOriginalSale.activeDiscountSetId,
              taxRate: taxRateForAdjusted,
              taxAmount: adjTaxAmount,
              totalAmount: adjTotalAmount,
              paymentMethod: pristineOriginalSale.paymentMethod as any,
              amountPaidByCustomer: (pristineOriginalSale.amountPaidByCustomer as number | undefined),
              changeDueToCustomer: (pristineOriginalSale.changeDueToCustomer as number | undefined),
              returnedItemsLog: combinedReturnLogs as any,
              originalSaleRecordId: pristineOriginalSale.id,
              creditOutstandingAmount: creditOutstandingAmt,
              creditPaymentStatus: creditPayStatus,
              creditLastPaymentDate: (pristineOriginalSale.creditLastPaymentDate as any),
              paymentInstallments: (pristineOriginalSale.paymentInstallments as any[] | undefined),
              createdByUserId: userId,
              companyId: companyId, // **FIX**: Associate with company
          },
          update: {
              date: new Date(),
              items: updatedItemsKeptItems as any,
              subtotalOriginal: adjSubtotalOriginal,
              totalItemDiscountAmount: adjTotalItemDiscount,
              totalCartDiscountAmount: adjTotalCartDiscountAmount,
              netSubtotal: adjNetSubtotal,
              appliedDiscountSummary: discountResultsForKeptItems.fullAppliedDiscountSummary as any,
              taxAmount: adjTaxAmount,
              totalAmount: adjTotalAmount,
              returnedItemsLog: combinedReturnLogs as any,
              creditOutstandingAmount: creditOutstandingAmt,
              creditPaymentStatus: creditPayStatus,
          }
      });
      
      if (isFirstAdjustment) {
        await tx.saleRecord.update({
          where: { id: pristineOriginalSale.id },
          data: { status: 'COMPLETED_ORIGINAL' } 
        });
      }

      return { returnTransactionId: newReturnTransactionId, adjustedSaleId: adjustedSaleRecord.id };
    }, {
      maxWait: 15000,
      timeout: 30000,
    });

    return { success: true, data: result };

  } catch (error: any) {
    console.error('Error in processReturnAction transaction:', error);
    let errorMessage = 'An unexpected error occurred during the return process.';
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      errorMessage = `Database error (Code: ${error.code}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}
    
