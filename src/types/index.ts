




export interface BuyGetRule {
    buyProductId: string;
    buyQuantity: number;
    getProductId: string;
    getQuantity: number;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    isRepeatable: boolean;
}

export interface DerivedUnit {
  name: string;
  conversionFactor: number;
  threshold: number;
}

export interface UnitDefinition {
  baseUnit: string;
  derivedUnits?: DerivedUnit[];
}

export interface SpecificDiscountRuleConfig {
  isEnabled: boolean;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  conditionMin?: number | null;
  conditionMax?: number | null;
  applyFixedOnce?: boolean;
}

export interface ProductBatch {
  id: string;
  productId: string;
  batchNumber?: string | null;
  quantity: number;
  costPrice: number;
  sellingPrice: number; // NEW: Batch-specific selling price
  expiryDate?: string | null; 
  createdAt?: string;
  purchaseBillItemId?: string | null;
  // Optional fields populated from related PurchaseBill
  purchaseDate?: string;
  user?: string;
  productNameAtPurchase?: string;
}

export interface Product {
  id: string;
  name: string;
  code?: string | null;
  category?: string | null;
  barcode?: string | null;
  units: UnitDefinition;
  sellingPrice: number; // This now acts as the *default* selling price
  stock: number; 
  costPrice?: number | null; 
  batches?: ProductBatch[];
  defaultQuantity: number;
  isActive: boolean;
  isService: boolean;
  productSpecificTaxRate?: number | null;
  description?: string | null;
  imageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  productDiscountConfigurations?: ProductDiscountConfiguration[];
  companyId?: string | null; // Multi-company support
}

export interface SaleItem extends Product {
  saleItemId: string; // Unique ID for this item *in this specific sale*
  quantity: number;
  price: number; // Actual price for this item in the sale (could be batch-specific)
  selectedBatchId?: string | null;
  selectedBatchNumber?: string | null;
  // New fields for custom discounts
  customDiscountType?: 'percentage' | 'fixed' | null;
  customDiscountValue?: number | null;
}


export interface DiscountSet {
  id: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  isOneTimePerTransaction: boolean; 
  globalCartPriceRuleJson: SpecificDiscountRuleConfig | null;
  globalCartQuantityRuleJson: SpecificDiscountRuleConfig | null;
  defaultLineItemValueRuleJson: SpecificDiscountRuleConfig | null;
  defaultLineItemQuantityRuleJson: SpecificDiscountRuleConfig | null;
  defaultSpecificQtyThresholdRuleJson: SpecificDiscountRuleConfig | null;
  defaultSpecificUnitPriceThresholdRuleJson: SpecificDiscountRuleConfig | null;
  buyGetRulesJson?: BuyGetRule[] | null;
  productConfigurations?: ProductDiscountConfiguration[]; 
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  companyId?: string | null; // Multi-company support
}

export interface ProductDiscountConfiguration {
  id: string;
  discountSetId: string; 
  discountSet?: DiscountSet;
  productId: string;
  product?: Product; 
  productNameAtConfiguration: string; 
  isActiveForProductInCampaign: boolean; 
  lineItemValueRuleJson: SpecificDiscountRuleConfig | null; 
  lineItemQuantityRuleJson: SpecificDiscountRuleConfig | null; 
  specificQtyThresholdRuleJson: SpecificDiscountRuleConfig | null; 
  specificUnitPriceThresholdRuleJson: SpecificDiscountRuleConfig | null; 
  createdAt?: string;
  updatedAt?: string;
}

export interface AppliedRuleInfo {
  discountCampaignName: string;
  sourceRuleName: string; 
  totalCalculatedDiscount: number;
  ruleType: 
    | 'product_config_line_item_value'
    | 'product_config_line_item_quantity'
    | 'product_config_specific_qty_threshold'
    | 'product_config_specific_unit_price'
    | 'campaign_default_line_item_value'
    | 'campaign_default_line_item_quantity'
    | 'campaign_default_specific_qty_threshold'
    | 'campaign_default_specific_unit_price'
    | 'campaign_global_cart_price'
    | 'campaign_global_cart_quantity'
    | 'buy_get_free'
    | 'custom_item_discount'; // Added for custom discounts
  productIdAffected?: string; 
  appliedOnce?: boolean; 
}

