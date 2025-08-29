

'use client';

import type { SaleRecord, ReturnedItemDetail, UnitDefinition, PaymentInstallment } from '@/types';

interface ReturnReceiptPrintContentProps {
  originalSale: SaleRecord;
  adjustedSale: SaleRecord;
  returnTransaction: SaleRecord | null;
}

export function ReturnReceiptPrintContent({
    originalSale,
    adjustedSale,
    returnTransaction,
}: ReturnReceiptPrintContentProps) {
  const companyName = "POS Solutions";
  const companyAddress = "123 Main Street, Colombo, Sri Lanka";
  const companyPhone = "+94 11 234 5678";

  const formatDate = (dateString: string | null | undefined) => dateString ? new Date(dateString).toLocaleString() : 'N/A';

  const getUnitText = (units: UnitDefinition | undefined | null) => {
    return units?.baseUnit || '';
  }

  const renderFinancialSummaryForPrint = (sale: SaleRecord, title: string) => {
    const subtotalOriginalFromRecord = sale.subtotalOriginal || 0;
    const totalItemDiscountFromRecord = sale.totalItemDiscountAmount || 0;
    const totalCartDiscountFromRecord = sale.totalCartDiscountAmount || 0;
    const netSubtotalFromRecord = sale.netSubtotal || 0;
    const taxAmountForDisplay = sale.taxAmount || 0;
    const finalTotalForDisplay = sale.totalAmount || 0;

    return (
      <>
        <div className="font-bold">{title}</div>
        <div><span>Subtotal (Original Prices):</span><span className="text-right">Rs. {subtotalOriginalFromRecord.toFixed(2)}</span></div>
        {(totalItemDiscountFromRecord > 0 || totalCartDiscountFromRecord > 0) && (
          <div><span>Total Discounts:</span><span className="text-right">-Rs. {(totalItemDiscountFromRecord + totalCartDiscountFromRecord).toFixed(2)}</span></div>
        )}
        <div><span>Net Subtotal:</span><span className="text-right">Rs. {netSubtotalFromRecord.toFixed(2)}</span></div>
        <div><span>Tax ({ (sale.taxRate * 100).toFixed(sale.taxRate === 0 ? 0 : (sale.taxRate * 100 % 1 === 0 ? 0 : 2)) }%) :</span><span className="text-right">Rs. {taxAmountForDisplay.toFixed(2)}</span></div>
        <div className="font-bold"><span>{sale.recordType === 'RETURN_TRANSACTION' ? 'Total Refunded' : 'TOTAL'}:</span><span className="text-right">Rs. {finalTotalForDisplay.toFixed(2)}</span></div>
         {sale.paymentMethod !== 'REFUND' && sale.amountPaidByCustomer !== undefined && sale.amountPaidByCustomer !== null && (
            <div><span>Amount Paid ({sale.paymentMethod}):</span><span className="text-right">Rs. {sale.amountPaidByCustomer.toFixed(2)}</span></div>
        )}
        {sale.paymentMethod === 'cash' && sale.changeDueToCustomer !== undefined && sale.changeDueToCustomer !== null && sale.changeDueToCustomer > 0 && (
            <div><span>Change Due:</span><span className="text-right">Rs. {sale.changeDueToCustomer.toFixed(2)}</span></div>
        )}
      </>
    );
  };
  
  const totalAllLoggedReturnsAmount = (adjustedSale.returnedItemsLog || []).reduce(
    (sum, logEntry) => !logEntry.isUndone ? sum + logEntry.totalRefundForThisReturnEntry : sum,
    0
  );
  
  const totalPaidByCustomerOnOriginalBill = originalSale.amountPaidByCustomer || 0;
  
  // This is the final, correct calculation for the customer's balance.
  const finalBalance = adjustedSale.totalAmount - totalPaidByCustomerOnOriginalBill;


  return (
    <>
      <div className="company-details text-center mb-2">
        <h3 className="font-bold text-sm">{companyName}</h3>
        <p>{companyAddress}</p>
        <p>{companyPhone}</p>
      </div>
      <hr className="separator" />
      <h4 className="section-title text-center font-bold">SALE &amp; RETURN RECEIPT</h4>
      {originalSale.customerName && <p className="text-center">Customer: {originalSale.customerName}</p>}
      <hr className="separator" />

      {/* Original Sale Section */}
      <div className="section-break">
        <p className="section-title font-bold">Original Sale Details</p>
        <div className="header-info">
          <p>Bill No: {originalSale.billNumber}</p>
          <p>Date: {formatDate(originalSale.date)}</p>
        </div>
        <table className="sub-table">
          <thead>
            <tr>
              <th className="text-left item-name">Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Line Disc.</th>
              <th className="text-right">Eff. Price</th>
              <th className="text-right">Line Total</th>
            </tr>
          </thead>
          <tbody>{originalSale.items.map(item => (
            <tr key={`orig-${item.productId}`}>
              <td className="item-name">{item.name}</td>
              <td className="text-right">{`${item.quantity} ${getUnitText(item.units)}`.trim()}</td>
              <td className="text-right">{(item.priceAtSale).toFixed(2)}</td>
              <td className="text-right">{(item.totalDiscountOnLine).toFixed(2)}</td>
              <td className="text-right">{(item.effectivePricePaidPerUnit).toFixed(2)}</td>
              <td className="text-right">{(item.effectivePricePaidPerUnit * item.quantity).toFixed(2)}</td>
            </tr>
          ))}</tbody>
        </table>
        <div className="totals-section">
            {renderFinancialSummaryForPrint(originalSale, "Original Sale Summary:")}
        </div>
      </div>
      <hr className="separator" />

      {/* Return Transaction Section (Current Transaction) */}
      {returnTransaction && (
          <div className="section-break">
            <p className="section-title font-bold">Items Returned (This Specific Transaction)</p>
            <div className="header-info">
              <p>Return Txn No: {returnTransaction.billNumber}</p>
              <p>Return Date: {formatDate(returnTransaction.date)}</p>
            </div>
            <table className="sub-table">
              <thead>
                <tr>
                  <th className="text-left item-name">Item</th>
                  <th className="text-right">Qty Rtn</th>
                  <th className="text-right">Refund/Unit</th>
                  <th className="text-right">Total Refund</th>
                </tr>
              </thead>
              <tbody>{returnTransaction.items.map(item => (
                <tr key={`ret-txn-${item.productId}`}>
                  <td className="item-name">{item.name}</td>
                  <td className="text-right">{`${item.quantity} ${getUnitText(item.units)}`.trim()}</td>
                  <td className="text-right">{(item.effectivePricePaidPerUnit).toFixed(2)}</td>
                  <td className="text-right">{(item.effectivePricePaidPerUnit * item.quantity).toFixed(2)}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="totals-section">
                <div className="font-bold"><span>Total Refund (This Transaction):</span><span className="text-right">Rs. {returnTransaction.totalAmount.toFixed(2)}</span></div>
            </div>
          </div>
      )}
      {(returnTransaction && (adjustedSale.returnedItemsLog && adjustedSale.returnedItemsLog.length > 0)) && <hr className="separator" />}

      {/* Full Return History Section */}
      {(adjustedSale.returnedItemsLog && adjustedSale.returnedItemsLog.length > 0) && (
        <div className="section-break">
          <p className="section-title font-bold">Full Return History for Original Bill ({originalSale.billNumber})</p>
          <table className="sub-table">
            <thead>
              <tr>
                <th className="text-left item-name">Date</th>
                <th className="text-left item-name">Return Txn ID</th>
                <th className="text-left item-name">Item</th>
                <th className="text-right">Qty Rtn.</th>
                <th className="text-right">Refund/Unit</th>
                <th className="text-right">Total Line Refund</th>
              </tr>
            </thead>
            <tbody>{(adjustedSale.returnedItemsLog as ReturnedItemDetail[]).filter(log => !log.isUndone).map((logEntry, index) => (
              <tr key={`log-${index}-${logEntry.itemId}-${logEntry.returnTransactionId}`}>
                <td className="item-name">{new Date(logEntry.returnDate).toLocaleDateString()}</td>
                <td className="item-name text-xs">{logEntry.returnTransactionId}</td>
                <td className="item-name">{logEntry.name}</td>
                <td className="text-right">{`${logEntry.returnedQuantity} ${getUnitText(logEntry.units)}`.trim()}</td>
                <td className="text-right">{(logEntry.refundAmountPerUnit).toFixed(2)}</td>
                <td className="text-right">{(logEntry.totalRefundForThisReturnEntry).toFixed(2)}</td>
              </tr>
            ))}</tbody>
          </table>
          <div className="totals-section">
            <div className="font-bold">
              <span>Total Refunded (All Active Returns for this Bill):</span>
              <span className="text-right">Rs. {totalAllLoggedReturnsAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
      <hr className="separator" />


      {/* Adjusted Bill Section */}
      <div className="section-break">
        <p className="section-title font-bold">Current Bill (After All Returns)</p>
         <div className="header-info">
            <p>Bill No: {adjustedSale.billNumber} (Adjusted)</p>
            <p>Last Adjustment Date: {formatDate(adjustedSale.date)}</p>
        </div>
        {adjustedSale.items.length > 0 ? (
          <>
            <table className="sub-table">
              <thead>
                <tr>
                  <th className="text-left item-name">Item Kept</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-right">Line Disc.</th>
                  <th className="text-right">Eff. Price</th>
                  <th className="text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>{adjustedSale.items.map(item => (
                <tr key={`adj-${item.productId}`}>
                  <td className="item-name">{item.name}</td>
                  <td className="text-right">{`${item.quantity} ${getUnitText(item.units)}`.trim()}</td>
                  <td className="text-right">{(item.priceAtSale).toFixed(2)}</td>
                  <td className="text-right">{(item.totalDiscountOnLine).toFixed(2)}</td>
                  <td className="text-right">{(item.effectivePricePaidPerUnit).toFixed(2)}</td>
                  <td className="text-right">{(item.effectivePricePaidPerUnit * item.quantity).toFixed(2)}</td>
                </tr>
              ))}</tbody>
            </table>
             <div className="totals-section">
                {renderFinancialSummaryForPrint(adjustedSale, "Adjusted Bill Summary:")}
            </div>
          </>
        ) : (
          <p className="text-center">(All items from original bill have been returned)</p>
        )}
      </div>
      
      {originalSale.isCreditSale && (
          <>
            <hr className="separator" />
            <div className="section-break">
              <p className="section-title font-bold">Credit Account Summary:</p>
              <div className="totals-section">
                <div><span>Net Bill Amount (Adjusted):</span><span className="value">Rs. {adjustedSale.totalAmount.toFixed(2)}</span></div>
                <div><span>Total Paid by Customer (Original Sale):</span><span className="value">Rs. {totalPaidByCustomerOnOriginalBill.toFixed(2)}</span></div>
                <div className="font-bold">
                    <span>{finalBalance >= 0 ? "Final Balance (Due from Customer):" : "Final Balance (Refund to Customer):"}</span>
                    <span className="value">Rs. {Math.abs(finalBalance).toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            {(originalSale.paymentInstallments && originalSale.paymentInstallments.length > 0) && (
              <>
                <p className="section-title font-bold" style={{marginTop: '5px'}}>Payment Installment History:</p>
                <table className="sub-table">
                  <thead><tr><th className="text-left">Date</th><th className="text-right">Amount Paid</th><th className="text-left">Method</th></tr></thead>
                  <tbody>{(originalSale.paymentInstallments as PaymentInstallment[]).map(inst => (<tr key={inst.id}><td>{formatDate(inst.paymentDate)}</td><td className="text-right">Rs. {inst.amountPaid.toFixed(2)}</td><td>{inst.method}</td></tr>))}</tbody>
                </table>
              </>
            )}
          </>
      )}

      <hr className="separator" />
      <p className="message">Thank You.</p>
    </>
  );
}
