
'use server';
import prisma from '@/lib/prisma';
import type { CashRegisterShift, CashRegisterShiftFormData, ShiftStatus } from '@/types';
import { CashRegisterShiftFormSchema, ShiftStatusEnumSchema } from '@/lib/zodSchemas';
import { Prisma } from '@prisma/client';
import { selectCurrentUser } from '@/store/slices/authSlice'; // This won't work in server actions

// Helper function to get the current user and their company ID on the server
async function getCurrentUserAndCompanyId(userId: string): Promise<{ user: { id: string; companyId: string | null; role: {name: string | null} | null } | null; companyId: string | null; }> {
    if (userId === 'root-user') {
        const rootUser = {
            id: 'root-user',
            companyId: null,
            role: { name: 'Admin' }
        };
        return { user: rootUser, companyId: null };
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, companyId: true, role: { select: { name: true } } }
    });

    if (!user) {
        // Return null instead of throwing for cases where the user might be root.
        // Let the calling action decide how to handle a non-existent user.
        return { user: null, companyId: null };
    }
    
    if (!user.companyId && user.role?.name !== 'Admin') {
        throw new Error("User is not associated with a company.");
    }
    
    return { user, companyId: user.companyId };
}


function mapPrismaShiftToType(
  prismaShift: Prisma.CashRegisterShiftGetPayload<{ include: { user: { select: { username: true } } } } >
): CashRegisterShift {
  return {
    id: prismaShift.id,
    openingBalance: prismaShift.openingBalance,
    closingBalance: prismaShift.closingBalance,
    notes: prismaShift.notes,
    startedAt: prismaShift.startedAt.toISOString(),
    closedAt: prismaShift.closedAt?.toISOString(),
    status: prismaShift.status as ShiftStatus,
    userId: prismaShift.userId,
    user: prismaShift.user ? { username: prismaShift.user.username } : undefined,
    createdAt: prismaShift.createdAt.toISOString(),
    updatedAt: prismaShift.updatedAt.toISOString(),
    companyId: prismaShift.companyId,
  };
}

export async function getActiveShiftForUserAction(userId: string): Promise<{
  success: boolean;
  data?: CashRegisterShift;
  error?: string;
}> {
  if (!userId) return { success: false, error: "User not authenticated." };
  try {
    const { companyId, user } = await getCurrentUserAndCompanyId(userId);
    if (!user) return { success: false, error: "User not found."};
    if (!companyId) return { success: true, data: undefined }; // No active shift if no company

    const activeShift = await prisma.cashRegisterShift.findFirst({
      where: {
        companyId: companyId,
        status: ShiftStatusEnumSchema.Enum.OPEN,
      },
       include: { user: { select: { username: true } } },
    });
    if (!activeShift) return { success: true, data: undefined };
    return { success: true, data: mapPrismaShiftToType(activeShift) };
  } catch (error: any) {
    console.error("Error fetching active shift:", error);
    return { success: false, error: error.message || "Failed to fetch active shift." };
  }
}

export async function startShiftAction(data: CashRegisterShiftFormData, userId: string): Promise<{
  success: boolean;
  data?: CashRegisterShift;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}> {
  if (!userId) return { success: false, error: "User not authenticated." };
  
  const validation = CashRegisterShiftFormSchema.safeParse(data);
  if (!validation.success || validation.data.openingBalance === undefined) {
    return { success: false, error: "Validation failed.", fieldErrors: validation.error?.flatten().fieldErrors };
  }
  
  const { openingBalance, notes } = validation.data;

  try {
    const { companyId, user } = await getCurrentUserAndCompanyId(userId);
    if (!user) return { success: false, error: "User not found."};
    if (!companyId) {
        return { success: false, error: "Cannot start a shift without being assigned to a company." };
    }

    const existingOpenShiftInCompany = await prisma.cashRegisterShift.findFirst({
      where: { companyId, status: 'OPEN' }
    });
    if (existingOpenShiftInCompany) {
      return { success: false, error: 'An open shift already exists for this company. Please close it first.' };
    }

    const newShift = await prisma.cashRegisterShift.create({
      data: {
        userId,
        companyId, // Associate shift with the user's company
        openingBalance: openingBalance,
        notes,
        status: 'OPEN',
      },
      include: { user: { select: { username: true } } },
    });

    return { success: true, data: mapPrismaShiftToType(newShift) };
  } catch (error: any) {
    console.error("Error starting shift:", error);
    return { success: false, error: error.message || "Failed to start a new shift." };
  }
}

