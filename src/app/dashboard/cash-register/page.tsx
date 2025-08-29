
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CashRegisterShiftFormSchema } from '@/lib/zodSchemas';
import type { CashRegisterShift, CashRegisterShiftFormData } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, WalletCards, RefreshCw, BadgeDollarSign, DoorOpen, DoorClosed, History, Edit3, Trash2, TrendingUp, CreditCard, AlertCircle, CheckCircle, User, LogOut, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useSelector, useDispatch } from 'react-redux';
import { selectCurrentUser, clearUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import { useRouter } from 'next/navigation';

import {
  startShiftAction,
  closeShiftAction,
  getActiveShiftForUserAction,
  getShiftHistoryAction,
  getShiftSummaryAction,
  updateClosedShiftAction,
  deleteShiftAction,
  getOpeningBalanceSuggestionAction,
} from '@/app/actions/cashRegisterActions';
import { verifyAdminPasswordAction } from '@/app/actions/authActions';


interface ShiftSummary {
  totalSales: number;
  cashSales: number;
  cardSales: number;
}

export default function CashRegisterPage() {
  const { toast } = useToast();
  const currentUser = useSelector(selectCurrentUser);
  const dispatch: AppDispatch = useDispatch();
  const router = useRouter();
  
  const isSuperAdminWithoutCompany = currentUser?.id === 'root-user' || (currentUser?.role?.name === 'Admin' && !currentUser?.companyId);

  const [activeShift, setActiveShift] = useState<CashRegisterShift | null>(null);
  const [activeShiftSummary, setActiveShiftSummary] = useState<ShiftSummary | null>(null);
  const [shiftHistory, setShiftHistory] = useState<CashRegisterShift[]>([]);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<CashRegisterShift | null>(null);
  const [shiftToDelete, setShiftToDelete] = useState<CashRegisterShift | null>(null);

  const [openingBalanceLocked, setOpeningBalanceLocked] = useState(true);
  const [isUnlockDialogOpen, setIsUnlockDialogOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const {
    control, handleSubmit, register, reset, watch, formState: { errors, isValid }
  } = useForm<CashRegisterShiftFormData>({
    resolver: zodResolver(CashRegisterShiftFormSchema), mode: 'onChange',
  });
  
  const editForm = useForm<CashRegisterShiftFormData>({
    resolver: zodResolver(CashRegisterShiftFormSchema), mode: 'onChange',
  });
  
  const closingBalance = watch('closingBalance');
  const expectedInDrawer = activeShift && activeShiftSummary ? activeShift.openingBalance + activeShiftSummary.cashSales : 0;
  const discrepancy = typeof closingBalance === 'number' ? closingBalance - expectedInDrawer : null;
  
  const handleLogoutFromPage = () => {
    dispatch(clearUser());
    router.push('/login');
  };

  const fetchActiveShiftAndSummary = useCallback(async () => {
    if (!currentUser?.id || isSuperAdminWithoutCompany) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const result = await getActiveShiftForUserAction(currentUser.id);
    if (result.success) {
      setActiveShift(result.data || null);
      if (result.data) { // Active shift found
        const summaryResult = await getShiftSummaryAction(result.data.id, currentUser.id);
        if (summaryResult.success && summaryResult.data) {
          setActiveShiftSummary(summaryResult.data);
          const expectedCash = result.data.openingBalance + summaryResult.data.cashSales;
          reset({ closingBalance: expectedCash, notes: result.data.notes || '' });
        } else { setActiveShiftSummary(null); }
      } else { // No active shift, suggest opening balance
        setActiveShiftSummary(null);
        const suggestionResult = await getOpeningBalanceSuggestionAction(currentUser.id);
        if (suggestionResult.success && suggestionResult.data !== undefined) {
           reset({ openingBalance: suggestionResult.data, notes: '' });
        } else {
           reset({ openingBalance: 0, notes: '' });
        }
      }
    } else {
      toast({ title: "Error", description: result.error || "Could not fetch active shift.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [currentUser, toast, reset, isSuperAdminWithoutCompany]);
  
  const fetchHistory = useCallback(async (page: number) => {
    if (!currentUser?.id || isSuperAdminWithoutCompany) {
      setShiftHistory([]);
      setHistoryTotalCount(0);
      return;
    }
    const historyResult = await getShiftHistoryAction(currentUser.id, page, 10);
    if (historyResult.success && historyResult.data) {
      setShiftHistory(historyResult.data.shifts);
      setHistoryTotalCount(historyResult.data.totalCount);
    } else {
      toast({ title: "Error", description: historyResult.error || "Could not fetch shift history.", variant: "destructive" });
    }
  }, [toast, currentUser, isSuperAdminWithoutCompany]);

  useEffect(() => {
    if (currentUser?.id) {
        fetchActiveShiftAndSummary();
        fetchHistory(historyPage);
    } else {
        setIsLoading(false);
    }
  }, [fetchActiveShiftAndSummary, fetchHistory, historyPage, currentUser]);
  
  const onFormSubmit = async (data: CashRegisterShiftFormData) => {
    if (!currentUser?.id) return;
    setIsSubmitting(true);
    let result = activeShift
      ? await closeShiftAction(data, activeShift.id, currentUser.id)
      : await startShiftAction(data, currentUser.id);
    
    if (result.success) {
      toast({ title: "Success", description: `Shift has been ${activeShift ? 'closed' : 'started'} successfully.` });
      fetchActiveShiftAndSummary();
      fetchHistory(1); setHistoryPage(1);
      setOpeningBalanceLocked(true);
    } else {
      toast({ title: "Error", description: result.error || "An error occurred.", variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const onEditFormSubmit = async (data: CashRegisterShiftFormData) => {
    if (!currentUser?.id || !editingShift) return;
    setIsSubmitting(true);
    const result = await updateClosedShiftAction(editingShift.id, {
        closingBalance: data.closingBalance!,
        notes: data.notes || null,
    }, currentUser.id);
    if (result.success) {
        toast({ title: "Success", description: "Shift updated successfully." });
        setIsEditSheetOpen(false);
        fetchHistory(historyPage);
    } else {
        toast({ title: "Error", description: result.error || "Failed to update shift.", variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const onConfirmDelete = async () => {
    if (!currentUser?.id || !shiftToDelete) return;
    const result = await deleteShiftAction(shiftToDelete.id, currentUser.id);
     if (result.success) {
        toast({ title: "Success", description: "Shift deleted successfully." });
        setShiftToDelete(null);
        fetchHistory(1); setHistoryPage(1);
    } else {
        toast({ title: "Error", description: result.error || "Failed to delete shift.", variant: "destructive" });
    }
  }

  const handleEditClick = (shift: CashRegisterShift) => {
    setEditingShift(shift);
    editForm.reset({
        closingBalance: shift.closingBalance || undefined,
        notes: shift.notes || '',
    });
    setIsEditSheetOpen(true);
  };

  const handleUnlockBalance = async () => {
    setUnlockError('');
    const result = await verifyAdminPasswordAction(adminPassword);
    if (result.success) {
        setOpeningBalanceLocked(false);
        setIsUnlockDialogOpen(false);
        setAdminPassword('');
        toast({ title: "Unlocked", description: "Opening balance can now be edited." });
    } else {
        setUnlockError(result.error || 'Password verification failed.');
    }
  };

  const historyPages = Math.ceil(historyTotalCount / 10);

  const renderActiveShiftSection = () => {
    if (isLoading && !isSuperAdminWithoutCompany) return <Skeleton className="h-96 w-full" />;
    
    if (activeShift) { // Close Shift Form and Summary
      return (
        <fieldset disabled={isSuperAdminWithoutCompany} className="grid md:grid-cols-2 gap-6">
          <Card className="bg-card border-border shadow-xl h-fit">
            <CardHeader><CardTitle className="flex items-center"><BadgeDollarSign className="mr-2 text-primary"/> Shift Actions</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
                <CardTitle className="text-xl text-card-foreground flex items-center"><DoorClosed className="mr-2 text-destructive" /> Close Current Shift</CardTitle>
                <CardDescription>Enter the final cash amount in the drawer to close your shift.</CardDescription>
                
                <div className="p-3 rounded-md bg-muted/30 border border-border/50 text-sm">
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-muted-foreground">Expected in Drawer:</span>
                        <span className="font-bold text-accent">Rs. {expectedInDrawer.toFixed(2)}</span>
                    </div>
                </div>

                <div>
                  <Label htmlFor="closingBalance" className="text-card-foreground">Closing Balance (Physical Count)*</Label>
                  <Input id="closingBalance" type="number" step="0.01" {...register('closingBalance', { valueAsNumber: true })} className="bg-input border-border" placeholder="e.g., 5500.50" />
                  {errors.closingBalance && <p className="text-xs text-destructive mt-1">{errors.closingBalance.message}</p>}
                </div>
                 {discrepancy !== null && (
                    <div className={`flex justify-between items-center p-2 rounded-md text-sm ${discrepancy === 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        <div className="flex items-center">
                          {discrepancy === 0 ? <CheckCircle className="mr-2 h-4 w-4" /> : <AlertCircle className="mr-2 h-4 w-4" />}
                          <span className="font-medium">Discrepancy:</span>
                        </div>
                        <span className="font-bold">Rs. {discrepancy.toFixed(2)}</span>
                    </div>
                  )}

                <div>
                  <Label htmlFor="notes" className="text-card-foreground">Notes (Optional)</Label>
                  <Textarea id="notes" {...register('notes')} className="bg-input border-border min-h-[60px]" placeholder="Any discrepancies or notes..." />
                  {errors.notes && <p className="text-xs text-destructive mt-1">{errors.notes.message}</p>}
                </div>
                <Button type="submit" disabled={isSubmitting || !isValid} className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {isSubmitting ? 'Closing...' : 'Close Shift & End Day'}
                </Button>
              </form>
            </CardContent>
          </Card>
           <Card className="bg-card border-border shadow-xl h-fit">
              <CardHeader><CardTitle className="flex items-center"><TrendingUp className="mr-2 text-primary"/> Active Shift Summary</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="p-3 rounded-md bg-muted/30 border border-border/50">
                    <p><span className="font-medium text-muted-foreground">Shift Started:</span> {new Date(activeShift.startedAt).toLocaleString()}</p>
                    <p><span className="font-medium text-muted-foreground">Opening Balance:</span> Rs. {activeShift.openingBalance.toFixed(2)}</p>
                </div>
                 {activeShiftSummary ? (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center"><span className="text-muted-foreground flex items-center"><WalletCards className="mr-2 h-4 w-4 text-green-400"/> Cash Sales:</span><span className="text-green-400 font-medium">Rs. {activeShiftSummary.cashSales.toFixed(2)}</span></div>
                        <div className="flex justify-between items-center"><span className="text-muted-foreground flex items-center"><CreditCard className="mr-2 h-4 w-4 text-blue-400"/> Card Sales:</span><span className="text-blue-400 font-medium">Rs. {activeShiftSummary.cardSales.toFixed(2)}</span></div>
                        <Separator className="my-2 bg-border/50"/>
                        <div className="flex justify-between items-center font-bold text-base"><span className="text-foreground">Total Sales:</span><span className="text-foreground">Rs. {activeShiftSummary.totalSales.toFixed(2)}</span></div>
                    </div>
                ) : <p className="text-muted-foreground text-center py-4">Loading summary...</p>}
              </CardContent>
           </Card>
        </fieldset>
      );
    } else { // Start Shift Form
      return (
        <Card className="md:col-span-1 bg-card border-border shadow-xl h-fit max-w-md mx-auto">
          <CardHeader><CardTitle className="flex items-center"><BadgeDollarSign className="mr-2 text-primary"/> Shift Actions</CardTitle></CardHeader>
          <CardContent>
            <fieldset disabled={isSuperAdminWithoutCompany}>
                <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
                <CardTitle className="text-xl text-card-foreground flex items-center"><DoorOpen className="mr-2 text-primary"/> Start New Shift</CardTitle>
                <CardDescription>Enter the initial cash amount in the drawer to start your shift.</CardDescription>
                <div>
                    <Label htmlFor="openingBalance" className="text-card-foreground">Opening Balance*</Label>
                    <div className="flex items-center space-x-2">
                        <Input 
                        id="openingBalance" 
                        type="number" 
                        step="0.01" 
                        {...register('openingBalance', { valueAsNumber: true })} 
                        className="bg-input border-border" 
                        placeholder="e.g., 5000.00"
                        readOnly={openingBalanceLocked}
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => setIsUnlockDialogOpen(true)} title={openingBalanceLocked ? "Unlock to edit" : "Balance is unlocked"}>
                            {openingBalanceLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 text-green-500" />}
                        </Button>
                    </div>
                    {errors.openingBalance && <p className="text-xs text-destructive mt-1">{errors.openingBalance.message}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Suggested from last shift's closing. Use Override for corrections.</p>
                </div>
                <div>
                    <Label htmlFor="notes" className="text-card-foreground">Notes (Optional)</Label>
                    <Textarea id="notes" {...register('notes')} className="bg-input border-border min-h-[60px]" placeholder="Initial shift notes..."/>
                    {errors.notes && <p className="text-xs text-destructive mt-1">{errors.notes.message}</p>}
                </div>
                <Button type="submit" disabled={isSubmitting || !isValid} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    {isSubmitting ? 'Starting...' : 'Start Shift'}
                </Button>
                </form>
            </fieldset>
          </CardContent>
        </Card>
      );
    }
  };

  return (
    <div className="flex flex-col flex-1 p-4 md:p-6 bg-gradient-to-br from-background to-secondary text-foreground">
      <header className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-3">
          <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground self-start sm:self-center">
            <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center">
            <WalletCards className="mr-3 h-7 w-7" /> Cash Register & Shift Management
          </h1>
        </div>
         <div className="flex items-center space-x-2 self-end sm:self-center">
            <Badge variant="outline" className="p-2 border-primary text-primary flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>{currentUser?.username || '...'}</span>
            </Badge>
            <Button onClick={handleLogoutFromPage} variant="outline" size="icon" className="text-red-400 border-red-400 hover:bg-red-400 hover:text-white" title="Logout">
                <LogOut className="h-4 w-4" />
            </Button>
            <Button onClick={() => { fetchActiveShiftAndSummary(); fetchHistory(1); setHistoryPage(1); }} variant="outline" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground" disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
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
                Cash Register & Shift Management is company-specific. This feature is disabled for root users without a company assignment.
              </p>
            </div>
          </CardContent>
        </Card>
      )}


      <div className="space-y-6">
        {renderActiveShiftSection()}
        
        <fieldset disabled={isSuperAdminWithoutCompany}>
            <Card className="bg-card border-border shadow-xl">
            <CardHeader>
                <CardTitle className="flex items-center"><History className="mr-2 text-primary"/> Shift History</CardTitle>
                <CardDescription>View past shift records for all users. You can edit or delete records if needed.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader><TableRow>
                        <TableHead className="text-muted-foreground">Start Time</TableHead>
                        <TableHead className="text-muted-foreground">End Time</TableHead>
                        <TableHead className="text-muted-foreground">User</TableHead>
                        <TableHead className="text-right text-muted-foreground">Opening</TableHead>
                        <TableHead className="text-right text-muted-foreground">Closing</TableHead>
                        <TableHead className="text-center text-muted-foreground">Status</TableHead>
                        <TableHead className="text-center text-muted-foreground">Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                    {isLoading && shiftHistory.length === 0 ? (
                        Array.from({ length: 5 }).map((_, i) => (<TableRow key={`skel-shift-${i}`}><TableCell colSpan={7}><Skeleton className="h-6 w-full bg-muted/50" /></TableCell></TableRow>))
                    ) : shiftHistory.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No shift history found.</TableCell></TableRow>
                    ) : (
                        shiftHistory.map(shift => (
                        <TableRow key={shift.id}>
                            <TableCell className="text-xs text-card-foreground">{new Date(shift.startedAt).toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-card-foreground">{shift.closedAt ? new Date(shift.closedAt).toLocaleString() : 'N/A'}</TableCell>
                            <TableCell className="text-xs text-card-foreground">{shift.user?.username || 'N/A'}</TableCell>
                            <TableCell className="text-right text-green-400">Rs. {shift.openingBalance.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-red-400">{shift.closingBalance ? `Rs. ${shift.closingBalance.toFixed(2)}` : 'N/A'}</TableCell>
                            <TableCell className="text-center"><Badge variant={shift.status === 'OPEN' ? 'default' : 'secondary'} className={shift.status === 'OPEN' ? 'bg-green-500/80 hover:bg-green-600' : ''}>{shift.status}</Badge></TableCell>
                            <TableCell className="text-center space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(shift)} className="h-8 w-8 text-blue-500 hover:text-blue-600" disabled={shift.status === 'OPEN'}><Edit3 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setShiftToDelete(shift)} className="h-8 w-8 text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                            </TableCell>
                        </TableRow>
                        ))
                    )}
                    </TableBody>
                </Table>
                </div>
                {historyPages > 1 && (<div className="flex justify-between items-center pt-4"><Button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} variant="outline" size="sm">Previous</Button><span className="text-xs text-muted-foreground">Page {historyPage} of {historyPages}</span><Button onClick={() => setHistoryPage(p => Math.min(historyPages, p + 1))} disabled={historyPage === historyPages} variant="outline" size="sm">Next</Button></div>)}
            </CardContent>
            </Card>
        </fieldset>
      </div>

       {isEditSheetOpen && editingShift && (
        <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
          <SheetContent className="sm:max-w-md w-full bg-card border-border shadow-xl">
            <SheetHeader><SheetTitle>Edit Closed Shift</SheetTitle><SheetDescription>Update closing balance and notes for shift started on {new Date(editingShift.startedAt).toLocaleDateString()}.</SheetDescription></SheetHeader>
            <form onSubmit={editForm.handleSubmit(onEditFormSubmit)} className="space-y-4 py-4">
                <div>
                  <Label htmlFor="editClosingBalance">Closing Balance</Label>
                  <Input id="editClosingBalance" type="number" step="0.01" {...editForm.register('closingBalance', { valueAsNumber: true })}/>
                  {editForm.formState.errors.closingBalance && <p className="text-xs text-destructive mt-1">{editForm.formState.errors.closingBalance.message}</p>}
                </div>
                 <div>
                  <Label htmlFor="editNotes">Notes</Label>
                  <Textarea id="editNotes" {...editForm.register('notes')} />
                </div>
                <SheetFooter className="mt-6"><SheetClose asChild><Button type="button" variant="outline">Cancel</Button></SheetClose><Button type="submit" disabled={isSubmitting || !editForm.formState.isValid}>{isSubmitting ? 'Saving...' : 'Save Changes'}</Button></SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      )}

      {shiftToDelete && (
          <AlertDialog open={!!shiftToDelete} onOpenChange={() => setShiftToDelete(null)}>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Shift?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete the shift from {new Date(shiftToDelete.startedAt).toLocaleString()}? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
      )}
      
       <Dialog open={isUnlockDialogOpen} onOpenChange={setIsUnlockDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Admin Authorization Required</DialogTitle>
                    <DialogDescription>
                        To override the opening balance, please enter an administrator's password.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="adminPassword">Admin Password</Label>
                    <Input 
                        id="adminPassword" 
                        type="password" 
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleUnlockBalance(); }}
                    />
                    {unlockError && <p className="text-xs text-destructive">{unlockError}</p>}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleUnlockBalance}>Unlock</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

    </div>
  );
}
