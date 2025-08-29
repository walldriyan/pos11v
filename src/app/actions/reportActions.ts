
'use server';

import prisma from '@/lib/prisma';
import type { ComprehensiveReport, SaleRecord, FinancialTransaction, StockAdjustmentLog, PurchaseBill, CashRegisterShift, Product, Party, User, SaleRecordItem } from '@/types';
import { Prisma } from '@prisma/client';
import { startOfDay, subDays, format, startOfMonth } from 'date-fns';

async function getCompanyIdForReport(userId?: string | null): Promise<string | null> {
    if (!userId) return null;
    if (userId === 'root-user') return null; // Root user may not have a company
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true }
    });
    return user?.companyId || null;
}

export async function getDashboardSummaryAction(
    userId: string | null,
    filter: 'today' | 'last7days' | 'thismonth' = 'last7days'
): Promise<{
    success: boolean;
    data?: {
        totalCustomers: number;
        newCustomersToday: number;
        totalSuppliers: number;
        recentParties: { id: string; name: string; }[];
        
        financials: {
            totalIncome: number;
            totalExpenses: number;
            chartData: { date: string; income: number; expenses: number }[];
        };

        recentProducts: { id: string; name: string; category: string | null; sellingPrice: number; isActive: boolean; imageUrl: string | null; stock: number; }[];
    };
    error?: string;
}> {
    if (!userId) {
        return { success: false, error: "User not authenticated." };
    }

    try {
        const companyId = await getCompanyIdForReport(userId);
        const whereClause: Prisma.PartyWhereInput = companyId ? { companyId } : {};
        const salesWhereClause: Prisma.SaleRecordWhereInput = companyId ? { companyId } : {};
        const purchaseWhereClause: Prisma.PurchaseBillWhereInput = companyId ? { companyId } : {};
        const expenseWhereClause: Prisma.FinancialTransactionWhereInput = companyId ? { companyId, type: 'EXPENSE' } : { type: 'EXPENSE' };
        const productWhereClause: Prisma.ProductWhereInput = companyId ? { companyId } : {};


        // Total Customers & Suppliers
        const [totalCustomers, totalSuppliers, recentProductsFromDb] = await Promise.all([
            prisma.party.count({ where: { ...whereClause, type: 'CUSTOMER' } }),
            prisma.party.count({ where: { ...whereClause, type: 'SUPPLIER' } }),
            prisma.product.findMany({
                where: productWhereClause,
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { 
                    id: true, 
                    name: true, 
                    category: true, 
                    sellingPrice: true, 
                    isActive: true, 
                    imageUrl: true,
                    isService: true,
                    batches: {
                        select: {
                            quantity: true
                        }
                    }
                }
            })
        ]);
        
        const recentProducts = recentProductsFromDb.map(p => {
            const stock = p.isService ? 0 : p.batches.reduce((sum, batch) => sum + batch.quantity, 0);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { batches, ...productData } = p;
            return { ...productData, stock };
        });


        // New Customers Today
        const todayForNewCust = startOfDay(new Date());
        const newCustomersToday = await prisma.party.count({
            where: { ...whereClause, type: 'CUSTOMER', createdAt: { gte: todayForNewCust } },
        });
        
        // Recent 5 Parties
        const recentParties = await prisma.party.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, name: true }
        });

        // --- Financial Chart Data ---
        let startDate: Date;
        const now = new Date();
        switch (filter) {
            case 'today':
                startDate = startOfDay(now);
                break;
            case 'thismonth':
                startDate = startOfMonth(now);
                break;
            case 'last7days':
            default:
                startDate = subDays(now, 7);
                break;
        }

        const [dailySales, dailyPurchases, dailyExpenses] = await Promise.all([
            prisma.saleRecord.groupBy({
                by: ['date'],
                where: { ...salesWhereClause, date: { gte: startDate }, recordType: 'SALE' },
                _sum: { totalAmount: true },
            }),
            prisma.purchaseBill.groupBy({
                by: ['purchaseDate'],
                where: { ...purchaseWhereClause, purchaseDate: { gte: startDate } },
                _sum: { totalAmount: true },
            }),
            prisma.financialTransaction.groupBy({
                by: ['date'],
                where: { ...expenseWhereClause, date: { gte: startDate } },
                _sum: { amount: true },
            }),
        ]);

        const financialDataMap = new Map<string, { income: number, expenses: number }>();
        const daysInRange = filter === 'today' ? 1 : filter === 'thismonth' ? now.getDate() : 7;

        // Initialize last N days
        for (let i = 0; i < daysInRange; i++) {
            const date = format(subDays(now, i), 'yyyy-MM-dd');
            financialDataMap.set(date, { income: 0, expenses: 0 });
        }
        
        // Populate with sales data (income)
        dailySales.forEach(day => {
            const dateStr = format(new Date(day.date), 'yyyy-MM-dd');
            if (financialDataMap.has(dateStr)) {
                financialDataMap.get(dateStr)!.income += day._sum.totalAmount || 0;
            }
        });

        // Populate with purchase data (expense)
        dailyPurchases.forEach(day => {
            const dateStr = format(new Date(day.purchaseDate), 'yyyy-MM-dd');
            if (financialDataMap.has(dateStr)) {
                financialDataMap.get(dateStr)!.expenses += day._sum.totalAmount || 0;
            }
        });

        // Populate with other financial expenses
        dailyExpenses.forEach(day => {
            const dateStr = format(new Date(day.date), 'yyyy-MM-dd');
             if (financialDataMap.has(dateStr)) {
                financialDataMap.get(dateStr)!.expenses += day._sum.amount || 0;
            }
        });
        
        const chartData = Array.from(financialDataMap.entries())
            .map(([date, values]) => ({ 
              date: filter === 'today' ? 'Today' : format(new Date(date), 'dd MMM'), 
              income: values.income,
              expenses: values.expenses
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const totalIncome = chartData.reduce((sum, day) => sum + day.income, 0);
        const totalExpenses = chartData.reduce((sum, day) => sum + day.expenses, 0);

        return {
            success: true,
            data: {
                totalCustomers,
                newCustomersToday,
                totalSuppliers,
                recentParties,
                financials: {
                    totalIncome,
                    totalExpenses,
                    chartData,
                },
                recentProducts
            }
        };

    } catch (error: any) {
        console.error('Error fetching dashboard summary:', error);
        return { success: false, error: 'Failed to fetch dashboard data. ' + error.message };
    }
}


export async function getComprehensiveReportAction(
  startDate: Date,
  endDate: Date,
  actorUserId: string | null, // This is the user *running* the report, for company scoping
  userIdForFilter?: string | null, // This is the user selected in the filter, could be 'all'
): Promise<{ success: boolean; data?: ComprehensiveReport; error?: string }> {
  try {

    // The report is always scoped to the company of the user RUNNING the report.
    const companyId = await getCompanyIdForReport(actorUserId);
    if (!companyId && actorUserId !== 'root-user') {
      // If the actor is a Super Admin without a company, maybe we show all? For now, let's restrict.
      return { success: false, error: "Cannot generate report. You are not assigned to a company." };
    }
    
    // The filter for a specific user is applied *within* the company's data.
    const userFilterForSalesAndPurchases = userIdForFilter && userIdForFilter !== 'all' ? { createdByUserId: userIdForFilter } : {};
    const userFilterForOtherRecords = userIdForFilter && userIdForFilter !== 'all' ? { userId: userIdForFilter } : {};
    const companyFilter = companyId ? { companyId: companyId } : {};
    
    // Use specific where clauses for each query to ensure correct field names are used.
    const salesWhere: Prisma.SaleRecordWhereInput = { date: { gte: startDate, lte: endDate }, ...companyFilter, ...userFilterForSalesAndPurchases };
    const financialsWhere = { date: { gte: startDate, lte: endDate }, ...companyFilter, ...userFilterForOtherRecords };
    const stockWhere = { adjustedAt: { gte: startDate, lte: endDate }, ...companyFilter, ...userFilterForOtherRecords };
    const purchasesWhere = { purchaseDate: { gte: startDate, lte: endDate }, ...companyFilter, ...userFilterForSalesAndPurchases };
    const shiftsWhere = { 
        startedAt: { lte: endDate }, 
        OR: [{ closedAt: null }, { closedAt: { gte: startDate }}], 
        ...companyFilter, 
        ...userFilterForOtherRecords
    };


    const salesAndReturns = await prisma.saleRecord.findMany({
      where: salesWhere,
      include: { customer: true, createdBy: { select: { username: true } }, paymentInstallments: true }, // Include installments
      orderBy: { date: 'asc' },
    });

    const financialTransactions = await prisma.financialTransaction.findMany({ 
        where: financialsWhere,
        include: { user: { select: { username: true } } },
        orderBy: { date: 'asc' } 
    });

    const stockAdjustments = await prisma.stockAdjustmentLog.findMany({ 
        where: stockWhere,
        include: { product: { select: { name: true } }, user: { select: { username: true } } }, 
        orderBy: { adjustedAt: 'asc' } 
    });

    const purchases = await prisma.purchaseBill.findMany({ 
        where: purchasesWhere,
        include: { supplier: true, items: true, payments: true, createdBy: { select: { username: true } } } 
    });

    const cashRegisterShifts = await prisma.cashRegisterShift.findMany({ 
        where: shiftsWhere,
        include: { user: { select: { username: true } } } 
    });
    
    const newOrUpdatedProducts = await prisma.product.findMany({ where: { updatedAt: { gte: startDate, lte: endDate }, ...companyFilter } });
    const newOrUpdatedParties = await prisma.party.findMany({ where: { updatedAt: { gte: startDate, lte: endDate }, ...companyFilter } });

    const allSales = salesAndReturns.filter(r => r.recordType === 'SALE').map(s => ({...s, items: s.items as Prisma.JsonArray, returnedItemsLog: s.returnedItemsLog as Prisma.JsonArray, appliedDiscountSummary: s.appliedDiscountSummary as Prisma.JsonArray}) as any);
    const allReturns = salesAndReturns.filter(r => r.recordType === 'RETURN_TRANSACTION').map(s => ({...s, items: s.items as Prisma.JsonArray, returnedItemsLog: s.returnedItemsLog as Prisma.JsonArray, appliedDiscountSummary: s.appliedDiscountSummary as Prisma.JsonArray}) as any);


    // --- Identify Active Sale Records for Summary ---
    const salesByBillNumber = new Map<string, { original: SaleRecord; adjusted: SaleRecord | null }>();

    // First, map all original sales.
    allSales.forEach(sale => {
      if (sale.status === 'COMPLETED_ORIGINAL') {
        salesByBillNumber.set(sale.billNumber, { original: sale, adjusted: null });
      }
    });

    // Then, find the latest adjusted sale for each original.
    allSales.forEach(sale => {
      if (sale.status === 'ADJUSTED_ACTIVE' && sale.originalSaleRecordId) {
        const originalSale = allSales.find(os => os.id === sale.originalSaleRecordId);
        if (originalSale && salesByBillNumber.has(originalSale.billNumber)) {
          const group = salesByBillNumber.get(originalSale.billNumber)!;
          if (!group.adjusted || new Date(sale.date) > new Date(group.adjusted.date)) {
            group.adjusted = sale;
          }
        }
      }
    });

    // Final list of active records (the latest adjusted one, or the original if no adjustments)
    const activeSaleRecords: SaleRecord[] = Array.from(salesByBillNumber.values()).map(group => group.adjusted || group.original);


    // --- Calculate Summary based on ACTIVE bills ---
    const costOfGoodsSold = activeSaleRecords.flatMap(s => s.items as unknown as SaleRecordItem[]).reduce((sum, item) => {
        return sum + (item.costPriceAtSale ?? 0) * item.quantity;
    }, 0);
    
    const totalCashSales = activeSaleRecords
        .filter(s => s.paymentMethod === 'cash')
        .reduce((sum, sale) => sum + sale.totalAmount, 0);

    const totalCreditSales = activeSaleRecords
        .filter(s => s.paymentMethod === 'credit')
        .reduce((sum, sale) => sum + sale.totalAmount, 0);

    // This gets payments made within the date range for ANY credit sale (even old ones)
     const allCreditPaymentsInRange = await prisma.paymentInstallment.findMany({
        where: {
            paymentDate: { gte: startDate, lte: endDate },
            saleRecord: companyId ? { companyId: companyId } : {}
        }
    });
    const totalPaymentsOnCreditSales = allCreditPaymentsInRange.reduce((sum, inst) => sum + inst.amountPaid, 0);
    
    // Let's also get total outstanding for ALL open credit bills in the company
     const outstandingCreditBills = await prisma.saleRecord.findMany({
      where: { 
        ...companyFilter, 
        isCreditSale: true,
        creditPaymentStatus: { in: ['PENDING', 'PARTIALLY_PAID'] }
      },
      select: { creditOutstandingAmount: true }
    });
    const outstandingCreditAmount = outstandingCreditBills.reduce((sum, bill) => sum + (bill.creditOutstandingAmount ?? 0), 0);


    const summary: ComprehensiveReport['summary'] = {
      netSales: activeSaleRecords.reduce((sum, sale) => sum + sale.totalAmount, 0),
      totalCashSales: totalCashSales,
      totalCreditSales: totalCreditSales,
      totalPaymentsOnCreditSales: totalPaymentsOnCreditSales,
      outstandingCreditAmount: outstandingCreditAmount,
      totalDiscounts: activeSaleRecords.reduce((sum, sale) => sum + (sale.totalItemDiscountAmount || 0) + (sale.totalCartDiscountAmount || 0), 0),
      totalTax: activeSaleRecords.reduce((sum, sale) => sum + (sale.taxAmount || 0), 0),
      grossSales: activeSaleRecords.reduce((sum, sale) => sum + (sale.subtotalOriginal || 0), 0),
      costOfGoodsSold: costOfGoodsSold,
      totalIncome: financialTransactions.filter(tx => tx.type === 'INCOME').reduce((sum, tx) => sum + tx.amount, 0),
      totalExpense: financialTransactions.filter(tx => tx.type === 'EXPENSE').reduce((sum, tx) => sum + tx.amount, 0),
      totalStockAdjustmentsValue: stockAdjustments.reduce((sum, adj) => {
        // This calculation might need refinement to get the cost of the adjusted stock
        return sum; // Placeholder
      }, 0),
      totalReturnsValue: 0, // Obsolete, as returns are reflected in active bills
      totalPurchaseValue: purchases.reduce((sum, p) => sum + p.totalAmount, 0),
      totalPaymentsToSuppliers: purchases.flatMap(p => p.payments || []).reduce((sum, payment) => sum + payment.amountPaid, 0),
      netCashFromShifts: cashRegisterShifts.filter(s => s.status === 'CLOSED' && s.closingBalance != null).reduce((sum, s) => sum + (s.closingBalance! - s.openingBalance), 0),
      netProfitLoss: 0, // Calculated last
    };

    // New "Owner's P&L" calculation focusing on cash-like movements and non-cash losses.
    // Income side: Cash sales + Payments received on credit sales + Other recorded income
    const totalCashInflow = summary.totalCashSales + summary.totalPaymentsOnCreditSales + summary.totalIncome;
    // Expense side: COGS for all sales (cash+credit) + Other recorded expenses
    const totalOutflowAndLoss = summary.costOfGoodsSold + summary.totalExpense;
    summary.netProfitLoss = totalCashInflow - totalOutflowAndLoss;

    const report: ComprehensiveReport = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      generatedAt: new Date().toISOString(),
      summary,
      sales: allSales,
      returns: allReturns,
      financialTransactions: financialTransactions as unknown as FinancialTransaction[],
      stockAdjustments,
      purchases: purchases as unknown as PurchaseBill[],
      cashRegisterShifts,
      newOrUpdatedProducts,
      newOrUpdatedParties,
    };

    return { success: true, data: report };

  } catch (error: any) {
    console.error('Error generating comprehensive report:', error);
    return { success: false, error: 'Failed to generate report. ' + error.message };
  }
}


export async function getUsersForReportFilterAction(actorUserId: string | null): Promise<{
  success: boolean;
  data?: { id: string; username: string }[];
  error?: string;
}> {
  if (!actorUserId) {
    return { success: false, error: "User not authenticated." };
  }
  try {
    const companyId = await getCompanyIdForReport(actorUserId);
    if (!companyId) {
        // Super admin with no company assigned sees all users, others see none.
        const actor = await prisma.user.findUnique({ where: { id: actorUserId }, include: { role: true }});
        if (actor?.role?.name !== 'Admin') {
            return { success: true, data: [] };
        }
    }

    const users = await prisma.user.findMany({
      where: { 
        isActive: true,
        companyId: companyId || undefined // Filter by company if it exists
      },
      select: {
        id: true,
        username: true,
      },
      orderBy: {
        username: 'asc',
      },
    });
    return { success: true, data: users };
  } catch (error: any) {
    console.error('Error fetching users for report filter:', error);
    return { success: false, error: error.message || 'Failed to load user list.' };
  }
}
      

    