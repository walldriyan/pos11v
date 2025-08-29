
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TransactionForm } from '@/components/dashboard/financials/TransactionForm';
import type { FinancialTransaction, FinancialTransactionFormData, TransactionType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, TrendingUp, PlusCircle, Edit3, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/store/slices/authSlice';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

import {
  createTransactionAction,
  getTransactionsAction,
  updateTransactionAction,
  deleteTransactionAction,
} from '@/app/actions/financialsActions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


interface LastSuccessfulSubmission {
  id: string;
  category: string;
  type: TransactionType;
}

export default function FinancialsPage() {
  const { toast } = useToast();
  const currentUser = useSelector(selectCurrentUser);
  const { can, check } = usePermissions();
  const canManageSettings = can('manage', 'Settings');
  
  const isSuperAdminWithoutCompany = currentUser?.role?.name === 'Admin' && !currentUser?.companyId;

  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransactionFormData | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<FinancialTransaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string[]> | undefined>(undefined);
  const [lastSuccessfulSubmission, setLastSuccessfulSubmission] = useState<LastSuccessfulSubmission | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!currentUser?.id) {
        setIsLoading(false);
        return;
    };
    setIsLoading(true);
    const result = await getTransactionsAction(currentUser.id);
    if (result.success && result.data) {
      setTransactions(result.data);
    } else {
      toast({ title: 'Error Fetching Transactions', description: result.error, variant: 'destructive' });
    }
    setIsLoading(false);
  }, [toast, currentUser?.id]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const resetFormState = () => {
    setEditingTransaction(null);
    setFormError(null);
    setFormFieldErrors(undefined);
    setLastSuccessfulSubmission(null);
  };

  const handleAddTransaction = () => {
    const { permitted, toast: permissionToast } = check('manage', 'Settings');
    if (!permitted) {
        permissionToast();
        return;
    }
    resetFormState();
  };

  const handleEditTransaction = (transaction: FinancialTransaction) => {
    const { permitted, toast: permissionToast } = check('manage', 'Settings');
    if (!permitted) {
        permissionToast();
        return;
    }
    resetFormState();
    setEditingTransaction({ ...transaction, date: new Date(transaction.date) });
  };
  
  const handleDeleteTransaction = (transaction: FinancialTransaction) => {
    const { permitted, toast: permissionToast } = check('manage', 'Settings');
    if (!permitted) {
        permissionToast();
        return;
    }
    setTransactionToDelete(transaction);
  };

  const confirmDeleteTransaction = async () => {
    if (!transactionToDelete || !currentUser?.id) return;
    const { permitted, toast: permissionToast } = check('manage', 'Settings');
    if (!permitted) {
        permissionToast();
        setTransactionToDelete(null);
        return;
    }

    setIsSubmitting(true);
    const result = await deleteTransactionAction(transactionToDelete.id, currentUser.id);
    if (result.success) {
      toast({ title: 'Transaction Deleted' });
      fetchTransactions();
      if (editingTransaction?.id === transactionToDelete.id) {
        resetFormState();
      }
    } else {
      toast({ title: 'Error Deleting Transaction', description: result.error, variant: 'destructive' });
    }
    setTransactionToDelete(null);
    setIsSubmitting(false);
  };

  const handleFormSubmit = async (data: FinancialTransactionFormData) => {
    const { permitted, toast: permissionToast } = check('manage', 'Settings');
    if (!permitted) {
        permissionToast();
        return { success: false, error: "Permission Denied" };
    }
    if (!currentUser?.id) {
        setFormError("You must be logged in to perform this action.");
        return { success: false, error: "User not authenticated." };
    }
    setIsSubmitting(true);
    setFormError(null);
    setFormFieldErrors(undefined);
    
    const result = editingTransaction?.id
      ? await updateTransactionAction(editingTransaction.id, data, currentUser.id)
      : await createTransactionAction(data, currentUser.id);
      
    setIsSubmitting(false);

    if (result.success && result.data) {
      toast({ title: editingTransaction ? 'Transaction Updated' : 'Transaction Created' });
      setLastSuccessfulSubmission({ id: result.data.id, category: result.data.category, type: result.data.type });
      fetchTransactions();
      if (!editingTransaction?.id) {
        setEditingTransaction(null);
      } else {
        setEditingTransaction({ ...result.data, date: new Date(result.data.date) });
      }
    } else {
      setFormError(result.error || 'An unexpected error occurred.');
      setFormFieldErrors(result.fieldErrors);
      setLastSuccessfulSubmission(null);
    }
    return { success: result.success, error: result.error, fieldErrors: result.fieldErrors };
  };

  return (
    <div className="flex flex-col flex-1 p-4 md:p-6 bg-gradient-to-br from-background to-secondary text-foreground">
      <header className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-3">
          <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center">
            <TrendingUp className="mr-3 h-7 w-7" /> Income & Expense Management
          </h1>
        </div>
        <div className="flex space-x-2 self-end sm:self-center">
            <Button onClick={fetchTransactions} variant="outline" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground" disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button onClick={handleAddTransaction} disabled={!canManageSettings || isSuperAdminWithoutCompany} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Transaction
            </Button>
        </div>
      </header>
      
      {isSuperAdminWithoutCompany && (
        <Alert variant="destructive" className="mb-4 border-yellow-500/50 bg-yellow-950/30 text-yellow-300 [&>svg]:text-yellow-400">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Feature Disabled for this User</AlertTitle>
            <AlertDescription>
                Financial transactions are company-specific. This page is disabled because your Super Admin account is not associated with a company. Please use a company-specific user account or assign your admin account to a company in User Management.
            </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
            <Card className="bg-card border-border shadow-xl h-full">
                <CardHeader>
                    <CardTitle className="text-card-foreground">{editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        {editingTransaction ? `Update details for transaction from ${new Date(editingTransaction.date).toLocaleDateString()}.` : 'Fill in the details for the new transaction.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <TransactionForm
                        key={editingTransaction?.id || lastSuccessfulSubmission?.id || 'new-tx-form'}
                        transaction={editingTransaction}
                        onSubmit={handleFormSubmit}
                        isLoading={isSubmitting}
                        formError={formError}
                        fieldErrors={formFieldErrors}
                        onSwitchToAddNew={resetFormState}
                        submissionDetails={lastSuccessfulSubmission}
                        isFormDisabled={!canManageSettings || isSuperAdminWithoutCompany}
                    />
                </CardContent>
            </Card>
        </div>
        
        <div className="lg:col-span-3">
          <Card className="bg-card border-border shadow-xl flex-1">
            <CardHeader>
              <CardTitle className="text-2xl text-card-foreground">Transaction History</CardTitle>
              <CardDescription className="text-muted-foreground">View and manage your income and expenses.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && transactions.length === 0 && !isSuperAdminWithoutCompany ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-muted-foreground">Date</TableHead>
                      <TableHead className="text-muted-foreground">Type</TableHead>
                      <TableHead className="text-muted-foreground">Category</TableHead>
                      <TableHead className="text-right text-muted-foreground">Amount</TableHead>
                      <TableHead className="text-muted-foreground">Description</TableHead>
                      <TableHead className="text-center text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={`skel-tx-${i}`}>
                        <TableCell><Skeleton className="h-4 w-24 bg-muted/50" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 rounded-full bg-muted/50" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32 bg-muted/50" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20 ml-auto bg-muted/50" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48 bg-muted/50" /></TableCell>
                        <TableCell className="text-center space-x-1">
                          <Skeleton className="h-8 w-8 inline-block rounded-md bg-muted/50" />
                          <Skeleton className="h-8 w-8 inline-block rounded-md bg-muted/50" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : !isLoading && transactions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <TrendingUp className="mx-auto h-12 w-12 mb-4 text-primary" />
                  <p className="text-lg font-medium">{isSuperAdminWithoutCompany ? "No company selected." : "No transactions recorded yet."}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-muted-foreground">Date</TableHead>
                        <TableHead className="text-muted-foreground">Type</TableHead>
                        <TableHead className="text-muted-foreground">Category</TableHead>
                        <TableHead className="text-right text-muted-foreground">Amount</TableHead>
                        <TableHead className="text-muted-foreground">Description</TableHead>
                        <TableHead className="text-center text-muted-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id} className={cn(editingTransaction?.id === tx.id && "bg-primary/10")}>
                          <TableCell className="text-card-foreground">{new Date(tx.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant={tx.type === 'INCOME' ? 'default' : 'destructive'} className={tx.type === 'INCOME' ? 'bg-green-500/80 hover:bg-green-600' : 'bg-red-500/80 hover:bg-red-600'}>
                              {tx.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-card-foreground">{tx.category}</TableCell>
                          <TableCell className={`text-right font-medium ${tx.type === 'INCOME' ? 'text-green-400' : 'text-red-400'}`}>
                            Rs. {tx.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-card-foreground text-xs">{tx.description || 'N/A'}</TableCell>
                          <TableCell className="text-center space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditTransaction(tx)} disabled={!canManageSettings} className="h-8 w-8 text-blue-500 hover:text-blue-600"><Edit3 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteTransaction(tx)} disabled={!canManageSettings} className="h-8 w-8 text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {transactionToDelete && (
        <AlertDialog open={!!transactionToDelete} onOpenChange={() => setTransactionToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the transaction from {new Date(transactionToDelete.date).toLocaleDateString()} for Rs. {transactionToDelete.amount.toFixed(2)}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTransactionToDelete(null)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteTransaction} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                {isSubmitting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
