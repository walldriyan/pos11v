
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getUnpaidOrPartiallyPaidPurchaseBillsAction, recordPurchasePaymentAction, getPaymentsForPurchaseBillAction, getAllSuppliersAction } from '@/app/actions/purchaseActions';
import { PurchasePaymentCreateInputSchema, PurchasePaymentMethodEnumSchema, PurchaseBillStatusEnumSchema } from '@/lib/zodSchemas';
import type { PurchaseBill, PurchasePayment, PurchasePaymentMethodEnum, PurchasePaymentCreateInput, PurchaseBillStatusEnum, Party as SupplierType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, RefreshCw, DollarSign, CreditCard, Info, CheckCircle, Hourglass, CalendarIcon, Filter, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from "@/lib/utils";
import { addDays, format, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/store/slices/authSlice';

type PaymentFormData = Omit<PurchasePaymentCreateInput, 'purchaseBillId'>;

export default function ManagePurchasePaymentsPage() {
  const { toast } = useToast();
  const currentUser = useSelector(selectCurrentUser);
  const [unpaidBills, setUnpaidBills] = useState<PurchaseBill[]>([]);
  const [selectedBill, setSelectedBill] = useState<PurchaseBill | null>(null);
  const [billPayments, setBillPayments] = useState<PurchasePayment[]>([]);
  
  const [isLoadingBills, setIsLoadingBills] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Advanced Filter State
  const [suppliers, setSuppliers] = useState<SupplierType[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all');
  const [activeFilters, setActiveFilters] = useState<{ supplierId: string; dateRange?: DateRange }>({ supplierId: 'all' });

  const { control, handleSubmit, register, reset, formState: { errors, isValid: isFormValid } } = useForm<PaymentFormData>({
    resolver: zodResolver(PurchasePaymentCreateInputSchema.omit({ purchaseBillId: true })),
    defaultValues: {
      paymentDate: new Date(),
      amountPaid: 0,
      method: PurchasePaymentMethodEnumSchema.Enum.CASH,
      reference: '',
      notes: '',
    },
    mode: 'onChange',
  });

  const fetchUnpaidBills = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsLoadingBills(true);
    const filterParams = {
        supplierId: activeFilters.supplierId === 'all' ? null : activeFilters.supplierId,
        startDate: activeFilters.dateRange?.from ? startOfDay(activeFilters.dateRange.from) : null,
        endDate: activeFilters.dateRange?.to ? endOfDay(activeFilters.dateRange.to) : activeFilters.dateRange?.from ? endOfDay(activeFilters.dateRange.from) : null,
    };
    const result = await getUnpaidOrPartiallyPaidPurchaseBillsAction(currentUser.id, 100, filterParams);
    if (result.success && result.data) {
      setUnpaidBills(result.data);
    } else {
      toast({ title: 'Error Fetching Bills', description: result.error || 'Could not fetch purchase bills.', variant: 'destructive' });
    }
    setIsLoadingBills(false);
  }, [toast, activeFilters, currentUser]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const fetchSuppliers = async () => {
        setIsLoadingSuppliers(true);
        const result = await getAllSuppliersAction(currentUser.id);
        if (result.success && result.data) {
            setSuppliers(result.data);
        } else {
            toast({ title: 'Error', description: 'Could not load suppliers for filter.', variant: 'destructive' });
        }
        setIsLoadingSuppliers(false);
    };
    fetchSuppliers();
  }, [toast, currentUser]);

  useEffect(() => {
    fetchUnpaidBills();
  }, [fetchUnpaidBills]);

  const handleApplyFilters = () => {
    setActiveFilters({ supplierId: selectedSupplierId, dateRange });
  };
  
  const handleClearFilters = () => {
    setSelectedSupplierId('all');
    setDateRange(undefined);
    setActiveFilters({ supplierId: 'all' });
  };


  const fetchBillPayments = useCallback(async (billId: string) => {
    if (!billId) return;
    setIsLoadingPayments(true);
    const result = await getPaymentsForPurchaseBillAction(billId);
    if (result.success && result.data) {
      setBillPayments(result.data);
    } else {
      setBillPayments([]);
      toast({ title: 'Error Fetching Payments', description: result.error || 'Could not fetch payment history.', variant: 'destructive' });
    }
    setIsLoadingPayments(false);
  }, [toast]);

  useEffect(() => {
    if (selectedBill) {
      fetchBillPayments(selectedBill.id);
      reset({
        paymentDate: new Date(),
        amountPaid: 0,
        method: PurchasePaymentMethodEnumSchema.Enum.CASH,
        reference: '',
        notes: '',
      });
    } else {
      setBillPayments([]);
    }
  }, [selectedBill, fetchBillPayments, reset]);

  const handleSelectBill = (bill: PurchaseBill) => {
    setSelectedBill(bill);
  };

  const handleRecordPayment = async (data: PaymentFormData) => {
    if (!currentUser?.id) {
        toast({ title: 'Authentication Error', description: 'You must be logged in to record a payment.', variant: 'destructive' });
        return;
    }
    if (!selectedBill) {
      toast({ title: 'Validation Error', description: 'Please select a purchase bill.', variant: 'destructive' });
      return;
    }
    const amount = Number(data.amountPaid);
    const outstandingAmount = selectedBill.totalAmount - selectedBill.amountPaid;

    if (amount <= 0) {
      toast({ title: 'Validation Error', description: 'Payment amount must be positive.', variant: 'destructive' });
      return;
    }
    if (amount > outstandingAmount + 0.001) {
      toast({ title: 'Validation Error', description: `Payment cannot exceed outstanding Rs. ${outstandingAmount.toFixed(2)}.`, variant: 'destructive' });
      return;
    }

    setIsProcessingPayment(true);
    const paymentDataToSubmit: PurchasePaymentCreateInput = {
        purchaseBillId: selectedBill.id,
        ...data,
        amountPaid: amount,
    };

    const result = await recordPurchasePaymentAction(paymentDataToSubmit, currentUser.id);
    if (result.success && result.data) {
      toast({ title: 'Payment Recorded', description: `Payment of Rs. ${amount.toFixed(2)} for bill ${selectedBill.supplierBillNumber || selectedBill.id} recorded.` });
      fetchUnpaidBills();
      setSelectedBill(result.data);
      reset({
        paymentDate: new Date(),
        amountPaid: 0,
        method: PurchasePaymentMethodEnumSchema.Enum.CASH,
        reference: '',
        notes: '',
      });
    } else {
      toast({ title: 'Error Recording Payment', description: result.error || 'Could not record payment.', variant: 'destructive' });
    }
    setIsProcessingPayment(false);
  };

  const filteredBills = unpaidBills.filter(bill =>
    (bill.supplierBillNumber && bill.supplierBillNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (bill.supplier?.name && bill.supplier.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    bill.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadgeVariant = (status: PurchaseBillStatusEnum) => {
    if (status === 'COMPLETED') return 'destructive';
    if (status === 'PARTIALLY_PAID') return 'secondary';
    if (status === 'PAID') return 'default';
    return 'outline';
  };
  
  const getStatusDisplayName = (bill: PurchaseBill) => {
    if (bill.paymentStatus === 'COMPLETED') {
        return 'Awaiting Payment';
    }
    return bill.paymentStatus.replace('_', ' ');
  };

  const totalAlreadyPaidForSelectedBill = selectedBill?.amountPaid || 0;

  return (
    <div className="flex flex-col h-full p-4 md:p-6 bg-gradient-to-br from-background to-secondary text-foreground">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
            <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                <Link href="/dashboard/purchases">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Create Purchase
                </Link>
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center">
            <CreditCard className="mr-3 h-7 w-7" /> Manage Purchase Payments
            </h1>
        </div>
        <Button onClick={fetchUnpaidBills} variant="outline" disabled={isLoadingBills} className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingBills ? 'animate-spin' : ''}`} /> Refresh List
        </Button>
      </header>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <Card className="w-1/2 lg:w-2/5 flex flex-col bg-card border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-card-foreground">Unpaid/Partially Paid Bills</CardTitle>
            <Card className="p-3 bg-muted/30 mt-2 border-border/50">
                <CardDescription className="mb-2 text-muted-foreground">Filter by Date & Supplier</CardDescription>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-1">
                      <Label htmlFor="date-filter" className="text-xs">Date Range</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button id="date-filter" variant="outline" className={cn("w-full justify-start text-left font-normal bg-input border-border", !dateRange && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? dateRange.to ? `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}` : format(dateRange.from, "LLL dd, y") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2}/></PopoverContent>
                      </Popover>
                  </div>
                   <div className="grid gap-1">
                    <Label htmlFor="supplier-filter" className="text-xs">Supplier</Label>
                    <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId} disabled={isLoadingSuppliers}>
                        <SelectTrigger id="supplier-filter" className="bg-input border-border focus:ring-primary"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Suppliers</SelectItem>
                            {suppliers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                    <Button onClick={handleClearFilters} variant="ghost" size="sm" className="text-xs"><X className="mr-1 h-3 w-3" />Clear</Button>
                    <Button onClick={handleApplyFilters} size="sm" className="text-xs"><Filter className="mr-1 h-3 w-3" />Apply Filters</Button>
                </div>
            </Card>
            <div className="relative mt-4">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Bill ID or Supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-input border-border focus:ring-primary text-card-foreground"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              {isLoadingBills ? (
                <div className="p-4 text-center text-muted-foreground">Loading bills...</div>
              ) : filteredBills.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">No unpaid or partially paid bills found.</div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="text-muted-foreground">Supp. Bill ID</TableHead>
                      <TableHead className="text-muted-foreground">Supplier</TableHead>
                      <TableHead className="text-right text-muted-foreground">Amount Due</TableHead>
                      <TableHead className="text-center text-muted-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBills.map((bill) => (
                      <TableRow
                        key={bill.id}
                        onClick={() => handleSelectBill(bill)}
                        className={`cursor-pointer hover:bg-muted/50 ${selectedBill?.id === bill.id ? 'bg-primary/10' : ''}`}
                      >
                        <TableCell className="text-card-foreground text-xs py-2">{bill.supplierBillNumber || bill.id.substring(0,8)}</TableCell>
                        <TableCell className="text-card-foreground text-xs py-2">{bill.supplier?.name || 'N/A'}</TableCell>
                        <TableCell className="text-right text-card-foreground text-xs py-2">
                          Rs. {(bill.totalAmount - bill.amountPaid).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center py-2">
                           <Badge variant={getStatusBadgeVariant(bill.paymentStatus)} className="text-xs">
                             {getStatusDisplayName(bill)}
                           </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex-1 flex flex-col bg-card border-border shadow-lg overflow-hidden">
          <CardHeader>
            <CardTitle className="text-card-foreground">
              {selectedBill ? `Details for Bill: ${selectedBill.supplierBillNumber || selectedBill.id}` : 'Select a Bill'}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {selectedBill ? `Supplier: ${selectedBill.supplier?.name || 'N/A'}` : 'Select a bill to view details and record payments.'}
            </CardDescription>
          </CardHeader>
          <ScrollArea className="flex-1">
            <CardContent className="p-4 space-y-4">
              {!selectedBill ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Info className="mx-auto h-10 w-10 mb-3" />
                  <p>No bill selected.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit(handleRecordPayment)}>
                  <div className="p-3 rounded-md bg-muted/30 border border-border/50 space-y-1 text-sm mb-4">
                    <h4 className="font-semibold text-card-foreground mb-1">Bill Summary</h4>
                    <div className="flex justify-between"><span className="text-muted-foreground">Original Total:</span> <span className="text-card-foreground font-medium">Rs. {selectedBill.totalAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Paid:</span> <span className="text-green-400 font-medium">Rs. {totalAlreadyPaidForSelectedBill.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Currently Due:</span> <span className="text-red-400 font-bold">Rs. {(selectedBill.totalAmount - totalAlreadyPaidForSelectedBill).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Payment Status:</span> <Badge variant={getStatusBadgeVariant(selectedBill.paymentStatus)} className="text-xs">{getStatusDisplayName(selectedBill)}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Purchase Date:</span> <span className="text-card-foreground"> {new Date(selectedBill.purchaseDate).toLocaleDateString()}</span></div>
                  </div>

                  <Separator className="my-3 bg-border/30" />

                  {selectedBill.paymentStatus !== PurchaseBillStatusEnumSchema.Enum.PAID && (
                    <div className="space-y-3 p-3 border border-dashed border-primary/40 rounded-md bg-primary/5">
                      <h4 className="font-semibold text-primary mb-1">Record New Payment</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="paymentDate" className="text-card-foreground">Payment Date*</Label>
                            <Controller
                            name="paymentDate"
                            control={control}
                            render={({ field }) => (
                                <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal bg-input border-border hover:bg-input/80 text-card-foreground",
                                        !field.value && "text-muted-foreground"
                                    )}
                                    >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                </PopoverContent>
                                </Popover>
                            )}
                            />
                            {errors.paymentDate && <p className="text-xs text-destructive mt-1">{errors.paymentDate.message}</p>}
                        </div>
                        <div>
                          <Label htmlFor="amountPaid" className="text-card-foreground">Amount to Pay (Rs.)*</Label>
                          <Controller name="amountPaid" control={control} render={({ field }) => (
                                <Input id="amountPaid" type="number" step="0.01" placeholder="Enter amount"
                                    className="bg-input border-border focus:ring-primary text-card-foreground"
                                    value={field.value === null || field.value === undefined || field.value === 0 ? '' : String(field.value)}
                                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                    min="0.01" max={(selectedBill.totalAmount - totalAlreadyPaidForSelectedBill).toFixed(2)}
                                />
                            )} />
                          {errors.amountPaid && <p className="text-xs text-destructive mt-1">{errors.amountPaid.message}</p>}
                        </div>
                      </div>
                       <div>
                        <Label htmlFor="method" className="text-card-foreground">Payment Method*</Label>
                        <Controller name="method" control={control} render={({ field }) => (
                            <Select value={field.value} onValueChange={(value) => field.onChange(value as PurchasePaymentMethodEnum)}>
                            <SelectTrigger id="method" className="bg-input border-border focus:ring-primary text-card-foreground">
                                <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.values(PurchasePaymentMethodEnumSchema.Enum).map(method => (
                                <SelectItem key={method} value={method}>{method.replace('_', ' ')}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                        )} />
                        {errors.method && <p className="text-xs text-destructive mt-1">{errors.method.message}</p>}
                      </div>
                      <div>
                        <Label htmlFor="reference" className="text-card-foreground">Reference (Optional)</Label>
                        <Input id="reference" {...register('reference')} placeholder="e.g., Cheque No, Txn ID" className="bg-input border-border focus:ring-primary text-card-foreground" />
                         {errors.reference && <p className="text-xs text-destructive mt-1">{errors.reference.message}</p>}
                      </div>
                      <div>
                        <Label htmlFor="notes" className="text-card-foreground">Notes (Optional)</Label>
                        <Textarea id="notes" {...register('notes')} placeholder="Payment notes..." className="bg-input border-border focus:ring-primary text-card-foreground min-h-[60px]" />
                         {errors.notes && <p className="text-xs text-destructive mt-1">{errors.notes.message}</p>}
                      </div>
                      <Button type="submit" disabled={isProcessingPayment || !isFormValid} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        {isProcessingPayment ? 'Processing...' : <><DollarSign className="mr-2 h-4 w-4" /> Record Payment</>}
                      </Button>
                    </div>
                  )}
                  {selectedBill.paymentStatus === PurchaseBillStatusEnumSchema.Enum.PAID && (
                    <div className="p-3 text-center text-green-600 bg-green-500/10 rounded-md border border-green-500/30">
                        <CheckCircle className="mx-auto h-8 w-8 mb-2" />
                        This bill is fully paid.
                    </div>
                  )}

                  <Separator className="my-3 bg-border/30" />
                  
                  <div>
                    <h4 className="font-semibold text-card-foreground mb-2">Payment History for this Bill</h4>
                    {isLoadingPayments ? (
                      <p className="text-muted-foreground">Loading payment history...</p>
                    ) : billPayments.length === 0 ? (
                      <p className="text-muted-foreground">No payments recorded for this bill yet.</p>
                    ) : (
                      <ScrollArea className="max-h-48 border border-border/50 rounded-md bg-card">
                        <Table>
                          <TableHeader className="sticky top-0 bg-muted/50 z-10">
                            <TableRow>
                              <TableHead className="text-muted-foreground">Date</TableHead>
                              <TableHead className="text-right text-muted-foreground">Amount Paid</TableHead>
                              <TableHead className="text-muted-foreground">Method</TableHead>
                              <TableHead className="text-muted-foreground">Reference</TableHead>
                              <TableHead className="text-muted-foreground">Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {billPayments.map((payment) => (
                              <TableRow key={payment.id} className="hover:bg-muted/30">
                                <TableCell className="text-card-foreground text-xs">{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                                <TableCell className="text-right text-card-foreground text-xs">Rs. {payment.amountPaid.toFixed(2)}</TableCell>
                                <TableCell className="text-card-foreground text-xs">{payment.method.replace('_', ' ')}</TableCell>
                                <TableCell className="text-card-foreground text-xs">{payment.reference || 'N/A'}</TableCell>
                                <TableCell className="text-card-foreground text-xs truncate max-w-[100px]" title={payment.notes || ''}>{payment.notes || 'N/A'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </div>
                </form>
              )}
            </CardContent>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}

