
import { z } from 'zod';

// Schema for UnitDefinition and DerivedUnit
export const DerivedUnitSchema = z.object({
  name: z.string().min(1, "Derived unit name is required"),
  conversionFactor: z.number({invalid_type_error: "Conversion factor must be a number"}).positive("Conversion factor must be positive"),
  threshold: z.number({invalid_type_error: "Threshold must be a number"}).nonnegative("Threshold must be non-negative"),
});
export type DerivedUnitInput = z.infer<typeof DerivedUnitSchema>;

export const UnitDefinitionSchema = z.object({
  baseUnit: z.string().min(1, "Base unit name is required"),
  derivedUnits: z.array(DerivedUnitSchema).optional().default([]),
});
export type UnitDefinitionInput = z.infer<typeof UnitDefinitionSchema>;

// Common schema for specific discount rules
export const SpecificDiscountRuleConfigSchema = z.object({
  isEnabled: z.boolean().default(false),
  name: z.string().min(1, { message: "Rule name is required" }).default("Unnamed Rule"),
  type: z.enum(['percentage', 'fixed']).default('percentage'),
  value: z.number().min(0, { message: "Value must be non-negative" }).default(0),
  conditionMin: z.number().min(0, { message: "Min condition must be non-negative" }).optional().nullable(),
  conditionMax: z.number().min(0, { message: "Max condition must be non-negative" }).optional().nullable(),
  applyFixedOnce: z.boolean().default(false).optional(),
}).superRefine((data, ctx) => {
  if (data.isEnabled) {
    if (!data.name || data.name.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rule name is required when rule is enabled.", path: ["name"] });
    }
    if (data.value === undefined || data.value === null || (typeof data.value === 'number' && data.value < 0)) {
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Value must be a non-negative number when rule is enabled.", path: ["value"] });
    }
    if (data.conditionMin != null && data.conditionMax != null && data.conditionMax < data.conditionMin) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Max condition cannot be less than Min condition.", path: ["conditionMax"] });
    }
  }
});
export type SpecificDiscountRuleConfigInput = z.infer<typeof SpecificDiscountRuleConfigSchema>;

// Schema for "Buy & Get" rules
export const BuyGetRuleSchema = z.object({
  buyProductId: z.string().min(1, "Product to buy must be selected."),
  buyQuantity: z.number().positive("Buy quantity must be greater than 0."),
  getProductId: z.string().min(1, "Product to get must be selected."),
  getQuantity: z.number().positive("Get quantity must be greater than 0."),
  discountType: z.enum(['percentage', 'fixed']).default('percentage'),
  discountValue: z.number().min(0, "Discount value must be non-negative."),
  isRepeatable: z.boolean().default(false),
});
export type BuyGetRuleInput = z.infer<typeof BuyGetRuleSchema>;


// NEW: Schema specifically for the Product Form
export const ProductFormDataSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1, "Product name is required"),
  code: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  units: UnitDefinitionSchema,
  sellingPrice: z.number({invalid_type_error: "Selling price must be a number"}).nonnegative("Selling price must be non-negative"),
  // stock and costPrice are optional for the form because they are for initial creation
  stock: z.number().nonnegative("Stock cannot be negative").optional().nullable(),
  costPrice: z.number().nonnegative("Cost price cannot be negative").optional().nullable(),
  defaultQuantity: z.number({invalid_type_error: "Default quantity must be a number"}).positive("Default quantity must be positive").default(1),
  isActive: z.boolean().default(true),
  isService: z.boolean().default(false),
  productSpecificTaxRate: z.number().min(0, "Tax rate cannot be negative.").max(100, "Tax rate must be a percentage between 0 and 100.").optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url("Invalid image URL. Must be full URL or empty.").optional().nullable().or(z.literal('')),
});
export type ProductFormData = z.infer<typeof ProductFormDataSchema>;