export interface SaleRecordItem {
  productId: string;
  name: string;
  price: number; 
  category?: string | null;
  imageUrl?: string | null;
  units: UnitDefinition; 
  quantity: number; 
  priceAtSale: number; 
  effectivePricePaidPerUnit: number; 
  totalDiscountOnLine: number; 
  costPriceAtSale: number;
  batchId?: string | null; // NEW: Track which batch was sold
  batchNumber?: string | null; // NEW: Store batch number for display
  // New fields for custom discounts
  customDiscountType?: 'percentage' | 'fixed' | null;
  customDiscountValue?: number | null;
}


export interface ReturnedItemDetail {
  id: string;
  itemId: string; 
  name: string;
  returnedQuantity: number;
  units: UnitDefinition;
  refundAmountPerUnit: number;
  totalRefundForThisReturnEntry: number;
  returnDate: string; 
  returnTransactionId: string;
  isUndone?: boolean;
  processedByUserId: string;
  undoneAt?: string | null;
  undoneByUserId?: string | null;
  originalBatchId?: string | null; // NEW: Track which batch is being returned
}


export type PaymentMethod = 'cash' | 'credit' | 'REFUND';
export type SaleStatus = 'COMPLETED_ORIGINAL' | 'ADJUSTED_ACTIVE' | 'RETURN_TRANSACTION_COMPLETED';
export type SaleRecordType = 'SALE' | 'RETURN_TRANSACTION';

export enum CreditPaymentStatusEnum {
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  FULLY_PAID = 'FULLY_PAID',
}
export type CreditPaymentStatus = `${CreditPaymentStatusEnum}`;

export interface PaymentInstallment {
  id: string;
  saleRecordId: string;
  paymentDate: string; 
  amountPaid: number;
  method: string; 
  notes?: string | null;
  createdAt?: string; 
  updatedAt?: string; 
  recordedByUserId: string;
}

export interface SaleRecord {
  id: string;
  recordType: SaleRecordType;
  billNumber: string;
  date: string; 
  customerName?: string | null;
  items: SaleRecordItem[];
  subtotalOriginal: number;
  totalItemDiscountAmount: number; 
  totalCartDiscountAmount: number; 
  netSubtotal: number; 
  appliedDiscountSummary: AppliedRuleInfo[] | null;
  activeDiscountSetId?: string | null; 
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  amountPaidByCustomer?: number | null;
  changeDueToCustomer?: number | null;
  status: SaleStatus;
  returnedItemsLog?: ReturnedItemDetail[] | null;
  originalSaleRecordId?: string | null;
  isCreditSale: boolean;
  creditOutstandingAmount?: number | null;
  creditLastPaymentDate?: string | null; 
  creditPaymentStatus?: CreditPaymentStatus | null;
  paymentInstallments?: PaymentInstallment[];
  customerId?: string | null;
  customer?: Party;
  createdByUserId: string;
  createdBy?: { username: string; }; // Added for reports
  _hasReturns?: boolean;
  companyId?: string | null; // Multi-company support
}

export interface ProductFormData { 
    id?: string;
    name: string;
    code?: string | null;
    category?: string | null;
    barcode?: string | null;
    units: UnitDefinition;
    sellingPrice: number;
    stock?: number | null;
    costPrice?: number | null;
    defaultQuantity?: number;
    isActive?: boolean;
    isService?: boolean;
    productSpecificTaxRate?: number | null;
    description?: string | null;
    imageUrl?: string | null;
}

export type ProductCreateInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'productDiscountConfigurations' | 'createdByUserId' | 'updatedByUserId' | 'stock' | 'costPrice' | 'batches'>;
export type ProductUpdateInput = Partial<ProductCreateInput>;

export type PartyTypeEnum = 'CUSTOMER' | 'SUPPLIER';

export interface Party {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  type: PartyTypeEnum;
  isActive: boolean;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt?: string; 
  updatedAt?: string;
  companyId?: string | null; // Multi-company support
}

export interface PartyFormData {
  id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  type: PartyTypeEnum;
  isActive: boolean;
}

export enum PurchaseBillStatusEnumPrisma {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
  PAID = 'PAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  CANCELLED = 'CANCELLED',
}
export type PurchaseBillStatusEnum = `${PurchaseBillStatusEnumPrisma}`;

