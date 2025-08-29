
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import {
  selectSaleItems,
  selectTaxRate,
  selectSaleSubtotalOriginal,
  selectCalculatedTax,
  selectSaleTotal,
  selectCalculatedDiscounts,
  selectAppliedDiscountSummary,
} from '@/store/slices/saleSlice';
import { getAllCustomersAction } from '@/app/actions/partyActions';
import { getAllCompanyProfilesAction } from '@/app/actions/companyActions';
import { selectCurrentUser } from '@/store/slices/authSlice';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SaleSummary } from "@/components/pos/SaleSummary";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { PaymentMethod, SaleItem, SaleRecordItem, AppliedRuleInfo, Party as CustomerType, CompanyProfileFormData } from '@/types';
import { ArrowLeft, Printer, CheckCircle, Users, Search, ChevronsUpDown, Settings, FileUp, FileDown, Code } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Select as UiSelect, SelectContent as UiSelectContent, SelectItem as UiSelectItem, SelectTrigger as UiSelectTrigger, SelectValue as UiSelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from '@/components/ui/textarea';


// --- START: TEMPLATE TYPES AND DEFAULTS ---

interface BillTemplateText {
    headerTitle?: string;
    dateLabel?: string;
    billNoLabel?: string;
    customerLabel?: string;
    itemHeader?: string;
    qtyHeader?: string;
    unitPriceHeader?: string;
    lineDiscountHeader?: string;
    effectivePriceHeader?: string;
    lineTotalHeader?: string;
    subtotalLabel?: string;
    totalDiscountLabel?: string;
    taxLabel?: string;
    grandTotalLabel?: string;
    paymentMethodLabel?: string;
    amountPaidLabel?: string;
    changeDueLabel?: string;
    thankYouMessage?: string;
}

interface BillTemplate {
    id: string;
    name: string;
    text: BillTemplateText;
}

const defaultTemplate: BillTemplate = {
  id: 'default-v1',
  name: 'Default Template',
  text: {
    headerTitle: "SALES INVOICE",
    dateLabel: "Date:",
    billNoLabel: "Bill No:",
    customerLabel: "Customer:",
    itemHeader: "Item",
    qtyHeader: "Qty",
    unitPriceHeader: "Unit Price (Orig)",
    lineDiscountHeader: "Line Disc.",
    effectivePriceHeader: "Eff. Price",
    lineTotalHeader: "Line Total (Net)",
    subtotalLabel: "Subtotal (Original Items Total):",
    totalDiscountLabel: "Total All Discounts:",
    taxLabel: "Tax",
    grandTotalLabel: "GRAND TOTAL:",
    paymentMethodLabel: "Payment Method:",
    amountPaidLabel: "Amount Paid:",
    changeDueLabel: "Change Due:",
    thankYouMessage: "Thank You! Please Come Again."
  },
};


// --- END: TEMPLATE TYPES AND DEFAULTS ---


interface PaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  paymentMethod: PaymentMethod;
  billNumber: string;
  onPaymentSuccess: (paymentDetails: {
    customerName?: string;
    customerId?: string | null;
    amountPaid?: number;
    changeDue?: number;
  }) => void;
  onBackToCart?: () => void;
}

interface BillPrintProps {
  billNumber: string;
  saleItems: SaleRecordItem[];
  subtotalOriginal: number;
  totalItemDiscountAmount: number;
  totalCartDiscountAmount: number;
  tax: number;
  total: number;
  taxRate: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  changeDue: number;
  customerName?: string;
  appliedDiscountSummary: AppliedRuleInfo[];
  calculatedItemDiscounts: ReturnType<typeof selectCalculatedDiscounts>['itemDiscounts'];
  companyNameProp?: string | null;
  companyAddressProp?: string | null;
  companyPhoneProp?: string | null;
  template: BillTemplate;
}

