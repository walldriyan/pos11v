
'use server';

import prisma from '@/lib/prisma';
import { ProductFormDataSchema } from '@/lib/zodSchemas';
import type { Product as ProductType, UnitDefinition, ProductFormData } from '@/types';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

interface ImportResult {
  success: boolean;
  message: string;
  totalRows: number;
  importedCount: number;
  errorCount: number;
  errors: { row: number; message: string; data: any }[];
}

export async function importProductsAction(
  data: Record<string, any>[],
  fieldMapping: Record<string, string>,
  userId: string
): Promise<ImportResult> {
  if (!userId) {
    return { success: false, message: "User not authenticated.", totalRows: 0, importedCount: 0, errorCount: 0, errors: [] };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.companyId) {
    return { success: false, message: "User is not associated with a company. Cannot import products.", totalRows: 0, importedCount: 0, errorCount: 0, errors: [] };
  }
  const companyId = user.companyId;

  let importedCount = 0;
  const importErrors: { row: number; message: string; data: any }[] = [];

  for (const [index, row] of data.entries()) {
    const mappedData: Record<string, any> = {};
    for (const [dbField, csvField] of Object.entries(fieldMapping)) {
      if (csvField && row[csvField] !== undefined) {
        mappedData[dbField] = row[csvField];
      }
    }
    
    // --- Data Transformation & Validation ---
    const stock = mappedData.stock ? parseFloat(mappedData.stock) : null;
    const costPrice = mappedData.costPrice ? parseFloat(mappedData.costPrice) : null;
    const sellingPrice = mappedData.sellingPrice ? parseFloat(mappedData.sellingPrice) : 0;
    
    const productForValidation: Partial<ProductFormData> = {
      name: mappedData.name,
      code: mappedData.code || null,
      category: mappedData.category || null,
      barcode: mappedData.barcode || null,
      sellingPrice: isNaN(sellingPrice) ? 0 : sellingPrice,
      stock: isNaN(stock as any) ? null : stock,
      costPrice: isNaN(costPrice as any) ? null : costPrice,
      isActive: true, // Default active
      isService: false, // Default to not a service
      units: { baseUnit: 'pcs', derivedUnits: [] }, // Default unit
    };
    
    const validationResult = ProductFormDataSchema.safeParse(productForValidation);

    if (validationResult.success) {
      const { stock: initialStock, costPrice: initialCostPrice, ...restOfProductData } = validationResult.data;
      
      try {
        await prisma.$transaction(async (tx) => {
            const productToCreate: Omit<Prisma.ProductCreateInput, 'batches'> = {
                ...restOfProductData,
                sellingPrice: restOfProductData.sellingPrice || 0,
                companyId: companyId,
                createdByUserId: userId,
                updatedByUserId: userId,
                units: (restOfProductData.units as Prisma.JsonValue) || Prisma.JsonNull,
            };

            const createdProduct = await tx.product.create({
              data: productToCreate
            });

            if (initialStock && initialStock > 0) {
              await tx.productBatch.create({
                data: {
                  productId: createdProduct.id,
                  batchNumber: 'INITIAL_IMPORT',
                  quantity: initialStock,
                  costPrice: initialCostPrice || 0, // Default cost to 0 if not provided
                  sellingPrice: createdProduct.sellingPrice,
                }
              });
            }
        });
        importedCount++;
      } catch (e: any) {
        let errorMessage = "Database error during creation.";
         if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
           errorMessage = `Product with this name or code already exists in your company.`;
         }
        importErrors.push({ row: index + 2, message: errorMessage, data: row });
      }

    } else {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      importErrors.push({ row: index + 2, message: errorMessage, data: row });
    }
  }

  return {
    success: importErrors.length === 0,
    message: `Import finished. ${importedCount} products imported, ${importErrors.length} rows failed.`,
    totalRows: data.length,
    importedCount,
    errorCount: importErrors.length,
    errors: importErrors,
  };
}

export async function exportProductsAction(
  userId: string
): Promise<{ success: boolean; data?: ProductType[]; error?: string }> {
  if (!userId) {
    return { success: false, error: "User not authenticated." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.companyId) {
    return { success: false, error: "User is not associated with a company." };
  }

  try {
    const products = await prisma.product.findMany({
      where: { companyId: user.companyId },
      include: { batches: true },
      orderBy: { name: 'asc' },
    });
    
    const mappedProducts: ProductType[] = products.map(p => {
        const totalStock = p.batches.reduce((sum, batch) => sum + batch.quantity, 0);
        const totalCostValue = p.batches.reduce((sum, batch) => sum + (batch.costPrice * batch.quantity), 0);
        const averageCostPrice = totalStock > 0 ? totalCostValue / totalStock : 0;
        return {
            ...p,
            stock: totalStock,
            costPrice: averageCostPrice,
            units: p.units as UnitDefinition
        };
    });

    return { success: true, data: mappedProducts };
  } catch (error: any) {
    console.error("Export products error:", error);
    return { success: false, error: "Failed to fetch products for export." };
  }
}
