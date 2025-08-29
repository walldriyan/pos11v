
'use server';

import prisma from '@/lib/prisma';
import { PurchaseBillCreateInputSchema, PurchaseBillStatusEnumSchema, PurchasePaymentMethodEnumSchema, PurchasePaymentCreateInputSchema } from '@/lib/zodSchemas';
import type { PurchaseBill, PurchaseBillCreateInput, Party, PurchasePayment, PurchaseBillStatusEnum } from '@/types';
import { Prisma } from '@prisma/client';

async function getCurrentUserAndCompanyId(userId: string): Promise<{ companyId: string | null }> {
    if (userId === 'root-user') {
      return { companyId: null };
    }
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true, role: { select: { name: true } } }
    });

    // A user must exist.
    if (!user) {
        throw new Error("User not found.");
    }

    // If the user is a Super Admin (role 'Admin'), they might not have a companyId.
    // In this specific context (purchases), they can't create bills without one,
    // but we shouldn't throw a generic error here. Let the calling action handle it.
    if (user.role?.name === 'Admin') {
        return { companyId: user.companyId };
    }
    
    // For any other user, a companyId is mandatory.
    if (!user.companyId) {
        throw new Error("User is not associated with a company.");
    }

    return { companyId: user.companyId };
}


// Helper to map Prisma PurchaseBill to our PurchaseBillType
function mapPrismaPurchaseBillToType(
  prismaPurchaseBill: Prisma.PurchaseBillGetPayload<{ include: { supplier: true, items: true, payments: true } }>
): PurchaseBill {
  return {
    ...prismaPurchaseBill,
    purchaseDate: prismaPurchaseBill.purchaseDate.toISOString(),
    createdAt: prismaPurchaseBill.createdAt?.toISOString(),
    updatedAt: prismaPurchaseBill.updatedAt?.toISOString(),
    items: prismaPurchaseBill.items.map((item: any) => ({
        ...item,
    })),
    payments: prismaPurchaseBill.payments?.map((p:any) => ({
      ...p,
      paymentDate: p.paymentDate.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })) || [],
    paymentStatus: prismaPurchaseBill.paymentStatus as PurchaseBillStatusEnum,
  };
}