const BillPrintContent = ({
    billNumber, saleItems, subtotalOriginal, totalItemDiscountAmount, totalCartDiscountAmount,
    tax, total, taxRate, paymentMethod, amountPaid, changeDue, customerName,
    appliedDiscountSummary, calculatedItemDiscounts,
    companyNameProp, companyAddressProp, companyPhoneProp, template
}: BillPrintProps) => {
    const companyName = companyNameProp || "POS Solutions";
    const companyAddress = companyAddressProp || "123 Main Street, Colombo, Sri Lanka";
    const companyPhone = companyPhoneProp || "+94 11 234 5678";
    const dateTime = new Date().toLocaleString();
    const totalDiscountAmount = totalItemDiscountAmount + totalCartDiscountAmount;
    const t = template.text;

    return (
        <>
            <div className="company-details text-center mb-2">
                <h3 className="font-bold text-sm">{companyName}</h3>
                <p>{companyAddress}</p>
                <p>{companyPhone}</p>
            </div>
            {t.headerTitle && <h4 className="section-title text-center font-bold">{t.headerTitle}</h4>}
            <div className="header-info text-center mb-1">
                 <p>{t.dateLabel || 'Date:'} {dateTime}</p>
                 <p>{t.billNoLabel || 'Bill No:'} {billNumber}</p>
            </div>
            {customerName && <p className="mb-1 customer-name">{t.customerLabel || 'Customer:'} {customerName}</p>}
            <hr className="separator" />
            <table>
                <thead>
                    <tr>
                        <th className="text-left item-name">{t.itemHeader || 'Item'}</th>
                        <th className="text-right">{t.qtyHeader || 'Qty'}</th>
                        <th className="text-right col-price">{t.unitPriceHeader || 'Unit Price (Orig)'}</th>
                        <th className="text-right col-price">{t.effectivePriceHeader || 'Eff. Price'}</th>
                        <th className="text-right col-discount">{t.lineDiscountHeader || 'Line Disc.'}</th>
                        <th className="text-right col-total">{t.lineTotalHeader || 'Line Total (Net)'}</th>
                    </tr>
                </thead>
                <tbody>{saleItems.map((item, index) => {
                    const originalUnitPrice = item.priceAtSale ?? item.price ?? 0;
                    const quantity = item.quantity;
                    const unitDisplay = item.units?.baseUnit || '';
                    const lineTotalDiscountAmountForItem = item.totalDiscountOnLine || 0;
                    const unitPriceAfterDiscount = originalUnitPrice - (quantity > 0 ? lineTotalDiscountAmountForItem / quantity : 0);
                    const lineTotalWithDiscount = unitPriceAfterDiscount * quantity;
                    return (<tr key={`${item.productId}-${index}`}>
                        <td className="item-name">{item.name}</td>
                        <td className="text-right">{`${quantity} ${unitDisplay}`.trim()}</td>
                        <td className="text-right col-price">{originalUnitPrice.toFixed(2)}</td>
                        <td className="text-right col-price">{unitPriceAfterDiscount.toFixed(2)}</td>
                        <td className="text-right col-discount">{lineTotalDiscountAmountForItem.toFixed(2)}</td>
                        <td className="text-right col-total">{lineTotalWithDiscount.toFixed(2)}</td>
                    </tr>);
                })}</tbody>
            </table>
            <hr className="separator" />
            <div className="totals-section">
                <div><span className="label">{t.subtotalLabel || 'Subtotal:'}</span><span className="value">Rs. {subtotalOriginal.toFixed(2)}</span></div>
                {totalDiscountAmount > 0 && <div><span className="label">{t.totalDiscountLabel || 'Total Discounts:'}</span><span className="value">-Rs. {totalDiscountAmount.toFixed(2)}</span></div>}
                <div><span className="label">{t.taxLabel || 'Tax'} ({ (taxRate * 100).toFixed(taxRate === 0 ? 0 : (taxRate * 100 % 1 === 0 ? 0 : 2)) }%) :</span><span className="value">Rs. {tax.toFixed(2)}</span></div>
                <hr className="separator" />
                <div className="font-bold"><span className="label">{t.grandTotalLabel || 'GRAND TOTAL:'}</span><span className="value">Rs. {total.toFixed(2)}</span></div>
            </div>
            <hr className="separator" />
            <div className="payment-info">
                <div><span className="label">{t.paymentMethodLabel || 'Payment Method:'}</span><span className="value">{paymentMethod.toUpperCase()}</span></div>
                {paymentMethod === 'cash' ? (<>
                    <div><span className="label">{t.amountPaidLabel || 'Amount Paid:'}</span><span className="value">Rs. {amountPaid.toFixed(2)}</span></div>
                    <div><span className="label">{t.changeDueLabel || 'Change Due:'}</span><span className="value">Rs. {changeDue.toFixed(2)}</span></div>
                </>) : (amountPaid > 0 && <div><span className="label">Card Amount Paid:</span><span className="value">Rs. {amountPaid.toFixed(2)}</span></div>)}
            </div>
            <hr className="separator" />
            <p className="thank-you">{t.thankYouMessage || 'Thank You!'}</p>
        </>
    );
};

