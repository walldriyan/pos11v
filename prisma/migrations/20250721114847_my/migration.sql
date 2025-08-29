/*
  Warnings:

  - You are about to drop the column `createdAt` on the `AppConfig` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `AppConfig` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `CompanyProfile` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `CompanyProfile` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `CompanyProfile` table. All the data in the column will be lost.
  - You are about to drop the column `costPrice` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `Product` table. All the data in the column will be lost.
  - Added the required column `updatedByUserId` to the `AppConfig` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "ProductBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT,
    "quantity" REAL NOT NULL,
    "costPrice" REAL NOT NULL,
    "expiryDate" DATETIME,
    "purchaseBillItemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductBatch_purchaseBillItemId_fkey" FOREIGN KEY ("purchaseBillItemId") REFERENCES "PurchaseBillItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleRecordItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "priceAtSale" REAL NOT NULL,
    "costPriceAtSale" REAL,
    "discountApplied" REAL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "value" JSONB NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppConfig" ("id", "updatedAt", "value") SELECT "id", "updatedAt", "value" FROM "AppConfig";
DROP TABLE "AppConfig";
ALTER TABLE "new_AppConfig" RENAME TO "AppConfig";
CREATE TABLE "new_CashRegisterShift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "openingBalance" REAL NOT NULL,
    "closingBalance" REAL,
    "notes" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "status" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CashRegisterShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CashRegisterShift" ("closedAt", "closingBalance", "createdAt", "id", "notes", "openingBalance", "startedAt", "status", "updatedAt", "userId") SELECT "closedAt", "closingBalance", "createdAt", "id", "notes", "openingBalance", "startedAt", "status", "updatedAt", "userId" FROM "CashRegisterShift";
DROP TABLE "CashRegisterShift";
ALTER TABLE "new_CashRegisterShift" RENAME TO "CashRegisterShift";
CREATE TABLE "new_CompanyProfile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main_profile',
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "taxId" TEXT,
    "logoUrl" TEXT,
    "updatedByUserId" TEXT
);
INSERT INTO "new_CompanyProfile" ("address", "email", "id", "logoUrl", "name", "phone", "taxId", "website") SELECT "address", "email", "id", "logoUrl", "name", "phone", "taxId", "website" FROM "CompanyProfile";
DROP TABLE "CompanyProfile";
ALTER TABLE "new_CompanyProfile" RENAME TO "CompanyProfile";
CREATE TABLE "new_DiscountSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isOneTimePerTransaction" BOOLEAN NOT NULL DEFAULT false,
    "globalCartPriceRuleJson" JSONB,
    "globalCartQuantityRuleJson" JSONB,
    "defaultLineItemValueRuleJson" JSONB,
    "defaultLineItemQuantityRuleJson" JSONB,
    "defaultSpecificQtyThresholdRuleJson" JSONB,
    "defaultSpecificUnitPriceThresholdRuleJson" JSONB,
    "buyGetRulesJson" JSONB,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DiscountSet_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "DiscountSet_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_DiscountSet" ("buyGetRulesJson", "createdAt", "createdByUserId", "defaultLineItemQuantityRuleJson", "defaultLineItemValueRuleJson", "defaultSpecificQtyThresholdRuleJson", "defaultSpecificUnitPriceThresholdRuleJson", "globalCartPriceRuleJson", "globalCartQuantityRuleJson", "id", "isActive", "isDefault", "isOneTimePerTransaction", "name", "updatedAt", "updatedByUserId") SELECT "buyGetRulesJson", "createdAt", "createdByUserId", "defaultLineItemQuantityRuleJson", "defaultLineItemValueRuleJson", "defaultSpecificQtyThresholdRuleJson", "defaultSpecificUnitPriceThresholdRuleJson", "globalCartPriceRuleJson", "globalCartQuantityRuleJson", "id", "isActive", "isDefault", "isOneTimePerTransaction", "name", "updatedAt", "updatedByUserId" FROM "DiscountSet";
DROP TABLE "DiscountSet";
ALTER TABLE "new_DiscountSet" RENAME TO "DiscountSet";
CREATE UNIQUE INDEX "DiscountSet_name_key" ON "DiscountSet"("name");
CREATE TABLE "new_FinancialTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancialTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FinancialTransaction" ("amount", "category", "createdAt", "date", "description", "id", "type", "updatedAt", "userId") SELECT "amount", "category", "createdAt", "date", "description", "id", "type", "updatedAt", "userId" FROM "FinancialTransaction";
DROP TABLE "FinancialTransaction";
ALTER TABLE "new_FinancialTransaction" RENAME TO "FinancialTransaction";
CREATE TABLE "new_Party" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Party_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "Party_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_Party" ("address", "createdAt", "createdByUserId", "email", "id", "isActive", "name", "phone", "type", "updatedAt", "updatedByUserId") SELECT "address", "createdAt", "createdByUserId", "email", "id", "isActive", "name", "phone", "type", "updatedAt", "updatedByUserId" FROM "Party";
DROP TABLE "Party";
ALTER TABLE "new_Party" RENAME TO "Party";
CREATE UNIQUE INDEX "Party_name_key" ON "Party"("name");
CREATE UNIQUE INDEX "Party_email_key" ON "Party"("email");
CREATE TABLE "new_PaymentInstallment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleRecordId" TEXT NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "amountPaid" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    CONSTRAINT "PaymentInstallment_saleRecordId_fkey" FOREIGN KEY ("saleRecordId") REFERENCES "SaleRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentInstallment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PaymentInstallment" ("amountPaid", "createdAt", "id", "method", "notes", "paymentDate", "recordedByUserId", "saleRecordId", "updatedAt") SELECT "amountPaid", "createdAt", "id", "method", "notes", "paymentDate", "recordedByUserId", "saleRecordId", "updatedAt" FROM "PaymentInstallment";
DROP TABLE "PaymentInstallment";
ALTER TABLE "new_PaymentInstallment" RENAME TO "PaymentInstallment";
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT,
    "barcode" TEXT,
    "units" JSONB NOT NULL,
    "sellingPrice" REAL NOT NULL,
    "defaultQuantity" REAL NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isService" BOOLEAN NOT NULL DEFAULT false,
    "productSpecificTaxRate" REAL,
    "description" TEXT,
    "imageUrl" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "Product_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_Product" ("barcode", "category", "code", "createdAt", "createdByUserId", "defaultQuantity", "description", "id", "imageUrl", "isActive", "isService", "name", "productSpecificTaxRate", "sellingPrice", "units", "updatedAt", "updatedByUserId") SELECT "barcode", "category", "code", "createdAt", "createdByUserId", "defaultQuantity", "description", "id", "imageUrl", "isActive", "isService", "name", "productSpecificTaxRate", "sellingPrice", "units", "updatedAt", "updatedByUserId" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
CREATE TABLE "new_PurchaseBill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierBillNumber" TEXT,
    "purchaseDate" DATETIME NOT NULL,
    "supplierId" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "amountPaid" REAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseBill_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseBill" ("amountPaid", "createdAt", "createdByUserId", "id", "notes", "paymentStatus", "purchaseDate", "supplierBillNumber", "supplierId", "totalAmount", "updatedAt") SELECT "amountPaid", "createdAt", "createdByUserId", "id", "notes", "paymentStatus", "purchaseDate", "supplierBillNumber", "supplierId", "totalAmount", "updatedAt" FROM "PurchaseBill";
DROP TABLE "PurchaseBill";
ALTER TABLE "new_PurchaseBill" RENAME TO "PurchaseBill";
CREATE TABLE "new_PurchasePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseBillId" TEXT NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "amountPaid" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchasePayment_purchaseBillId_fkey" FOREIGN KEY ("purchaseBillId") REFERENCES "PurchaseBill" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchasePayment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PurchasePayment" ("amountPaid", "createdAt", "id", "method", "notes", "paymentDate", "purchaseBillId", "recordedByUserId", "reference") SELECT "amountPaid", "createdAt", "id", "method", "notes", "paymentDate", "purchaseBillId", "recordedByUserId", "reference" FROM "PurchasePayment";
DROP TABLE "PurchasePayment";
ALTER TABLE "new_PurchasePayment" RENAME TO "PurchasePayment";
CREATE TABLE "new_SaleRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordType" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "items" JSONB NOT NULL,
    "subtotalOriginal" REAL NOT NULL,
    "totalItemDiscountAmount" REAL NOT NULL,
    "totalCartDiscountAmount" REAL NOT NULL,
    "netSubtotal" REAL NOT NULL,
    "appliedDiscountSummary" JSONB,
    "activeDiscountSetId" TEXT,
    "taxRate" REAL NOT NULL,
    "taxAmount" REAL NOT NULL,
    "totalAmount" REAL NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "amountPaidByCustomer" REAL,
    "changeDueToCustomer" REAL,
    "status" TEXT NOT NULL,
    "returnedItemsLog" JSONB,
    "originalSaleRecordId" TEXT,
    "isCreditSale" BOOLEAN NOT NULL DEFAULT false,
    "creditOutstandingAmount" REAL,
    "creditLastPaymentDate" DATETIME,
    "creditPaymentStatus" TEXT,
    "customerId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    CONSTRAINT "SaleRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SaleRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SaleRecord" ("activeDiscountSetId", "amountPaidByCustomer", "appliedDiscountSummary", "billNumber", "changeDueToCustomer", "createdByUserId", "creditLastPaymentDate", "creditOutstandingAmount", "creditPaymentStatus", "customerId", "date", "id", "isCreditSale", "items", "netSubtotal", "originalSaleRecordId", "paymentMethod", "recordType", "returnedItemsLog", "status", "subtotalOriginal", "taxAmount", "taxRate", "totalAmount", "totalCartDiscountAmount", "totalItemDiscountAmount") SELECT "activeDiscountSetId", "amountPaidByCustomer", "appliedDiscountSummary", "billNumber", "changeDueToCustomer", "createdByUserId", "creditLastPaymentDate", "creditOutstandingAmount", "creditPaymentStatus", "customerId", "date", "id", "isCreditSale", "items", "netSubtotal", "originalSaleRecordId", "paymentMethod", "recordType", "returnedItemsLog", "status", "subtotalOriginal", "taxAmount", "taxRate", "totalAmount", "totalCartDiscountAmount", "totalItemDiscountAmount" FROM "SaleRecord";
DROP TABLE "SaleRecord";
ALTER TABLE "new_SaleRecord" RENAME TO "SaleRecord";
CREATE UNIQUE INDEX "SaleRecord_billNumber_key" ON "SaleRecord"("billNumber");
CREATE TABLE "new_StockAdjustmentLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "quantityChanged" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "adjustedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "StockAdjustmentLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockAdjustmentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockAdjustmentLog" ("adjustedAt", "id", "notes", "productId", "quantityChanged", "reason", "userId") SELECT "adjustedAt", "id", "notes", "productId", "quantityChanged", "reason", "userId" FROM "StockAdjustmentLog";
DROP TABLE "StockAdjustmentLog";
ALTER TABLE "new_StockAdjustmentLog" RENAME TO "StockAdjustmentLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ProductBatch_purchaseBillItemId_key" ON "ProductBatch"("purchaseBillItemId");