export enum PurchasePaymentMethodEnumPrisma {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE',
  CREDIT_NOTE = 'CREDIT_NOTE',
  OTHER = 'OTHER',
}
export type PurchasePaymentMethodEnum = `${PurchasePaymentMethodEnumPrisma}`;

export interface PurchaseBillItem {
  id: string;
  productId: string;
  productNameAtPurchase: string;
  quantityPurchased: number;
  costPriceAtPurchase: number;
  subtotal: number;
  batch?: ProductBatch | null;
  purchaseBill?: PurchaseBill;
}

export interface PurchaseBill {
  id: string;
  supplierId: string;
  supplier?: Party;
  supplierBillNumber?: string | null;
  purchaseDate: string;
  items: PurchaseBillItem[];
  notes?: string | null;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: PurchaseBillStatusEnum;
  payments?: PurchasePayment[];
  createdByUserId: string;
  createdBy?: { username: string; };
  createdAt?: string;
  updatedAt?: string;
  companyId?: string | null; // Multi-company support
}

export interface PurchaseBillFormData {
  supplierId: string | null;
  supplierBillNumber?: string | null;
  purchaseDate: Date; 
  items: {
    productId: string;
    name: string;
    units: UnitDefinition;
    quantityPurchased: number;
    costPriceAtPurchase: number;
    batchNumber?: string | null;
    expiryDate?: Date | null;
    currentStock?: number;
    currentSellingPrice?: number; // This is the new field
  }[];
  notes?: string | null;
  amountPaid?: number | null;
  initialPaymentMethod?: PurchasePaymentMethodEnum | null;
  paymentReference?: string | null;
  paymentNotes?: string | null;
}

export interface PurchasePaymentCreateInput {
    purchaseBillId: string;
    paymentDate: Date; 
    amountPaid: number;
    method: PurchasePaymentMethodEnum;
    reference?: string | null;
    notes?: string | null;
}

export interface PurchasePayment extends PurchasePaymentCreateInput {
    id: string;
    createdAt: string; // ISO string
    recordedByUserId: string;
}

export interface Permission {
  id: string;
  action: string;
  subject: string;
  description?: string | null;
  createdAt?: string; 
  updatedAt?: string; 
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  permissions?: Permission[];
  createdAt?: string; 
  updatedAt?: string; 
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
}

export interface User {
  id: string;
  username: string;
  email?: string | null;
  passwordHash: string;
  isActive: boolean;
  roleId: string;
  role?: Role;
  createdAt?: string; 
  updatedAt?: string; 
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  companyId?: string | null; // Multi-company support
  company?: CompanyProfileFormData;
}

export interface UserFormData {
  username: string;
  email?: string | null;
  password?: string; 
  confirmPassword?: string; 
  roleId: string;
  isActive: boolean;
  companyId?: string | null; // Multi-company support
}

export type PermissionCreateInput = Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>;
export type RoleCreateInput = Omit<Role, 'id' | 'createdAt' | 'updatedAt' | 'permissions' | 'createdByUserId' | 'updatedByUserId'> & { permissionIds?: string[] };
export type RoleUpdateInput = Partial<RoleCreateInput>;
export type UserCreateInput = Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'role' | 'createdByUserId' | 'updatedByUserId'>; 
export type UserUpdateInput = Partial<Omit<UserCreateInput, 'passwordHash'>> & { password?: string }; 

export interface CompanyProfileFormData {
    id?: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    taxId?: string | null;
    logoUrl?: string | null;
    createdByUserId?: string | null;
    updatedByUserId?: string | null;
}

export type SaleRecordItemInput = Omit<SaleRecordItem, 'price'> & { price: number | null };

export type SaleRecordInput = Omit<SaleRecord, 'id' | 'items' | 'returnedItemsLog' | 'paymentInstallments' | '_hasReturns' | 'createdByUserId' | 'customer' | 'createdBy' | 'companyId'> & {
  id?: string;
  items: SaleRecordItemInput[];
  returnedItemsLog?: ReturnedItemDetailInput[] | null;
  paymentInstallments?: Omit<PaymentInstallment, 'id' | 'saleRecordId' | 'createdAt' | 'updatedAt' | 'recordedByUserId'>[];
};