// Schema for Product (Database Model representation)
export const ProductSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1, "Product name is required"),
  code: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  units: UnitDefinitionSchema,
  sellingPrice: z.number({invalid_type_error: "Selling price must be a number"}).nonnegative("Selling price must be non-negative"),
  stock: z.number(), // Not part of form, calculated
  costPrice: z.number().optional().nullable(), // Not part of form, calculated
  defaultQuantity: z.number({invalid_type_error: "Default quantity must be a number"}).positive("Default quantity must be positive").default(1),
  isActive: z.boolean().default(true),
  isService: z.boolean().default(false),
  productSpecificTaxRate: z.number().min(0, "Tax rate cannot be negative.").max(100, "Tax rate must be a percentage between 0 and 100.").optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url("Invalid image URL. If provided, it must be a full URL (e.g., https://example.com/image.png)").optional().nullable().or(z.literal('')),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type ProductType = z.infer<typeof ProductSchema>;

// This schema is for creating the DB record, it doesn't include form-only fields.
export const ProductCreateInputSchema = ProductSchema.omit({ id: true, createdAt: true, updatedAt: true, stock: true, costPrice: true });
export type ProductCreateInput = z.infer<typeof ProductCreateInputSchema>;

// Update schema should be partial and can now accept stock/costPrice for adjustments.
export const ProductUpdateInputSchema = ProductFormDataSchema.partial();
export type ProductUpdateInput = z.infer<typeof ProductUpdateInputSchema>;


// Schema for AppliedRuleInfo
export const AppliedRuleInfoSchema = z.object({
  discountCampaignName: z.string(),
  sourceRuleName: z.string(),
  totalCalculatedDiscount: z.number(),
  ruleType: z.enum([
    // Product-specific rules (from ProductDiscountConfiguration within a Campaign)
    'product_config_line_item_value',
    'product_config_line_item_quantity',
    'product_config_specific_qty_threshold',
    'product_config_specific_unit_price',
    // Campaign's default item rules (for unconfigured products in that campaign)
    'campaign_default_line_item_value',
    'campaign_default_line_item_quantity',
    'campaign_default_specific_qty_threshold',
    'campaign_default_specific_unit_price',
    // Campaign's global cart rules
    'campaign_global_cart_price',
    'campaign_global_cart_quantity',
    // New Buy & Get rule
    'buy_get_free',
    // New type for custom discounts
    'custom_item_discount',
  ]),
  productIdAffected: z.string().optional(),
  appliedOnce: z.boolean().optional(),
});
export type AppliedRuleInfoInput = z.infer<typeof AppliedRuleInfoSchema>;


// Schema for ReturnedItemDetail
export const ReturnedItemDetailSchema = z.object({
  id: z.string().min(1),
  itemId: z.string(), // productId of the item returned
  name: z.string(),
  returnedQuantity: z.number().positive(),
  units: UnitDefinitionSchema,
  refundAmountPerUnit: z.number(),
  totalRefundForThisReturnEntry: z.number(),
  returnDate: z.string().datetime(),
  returnTransactionId: z.string(),
  isUndone: z.boolean().optional().default(false),
  processedByUserId: z.string().min(1, "Processed by user ID is required."),
  originalBatchId: z.string().nullable().optional(),
});
export type ReturnedItemDetailInput = z.infer<typeof ReturnedItemDetailSchema>;


// Schema for SaleRecordItem
export const SaleRecordItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  price: z.number(),
  category: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal('')),
  units: UnitDefinitionSchema, // CORRECTED: This was missing before
  quantity: z.number().positive("Item quantity must be greater than 0."), // Individual items must always have quantity > 0
  priceAtSale: z.number(),
  effectivePricePaidPerUnit: z.number(),
  totalDiscountOnLine: z.number(),
  costPriceAtSale: z.number(), // Added for profit calculation
  batchId: z.string().optional().nullable(),
  batchNumber: z.string().optional().nullable(),
  customDiscountType: z.enum(['percentage', 'fixed']).optional().nullable(),
  customDiscountValue: z.number().optional().nullable(),
});
export type SaleRecordItemInput = z.infer<typeof SaleRecordItemSchema>;

export const CreditPaymentStatusEnumSchema = z.enum(['PENDING', 'PARTIALLY_PAID', 'FULLY_PAID']);
export type CreditPaymentStatusType = z.infer<typeof CreditPaymentStatusEnumSchema>;

