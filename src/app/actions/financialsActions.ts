
'use server';

import prisma from '@/lib/prisma';
import { FinancialTransactionFormSchema } from '@/lib/zodSchemas';
import type { FinancialTransaction, FinancialTransactionFormData } from '@/types';
import { Prisma } from '@prisma/client';

async function getCurrentUserAndCompanyId(userId: string): Promise<{ companyId: string | null }> {
    if (userId === 'root-user') {
        return { companyId: null };
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true, role: { select: { name: true } } }
    });

    if (!user) {
        throw new Error("User not found.");
    }
    
    if (user.role?.name === 'Admin') {
        return { companyId: user.companyId }; // Can be null for Super Admin
    }

    if (!user.companyId) {
        throw new Error("User is not associated with a company.");
    }
    return { companyId: user.companyId };
}


function mapPrismaToTransaction(transaction: any): FinancialTransaction {
  return {
    ...transaction,
    date: transaction.date.toISOString(),
    createdAt: transaction.createdAt?.toISOString(),
    updatedAt: transaction.updatedAt?.toISOString(),
    companyId: transaction.companyId,
  };
}

export async function createTransactionAction(
  data: FinancialTransactionFormData,
  userId: string
): Promise<{ success: boolean; data?: FinancialTransaction; error?: string, fieldErrors?: Record<string, string[]> }> {
  const validationResult = FinancialTransactionFormSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, error: "Validation failed.", fieldErrors: validationResult.error.flatten().fieldErrors };
  }

  const validatedData = validationResult.data;
  
  try {
    const { companyId } = await getCurrentUserAndCompanyId(userId);
    if (!companyId) {
        return { success: false, error: "Cannot create transaction. User is not associated with a company." };
    }

    const newTransaction = await prisma.financialTransaction.create({
      data: {
        ...validatedData,
        userId: userId,
        companyId: companyId, // Associate with user's company
      },
    });
    return { success: true, data: mapPrismaToTransaction(newTransaction) };
  } catch (error: any) {
    console.error("Error creating transaction:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return { success: false, error: `Database error: ${error.message}` };
    }
    return { success: false, error: error.message || "Failed to record transaction. Please check server logs." };
  }
}

export async function getTransactionsAction(userId: string): Promise<{
  success: boolean;
  data?: FinancialTransaction[];
  error?: string;
}> {
  try {
    const { companyId } = await getCurrentUserAndCompanyId(userId);
    if (!companyId) {
      // Root admin or admin without a company sees no transactions. This is not an error.
      return { success: true, data: [] };
    }

    const transactions = await prisma.financialTransaction.findMany({
      where: { companyId: companyId }, // Filter by company
      orderBy: { date: 'desc' },
      include: { user: { select: { username: true } } }
    });
    return { success: true, data: transactions.map(mapPrismaToTransaction) };
  } catch (error: any) {
    console.error("Error fetching transactions:", error);
    return { success: false, error: error.message || 'Failed to fetch transactions.' };
  }
}

export async function updateTransactionAction(
  id: string,
  data: FinancialTransactionFormData,
  userId: string
): Promise<{ success: boolean; data?: FinancialTransaction; error?: string; fieldErrors?: Record<string, string[]> }> {
  if (!id) return { success: false, error: "Transaction ID is required for update." };
  
  const validationResult = FinancialTransactionFormSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, error: "Validation failed.", fieldErrors: validationResult.error.flatten().fieldErrors };
  }

  try {
    const { companyId } = await getCurrentUserAndCompanyId(userId);
    if (!companyId) {
        return { success: false, error: "Cannot update transaction. User is not associated with a company." };
    }
    
    // Ensure user can only update their own company's transaction
    const transaction = await prisma.financialTransaction.findFirst({
        where: { id, companyId: companyId },
    });
    if (!transaction) {
        return { success: false, error: 'Transaction not found or you do not have permission to edit it.' };
    }

    const updatedTransaction = await prisma.financialTransaction.update({
      where: { id },
      data: validationResult.data,
    });
    return { success: true, data: mapPrismaToTransaction(updatedTransaction) };
  } catch (error: any) {
    console.error(`Error updating transaction ${id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return { success: false, error: 'Transaction to update not found.' };
    }
    return { success: false, error: error.message || 'Failed to update transaction.' };
  }
}

export async function deleteTransactionAction(
  id: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: "Transaction ID is required for deletion." };
  try {
    const { companyId } = await getCurrentUserAndCompanyId(userId);
     if (!companyId) {
        return { success: false, error: "Cannot delete transaction. User is not associated with a company." };
    }
    
    // Ensure user can only delete their own company's transaction
    const transaction = await prisma.financialTransaction.findFirst({
        where: { id, companyId: companyId },
    });
    if (!transaction) {
        return { success: false, error: 'Transaction not found or you do not have permission to delete it.' };
    }

    await prisma.financialTransaction.delete({
      where: { id },
    });
    return { success: true };
  } catch (error: any) {
    console.error(`Error deleting transaction ${id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return { success: false, error: 'Transaction to delete not found.' };
    }
    return { success: false, error: error.message || 'Failed to delete transaction.' };
  }
}
      