export type ReturnedItemDetailInput = Omit<ReturnedItemDetail, 'id' | 'returnDate' | 'processedByUserId' | 'undoneAt' | 'undoneByUserId' | 'originalBatchId'> & {
  returnDate: string;
  originalBatchId?: string | null;
};


export type UndoReturnItemInput = {
  masterSaleRecordId: string;
  returnedItemDetailId: string;
};

export type StockAdjustmentReasonEnum = 'LOST' | 'DAMAGED' | 'CORRECTION_ADD' | 'CORRECTION_SUBTRACT';

export interface StockAdjustmentLog {
  id: string;
  productId: string;
  product: { name: string };
  quantityChanged: number;
  reason: StockAdjustmentReasonEnum;
  notes?: string | null;
  adjustedAt: Date;
  userId: string;
  user?: { username: string; }; // Added for reports
  companyId?: string | null; // Multi-company support
}

export interface StockAdjustmentFormData {
  productId: string;
  quantity: number;
  reason: StockAdjustmentReasonEnum;
  notes?: string | null;
  userId: string;
}

export type ProductDiscountConfigurationFormData = Omit<ProductDiscountConfiguration, 'id' | 'discountSetId' | 'productId' | 'product' | 'createdAt' | 'updatedAt' | 'productNameAtConfiguration'> & {
  _key?: string;
  productId?: string;
  productName?: string;
};

export interface DiscountSetFormData {
  id?: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  isOneTimePerTransaction: boolean;
  globalCartPriceRuleJson: SpecificDiscountRuleConfig | null;
  globalCartQuantityRuleJson: SpecificDiscountRuleConfig | null;
  defaultLineItemValueRuleJson: SpecificDiscountRuleConfig | null;
  defaultLineItemQuantityRuleJson: SpecificDiscountRuleConfig | null;
  defaultSpecificQtyThresholdRuleJson: SpecificDiscountRuleConfig | null;
  defaultSpecificUnitPriceThresholdRuleJson: SpecificDiscountRuleConfig | null;
  buyGetRulesJson?: BuyGetRule[] | null;
  productConfigurations: ProductDiscountConfigurationFormData[];
}

export enum TransactionTypeEnum {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}
export type TransactionType = `${TransactionTypeEnum}`;

export interface FinancialTransaction {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  category: string;
  description?: string | null;
  userId: string;
  user?: { username: string; }; // Added for reports
  createdAt?: string;
  updatedAt?: string;
  companyId?: string | null; // Multi-company support
}

export interface FinancialTransactionFormData {
  id?: string;
  date: Date;
  type: TransactionType;
  amount: number;
  category: string;
  description?: string | null;
}

// Cash Register Shift Management
export enum ShiftStatusEnum {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}
export type ShiftStatus = `${ShiftStatusEnum}`;

export interface CashRegisterShift {
  id: string;
  openingBalance: number;
  closingBalance?: number | null;
  notes?: string | null;
  startedAt: string; // ISO String
  closedAt?: string | null; // ISO String
  status: ShiftStatus;
  userId: string;
  user?: {
    username: string;
  };
  createdAt?: string;
  updatedAt?: string;
  companyId?: string | null; // Multi-company support
}

export interface CashRegisterShiftFormData {
    openingBalance?: number;
    closingBalance?: number;
    notes?: string;
}

// Report Types
export interface ComprehensiveReport {
  startDate: string;
  endDate: string;
  generatedAt: string;
  summary: {
    netSales: number;
    totalCashSales: number;
    totalCreditSales: number;
    totalPaymentsOnCreditSales: number;
    outstandingCreditAmount: number;
    totalDiscounts: number;
    totalTax: number;
    grossSales: number;
    totalReturnsValue: number;
    totalIncome: number;
    totalExpense: number;
    costOfGoodsSold: number;
    netProfitLoss: number;
    totalPurchaseValue: number;
    totalPaymentsToSuppliers: number;
    netCashFromShifts: number;
    totalStockAdjustmentsValue: number;
  };
  sales: SaleRecord[];
  returns: SaleRecord[];
  financialTransactions: FinancialTransaction[];
  stockAdjustments: StockAdjustmentLog[];
  purchases: PurchaseBill[];
  cashRegisterShifts: CashRegisterShift[];
  newOrUpdatedProducts: Product[];
  newOrUpdatedParties: Party[];
}