export const PaymentInstallmentSchema = z.object({
  id: z.string().cuid(),
  saleRecordId: z.string(),
  paymentDate: z.string().datetime(),
  amountPaid: z.number().positive("Installment amount must be positive"),
  method: z.string().min(1, "Installment payment method is required"),
  notes: z.string().optional().nullable(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  recordedByUserId: z.string(),
});
export type PaymentInstallmentInput = z.infer<typeof PaymentInstallmentSchema>;


export const SaleRecordSchema = z.object({
  id: z.string().cuid().optional(), 
  recordType: z.enum(['SALE', 'RETURN_TRANSACTION']),
  billNumber: z.string(),
  date: z.string().datetime(),
  items: z.array(SaleRecordItemSchema),
  subtotalOriginal: z.number(),
  totalItemDiscountAmount: z.number(),
  totalCartDiscountAmount: z.number(),
  netSubtotal: z.number(),
  appliedDiscountSummary: z.union([z.array(AppliedRuleInfoSchema), z.null()]),
  activeDiscountSetId: z.string().optional().nullable(),
  taxRate: z.number(),
  taxAmount: z.number(),
  totalAmount: z.number(),
  paymentMethod: z.enum(['cash', 'credit', 'REFUND']),
  amountPaidByCustomer: z.number().optional().nullable(),
  changeDueToCustomer: z.number().optional().nullable(),
  status: z.enum(['COMPLETED_ORIGINAL', 'ADJUSTED_ACTIVE', 'RETURN_TRANSACTION_COMPLETED']),
  returnedItemsLog: z.array(ReturnedItemDetailSchema).optional().nullable(),
  originalSaleRecordId: z.string().optional().nullable(),
  isCreditSale: z.boolean().default(false),
  creditOutstandingAmount: z.number().optional().nullable(),
  creditLastPaymentDate: z.string().datetime().optional().nullable(),
  creditPaymentStatus: CreditPaymentStatusEnumSchema.optional().nullable(),
  paymentInstallments: z.array(PaymentInstallmentSchema).optional(),
  customerId: z.string().optional().nullable(),
  _hasReturns: z.boolean().optional(), 
}).superRefine((data, ctx) => {
  if (data.recordType === 'SALE' && data.status === 'COMPLETED_ORIGINAL' && data.items.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Original sales must have at least one item.",
      path: ["items"],
    });
  }
  if (data.status === 'ADJUSTED_ACTIVE' && data.items.length === 0 && !data.originalSaleRecordId) {
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An adjusted sale with no items must have an originalSaleRecordId linking it to the original transaction.",
        path: ["originalSaleRecordId"]
    });
  }
});
export type SaleRecordInput = z.infer<typeof SaleRecordSchema>;

export const UndoReturnItemInputSchema = z.object({
  masterSaleRecordId: z.string().min(1, "Master Sale Record ID is required."),
  returnedItemDetailId: z.string().min(1, "Returned Item Detail ID is required."), 
});
export type UndoReturnItemInput = z.infer<typeof UndoReturnItemInputSchema>;


// Schema for ProductDiscountConfiguration (rules for a specific product within a campaign)
export const ProductDiscountConfigurationSchema = z.object({
  id: z.string().cuid().optional(),
  discountSetId: z.string().optional(), 
  productId: z.string().min(1, "Product selection is required."),
  productNameAtConfiguration: z.string().optional(),
  isActiveForProductInCampaign: z.boolean().default(true),
  lineItemValueRuleJson: SpecificDiscountRuleConfigSchema.nullable().optional(),
  lineItemQuantityRuleJson: SpecificDiscountRuleConfigSchema.nullable().optional(),
  specificQtyThresholdRuleJson: SpecificDiscountRuleConfigSchema.nullable().optional(),
  specificUnitPriceThresholdRuleJson: SpecificDiscountRuleConfigSchema.nullable().optional(),
});
export type ProductDiscountConfigurationInput = z.infer<typeof ProductDiscountConfigurationSchema>;


// Schema for DiscountSet (Campaign)
export const DiscountSetValidationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: "Campaign name is required" }),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  isOneTimePerTransaction: z.boolean().default(false),
  globalCartPriceRuleJson: SpecificDiscountRuleConfigSchema.nullable().optional(),
  globalCartQuantityRuleJson: SpecificDiscountRuleConfigSchema.nullable().optional(),
  // NEW default item rules
  defaultLineItemValueRuleJson: SpecificDiscountRuleConfigSchema.nullable().optional(),
  defaultLineItemQuantityRuleJson: SpecificDiscountRuleConfigSchema.nullable().optional(),
  defaultSpecificQtyThresholdRuleJson: SpecificDiscountRuleConfigSchema.nullable().optional(),
  defaultSpecificUnitPriceThresholdRuleJson: SpecificDiscountRuleConfigSchema.nullable().optional(),
  productConfigurations: z.array(ProductDiscountConfigurationSchema).optional().default([]),
  buyGetRulesJson: z.array(BuyGetRuleSchema).optional().default([]),
});
export type DiscountSetValidationInput = z.infer<typeof DiscountSetValidationSchema>;