export function PaymentFormContent({
    paymentMethod, billNumber, onPaymentSuccess, onBackToCart
}: Omit<PaymentDialogProps, 'isOpen' | 'onOpenChange'>) {
    const { toast } = useToast();
    const currentUser = useSelector(selectCurrentUser);
    const currentSaleItemsFromStore = useSelector(selectSaleItems);
    const taxRate = useSelector(selectTaxRate);
    const subtotalOriginal = useSelector(selectSaleSubtotalOriginal);
    const calculatedDiscounts = useSelector(selectCalculatedDiscounts);
    const { totalItemDiscountAmount, totalCartDiscountAmount, itemDiscounts: calculatedItemDiscountsMap } = calculatedDiscounts;
    const tax = useSelector(selectCalculatedTax);
    const total = useSelector(selectSaleTotal);
    const appliedDiscountSummary = useSelector(selectAppliedDiscountSummary);

    const [cashAmountPaidStr, setCashAmountPaidStr] = useState('');
    const [cardAmountPaidNowStr, setCardAmountPaidNowStr] = useState(''); 
    const [changeDue, setChangeDue] = useState(0);
    const amountPaidInputRef = useRef<HTMLInputElement>(null);

    const [allCustomers, setAllCustomers] = useState<CustomerType[]>([]);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
    const [customerError, setCustomerError] = useState<string | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerType | null>(null);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
    const [manualCustomerName, setManualCustomerName] = useState('');

    const [companyProfile, setCompanyProfile] = useState<CompanyProfileFormData | null>(null);
    const [isLoadingCompanyProfile, setIsLoadingCompanyProfile] = useState(false);

    const [autoPrintOnConfirm, setAutoPrintOnConfirm] = useState(true);
    const [isPrinting, setIsPrinting] = useState(false);
    
    // --- START: TEMPLATE MANAGEMENT STATE & LOGIC ---
    const [billTemplates, setBillTemplates] = useState<BillTemplate[]>([defaultTemplate]);
    const [activeTemplateId, setActiveTemplateId] = useState<string>(defaultTemplate.id);
    const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
    const [editingTemplateJson, setEditingTemplateJson] = useState('');
    const importTemplateInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            const savedTemplatesRaw = localStorage.getItem('posBillTemplates');
            const savedActiveTemplateId = localStorage.getItem('posActiveBillTemplateId');
            if (savedTemplatesRaw) {
                const savedTemplates = JSON.parse(savedTemplatesRaw);
                if (Array.isArray(savedTemplates) && savedTemplates.length > 0) {
                    setBillTemplates(savedTemplates);
                    if (savedActiveTemplateId && savedTemplates.some(t => t.id === savedActiveTemplateId)) {
                        setActiveTemplateId(savedActiveTemplateId);
                    } else if (savedTemplates.length > 0) {
                        setActiveTemplateId(savedTemplates[0].id);
                    }
                }
            }
        } catch (e) { console.error("Failed to load bill templates from localStorage", e); }
    }, []);

    const saveTemplatesToStorage = (templates: BillTemplate[]) => {
        localStorage.setItem('posBillTemplates', JSON.stringify(templates));
    };

    const handleTemplateChange = (templateId: string) => {
        setActiveTemplateId(templateId);
        localStorage.setItem('posActiveBillTemplateId', templateId);
    };

    const handleImportTemplate = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedTemplate = JSON.parse(e.target?.result as string) as BillTemplate;
                    if (importedTemplate.id && importedTemplate.name && importedTemplate.text) {
                        const newTemplates = [...billTemplates.filter(t => t.id !== importedTemplate.id), importedTemplate];
                        setBillTemplates(newTemplates);
                        saveTemplatesToStorage(newTemplates);
                        setActiveTemplateId(importedTemplate.id);
                        toast({ title: "Template Imported", description: `Template "${importedTemplate.name}" imported successfully.`});
                    } else { throw new Error("Invalid template structure."); }
                } catch (err) { toast({ title: "Import Error", description: "Invalid JSON or template structure in the file.", variant: "destructive"}); }
            };
            reader.readAsText(file);
        }
        event.target.value = ''; // Reset input
    };

    const handleExportTemplate = () => {
        const activeTemplate = billTemplates.find(t => t.id === activeTemplateId) || defaultTemplate;
        const blob = new Blob([JSON.stringify(activeTemplate, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeTemplate.name.replace(/\s+/g, '_')}_template.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
    
    const handleOpenTemplateEditor = () => {
        const activeTemplate = billTemplates.find(t => t.id === activeTemplateId) || defaultTemplate;
        setEditingTemplateJson(JSON.stringify(activeTemplate, null, 2));
        setIsTemplateEditorOpen(true);
    };

    const handleSaveTemplateEdits = () => {
        try {
            const editedTemplate = JSON.parse(editingTemplateJson) as BillTemplate;
            if (editedTemplate.id && editedTemplate.name && editedTemplate.text) {
                const newTemplates = billTemplates.map(t => t.id === editedTemplate.id ? editedTemplate : t);
                if (!newTemplates.some(t => t.id === editedTemplate.id)) newTemplates.push(editedTemplate); // Add if it's a new ID
                setBillTemplates(newTemplates);
                saveTemplatesToStorage(newTemplates);
                setActiveTemplateId(editedTemplate.id);
                setIsTemplateEditorOpen(false);
                toast({ title: "Template Saved", description: `Template "${editedTemplate.name}" updated.`});
            } else { throw new Error("Invalid template structure."); }
        } catch (err) { toast({ title: "Save Error", description: "Invalid JSON format. Please check your syntax.", variant: "destructive"}); }
    };
    
    const activeTemplate = useMemo(() => billTemplates.find(t => t.id === activeTemplateId) || defaultTemplate, [billTemplates, activeTemplateId]);
    
    // --- END: TEMPLATE MANAGEMENT ---

    const saleRecordItemsForPrint: SaleRecordItem[] = currentSaleItemsFromStore.map(item => {
        const originalItemPrice = item.price ?? 0;
        const itemDiscountDetails = calculatedItemDiscountsMap.get(item.id);
        const totalDiscountAppliedToThisLine = itemDiscountDetails?.totalCalculatedDiscountForLine ?? 0;
        let effectivePricePaidPerUnitValue = originalItemPrice - (item.quantity > 0 ? totalDiscountAppliedToThisLine / item.quantity : 0);
        effectivePricePaidPerUnitValue = Math.max(0, effectivePricePaidPerUnitValue);
        const unitsForRecord = item.units || { baseUnit: 'pcs', derivedUnits: [] };
        return { 
          productId: item.id, name: item.name, price: originalItemPrice, category: item.category,
          imageUrl: item.imageUrl, units: unitsForRecord, quantity: item.quantity, priceAtSale: originalItemPrice,
          effectivePricePaidPerUnit: effectivePricePaidPerUnitValue, totalDiscountOnLine: totalDiscountAppliedToThisLine,
          costPriceAtSale: item.costPrice || 0,
        };
      });

    useEffect(() => {
        const fetchInitialData = async () => {
          if (!currentUser?.id) return;
          setIsLoadingCustomers(true);
          setIsLoadingCompanyProfile(true);
          setCustomerError(null);
          try {
            const [customersResult, companyProfilesResult] = await Promise.all([
              getAllCustomersAction(currentUser.id), getAllCompanyProfilesAction(currentUser.id)
            ]);
            if (customersResult.success && customersResult.data) setAllCustomers(customersResult.data);
            else setCustomerError(customersResult.error || "Failed to load customers.");
            
            if (companyProfilesResult.success && companyProfilesResult.data && companyProfilesResult.data.length > 0) {
                 const userCompany = companyProfilesResult.data.find(c => c.id === currentUser.companyId);
                 setCompanyProfile(userCompany || companyProfilesResult.data[0]);
            } else { console.warn("Could not load company profile for receipt:", companyProfilesResult.error); setCompanyProfile(null); }

          } catch (error) { setCustomerError("An error occurred while fetching initial data."); console.error("Error fetching payment dialog initial data:", error); }
          setIsLoadingCustomers(false);
          setIsLoadingCompanyProfile(false);
        };
        const savedAutoPrint = localStorage.getItem('posAutoPrint');
        if (savedAutoPrint !== null) setAutoPrintOnConfirm(JSON.parse(savedAutoPrint));

        fetchInitialData();
        setCashAmountPaidStr(''); setCardAmountPaidNowStr(''); setChangeDue(0);
        if (paymentMethod === 'cash') setTimeout(() => amountPaidInputRef.current?.focus(), 100);
        setSelectedCustomer(null); setCustomerSearchTerm(''); setManualCustomerName('');
      }, [paymentMethod, total, currentUser]);

    useEffect(() => {
      if (paymentMethod === 'cash') {
        const paid = parseFloat(cashAmountPaidStr);
        if (!isNaN(paid) && paid >= total) setChangeDue(paid - total);
        else setChangeDue(0);
      } else { setChangeDue(0); }
    }, [cashAmountPaidStr, total, paymentMethod]);
    
    useEffect(() => {
        if (isPrinting) {
            const billContentHolder = document.getElementById('printable-bill-content-holder');
            if (!billContentHolder) { console.error('Bill content holder not found'); setIsPrinting(false); return; }
            const printContents = billContentHolder.innerHTML;
            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
            iframe.setAttribute('title', 'Print Bill'); document.body.appendChild(iframe);
            const doc = iframe.contentWindow?.document;
            if (doc) {
                doc.open();
                const printHtml = `
                    <html><head><title>Print Bill - ${billNumber}</title>
                    <style>
                        @page { size: auto; margin: 0mm; } body { margin: 0; font-family: 'Courier New', Courier, monospace; font-size: 8pt; background-color: white; color: black; height: fit-content; }
                        .receipt-container { width: 280px; margin: 0 auto; padding: 5px; height: fit-content; } table { width: 100%; border-collapse: collapse; font-size: 7pt; margin-bottom: 3px; }
                        th, td { padding: 1px 2px; vertical-align: top; font-size: 7pt; } .text-left { text-align: left; } .text-right { text-align: right; } .text-center { text-align: center; }
                        .font-bold { font-weight: bold; } .company-details p, .header-info p, .customer-name { margin: 0px 0; line-height: 1.1; font-size: 8pt; }
                        .company-details h3 { font-size: 10pt; margin: 1px 0;} .item-name { word-break: break-all; max-width: 60px; }
                        .col-price { max-width: 45px; word-break: break-all; } .col-discount { max-width: 40px; word-break: break-all; } .col-total { max-width: 50px; word-break: break-all; }
                        hr.separator { border: none; border-top: 1px dashed black; margin: 2px 0; color: black; background-color: black; }
                        .totals-section div, .payment-info div { display: flex; justify-content: space-between; padding: 0px 0; font-size: 8pt; }
                        .totals-section .label, .payment-info .label { text-align: left; } .totals-section .value, .payment-info .value { text-align: right; }
                        .thank-you { margin-top: 3px; text-align: center; font-size: 8pt; }
                        .discount-details { font-size: 7pt; margin-left: 5px; margin-top: 1px; margin-bottom: 1px; }
                        .discount-details div { display: flex; justify-content: space-between; } .discount-details span:first-child { padding-right: 3px; }
                        th { font-size: 7pt; white-space: normal; text-align: right; } th.item-name { text-align: left; }
                        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 8pt !important; color: black !important; background-color: white !important; height: auto !important; } .receipt-container { margin: 0; padding:0; width: 100%; height: fit-content !important; } table { font-size: 7pt !important; } }
                    </style></head><body><div class="receipt-container">${printContents}</div></body></html>
                `;
                doc.write(printHtml); doc.close();
                iframe.contentWindow?.focus(); iframe.contentWindow?.print();
            }
            setTimeout(() => { if (iframe.parentNode) document.body.removeChild(iframe); }, 500);
            setIsPrinting(false);
        }
    }, [isPrinting, billNumber, companyProfile, appliedDiscountSummary, calculatedItemDiscountsMap, saleRecordItemsForPrint, subtotalOriginal, totalItemDiscountAmount, totalCartDiscountAmount, tax, total, taxRate, paymentMethod, activeTemplate]);

    const handleConfirmPayment = () => {
      let finalAmountPaid = 0;
      if (paymentMethod === 'cash') {
        const paid = parseFloat(cashAmountPaidStr);
        if (isNaN(paid) || paid < total) { alert("Amount paid by cash is less than total or invalid."); return; }
        finalAmountPaid = paid;
      } else if (paymentMethod === 'credit') { finalAmountPaid = parseFloat(cardAmountPaidNowStr) || 0; if (finalAmountPaid < 0) { alert("Card payment amount cannot be negative."); return; } }
      onPaymentSuccess({
          customerName: selectedCustomer ? selectedCustomer.name : manualCustomerName || undefined,
          customerId: selectedCustomer ? selectedCustomer.id : null,
          amountPaid: finalAmountPaid, changeDue: paymentMethod === 'cash' ? changeDue : 0,
      });
      if (autoPrintOnConfirm) setIsPrinting(true);
    };

    const currentAmountPaidForPrint = paymentMethod === 'cash' ? (parseFloat(cashAmountPaidStr) || 0) : (parseFloat(cardAmountPaidNowStr) || 0);
    const currentChangeDueForPrint = paymentMethod === 'cash' ? changeDue : 0;
    
    const filteredCustomers = useMemo(() => {
      if (!customerSearchTerm) return allCustomers;
      return allCustomers.filter(c => c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) || (c.phone && c.phone.includes(customerSearchTerm)));
    }, [allCustomers, customerSearchTerm]);

    const confirmButtonDisabled = (paymentMethod === 'cash' && (parseFloat(cashAmountPaidStr) || 0) < total && total > 0) || (paymentMethod === 'credit' && (parseFloat(cardAmountPaidNowStr) || 0) < 0) || saleRecordItemsForPrint.length === 0;

    return (
        <div className="flex flex-col h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 h-full overflow-hidden">
                <div className="flex flex-col border-r border-border bg-background overflow-hidden">
                    <div className="p-4 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-card-foreground">Order Summary</h3>
                        {onBackToCart && <Button variant="outline" size="sm" onClick={onBackToCart} className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Cart</Button>}
                    </div>
                    <div className="p-4 pt-0">
                        <SaleSummary subtotalOriginal={subtotalOriginal} totalItemDiscountAmount={totalItemDiscountAmount} totalCartDiscountAmount={totalCartDiscountAmount} tax={tax} total={total} taxRate={taxRate} appliedDiscountSummary={appliedDiscountSummary} onOpenDiscountInfoDialog={() => {}} />
                    </div>
                    <Separator className="bg-border" />
                    <div className="p-4 pt-2 flex-1 flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-2">
                             <h3 className="text-lg font-semibold text-card-foreground">Bill Preview</h3>
                             <div className="flex items-center gap-2">
                                <UiSelect value={activeTemplateId} onValueChange={handleTemplateChange}>
                                    <UiSelectTrigger className="h-8 w-[150px] text-xs bg-input border-border focus:ring-primary"><UiSelectValue placeholder="Select Template..." /></UiSelectTrigger>
                                    <UiSelectContent><ScrollArea className="h-48">{billTemplates.map(t => <UiSelectItem key={t.id} value={t.id}>{t.name}</UiSelectItem>)}</ScrollArea></UiSelectContent>
                                </UiSelect>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Settings className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={handleOpenTemplateEditor}><Code className="mr-2 h-4 w-4" />Edit Current Template JSON</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => importTemplateInputRef.current?.click()}><FileUp className="mr-2 h-4 w-4" />Import Template from JSON</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={handleExportTemplate}><FileDown className="mr-2 h-4 w-4" />Export Current Template</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <input type="file" ref={importTemplateInputRef} onChange={handleImportTemplate} accept=".json" className="hidden"/>
                             </div>
                        </div>
                        <ScrollArea className="h-auto flex-1 border border-border rounded-md bg-white p-[5px]">
                            <div className="w-[290px] p-2 mx-auto text-black font-mono text-[8pt] leading-tight print-preview-content">
                                <BillPrintContent billNumber={billNumber} saleItems={saleRecordItemsForPrint} subtotalOriginal={subtotalOriginal} totalItemDiscountAmount={totalItemDiscountAmount} totalCartDiscountAmount={totalCartDiscountAmount} tax={tax} total={total} taxRate={taxRate} paymentMethod={paymentMethod} amountPaid={currentAmountPaidForPrint} changeDue={currentChangeDueForPrint} customerName={selectedCustomer ? selectedCustomer.name : manualCustomerName} appliedDiscountSummary={appliedDiscountSummary} calculatedItemDiscounts={calculatedItemDiscountsMap} companyNameProp={companyProfile?.name} companyAddressProp={companyProfile?.address} companyPhoneProp={companyProfile?.phone} template={activeTemplate} />
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <div className="flex flex-col p-6 bg-card space-y-6 overflow-y-auto">
                    <div><Label className="text-sm font-medium text-card-foreground">Payment Method</Label><p className="text-lg font-semibold text-primary">{paymentMethod === 'cash' ? 'Cash Payment' : 'Credit Sale / Card Payment'}</p></div>
                    <Separator className="bg-border" />
                    <div>
                        <Label htmlFor="customer-select-trigger" className="text-sm font-medium text-card-foreground">Customer (Optional)</Label>
                        <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
                            <PopoverTrigger asChild><Button id="customer-select-trigger" variant="outline" role="combobox" aria-expanded={isCustomerPopoverOpen} className="w-full justify-between bg-input border-border text-card-foreground hover:bg-muted/20 mt-1">{selectedCustomer ? selectedCustomer.name : manualCustomerName || "Select or type customer..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><div className="p-2"><div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search customer..." value={customerSearchTerm} onChange={(e) => setCustomerSearchTerm(e.target.value)} className="pl-8 h-9 bg-background border-border focus:ring-primary" aria-label="Search customers"/></div></div>
                                {isLoadingCustomers && <p className="p-2 text-xs text-muted-foreground">Loading customers...</p>}
                                {customerError && <p className="p-2 text-xs text-destructive">{customerError}</p>}
                                {!isLoadingCustomers && !customerError && (<ScrollArea className="max-h-60">{filteredCustomers.length === 0 && customerSearchTerm && (<p className="p-2 text-xs text-muted-foreground text-center">No customer found.</p>)}{filteredCustomers.map((customer) => (<Button key={customer.id} variant="ghost" className="w-full justify-start h-auto py-1.5 px-2 text-left rounded-sm" onClick={() => { setSelectedCustomer(customer); setManualCustomerName(''); setIsCustomerPopoverOpen(false); }}><div className="flex flex-col"><span className="text-sm">{customer.name}</span>{customer.phone && <span className="text-xs text-muted-foreground">{customer.phone}</span>}</div></Button>))}</ScrollArea>)}
                                <div className="p-2 border-t border-border"><Input placeholder="Or type new customer name" value={manualCustomerName} onChange={(e) => { setManualCustomerName(e.target.value); if(selectedCustomer) setSelectedCustomer(null); }} className="h-9 bg-background border-border focus:ring-primary"/></div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {paymentMethod === 'cash' && (<><div><Label htmlFor="cashAmountPaid" className="text-sm font-medium text-card-foreground">Amount Paid by Customer (Cash)</Label><Input id="cashAmountPaid" ref={amountPaidInputRef} type="number" value={cashAmountPaidStr} onChange={(e) => setCashAmountPaidStr(e.target.value)} placeholder="e.g., 5000" className="bg-input border-border focus:ring-primary text-card-foreground text-lg mt-1" min="0"/></div><div><Label className="text-sm font-medium text-card-foreground">Change Due</Label><p className={`text-2xl font-bold ${changeDue > 0 ? 'text-green-400' : 'text-card-foreground'}`}>Rs. {changeDue.toFixed(2)}</p></div></>)}
                    {paymentMethod === 'credit' && (<><div><Label htmlFor="cardAmountPaidNow" className="text-sm font-medium text-card-foreground">Amount Paid by Card Now (Optional)</Label><Input id="cardAmountPaidNow" type="number" value={cardAmountPaidNowStr} onChange={(e) => setCardAmountPaidNowStr(e.target.value)} placeholder={`Full amount: Rs. ${total.toFixed(2)}`} className="bg-input border-border focus:ring-primary text-card-foreground text-lg mt-1" min="0"/><p className="text-xs text-muted-foreground mt-1">Enter amount charged to card now. If less than total, the rest becomes credit. Leave blank or 0 if entire amount is on credit.</p></div></>)}
                    
                    <div className="text-2xl font-bold text-primary mt-auto"><span>Total to Pay: Rs. {total.toFixed(2)}</span></div>
                    
                    <div className="flex w-full justify-between items-center pt-4 border-t border-border">
                         <div className="flex items-center space-x-2"><Switch id="auto-print" checked={autoPrintOnConfirm} onCheckedChange={(checked) => { setAutoPrintOnConfirm(checked); localStorage.setItem('posAutoPrint', JSON.stringify(checked)); }}/><Label htmlFor="auto-print" className="text-xs">Auto Print on Confirm</Label></div>
                        <Button onClick={handleConfirmPayment} className="bg-green-500 hover:bg-green-600 text-white text-lg px-8 py-6" disabled={confirmButtonDisabled}><CheckCircle className="mr-2 h-5 w-5" /> Confirm Payment</Button>
                    </div>
                </div>
            </div>
            {isPrinting && <div id="printable-bill-content-holder" style={{ display: 'none' }}><BillPrintContent billNumber={billNumber} saleItems={saleRecordItemsForPrint} subtotalOriginal={subtotalOriginal} totalItemDiscountAmount={totalItemDiscountAmount} totalCartDiscountAmount={totalCartDiscountAmount} tax={tax} total={total} taxRate={taxRate} paymentMethod={paymentMethod} amountPaid={currentAmountPaidForPrint} changeDue={currentChangeDueForPrint} customerName={selectedCustomer ? selectedCustomer.name : manualCustomerName} appliedDiscountSummary={appliedDiscountSummary} calculatedItemDiscounts={calculatedItemDiscountsMap} companyNameProp={companyProfile?.name} companyAddressProp={companyProfile?.address} companyPhoneProp={companyProfile?.phone} template={activeTemplate}/></div>}
            
            <Dialog open={isTemplateEditorOpen} onOpenChange={setIsTemplateEditorOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Edit Bill Template JSON</DialogTitle><DialogDescription>Modify the JSON below to customize the receipt. Be careful with the structure.</DialogDescription></DialogHeader>
                    <Textarea value={editingTemplateJson} onChange={(e) => setEditingTemplateJson(e.target.value)} className="h-80 font-mono text-xs bg-background border-border" />
                    <DialogFooter><Button variant="secondary" onClick={() => setIsTemplateEditorOpen(false)}>Cancel</Button><Button onClick={handleSaveTemplateEdits}>Save Template</Button></DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}

export function PaymentDialog({ isOpen, onOpenChange, paymentMethod, billNumber, onPaymentSuccess, onBackToCart }: PaymentDialogProps) {
  if (!isOpen) return null;
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
        <DialogHeader className="p-4 border-b border-border">
          <div className="flex items-center justify-between"><DialogTitle className="text-2xl text-card-foreground">Payment & Checkout</DialogTitle><Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Cart</Button></div>
          <DialogDescription className="text-muted-foreground">Finalize the sale for {paymentMethod === 'cash' ? 'Cash' : 'Credit'} payment. Bill: {billNumber}</DialogDescription>
        </DialogHeader>
        <PaymentFormContent paymentMethod={paymentMethod} billNumber={billNumber} onPaymentSuccess={(details) => { onPaymentSuccess(details); onOpenChange(false); }} onBackToCart={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

