/*
  Warnings:

  - You are about to drop the column `updatedByUserId` on the `AppConfig` table. All the data in the column will be lost.
  - You are about to drop the column `updatedByUserId` on the `CompanyProfile` table. All the data in the column will be lost.
  - You are about to drop the column `defaultSpecificUnitPriceThresholdRule` on the `DiscountSet` table. All the data in the column will be lost.
  - You are about to alter the column `defaultQuantity` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - You are about to alter the column `stock` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - You are about to drop the column `createdAt` on the `PurchaseBillItem` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `PurchaseBillItem` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `PurchasePayment` table. All the data in the column will be lost.
  - You are about to drop the column `assignedAt` on the `RolePermission` table. All the data in the column will be lost.
  - You are about to drop the column `activeDiscountSetIdDuringSale` on the `SaleRecord` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `SaleRecord` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `SaleRecord` table. All the data in the column will be lost.
  - You are about to alter the column `quantityChanged` on the `StockAdjustmentLog` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - Made the column `roleId` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "CashRegisterShift_status_idx";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "value" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "AppConfig_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AppConfig" ("id", "updatedAt", "value") SELECT "id", "updatedAt", "value" FROM "AppConfig";
DROP TABLE "AppConfig";
ALTER TABLE "new_AppConfig" RENAME TO "AppConfig";
CREATE TABLE "new_CompanyProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "taxId" TEXT,
    "logoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "CompanyProfile_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CompanyProfile" ("address", "email", "id", "logoUrl", "name", "phone", "taxId", "updatedAt", "website") SELECT "address", "email", "id", "logoUrl", "name", "phone", "taxId", "updatedAt", "website" FROM "CompanyProfile";
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT
);
INSERT INTO "new_DiscountSet" ("buyGetRulesJson", "createdAt", "createdByUserId", "defaultLineItemQuantityRuleJson", "defaultLineItemValueRuleJson", "defaultSpecificQtyThresholdRuleJson", "globalCartPriceRuleJson", "globalCartQuantityRuleJson", "id", "isActive", "isDefault", "isOneTimePerTransaction", "name", "updatedAt", "updatedByUserId") SELECT "buyGetRulesJson", "createdAt", "createdByUserId", "defaultLineItemQuantityRuleJson", "defaultLineItemValueRuleJson", "defaultSpecificQtyThresholdRuleJson", "globalCartPriceRuleJson", "globalCartQuantityRuleJson", "id", "isActive", "isDefault", "isOneTimePerTransaction", "name", "updatedAt", "updatedByUserId" FROM "DiscountSet";
DROP TABLE "DiscountSet";
ALTER TABLE "new_DiscountSet" RENAME TO "DiscountSet";
CREATE UNIQUE INDEX "DiscountSet_name_key" ON "DiscountSet"("name");
CREATE TABLE "new_Party" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    CONSTRAINT "Party_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "Party_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
INSERT INTO "new_Party" ("address", "createdAt", "createdByUserId", "email", "id", "isActive", "name", "phone", "type", "updatedAt", "updatedByUserId") SELECT "address", "createdAt", "createdByUserId", "email", "id", "isActive", "name", "phone", "type", "updatedAt", "updatedByUserId" FROM "Party";
DROP TABLE "Party";
ALTER TABLE "new_Party" RENAME TO "Party";
CREATE UNIQUE INDEX "Party_email_key" ON "Party"("email");
CREATE INDEX "Party_type_idx" ON "Party"("type");
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
    CONSTRAINT "PaymentInstallment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION
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
    "costPrice" REAL,
    "stock" REAL NOT NULL DEFAULT 0,
    "defaultQuantity" REAL NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isService" BOOLEAN NOT NULL DEFAULT false,
    "productSpecificTaxRate" REAL,
    "description" TEXT,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    CONSTRAINT "Product_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "Product_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
INSERT INTO "new_Product" ("barcode", "category", "code", "costPrice", "createdAt", "createdByUserId", "defaultQuantity", "description", "id", "imageUrl", "isActive", "isService", "name", "productSpecificTaxRate", "sellingPrice", "stock", "units", "updatedAt", "updatedByUserId") SELECT "barcode", "category", "code", "costPrice", "createdAt", "createdByUserId", "defaultQuantity", "description", "id", "imageUrl", "isActive", "isService", "name", "productSpecificTaxRate", "sellingPrice", "stock", "units", "updatedAt", "updatedByUserId" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
CREATE TABLE "new_ProductDiscountConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discountSetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameAtConfiguration" TEXT NOT NULL,
    "isActiveForProductInCampaign" BOOLEAN NOT NULL DEFAULT true,
    "lineItemValueRuleJson" JSONB,
    "lineItemQuantityRuleJson" JSONB,
    "specificQtyThresholdRuleJson" JSONB,
    "specificUnitPriceThresholdRuleJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductDiscountConfiguration_discountSetId_fkey" FOREIGN KEY ("discountSetId") REFERENCES "DiscountSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductDiscountConfiguration_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProductDiscountConfiguration" ("createdAt", "discountSetId", "id", "isActiveForProductInCampaign", "lineItemQuantityRuleJson", "lineItemValueRuleJson", "productId", "productNameAtConfiguration", "specificQtyThresholdRuleJson", "specificUnitPriceThresholdRuleJson", "updatedAt") SELECT "createdAt", "discountSetId", "id", "isActiveForProductInCampaign", "lineItemQuantityRuleJson", "lineItemValueRuleJson", "productId", "productNameAtConfiguration", "specificQtyThresholdRuleJson", "specificUnitPriceThresholdRuleJson", "updatedAt" FROM "ProductDiscountConfiguration";
DROP TABLE "ProductDiscountConfiguration";
ALTER TABLE "new_ProductDiscountConfiguration" RENAME TO "ProductDiscountConfiguration";
CREATE UNIQUE INDEX "ProductDiscountConfiguration_discountSetId_productId_key" ON "ProductDiscountConfiguration"("discountSetId", "productId");
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
    CONSTRAINT "PurchaseBill_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
INSERT INTO "new_PurchaseBill" ("amountPaid", "createdAt", "createdByUserId", "id", "notes", "paymentStatus", "purchaseDate", "supplierBillNumber", "supplierId", "totalAmount", "updatedAt") SELECT "amountPaid", "createdAt", "createdByUserId", "id", "notes", "paymentStatus", "purchaseDate", "supplierBillNumber", "supplierId", "totalAmount", "updatedAt" FROM "PurchaseBill";
DROP TABLE "PurchaseBill";
ALTER TABLE "new_PurchaseBill" RENAME TO "PurchaseBill";
CREATE TABLE "new_PurchaseBillItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseBillId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameAtPurchase" TEXT NOT NULL,
    "quantityPurchased" REAL NOT NULL,
    "costPriceAtPurchase" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "PurchaseBillItem_purchaseBillId_fkey" FOREIGN KEY ("purchaseBillId") REFERENCES "PurchaseBill" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseBillItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseBillItem" ("costPriceAtPurchase", "id", "productId", "productNameAtPurchase", "purchaseBillId", "quantityPurchased", "subtotal") SELECT "costPriceAtPurchase", "id", "productId", "productNameAtPurchase", "purchaseBillId", "quantityPurchased", "subtotal" FROM "PurchaseBillItem";
DROP TABLE "PurchaseBillItem";
ALTER TABLE "new_PurchaseBillItem" RENAME TO "PurchaseBillItem";
CREATE TABLE "new_PurchasePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseBillId" TEXT NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "amountPaid" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT NOT NULL,
    CONSTRAINT "PurchasePayment_purchaseBillId_fkey" FOREIGN KEY ("purchaseBillId") REFERENCES "PurchaseBill" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchasePayment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
INSERT INTO "new_PurchasePayment" ("amountPaid", "createdAt", "id", "method", "notes", "paymentDate", "purchaseBillId", "recordedByUserId", "reference") SELECT "amountPaid", "createdAt", "id", "method", "notes", "paymentDate", "purchaseBillId", "recordedByUserId", "reference" FROM "PurchasePayment";
DROP TABLE "PurchasePayment";
ALTER TABLE "new_PurchasePayment" RENAME TO "PurchasePayment";
CREATE TABLE "new_Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    CONSTRAINT "Role_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "Role_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_Role" ("createdAt", "createdByUserId", "description", "id", "name", "updatedAt", "updatedByUserId") SELECT "createdAt", "createdByUserId", "description", "id", "name", "updatedAt", "updatedByUserId" FROM "Role";
DROP TABLE "Role";
ALTER TABLE "new_Role" RENAME TO "Role";
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
CREATE TABLE "new_RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    PRIMARY KEY ("roleId", "permissionId"),
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RolePermission" ("permissionId", "roleId") SELECT "permissionId", "roleId" FROM "RolePermission";
DROP TABLE "RolePermission";
ALTER TABLE "new_RolePermission" RENAME TO "RolePermission";
CREATE TABLE "new_SaleRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordType" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "items" JSONB NOT NULL,
    "subtotalOriginal" REAL NOT NULL,
    "totalItemDiscountAmount" REAL NOT NULL DEFAULT 0,
    "totalCartDiscountAmount" REAL NOT NULL DEFAULT 0,
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
    CONSTRAINT "SaleRecord_activeDiscountSetId_fkey" FOREIGN KEY ("activeDiscountSetId") REFERENCES "DiscountSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SaleRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SaleRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
INSERT INTO "new_SaleRecord" ("amountPaidByCustomer", "appliedDiscountSummary", "billNumber", "changeDueToCustomer", "createdByUserId", "creditLastPaymentDate", "creditOutstandingAmount", "creditPaymentStatus", "customerId", "date", "id", "isCreditSale", "items", "netSubtotal", "originalSaleRecordId", "paymentMethod", "recordType", "returnedItemsLog", "status", "subtotalOriginal", "taxAmount", "taxRate", "totalAmount", "totalCartDiscountAmount", "totalItemDiscountAmount") SELECT "amountPaidByCustomer", "appliedDiscountSummary", "billNumber", "changeDueToCustomer", "createdByUserId", "creditLastPaymentDate", "creditOutstandingAmount", "creditPaymentStatus", "customerId", "date", "id", "isCreditSale", "items", "netSubtotal", "originalSaleRecordId", "paymentMethod", "recordType", "returnedItemsLog", "status", "subtotalOriginal", "taxAmount", "taxRate", "totalAmount", "totalCartDiscountAmount", "totalItemDiscountAmount" FROM "SaleRecord";
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
    CONSTRAINT "StockAdjustmentLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockAdjustmentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockAdjustmentLog" ("adjustedAt", "id", "notes", "productId", "quantityChanged", "reason", "userId") SELECT "adjustedAt", "id", "notes", "productId", "quantityChanged", "reason", "userId" FROM "StockAdjustmentLog";
DROP TABLE "StockAdjustmentLog";
ALTER TABLE "new_StockAdjustmentLog" RENAME TO "StockAdjustmentLog";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "roleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "User_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_User" ("createdAt", "createdByUserId", "email", "id", "isActive", "passwordHash", "roleId", "updatedAt", "updatedByUserId", "username") SELECT "createdAt", "createdByUserId", "email", "id", "isActive", "passwordHash", "roleId", "updatedAt", "updatedByUserId", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
