
'use server';
import prisma from '@/lib/prisma';
import { updateProductStockAction } from '@/app/actions/productActions';
import { StockAdjustmentFormSchema } from '@/lib/zodSchemas';
import type { StockAdjustmentFormData } from '@/types';

export async function adjustStockAction(
  data: Omit<StockAdjustmentFormData, 'userId'>,
  userId: string
): Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }> {
  
  if (!userId) {
    return { success: false, error: 'User not authenticated. Cannot adjust stock.' };
  }
  
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.companyId) {
    return { success: false, error: "User is not associated with a company." };
  }
  const companyId = user.companyId;

  const validationResult = StockAdjustmentFormSchema.omit({userId: true}).safeParse(data);
  if (!validationResult.success) {
    return { success: false, error: "Validation failed.", fieldErrors: validationResult.error.flatten().fieldErrors };
  }

  const { productId, quantity, reason, notes } = validationResult.data;

  // Verify the product belongs to the user's company before adjusting
  const productToAdjust = await prisma.product.findFirst({
    where: { id: productId, companyId: companyId },
    include: { batches: true },
  });
  if (!productToAdjust) {
    return { success: false, error: "Product not found in your company." };
  }

  const currentTotalStock = productToAdjust.batches.reduce((sum, b) => sum + b.quantity, 0);

  let changeInStock = 0;
  switch (reason) {
    case 'LOST':
    case 'DAMAGED':
    case 'CORRECTION_SUBTRACT':
      changeInStock = -Math.abs(quantity);
       if (currentTotalStock < Math.abs(changeInStock)) {
         return { success: false, error: `Cannot subtract ${Math.abs(changeInStock)}. Only ${currentTotalStock} in stock.` };
      }
      break;
    case 'CORRECTION_ADD':
      changeInStock = Math.abs(quantity);
      break;
    default:
      return { success: false, error: "Invalid adjustment reason." };
  }

  const updateResult = await updateProductStockAction(productId, changeInStock, userId);

  if (!updateResult.success) {
    return { success: false, error: updateResult.error || "Failed to update product stock." };
  }

  try {
    await prisma.stockAdjustmentLog.create({
      data: {
        productId,
        quantityChanged: changeInStock,
        reason,
        notes,
        userId: userId,
        companyId: companyId, // Log the company for the adjustment
        adjustedAt: new Date(),
      }
    });
  } catch (logError) {
    console.error("Failed to log stock adjustment:", logError);
    // Even if logging fails, the stock was updated, so we might not want to return a hard error.
    // This could be enhanced with more robust logging.
  }

  return { success: true };
}