export async function createPurchaseBillAction(
  purchaseData: unknown,
  userId: string
): Promise<{ success: boolean; data?: PurchaseBill; error?: string; fieldErrors?: Record<string, string[]> }> {
  const actionExecutionTime = new Date().toISOString();
  console.log(`[${actionExecutionTime}] --- START: createPurchaseBillAction ---`);

  if (!prisma) {
    const errorMsg = `[${actionExecutionTime}] ERROR: Prisma instance is NULL or UNDEFINED.`;
    console.error(errorMsg);
    return { success: false, error: "Prisma client is not available. This is a severe server misconfiguration." };
  }
   if (!userId) {
    return { success: false, error: "User is not authenticated. Cannot create purchase bill." };
  }

  const validationResult = PurchaseBillCreateInputSchema.safeParse(purchaseData);
  if (!validationResult.success) {
    const fieldErrors = validationResult.error.flatten().fieldErrors;
    console.error(`[${actionExecutionTime}] ERROR: Validation failed. Errors:`, JSON.stringify(fieldErrors, null, 2));
    return { success: false, error: "Validation failed for purchase bill.", fieldErrors };
  }
  const validatedData = validationResult.data;

  try {
    const { companyId } = await getCurrentUserAndCompanyId(userId);
    if (!companyId) {
        return { success: false, error: "Cannot create a purchase bill. The user is not associated with a specific company."};
    }

    const totalAmount = validatedData.items.reduce((sum, item) => {
      return sum + (item.quantityPurchased * item.costPriceAtPurchase);
    }, 0);

    const amountActuallyPaid = validatedData.amountPaid ?? 0;
    let finalPaymentStatus: PurchaseBillStatusEnum;

    if (totalAmount === 0) {
      finalPaymentStatus = PurchaseBillStatusEnumSchema.Enum.DRAFT;
    } else if (amountActuallyPaid >= totalAmount) {
        finalPaymentStatus = PurchaseBillStatusEnumSchema.Enum.PAID;
    } else if (amountActuallyPaid > 0 && amountActuallyPaid < totalAmount) {
        finalPaymentStatus = PurchaseBillStatusEnumSchema.Enum.PARTIALLY_PAID;
    } else {
        finalPaymentStatus = PurchaseBillStatusEnumSchema.Enum.COMPLETED;
    }

    const newPurchaseBill = await prisma.$transaction(async (tx) => {
      console.log(`[${actionExecutionTime}] DB Transaction Started.`);

      const createdBill = await tx.purchaseBill.create({
        data: {
          supplierId: validatedData.supplierId!,
          supplierBillNumber: validatedData.supplierBillNumber,
          purchaseDate: new Date(validatedData.purchaseDate),
          notes: validatedData.notes,
          totalAmount: totalAmount,
          amountPaid: amountActuallyPaid,
          paymentStatus: finalPaymentStatus,
          createdByUserId: userId,
          companyId: companyId, // Associate with user's company
          items: {
            create: validatedData.items.map((item) => ({
              productId: item.productId,
              productNameAtPurchase: '', // Will be updated below
              quantityPurchased: item.quantityPurchased,
              costPriceAtPurchase: item.costPriceAtPurchase,
              subtotal: item.quantityPurchased * item.costPriceAtPurchase,
            })),
          },
        },
        include: { items: true, supplier: true, payments: true },
      });
      console.log(`[${actionExecutionTime}] PurchaseBill Header created. ID: ${createdBill.id}`);

      if (amountActuallyPaid > 0 && validatedData.initialPaymentMethod) {
        await tx.purchasePayment.create({
            data: {
                purchaseBillId: createdBill.id,
                paymentDate: new Date(validatedData.purchaseDate),
                amountPaid: amountActuallyPaid,
                method: validatedData.initialPaymentMethod,
                reference: validatedData.paymentReference,
                notes: validatedData.paymentNotes,
                recordedByUserId: userId,
            }
        });
        console.log(`[${actionExecutionTime}] Initial payment of Rs. ${amountActuallyPaid.toFixed(2)} recorded.`);
      }

      for (const itemInput of validatedData.items) {
        console.log(`[${actionExecutionTime}] Processing item: ProductID ${itemInput.productId}`);
        const product = await tx.product.findUnique({ where: { id: itemInput.productId } });
        if (!product) {
          const errorMsg = `[${actionExecutionTime}] ERROR: Product with ID ${itemInput.productId} not found. Rolling back transaction.`;
          console.error(errorMsg);
          throw new Error(`Product with ID ${itemInput.productId} not found during purchase.`);
        }

        await tx.purchaseBillItem.updateMany({
            where: { purchaseBillId: createdBill.id, productId: itemInput.productId },
            data: { productNameAtPurchase: product.name },
        });

        // NEW: Update selling price if it was changed on the GRN form
        if (itemInput.currentSellingPrice !== undefined && itemInput.currentSellingPrice !== null && itemInput.currentSellingPrice !== product.sellingPrice) {
            await tx.product.update({
                where: { id: itemInput.productId },
                data: { sellingPrice: itemInput.currentSellingPrice },
            });
            console.log(`[${actionExecutionTime}] Default selling price for ${product.name} updated to Rs. ${itemInput.currentSellingPrice.toFixed(2)}.`);
        }

        if (product.isService) {
            console.log(`[${actionExecutionTime}] Product ${product.name} is a service. Skipping stock update.`);
            continue;
        }

        // The core logic change: Create a new batch with its own selling price
        await tx.productBatch.create({
            data: {
                productId: itemInput.productId,
                purchaseBillItemId: createdBill.items.find(i => i.productId === itemInput.productId)!.id,
                batchNumber: itemInput.batchNumber || null,
                quantity: itemInput.quantityPurchased,
                costPrice: itemInput.costPriceAtPurchase,
                sellingPrice: itemInput.currentSellingPrice || product.sellingPrice, // Use new price or fallback to current
                expiryDate: itemInput.expiryDate ? new Date(itemInput.expiryDate) : null,
            }
        });
        console.log(`[${actionExecutionTime}] New batch created for ${product.name} with quantity ${itemInput.quantityPurchased}.`);
      }

      console.log(`[${actionExecutionTime}] Refetching final bill.`);
      const finalBill = await tx.purchaseBill.findUnique({
          where: { id: createdBill.id },
          include: {
              items: { include: { product: {select: { name: true}}}},
              supplier: true,
              payments: true,
          }
      });
       if (!finalBill) {
           const errorMsg = `[${actionExecutionTime}] ERROR: Failed to refetch created bill.`;
           console.error(errorMsg);
           throw new Error("Failed to refetch the created purchase bill.");
       }
      console.log(`[${actionExecutionTime}] --- Transaction Succeeded. ---`);
      return finalBill;
    });

    return { success: true, data: mapPrismaPurchaseBillToType(newPurchaseBill) };
  } catch (error: any) {
    const errorMessage = `[${actionExecutionTime}] CRITICAL ERROR in createPurchaseBillAction: ${error.message}`;
    console.error(errorMessage, error.stack);
    let clientErrorMessage = 'Failed to create purchase bill.';
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        clientErrorMessage = `Database error: ${error.message} (Code: ${error.code})`;
    } else if (error instanceof Error) {
        clientErrorMessage = error.message;
    }
    return { success: false, error: clientErrorMessage };
  } finally {
      console.log(`[${actionExecutionTime}] --- END: createPurchaseBillAction ---`);
  }
}


