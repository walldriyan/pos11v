
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { recordPurchasePaymentAction, getAllSuppliersAction } from '@/app/actions/purchaseActions';
import { getCreditSalesAction, recordCreditPaymentAction, getInstallmentsForSaleAction, deletePaymentInstallmentAction } from '@/app/actions/saleActions';
import { getAllCustomersAction } from '@/app/actions/partyActions';
import type { SaleRecord, PaymentInstallment, CreditPaymentStatus, Party as CustomerType, ReturnedItemDetail } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Search, RefreshCw, ReceiptText, DollarSign, ListChecks, Info, CheckCircle, Hourglass, Printer, CalendarIcon, Filter, X, User, ChevronsUpDown, AlertTriangle, Banknote, Landmark, WalletCards, ArrowUpRight, ArrowDownCircle, ListFilter, ChevronLeft, ChevronRight, FileArchive, Sigma, Repeat, FileText, TrendingUp, TrendingDown, ShoppingBag, ArrowUpRight as ArrowUpRightIcon, CurrencyIcon, CopySlash, CopySlashIcon, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CreditBillPrintContent } from '@/components/pos/CreditBillPrintContent';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/store/slices/authSlice';
import { usePermissions } from '@/hooks/usePermissions';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { addDays, format, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


const ITEMS_PER_PAGE = 10;

export default function CreditManagementPage() {
  const { toast } = useToast();
  const currentUser = useSelector(selectCurrentUser);
  const { can, check } = usePermissions();
  const canUpdateSale = can('update', 'Sale');

  const isSuperAdminWithoutCompany = currentUser?.role?.name === 'Admin' && !currentUser?.companyId;

  const [creditSales, setCreditSales] = useState<SaleRecord[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<{ activeBillForDisplay: SaleRecord, pristineOriginalSale: SaleRecord | null } | null>(null);
  const [installments, setInstallments] = useState<PaymentInstallment[]>([]);
  const [installmentToDelete, setInstallmentToDelete] = useState<PaymentInstallment | null>(null);

  const [isLoadingSales, setIsLoadingSales] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isLoadingInstallments, setIsLoadingInstallments] = useState(false);
  const [isPrintingBill, setIsPrintingBill] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'OTHER'>('CASH');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [customers, setCustomers] = useState<CustomerType[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [showPaidBills, setShowPaidBills] = useState(false);
  const [activeFilters, setActiveFilters] = useState<{ customerId: string; dateRange?: DateRange, status: 'OPEN' | 'PAID' }>({ customerId: 'all', status: 'OPEN' });

  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const customerSearchInputRef = useRef<HTMLInputElement>(null);

  const [activeCard, setActiveCard] = useState<'history' | 'status'>('status');


  const fetchCreditSales = useCallback(async () => {
    if (!currentUser?.id || isSuperAdminWithoutCompany) {
      setIsLoadingSales(false);
      setCreditSales([]);
      setTotalCount(0);
      return;
    }
    setIsLoadingSales(true);
    const filterParams = {
      customerId: activeFilters.customerId === 'all' ? null : activeFilters.customerId,
      startDate: activeFilters.dateRange?.from ? startOfDay(activeFilters.dateRange.from) : null,
      endDate: activeFilters.dateRange?.to ? endOfDay(activeFilters.dateRange.to) : activeFilters.dateRange?.from ? endOfDay(activeFilters.dateRange.from) : null,
      status: activeFilters.status,
    };
    const result = await getCreditSalesAction(currentUser.id, currentPage, ITEMS_PER_PAGE, filterParams);
    if (result.success && result.data) {
      setCreditSales(result.data.sales);
      setTotalCount(result.data.totalCount);
    } else {
      toast({ title: 'Error', description: result.error || 'Could not fetch credit sales.', variant: 'destructive' });
      setCreditSales([]);
      setTotalCount(0);
    }
    setIsLoadingSales(false);
  }, [toast, currentUser?.id, activeFilters, currentPage, isSuperAdminWithoutCompany]);

  useEffect(() => {
    if (!currentUser?.id || isSuperAdminWithoutCompany) {
      setIsLoadingCustomers(false);
      setCustomers([]);
      return;
    }
    const fetchCustomers = async () => {
      setIsLoadingCustomers(true);
      const result = await getAllCustomersAction(currentUser.id);
      if (result.success && result.data) {
        setCustomers(result.data);
      } else {
        toast({ title: 'Error', description: 'Could not load customers for filter.', variant: 'destructive' });
      }
      setIsLoadingCustomers(false);
    };
    fetchCustomers();
  }, [toast, currentUser?.id, isSuperAdminWithoutCompany]);

  useEffect(() => {
    fetchCreditSales();
  }, [fetchCreditSales]);

  const handleApplyFilters = () => {
    setCurrentPage(1);
    setActiveFilters({ customerId: selectedCustomerId, dateRange, status: showPaidBills ? 'PAID' : 'OPEN' });
  };

  const handleClearFilters = () => {
    setSelectedCustomerId('all');
    setDateRange(undefined);
    setShowPaidBills(false);
    setCurrentPage(1);
    setActiveFilters({ customerId: 'all', status: 'OPEN' });
  };


  const fetchInstallments = useCallback(async (sale: SaleRecord) => {
    if (!sale) return;
    setIsLoadingInstallments(true);
    const result = await getInstallmentsForSaleAction(sale.id);
    if (result.success && result.data) {
      setInstallments(result.data);
    } else {
      setInstallments([]);
      toast({ title: 'Error Fetching Payments', description: result.error || 'Could not fetch payment history.', variant: 'destructive' });
    }
    setIsLoadingInstallments(false);
  }, [toast]);


  const handleSelectGroup = async (sale: SaleRecord) => {
    setSelectedGroup({ activeBillForDisplay: sale, pristineOriginalSale: sale }); // Simplified for now
    setActiveCard('history');
    setPaymentAmount('');
    setPaymentMethod('CASH');
    setPaymentNotes('');
    await fetchInstallments(sale);
  };

  const handleRecordPayment = async () => {
    const { permitted, toast: permissionToast } = check('update', 'Sale');
    if (!permitted) {
      permissionToast();
      return;
    }
    if (!currentUser?.id) {
      toast({ title: 'Authentication Error', description: 'You must be logged in to record a payment.', variant: 'destructive' });
      return;
    }
    const selectedSale = selectedGroup?.activeBillForDisplay;
    if (!selectedSale || !paymentAmount) {
      toast({ title: 'Validation Error', description: 'Please select a sale and enter payment amount.', variant: 'destructive' });
      return;
    }
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Validation Error', description: 'Invalid payment amount.', variant: 'destructive' });
      return;
    }

    const billFinancials = calculateBillFinancials(selectedGroup);
    if (!billFinancials) return;

    if (amount > billFinancials.finalBalance + 0.01) {
      toast({ title: 'Validation Error', description: `Payment cannot exceed outstanding Rs. ${(billFinancials.finalBalance).toFixed(2)}.`, variant: 'destructive' });
      return;
    }

    setIsProcessingPayment(true);
    const result = await recordCreditPaymentAction(selectedSale.id, amount, paymentMethod, currentUser.id, paymentNotes);
    if (result.success && result.data) {
      toast({ title: 'Payment Recorded', description: `Payment of Rs. ${amount.toFixed(2)} for bill ${selectedSale.billNumber} recorded.` });
      // Correctly refresh the state
      await fetchCreditSales(); 
      // After fetching the list, find the updated bill and set it as selected
      const updatedList = await getCreditSalesAction(currentUser.id, currentPage, ITEMS_PER_PAGE, activeFilters);
      if (updatedList.success && updatedList.data) {
          const updatedBillInList = updatedList.data.sales.find(s => s.id === result.data?.id);
          if (updatedBillInList) {
             setSelectedGroup({ activeBillForDisplay: updatedBillInList, pristineOriginalSale: updatedBillInList });
             await fetchInstallments(updatedBillInList);
          } else {
             // If the bill is now paid, it might not be in the "OPEN" list anymore.
             // We can just use the returned data.
             setSelectedGroup({ activeBillForDisplay: result.data, pristineOriginalSale: result.data });
             await fetchInstallments(result.data);
          }
      }
      
      setPaymentAmount('');
      setPaymentNotes('');
    } else {
      toast({ title: 'Error Recording Payment', description: result.error || 'Could not record payment.', variant: 'destructive' });
    }
    setIsProcessingPayment(false);
  };

  const handleConfirmDeleteInstallment = async () => {
    const { permitted, toast: permissionToast } = check('update', 'Sale');
    if (!permitted || !installmentToDelete || !currentUser?.id) {
      if (!permitted) permissionToast();
      setInstallmentToDelete(null);
      return;
    }

    setIsProcessingPayment(true);
    const result = await deletePaymentInstallmentAction(installmentToDelete.id, currentUser.id);

    if (result.success && result.data) {
      toast({ title: 'Payment Deleted', description: `Payment of Rs. ${installmentToDelete.amountPaid.toFixed(2)} has been removed.` });
      
      setSelectedGroup({ activeBillForDisplay: result.data, pristineOriginalSale: result.data });
      await fetchInstallments(result.data);
      await fetchCreditSales();
    } else {
      toast({ title: 'Error Deleting Payment', description: result.error, variant: 'destructive' });
    }
    setInstallmentToDelete(null);
    setIsProcessingPayment(false);
  };


  const handlePrintFullBill = () => {
    const selectedSale = selectedGroup?.activeBillForDisplay;
    if (!selectedSale) {
      toast({ title: "Error", description: "No sale selected to print.", variant: "destructive" });
      return;
    }
    setIsPrintingBill(true);

    setTimeout(() => {
      const printContentHolder = document.getElementById('printable-credit-bill-holder');
      if (!printContentHolder) {
        console.error('Credit bill print content holder not found.');
        toast({ title: "Print Error", description: "Receipt content area not found.", variant: "destructive" });
        setIsPrintingBill(false);
        return;
      }

      const printContents = printContentHolder.innerHTML;
      if (!printContents || printContents.trim() === "") {
        console.error('Credit bill content holder is empty.');
        toast({ title: "Print Error", description: "No content generated for the receipt.", variant: "destructive" });
        setIsPrintingBill(false);
        return;
      }

      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = '0';
      iframe.setAttribute('title', `Print Bill ${selectedSale.billNumber}`);
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (iframeDoc) {
        const printHtml = `
          <html>
          <head>
              <title>Credit Bill - ${selectedSale.billNumber}</title>
              <style>
                  @page { size: auto; margin: 5px; }
                  body { margin: 0; font-family: 'Courier New', Courier, monospace; font-size: 8pt; background-color: white; color: black; height: fit-content; }
                  .receipt-container { width: 100%; margin: 0; padding: 0; height: fit-content; }
                  table { width: 100%; border-collapse: collapse; font-size: 7pt; margin-bottom: 3px; }
                  th, td { padding: 1px 2px; vertical-align: top; }
                  .text-left { text-align: left; } .text-right { text-align: right; } .text-center { text-align: center; }
                  .font-bold { font-weight: bold; }
                  .company-details p, .header-info p, .customer-name, .section-title { margin: 2px 0; font-size: 8pt; }
                  .company-details h3 { font-size: 10pt; margin: 1px 0;}
                  .item-name { word-break: break-all; max-width: 100px; } 
                  .col-price { max-width: 45px; } .col-discount { max-width: 40px; } .col-total { max-width: 50px; }
                  hr.separator { border: none; border-top: 1px dashed black; margin: 3px 0; }
                  .totals-section div { display: flex; justify-content: space-between; padding: 0px 0; font-size: 8pt; }
                  .totals-section .value { text-align: right; }
                  .thank-you { margin-top: 5px; text-align: center; font-size: 8pt; }
                  .section-break { margin-top: 5px; margin-bottom: 5px; }
                  .sub-table th { font-size: 6.5pt; padding: 1px; } .sub-table td { font-size: 6.5pt; padding: 1px; }
                  @media print {
                      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 8pt !important; color: black !important; background-color: white !important; height: auto !important; }
                      .receipt-container { margin: 0; padding:0; width: 100%; height: fit-content !important; }
                      table { font-size: 7pt !important; } .sub-table th, .sub-table td { font-size: 6.5pt !important; }
                  }
              </style>
          </head>
          <body><div class="receipt-container">${printContents}</div></body>
          </html>
        `;
        iframeDoc.open();
        iframeDoc.write(printHtml);
        iframeDoc.close();

        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } else {
          console.error("Iframe contentWindow became null before print.");
          toast({ title: "Print Error", description: "Failed to access iframe for printing.", variant: "destructive" });
        }
      } else {
        console.error("Could not get iframe document for printing.");
        toast({ title: "Print Error", description: "Could not prepare print document.", variant: "destructive" });
      }

      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1000);

      setIsPrintingBill(false);
    }, 200);
  };


  const getStatusBadgeVariant = (status?: CreditPaymentStatus | null) => {
    if (status === 'PENDING') return 'destructive';
    if (status === 'PARTIALLY_PAID') return 'secondary';
    if (status === 'FULLY_PAID') return 'default';
    return 'outline';
  };

  const calculateBillFinancials = useCallback((group: { activeBillForDisplay: SaleRecord, pristineOriginalSale: SaleRecord | null } | null) => {
    if (!group || !group.activeBillForDisplay) return null;

    const { activeBillForDisplay, pristineOriginalSale } = group;

    const netBillAmount = activeBillForDisplay.totalAmount;
    // Use the amountPaidByCustomer from the *original* sale, as this is the total cash/card collected against this bill number.
    const totalPaidByCustomer = pristineOriginalSale?.amountPaidByCustomer || activeBillForDisplay.amountPaidByCustomer || 0;

    // Correctly calculate the final balance due.
    const finalBalance = netBillAmount - totalPaidByCustomer;

    const initialPaymentRecord = (activeBillForDisplay.paymentInstallments || []).find(inst => inst.notes?.includes("Initial payment"));
    const initialPayment = initialPaymentRecord ? initialPaymentRecord.amountPaid : (pristineOriginalSale?.amountPaidByCustomer || 0);
    const subsequentInstallments = (activeBillForDisplay.paymentInstallments || []).filter(inst => !inst.notes?.includes("Initial payment"));

    return {
      netBillAmount,
      totalPaidByCustomer,
      finalBalance,
      initialPayment: initialPayment,
      installments: subsequentInstallments,
    };
  }, []);

  const billFinancials = useMemo(() => calculateBillFinancials(selectedGroup), [selectedGroup, calculateBillFinancials]);

  const maxPage = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const filteredCreditSales = useMemo(() => {
    if (!searchTerm) return creditSales;
    const lowerCaseSearch = searchTerm.toLowerCase();
    return creditSales.filter(bill =>
      (bill.billNumber && bill.billNumber.toLowerCase().includes(lowerCaseSearch)) ||
      (bill.customerName && bill.customerName.toLowerCase().includes(lowerCaseSearch))
    );
  }, [creditSales, searchTerm]);

  const filteredCustomersForDropdown = useMemo(() => {
    if (!customerSearchTerm) return customers;
    const lowerCaseSearch = customerSearchTerm.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(lowerCaseSearch) ||
      (c.phone && c.phone.includes(customerSearchTerm))
    );
  }, [customers, customerSearchTerm]);


  return (
    <>
      <div className="flex flex-col h-full p-4 md:p-6 bg-gradient-to-br from-background to-secondary text-foreground">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center">
            <ReceiptText className="mr-3 h-7 w-7" />
            Credit Management
          </h1>
          <div className="flex items-center space-x-2">
            <Button onClick={() => fetchCreditSales()} variant="outline" disabled={isLoadingSales} className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingSales ? 'animate-spin' : ''}`} /> Refresh List
            </Button>
             <Button onClick={handlePrintFullBill} variant="outline" disabled={!selectedGroup?.activeBillForDisplay || isPrintingBill} className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white">
                <Printer className="mr-2 h-4 w-4" /> {isPrintingBill ? 'Printing...' : 'Print Full Bill Details'}
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
                  Credit management is company-specific. To use this feature, please ensure your Super Admin account is associated with a company in the User Management settings.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-1 gap-4 overflow-hidden" >
          <div className="w-1/2 lg:w-3/5 flex flex-col space-y-4">
            {selectedGroup && billFinancials && (
              <Card className="p-4 bg-muted/20 border-border/40">
                <CardHeader className="p-0 pb-3"><CardTitle className="text-base font-medium text-foreground flex items-center"><Sigma className="mr-2 h-4 w-4 text-primary" />Financial Status</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Accordion type="single" collapsible defaultValue="summary" className="w-full">
                    <AccordionItem value="summary" className="border-b-0">
                      <AccordionTrigger className="p-0 hover:no-underline text-base font-semibold flex-col items-start !space-y-2">
                        <div className="flex justify-between items-start w-full">
                          <div className="text-left">
                            <span className="text-gray-400 text-sm">Final Balance</span>
                            <h2 className="text-4xl text-red-400 font-bold">

                              Rs. {billFinancials.finalBalance.toFixed(2)}
                            </h2>
                          </div>

                          {/* Balance Amount */}
                          <div className="flex items-end gap-2">

                            <div className="flex items-center text-green-400 text-sm font-medium">
                              <ArrowUpRightIcon className="w-4 h-4 mr-1" />
                              Paid: Rs. {billFinancials.totalPaidByCustomer.toFixed(2)}
                            </div>
                            <div className="flex items-center text-primary text-xl font-medium">
                              <ArrowUpRightIcon className="w-4 h-4 mr-1" />
                              OF  Rs. {billFinancials.netBillAmount.toFixed(2)} BILL.
                            </div>
                          </div>

                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-3 mt-2 border-t border-border/50">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span>Payment Method:</span> <span>{selectedGroup?.activeBillForDisplay?.paymentMethod}</span></div>
                          <div className="flex justify-between"><span>Date of Original Sale:</span> <span>{new Date(selectedGroup?.activeBillForDisplay?.date).toLocaleDateString()}</span></div>
                          <div className="flex justify-between"><span>Customer:</span> <span>{selectedGroup?.activeBillForDisplay?.customerName || 'N/A'}</span></div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    {billFinancials.installments.length > 0 && (
                      <AccordionItem value="installments" className="border-b-0 pt-2 mt-2 border-t border-border/30">
                          <AccordionTrigger className="py-1 text-sm font-medium text-muted-foreground hover:no-underline">
                              View Payment Installment History ({billFinancials.installments.length})
                          </AccordionTrigger>
                          <AccordionContent>
                              <Table className="text-xs">
                                  <TableHeader>
                                      <TableRow className="border-b-border/30">
                                          <TableHead className="h-6 text-muted-foreground">Date</TableHead>
                                          <TableHead className="text-right h-6 text-muted-foreground">Amount Paid</TableHead>
                                          <TableHead className="h-6 text-muted-foreground">Method</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {billFinancials.initialPayment > 0 && (
                                       <TableRow className="border-b-border/30 bg-muted/10 italic">
                                          <TableCell>{new Date(selectedGroup?.activeBillForDisplay?.date).toLocaleDateString()}</TableCell>
                                          <TableCell className="text-right">Rs. {billFinancials.initialPayment.toFixed(2)}</TableCell>
                                          <TableCell>Initial Payment</TableCell>
                                      </TableRow>
                                    )}
                                    {billFinancials.installments.map(inst => (
                                      <TableRow key={inst.id} className="border-b-border/30">
                                          <TableCell>{new Date(inst.paymentDate).toLocaleDateString()}</TableCell>
                                          <TableCell className="text-right">Rs. {inst.amountPaid.toFixed(2)}</TableCell>
                                          <TableCell>{inst.method}</TableCell>
                                      </TableRow>
                                    ))}
                                    <TableRow className="bg-muted/30 font-semibold">
                                        <TableCell>Total Paid</TableCell>
                                        <TableCell className="text-right" colSpan={2}>Rs. {billFinancials.totalPaidByCustomer.toFixed(2)}</TableCell>
                                    </TableRow>
                                  </TableBody>
                              </Table>
                          </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>
                </CardContent>
              </Card>
            )}
            <Card className="p-4 bg-primary/5 border-primary/40 border-dashed">
              <CardHeader className="p-0 pb-3"><CardTitle className="text-base text-primary flex items-center"><DollarSign className="mr-2 h-4 w-4" />Record New Payment Installment</CardTitle></CardHeader>
              <CardContent className="p-0 space-y-4">
                <div><Label htmlFor="paymentAmount" className="text-card-foreground text-sm">Amount to Pay (Rs.)*</Label><Input id="paymentAmount" type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Enter amount" className="bg-input border-border focus:ring-primary text-card-foreground mt-1 h-12 text-lg" min="0.01" step="0.01" max={selectedGroup?.activeBillForDisplay?.creditOutstandingAmount?.toFixed(2) || '0'} /></div>
                <div><Label htmlFor="paymentMethod" className="text-card-foreground text-sm">Payment Method*</Label><Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as 'CASH' | 'BANK_TRANSFER' | 'OTHER')}><SelectTrigger className="bg-input border-border focus:ring-primary text-card-foreground mt-1"><SelectValue placeholder="Select method" /></SelectTrigger><SelectContent><SelectItem value="CASH"><div className="flex items-center gap-2"><WalletCards className="h-4 w-4" />Cash</div></SelectItem><SelectItem value="BANK_TRANSFER"><div className="flex items-center gap-2"><Landmark className="h-4 w-4" />Bank Transfer</div></SelectItem><SelectItem value="OTHER"><div className="flex items-center gap-2"><Banknote className="h-4 w-4" />Other</div></SelectItem></SelectContent></Select></div>
                <div><Label htmlFor="paymentNotes" className="text-card-foreground text-xs">Notes (Optional)</Label><Textarea id="paymentNotes" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="e.g., Paid by John Doe, Ref#123" className="bg-input border-border focus:ring-primary text-card-foreground min-h-[60px] mt-1" /></div>
                <Button onClick={handleRecordPayment} disabled={isProcessingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0 || !canUpdateSale || !selectedGroup} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">{isProcessingPayment ? 'Processing...' : 'Record Payment'}</Button>
              </CardContent>
            </Card>




            <div className="grid grid-cols-1 gap-4 ">
              <Card className="p-4 bg-muted/20 border-border/40">
                <CardHeader className="p-0 pb-3"><CardTitle className="text-base font-medium text-foreground flex items-center"><ListChecks className="mr-2 h-4 w-4 text-primary" />Payment History</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {isLoadingInstallments ? (<p className="text-muted-foreground text-xs">Loading payment history...</p>) : installments.length === 0 ? (<p className="text-muted-foreground text-xs">No payment installments recorded.</p>) : (
                    <ScrollArea className="h-40">


                      <Table>
                        <TableHeader className="sticky top-0 bg-muted/50 z-10">
                          <TableRow>
                            <TableHead className="text-muted-foreground h-8 text-xs">Date</TableHead>
                            <TableHead className="text-right text-muted-foreground h-8 text-xs">Amount Paid</TableHead>
                            <TableHead className="text-muted-foreground h-8 text-xs">Method</TableHead>
                            <TableHead className="text-center text-muted-foreground h-8 text-xs">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {installments.map((inst) => (
                            <TableRow key={inst.id} className="hover:bg-muted/30">
                              <TableCell className="text-card-foreground text-xs py-1.5">{new Date(inst.paymentDate).toLocaleString()}</TableCell>
                              <TableCell className="text-right text-card-foreground text-xs py-1.5">Rs. {inst.amountPaid.toFixed(2)}</TableCell>
                              <TableCell className="text-card-foreground text-xs py-1.5">{inst.method}</TableCell>
                              <TableCell className="text-center py-1.5">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setInstallmentToDelete(inst)} disabled={!canUpdateSale}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>




          </div>

          <Card className="w-1/2 lg:w-2/5 flex flex-col bg-card border-border shadow-lg">
            <CardHeader>
              <CardTitle className="text-card-foreground">Search & Filter Bills</CardTitle>
              <Card className="p-3 bg-muted/30 mt-2 border-border/50">
                <CardDescription className="mb-2 text-muted-foreground">Filter by Date & Supplier</CardDescription>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-1"><Label htmlFor="date-filter" className="text-xs">Date Range</Label><Popover><PopoverTrigger asChild><Button id="date-filter" variant="outline" className={cn("w-full justify-start text-left font-normal bg-input border-border", !dateRange && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? dateRange.to ? `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}` : format(dateRange.from, "LLL dd, y") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} /></PopoverContent></Popover></div>
                  <div className="grid gap-1"><Label htmlFor="customer-filter" className="text-xs">Customer</Label><Popover open={isCustomerPopoverOpen} onOpenChange={(open) => { setIsCustomerPopoverOpen(open); if (open) setTimeout(() => customerSearchInputRef.current?.focus(), 100); }}><PopoverTrigger asChild><Button id="customer-filter" variant="outline" role="combobox" className="w-full justify-between bg-input border-border font-normal" disabled={isLoadingCustomers}><span className="truncate">{selectedCustomerId === 'all' ? 'All Customers' : customers.find(c => c.id === selectedCustomerId)?.name || 'Select customer...'}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><div className="p-2"><Input ref={customerSearchInputRef} placeholder="Search customer..." value={customerSearchTerm} onChange={(e) => setCustomerSearchTerm(e.target.value)} className="h-9" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); let customerToFilterBy = selectedCustomerId; if (filteredCustomersForDropdown.length === 1) { customerToFilterBy = filteredCustomersForDropdown[0].id; setSelectedCustomerId(customerToFilterBy); } setCurrentPage(1); setActiveFilters({ customerId: customerToFilterBy, dateRange, status: showPaidBills ? 'PAID' : 'OPEN' }); setIsCustomerPopoverOpen(false); } }} /></div><ScrollArea className="max-h-60"><div className="p-1"><Button variant="ghost" className="w-full justify-start" onClick={() => { setSelectedCustomerId('all'); setIsCustomerPopoverOpen(false); setCustomerSearchTerm(''); }}>All Customers</Button>{filteredCustomersForDropdown.map(c => (<Button key={c.id} variant="ghost" className="w-full justify-start text-left h-auto py-1.5" onClick={() => { setSelectedCustomerId(c.id); setIsCustomerPopoverOpen(false); setCustomerSearchTerm(''); }}><div className="flex flex-col"><span>{c.name}</span>{c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}</div></Button>))}{filteredCustomersForDropdown.length === 0 && customerSearchTerm && (<p className="p-2 text-center text-sm text-muted-foreground">No customer found.</p>)}</div></ScrollArea></PopoverContent></Popover></div>
                </div>
                <div className="flex justify-end gap-2 mt-3"><Button onClick={handleClearFilters} variant="ghost" size="sm" className="text-xs"><X className="mr-1 h-3 w-3" />Clear</Button><Button onClick={handleApplyFilters} size="sm" className="text-xs"><Filter className="mr-1 h-3 w-3" />Apply Filters</Button></div>
              </Card>
              <div className="relative mt-4"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Quick-search by Bill ID or Customer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-input border-border focus:ring-primary text-card-foreground" /></div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <div className="flex justify-between items-center p-4 border-b border-border/50"><span className="font-semibold text-card-foreground">{showPaidBills ? 'Fully Paid Bills' : 'Open Credit Bills'} ({totalCount})</span><div className="flex items-center space-x-2"><Label htmlFor="bill-status-toggle" className="text-sm text-muted-foreground">Show Paid</Label><Switch id="bill-status-toggle" checked={showPaidBills} onCheckedChange={(checked) => { setShowPaidBills(checked); setCurrentPage(1); setActiveFilters(prev => ({ ...prev, status: checked ? 'PAID' : 'OPEN' })); }} className="data-[state=checked]:bg-green-600" /></div></div>
              <ScrollArea className="h-full p-3">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10"><TableRow>
                  <TableHead className="text-muted-foreground">Bill</TableHead>
                  {/* <TableHead className="text-muted-foreground">Bill ID</TableHead> */}
                  {/* <TableHead className="text-muted-foreground">Customer</TableHead> */}
                  {/* <TableHead className="text-muted-foreground">User</TableHead> */}
                  <TableHead className="text-right text-muted-foreground">Outstanding</TableHead>
                  <TableHead className="text-center text-muted-foreground">Status</TableHead>
                  </TableRow></TableHeader>
                 
                  <TableBody>{isLoadingSales ? (<TableRow><TableCell colSpan={6} 
                  className="text-center text-muted-foreground">Loading credit sales...</TableCell>
                  </TableRow>) : filteredCreditSales.length === 0 ? (<TableRow><TableCell colSpan={6} 
                  className="text-center text-muted-foreground">No credit sales matching criteria.</TableCell>
                  </TableRow>) : 
                  (filteredCreditSales.map((sale) => (<TableRow key={sale.id} onClick={() => handleSelectGroup(sale)} 
                  className={cn('cursor-pointer hover:bg-muted/50', selectedGroup?.activeBillForDisplay.id === sale.id && 'border-l-4 border-l-primary bg-primary/5')}>
                    <TableCell className="text-card-foreground text-xs py-2">
<div className="flex  gap-2 flex-col ">
                    <span className="text-muted-foreground rounderded-full text-xs font-bold ">  {sale.customerName || 'N/A'} </span>
                    <span className="text-muted-foreground">  {sale.billNumber} </span>
                    <span className="text-muted-foreground/70">   {new Date(sale.date).toLocaleDateString()} </span>
</div>
                    </TableCell>
                    {/* <TableCell className="text-card-foreground text-xs py-2">{sale.billNumber}</TableCell> */}
                    {/* <TableCell className="text-card-foreground text-xs py-2">{sale.customerName || 'N/A'}</TableCell> */}
                    {/* <TableCell className="text-card-foreground text-xs py-2">{sale.createdBy?.username || 'N/A'}</TableCell> */}
                    <TableCell className="text-right text-card-foreground text-xs py-2">Rs. {(sale.creditOutstandingAmount ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="text-center py-2"><Badge variant={getStatusBadgeVariant(sale.creditPaymentStatus)} 
                    className="text-xs">{sale.creditPaymentStatus ? sale.creditPaymentStatus.replace('_', ' ') : 'N/A'}</Badge>
                    </TableCell></TableRow>)))}</TableBody>
                    </Table>
                    </ScrollArea>
            </CardContent>
            <CardFooter className="p-2 border-t border-border/50"><div className="flex justify-between items-center w-full"><Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || isLoadingSales} variant="outline" size="sm">Previous</Button><span className="text-xs text-muted-foreground">Page {currentPage} of {maxPage}</span><Button onClick={() => setCurrentPage(p => Math.min(maxPage, p + 1))} disabled={currentPage === maxPage || isLoadingSales} variant="outline" size="sm">Next</Button></div></CardFooter>
          </Card>
        </div>



        {isPrintingBill && selectedGroup?.activeBillForDisplay && (
          <div id="printable-credit-bill-holder" style={{ display: 'none' }}>
            <CreditBillPrintContent
              saleRecord={selectedGroup.activeBillForDisplay}
              installments={installments}
              companyName={currentUser?.company?.name}
              companyAddress={currentUser?.company?.address}
              companyPhone={currentUser?.company?.phone}
            />
          </div>
        )}
      </div>

      <AlertDialog open={!!installmentToDelete} onOpenChange={() => setInstallmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Installment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the payment of Rs. {installmentToDelete?.amountPaid.toFixed(2)} made on {installmentToDelete ? new Date(installmentToDelete.paymentDate).toLocaleDateString() : ''}? This action cannot be undone and will update the bill's outstanding balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteInstallment} className="bg-destructive hover:bg-destructive/80">Delete Payment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