export const TaxRateValidationSchema = z.object({
  rate: z.number().min(0, "Tax rate cannot be negative.").max(100, "Tax rate must be between 0 and 100."),
});
export type TaxRateValidationInput = z.infer<typeof TaxRateValidationSchema>;


export const PartyTypeEnumSchema = z.enum(['CUSTOMER', 'SUPPLIER']);

export const PartySchema = z.object({
    id: z.string().cuid(),
    name: z.string().min(1, "Name is required"),
    phone: z.string().optional().nullable(),
    email: z.string().email("Invalid email address").optional().nullable().or(z.literal('')),
    address: z.string().optional().nullable(),
    type: PartyTypeEnumSchema,
    isActive: z.boolean().default(true),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
});
export type PartyType = z.infer<typeof PartySchema>;

export const PartyCreateInputSchema = PartySchema.omit({ id: true, createdAt: true, updatedAt: true });
export type PartyCreateInput = z.infer<typeof PartyCreateInputSchema>;

export const PartyUpdateInputSchema = PartyCreateInputSchema.partial();
export type PartyUpdateInput = z.infer<typeof PartyUpdateInputSchema>;


export const PurchaseBillStatusEnumSchema = z.enum([
  'DRAFT', 'COMPLETED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED'
]);

export const PurchasePaymentMethodEnumSchema = z.enum([
  'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT_NOTE', 'OTHER'
]);

export const PurchaseBillItemInputSchema = z.object({
  productId: z.string().min(1, "Product ID is required."),
  quantityPurchased: z.number().positive("Purchased quantity must be a positive number."),
  costPriceAtPurchase: z.number().nonnegative("Cost price must be a non-negative number."),
  currentSellingPrice: z.number().nonnegative("Selling price must be a non-negative number.").optional(),
  batchNumber: z.string().optional().nullable(),
  expiryDate: z.date().optional().nullable(),
});
export type PurchaseBillItemInput = z.infer<typeof PurchaseBillItemInputSchema>;

export const PurchaseBillCreateInputSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required.").nullable(),
  supplierBillNumber: z.string().optional().nullable(),
  purchaseDate: z.date({
    required_error: "Purchase date is required.",
    invalid_type_error: "Purchase date must be a valid date.",
  }),
  items: z.array(PurchaseBillItemInputSchema).min(1, "At least one item is required for the purchase bill."),
  notes: z.string().optional().nullable(),
  amountPaid: z.number({invalid_type_error: "Amount paid must be a number"}).nonnegative("Amount paid must be non-negative").optional().nullable(),
  initialPaymentMethod: PurchasePaymentMethodEnumSchema.optional().nullable(),
  paymentReference: z.string().optional().nullable(),
  paymentNotes: z.string().optional().nullable(),
}).refine(data => {
  if ((data.amountPaid !== undefined && data.amountPaid !== null && data.amountPaid > 0) && !data.initialPaymentMethod) {
    return false;
  }
  return true;
}, {
  message: "Payment method is required if an amount is paid.",
  path: ["initialPaymentMethod"],
});
export type PurchaseBillCreateInput = z.infer<typeof PurchaseBillCreateInputSchema>;