export async function getAllSuppliersAction(userId: string): Promise<{ success: boolean; data?: Party[]; error?: string }> {
  if (!userId) {
    return { success: false, error: "User not authenticated. Cannot fetch suppliers." };
  }
  try {
    const { companyId } = await getCurrentUserAndCompanyId(userId);
    if (!companyId) {
      // Super admin without a company or root user sees no suppliers, as they are company-specific. This is not an error.
      return { success: true, data: [] };
    }
    const suppliers = await prisma.party.findMany({
      where: { companyId: companyId, type: 'SUPPLIER', isActive: true },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: suppliers as Party[] };
  } catch (error: any) {
    console.error(`Error fetching suppliers:`, error);
    return { success: false, error: error.message || 'Failed to fetch suppliers.' };
  }
}

export async function getUnpaidOrPartiallyPaidPurchaseBillsAction(
  userId: string,
  limit: number = 50,
  filters?: {
    supplierId?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
  }
): Promise<{ success: boolean; data?: PurchaseBill[]; error?: string }> {
   if (!userId) {
    return { success: false, error: "User not authenticated." };
  }
  try {
    const { companyId } = await getCurrentUserAndCompanyId(userId);
     if (!companyId) {
      return { success: true, data: [] };
    }

    const whereClause: Prisma.PurchaseBillWhereInput = {
      companyId: companyId, // Filter by company
      paymentStatus: {
        in: [PurchaseBillStatusEnumSchema.Enum.COMPLETED, PurchaseBillStatusEnumSchema.Enum.PARTIALLY_PAID],
      },
    };

    if (filters?.supplierId && filters.supplierId !== 'all') {
      whereClause.supplierId = filters.supplierId;
    }

    const dateFilter: Prisma.DateTimeFilter = {};
    if (filters?.startDate) {
      dateFilter.gte = filters.startDate;
    }
    if (filters?.endDate) {
      dateFilter.lte = filters.endDate;
    }
    if (Object.keys(dateFilter).length > 0) {
      whereClause.purchaseDate = dateFilter;
    }

    const unpaidBills = await prisma.purchaseBill.findMany({
      where: whereClause,
      include: { supplier: true, items: true, payments: true },
      orderBy: { purchaseDate: 'asc' },
      take: limit,
    });
    return { success: true, data: unpaidBills.map(mapPrismaPurchaseBillToType) };
  } catch (error: any)
   {
    console.error('Error fetching unpaid purchase bills:', error);
    return { success: false, error: 'Failed to fetch unpaid purchase bills.' };
  }
}

export async function recordPurchasePaymentAction(
  paymentData: unknown,
  userId: string
): Promise<{ success: boolean; data?: PurchaseBill; error?: string; fieldErrors?: Record<string, string[]> }> {
  if (!userId) {
    return { success: false, error: 'User is not authenticated. Cannot record payment.' };
  }

  const validationResult = PurchasePaymentCreateInputSchema.safeParse(paymentData);
  if (!validationResult.success) {
    return { success: false, error: "Invalid payment data.", fieldErrors: validationResult.error.flatten().fieldErrors };
  }
  const { purchaseBillId, amountPaid, ...restOfPaymentData } = validationResult.data;

  try {
     const { companyId } = await getCurrentUserAndCompanyId(userId);
     if (!companyId) {
        return { success: false, error: "Cannot record payment. User not associated with a company." };
     }

    const updatedPurchaseBill = await prisma.$transaction(async (tx) => {
      const bill = await tx.purchaseBill.findUnique({
        where: { id: purchaseBillId, companyId: companyId }, // Ensure bill belongs to user's company
        include: { payments: true }
      });

      if (!bill) {
        throw new Error("Purchase bill not found in your company.");
      }
      if (bill.paymentStatus === PurchaseBillStatusEnumSchema.Enum.PAID) {
        throw new Error("This purchase bill is already fully paid.");
      }

      const currentTotalPaid = bill.payments.reduce((sum, p) => sum + p.amountPaid, 0);
      const totalPaidAfterThisPayment = currentTotalPaid + amountPaid;

      if (totalPaidAfterThisPayment > bill.totalAmount + 0.001) {
        throw new Error(`Payment amount (Rs. ${amountPaid.toFixed(2)}) would result in overpayment. Outstanding: Rs. ${(bill.totalAmount - currentTotalPaid).toFixed(2)}.`);
      }

      await tx.purchasePayment.create({
        data: {
          purchaseBillId: purchaseBillId,
          amountPaid: amountPaid,
          ...restOfPaymentData,
          recordedByUserId: userId,
        },
      });

      const newPaymentStatus = totalPaidAfterThisPayment >= bill.totalAmount - 0.001 ?
                               PurchaseBillStatusEnumSchema.Enum.PAID :
                               PurchaseBillStatusEnumSchema.Enum.PARTIALLY_PAID;

      return tx.purchaseBill.update({
        where: { id: purchaseBillId },
        data: {
          amountPaid: totalPaidAfterThisPayment,
          paymentStatus: newPaymentStatus,
        },
        include: { supplier: true, items: true, payments: true },
      });
    });

    return { success: true, data: mapPrismaPurchaseBillToType(updatedPurchaseBill) };
  } catch (error: any) {
    console.error('Error recording purchase payment:', error);
    return { success: false, error: error.message || 'Failed to record purchase payment.' };
  }
}

export async function getPaymentsForPurchaseBillAction(
  purchaseBillId: string
): Promise<{ success: boolean; data?: PurchasePayment[]; error?: string }> {
  if (!prisma || !prisma.purchasePayment) {
    return { success: false, error: "Prisma client or PurchasePayment model not initialized." };
  }
  if (!purchaseBillId) {
    return { success: false, error: "Purchase Bill ID is required." };
  }
  try {
    const payments = await prisma.purchasePayment.findMany({
      where: { purchaseBillId: purchaseBillId },
      orderBy: { paymentDate: 'asc' },
    });
    const mappedPayments: PurchasePayment[] = payments.map(p => ({
      ...p,
      paymentDate: p.paymentDate.toISOString(),
      createdAt: p.createdAt.toISOString(),
    }));
    return { success: true, data: mappedPayments };
  } catch (error: any) {
    console.error(`Error fetching payments for purchase bill ${purchaseBillId}:`, error);
    return { success: false, error: 'Failed to fetch payments for purchase bill.' };
  }
}