export async function closeShiftAction(data: CashRegisterShiftFormData, shiftId: string, userId: string): Promise<{
  success: boolean;
  data?: CashRegisterShift;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}> {
    if (!userId || !shiftId) return { success: false, error: "User or Shift ID missing." };
    
    const validation = CashRegisterShiftFormSchema.safeParse(data);
     if (!validation.success || validation.data.closingBalance === undefined) {
        return { success: false, error: "Validation failed. Closing balance is required.", fieldErrors: validation.error?.flatten().fieldErrors };
    }
    const { closingBalance, notes } = validation.data;
    
    try {
        const { companyId, user } = await getCurrentUserAndCompanyId(userId);
        if (!user) return { success: false, error: "User not found."};
        if (!companyId) {
            return { success: false, error: "Cannot close a shift without being assigned to a company." };
        }
        
        const shiftToClose = await prisma.cashRegisterShift.findFirst({
            where: { id: shiftId, companyId: companyId, status: 'OPEN' }
        });
        if (!shiftToClose) {
            return { success: false, error: "No open shift found for this company to close." };
        }
        
        const updatedShift = await prisma.cashRegisterShift.update({
            where: { id: shiftId },
            data: {
                closingBalance: closingBalance,
                notes: notes, // Update notes if provided
                status: 'CLOSED',
                closedAt: new Date(),
            },
            include: { user: { select: { username: true } } },
        });

        return { success: true, data: mapPrismaShiftToType(updatedShift) };
    } catch (error: any) {
        console.error("Error closing shift:", error);
        return { success: false, error: error.message || "Failed to close the shift." };
    }
}

export async function getShiftHistoryAction(
  userId: string,
  page: number = 1,
  limit: number = 10
): Promise<{
  success: boolean;
  data?: { shifts: CashRegisterShift[]; totalCount: number };
  error?: string;
}> {
  if (!userId) return { success: false, error: "User not authenticated." };
  try {
     const { companyId, user } = await getCurrentUserAndCompanyId(userId);
     if (!user) return { success: false, error: "User not found."};
     if (!companyId) {
        return { success: true, data: { shifts: [], totalCount: 0 }}; // No history if no company
     }

    const skip = (page - 1) * limit;
    const whereClause = { companyId: companyId };

    const [shifts, totalCount] = await prisma.$transaction([
      prisma.cashRegisterShift.findMany({
        where: whereClause,
        include: { user: { select: { username: true } } },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: skip,
      }),
      prisma.cashRegisterShift.count({ where: whereClause }),
    ]);
    
    return { success: true, data: { shifts: shifts.map(mapPrismaShiftToType), totalCount } };
  } catch (error: any) {
    console.error("Error fetching shift history:", error);
    return { success: false, error: error.message || "Failed to fetch shift history." };
  }
}


