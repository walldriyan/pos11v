

'use client';

import type { SaleRecord, PaymentInstallment, UnitDefinition } from '@/types';

interface CreditBillPrintContentProps {
  saleRecord: SaleRecord;
  installments: PaymentInstallment[];
  companyName?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
}

// Simplified getUnitText for print content
const getUnitText = (units: UnitDefinition | undefined | null): string => {
  return units?.baseUnit || '';
};

export function CreditBillPrintContent({ 
    saleRecord, 
    installments,
    companyName: companyNameProp,
    companyAddress: companyAddressProp,
    companyPhone: companyPhoneProp,
}: CreditBillPrintContentProps) {
  const companyName = companyNameProp || "POS Solutions";
  const companyAddress = companyAddressProp || "123 Main Street, Colombo, Sri Lanka";
  const companyPhone = companyPhoneProp || "+94 11 234 5678";
  const formatDate = (dateString: string | null | undefined) => dateString ? new Date(dateString).toLocaleString() : 'N/A';
  
  const initialPayment = (saleRecord.paymentInstallments || []).find(inst => inst.notes?.includes("Initial payment"))?.amountPaid || 0;
  const subsequentInstallments = (saleRecord.paymentInstallments || []).filter(inst => !inst.notes?.includes("Initial payment"));
  const totalSubsequentInstallmentsPaid = subsequentInstallments.reduce((sum, inst) => sum + inst.amountPaid, 0);

  const totalPaidByCustomer = saleRecord.amountPaidByCustomer || 0;
  const finalBalance = saleRecord.creditOutstandingAmount ?? (saleRecord.totalAmount - totalPaidByCustomer);


  return (
    <>
      <div className="company-details text-center mb-2">
        <h3 className="font-bold text-sm">{companyName}</h3>
        <p>{companyAddress}</p>
        <p>{companyPhone}</p>
      </div>
      <hr className="separator" />
      <h4 className="section-title text-center font-bold">CREDIT SALE INVOICE</h4>
      <div className="header-info text-center mb-1">
        <p>Bill No: {saleRecord.billNumber}</p>
        <p>Sale Date: {formatDate(saleRecord.date)}</p>
      </div>
      {saleRecord.customerName && <p className="mb-1 customer-name text-center">Customer: {saleRecord.customerName}</p>}
      <hr className="separator" />

      <p className="section-title font-bold">Original Items Purchased:</p>
      <table>
        <thead>
          <tr>
            <th className="text-left item-name">Item</th>
            <th className="text-right">Qty</th>
            <th className="text-right col-price">Unit Price</th>
            <th className="text-right col-discount">Line Disc.</th>
            <th className="text-right col-price">Eff. Price</th>
            <th className="text-right col-total">Line Total</th>
          </tr>
        </thead>
        <tbody>
          {saleRecord.items.map(item => (
            <tr key={`item-${item.productId}-${item.name}`}>
              <td className="item-name">{item.name}</td>
              <td className="text-right">{`${item.quantity} ${getUnitText(item.units)}`.trim()}</td>
              <td className="text-right col-price">{(item.priceAtSale).toFixed(2)}</td>
              <td className="text-right col-discount">{(item.totalDiscountOnLine).toFixed(2)}</td>
              <td className="text-right col-price">{(item.effectivePricePaidPerUnit).toFixed(2)}</td>
              <td className="text-right col-total">{(item.effectivePricePaidPerUnit * item.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr className="separator" />

      <p className="section-title font-bold">Original Sale Summary:</p>
      <div className="totals-section">
        <div><span>Subtotal (Original):</span><span className="value">Rs. {saleRecord.subtotalOriginal.toFixed(2)}</span></div>
        {saleRecord.totalItemDiscountAmount > 0 && <div><span>Item Discounts:</span><span className="value">-Rs. {saleRecord.totalItemDiscountAmount.toFixed(2)}</span></div>}
        {saleRecord.totalCartDiscountAmount > 0 && <div><span>Cart Discount:</span><span className="value">-Rs. {saleRecord.totalCartDiscountAmount.toFixed(2)}</span></div>}
        <div><span>Net Subtotal:</span><span className="value">Rs. {saleRecord.netSubtotal.toFixed(2)}</span></div>
        <div><span>Tax ({ (saleRecord.taxRate * 100).toFixed(saleRecord.taxRate === 0 ? 0 : (saleRecord.taxRate * 100 % 1 === 0 ? 0 : 2)) }%) :</span><span className="value">Rs. {saleRecord.taxAmount.toFixed(2)}</span></div>
        <div className="font-bold"><span>Original Bill Total:</span><span className="value">Rs. {saleRecord.totalAmount.toFixed(2)}</span></div>
      </div>
      <hr className="separator" />

      <p className="section-title font-bold">Credit Account Summary:</p>
      <div className="totals-section">
        <div><span>Total Amount Credited (Bill Total):</span><span className="value">Rs. {saleRecord.totalAmount.toFixed(2)}</span></div>
        {initialPayment > 0 && <div><span>Initial Payment (at sale):</span><span className="value">-Rs. {initialPayment.toFixed(2)}</span></div>}
        {totalSubsequentInstallmentsPaid > 0 && <div><span>Subsequent Installments Paid:</span><span className="value">-Rs. {totalSubsequentInstallmentsPaid.toFixed(2)}</span></div>}
        <div className="font-bold border-t border-dashed border-black"><span>Total Paid To Date:</span><span className="value">-Rs. {totalPaidByCustomer.toFixed(2)}</span></div>
        <div className="font-bold"><span>Current Outstanding Balance:</span><span className="value">Rs. {finalBalance.toFixed(2)}</span></div>
        {saleRecord.creditPaymentStatus && <div><span>Credit Status:</span><span className="value">{saleRecord.creditPaymentStatus.replace('_', ' ')}</span></div>}
      </div>
      

      {(installments || []).length > 0 && (
        <>
          <hr className="separator" />
          <p className="section-title font-bold">Payment Installment History:</p>
          <table>
            <thead>
              <tr>
                <th className="text-left">Date</th>
                <th className="text-right">Amount Paid</th>
                <th className="text-left">Method</th>
                <th className="text-left item-name">Notes</th>
              </tr>
            </thead>
            <tbody>
              {installments.map(inst => (
                <tr key={inst.id}>
                  <td>{formatDate(inst.paymentDate)}</td>
                  <td className="text-right">Rs. {inst.amountPaid.toFixed(2)}</td>
                  <td>{inst.method}</td>
                  <td className="item-name">{inst.notes || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      
      <hr className="separator" />
      <p className="thank-you text-center mt-2">Thank You!</p>
    </>
  );
}