export const PurchasePaymentCreateInputSchema = z.object({
  purchaseBillId: z.string().min(1, "Purchase Bill ID is required."),
  paymentDate: z.date({
    required_error: "Payment date is required.",
    invalid_type_error: "Payment date must be a valid date.",
  }),
  amountPaid: z.number().positive("Payment amount must be a positive number."),
  method: PurchasePaymentMethodEnumSchema,
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type PurchasePaymentCreateInput = z.infer<typeof PurchasePaymentCreateInputSchema>;

export const UserCreateSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long."),
  email: z.string().email("Invalid email address.").optional().nullable().or(z.literal('')),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  confirmPassword: z.string(),
  roleId: z.string().min(1, "Role is required."),
  isActive: z.boolean().default(true),
  companyId: z.string().min(1, "Company is required for this role.").optional().nullable(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
export type UserCreateFormInput = z.infer<typeof UserCreateSchema>;

export const UserUpdateSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long."),
  email: z.string().email("Invalid email address.").optional().nullable().or(z.literal('')),
  password: z.string().min(6, "Password must be at least 6 characters long.").optional().or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
  roleId: z.string().min(1, "Role is required."),
  isActive: z.boolean().default(true),
  companyId: z.string().min(1, "Company is required for this role.").optional().nullable(),
}).refine((data) => {
  if (data.password && data.password.length > 0) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
export type UserUpdateFormInput = z.infer<typeof UserUpdateSchema>;

export const RoleFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Role name must be at least 2 characters long."),
  description: z.string().optional().nullable(),
  permissionIds: z.array(z.string()).optional().default([]),
});
export type RoleFormInput = z.infer<typeof RoleFormSchema>;

export const PermissionSchema = z.object({
  id: z.string(),
  action: z.string(),
  subject: z.string(),
  description: z.string().optional().nullable(),
});
export type PermissionType = z.infer<typeof PermissionSchema>;

export const PermissionCreateSchema = PermissionSchema.omit({ id: true });
export type PermissionCreateInput = z.infer<typeof PermissionCreateSchema>;

export const CompanyProfileSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1, "Company name is required."),
  address: z.string().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().or(z.literal('')),
  email: z.string().email("Invalid email format.").optional().nullable().or(z.literal('')),
  website: z.string().url("Invalid URL format. Must be a full URL (e.g., https://example.com/image.png) or empty if no valid URL.").optional().nullable().or(z.literal('')),
  taxId: z.string().optional().nullable().or(z.literal('')),
  logoUrl: z.string().url("Invalid URL format. Must be a full URL (e.g., https://example.com/image.png) or empty if no logo.").optional().nullable().or(z.literal('')),
  createdByUserId: z.string().cuid().optional(),
  updatedByUserId: z.string().cuid().optional(),
});
export type CompanyProfileFormDataWithUser = z.infer<typeof CompanyProfileSchema>;

// Schema for Stock Adjustment Form
export const StockAdjustmentReasonEnumSchema = z.enum(['LOST', 'DAMAGED', 'CORRECTION_ADD', 'CORRECTION_SUBTRACT']);
export type StockAdjustmentReasonEnumType = z.infer<typeof StockAdjustmentReasonEnumSchema>;

export const StockAdjustmentFormSchema = z.object({
  productId: z.string().min(1, "Product selection is required."),
  quantity: z.number({invalid_type_error: "Quantity must be a number."}).positive("Quantity must be a positive number."),
  reason: StockAdjustmentReasonEnumSchema,
  notes: z.string().optional().nullable(),
});
export type StockAdjustmentFormInput = z.infer<typeof StockAdjustmentFormSchema>;

// Schemas for Financial Transactions
export const FinancialTransactionFormSchema = z.object({
  id: z.string().optional(),
  date: z.coerce.date({
    required_error: "Please select a date.",
    invalid_type_error: "That's not a valid date!",
  }),
  type: z.enum(['INCOME', 'EXPENSE'], { required_error: "Please select a transaction type." }),
  amount: z.number({invalid_type_error: "Amount must be a number."}).positive({ message: "Amount must be greater than zero." }),
  category: z.string().min(1, { message: "Category is required." }),
  description: z.string().optional().nullable(),
});

export const ShiftStatusEnumSchema = z.enum(['OPEN', 'CLOSED']);

export const CashRegisterShiftFormSchema = z.object({
  openingBalance: z.number({invalid_type_error: "Opening balance must be a number."}).nonnegative("Opening balance cannot be negative.").optional(),
  closingBalance: z.number({invalid_type_error: "Closing balance must be a number."}).nonnegative("Closing balance cannot be negative.").optional(),
  notes: z.string().optional().nullable(),
}).refine(data => data.openingBalance !== undefined || data.closingBalance !== undefined, {
    message: "Either opening or closing balance must be provided.",
});

    