export async function getShiftSummaryAction(shiftId: string, userId: string): Promise<{
  success: boolean;
  data?: { totalSales: number; cashSales: number; cardSales: number };
  error?: string;
}> {
  if (!shiftId || !userId) return { success: false, error: "Shift or User ID missing." };
  try {
     const { companyId, user } = await getCurrentUserAndCompanyId(userId);
     if (!user) return { success: false, error: "User not found."};
     if (!companyId) {
        return { success: false, error: "User not associated with a company." };
     }
    const shift = await prisma.cashRegisterShift.findFirst({
      where: { id: shiftId, companyId: companyId, status: 'OPEN' },
    });
    if (!shift) return { success: false, error: "Active shift not found for this company." };

    const sales = await prisma.saleRecord.findMany({
      where: {
        companyId: companyId, // Filter sales by company
        createdAt: { gte: shift.startedAt },
        recordType: 'SALE'
      },
    });

    let totalSales = 0;
    let cashSales = 0;
    let cardSales = 0;

    sales.forEach(sale => {
      totalSales += sale.totalAmount;
      if (sale.paymentMethod === 'cash') {
        cashSales += sale.totalAmount;
      } else if (sale.paymentMethod === 'credit') {
        cardSales += sale.totalAmount;
      }
    });

    return { success: true, data: { totalSales, cashSales, cardSales } };
  } catch (error: any) {
    console.error("Error getting shift summary:", error);
    return { success: false, error: error.message || "Failed to get shift summary." };
  }
}

export async function updateClosedShiftAction(shiftId: string, data: { closingBalance: number; notes: string | null }, userId: string): Promise<{
  success: boolean;
  data?: CashRegisterShift;
  error?: string;
}> {
  if (!shiftId || !userId) return { success: false, error: "Shift or User ID missing." };
  try {
    const { companyId, user } = await getCurrentUserAndCompanyId(userId);
    if (!user) return { success: false, error: "User not found."};
    if (!companyId) {
      return { success: false, error: "User not associated with a company." };
    }
    const shift = await prisma.cashRegisterShift.findFirst({
      where: { id: shiftId, companyId: companyId, status: 'CLOSED' },
    });
    if (!shift) return { success: false, error: "Closed shift not found for this user's company." };

    const updatedShift = await prisma.cashRegisterShift.update({
      where: { id: shiftId },
      data: {
        closingBalance: data.closingBalance,
        notes: data.notes,
      },
      include: { user: { select: { username: true } } },
    });
    return { success: true, data: mapPrismaShiftToType(updatedShift) };
  } catch (error) {
    console.error("Error updating closed shift:", error);
    return { success: false, error: "Failed to update shift." };
  }
}

export async function deleteShiftAction(shiftId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  if (!shiftId || !userId) return { success: false, error: "Shift or User ID missing." };
  try {
    const { companyId, user } = await getCurrentUserAndCompanyId(userId);
    if (!user) return { success: false, error: "User not found."};
     if (!companyId) {
      return { success: false, error: "User not associated with a company." };
    }
    const shift = await prisma.cashRegisterShift.findFirst({
      where: { id: shiftId, companyId: companyId },
    });
    if (!shift) return { success: false, error: "Shift not found for this user's company." };

    await prisma.cashRegisterShift.delete({
      where: { id: shiftId },
    });
    return { success: true };
  } catch (error) {
    console.error("Error deleting shift:", error);
    return { success: false, error: "Failed to delete shift." };
  }
}


export async function getOpeningBalanceSuggestionAction(userId: string): Promise<{
  success: boolean;
  data?: number;
  error?: string;
}> {
  if (!userId) return { success: false, error: "User not authenticated." };
  try {
    const { companyId, user } = await getCurrentUserAndCompanyId(userId);
    if (!user) return { success: false, error: "User not found."};
    if (!companyId) {
      return { success: true, data: 0 }; // No company, no suggestion
    }

    const lastClosedShift = await prisma.cashRegisterShift.findFirst({
      where: {
        companyId: companyId, // Filter by company
        status: 'CLOSED',
        closingBalance: { not: null },
      },
      orderBy: {
        closedAt: 'desc',
      },
    });

    return { success: true, data: lastClosedShift?.closingBalance ?? 0 };
  } catch (error: any) {
    console.error("Error fetching last closing balance:", error);
    return { success: false, error: error.message || "Failed to fetch opening balance suggestion." };
  }
}
      

    