

'use server';

import prisma from '@/lib/prisma';
import { ProductFormDataSchema } from '@/lib/zodSchemas';
import type { Product as ProductType, UnitDefinition, ProductFormData, ProductBatch } from '@/types';
import { Prisma } from '@prisma/client';
import { z } from 'zod';


// Helper to map Prisma Product to our ProductType, including calculated fields
function mapPrismaProductToType(
  product: Prisma.ProductGetPayload<{
    include: {
      productDiscountConfigurations: true,
      batches: {
        include: {
          purchaseBillItem: {
            include: {
              purchaseBill: {
                include: {
                  createdBy: {
                    select: {
                      username: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }>
): ProductType {
  const totalStock = product.batches.reduce((sum, batch) => sum + batch.quantity, 0);
  const totalCostValue = product.batches.reduce((sum, batch) => sum + (batch.costPrice * batch.quantity), 0);
  const averageCostPrice = totalStock > 0 ? totalCostValue / totalStock : 0;

  const sortedBatches = product.batches.sort((a, b) => {
    const dateA = a.purchaseBillItem?.purchaseBill?.purchaseDate ? new Date(a.purchaseBillItem.purchaseBill.purchaseDate).getTime() : new Date(a.createdAt).getTime();
    const dateB = b.purchaseBillItem?.purchaseBill?.purchaseDate ? new Date(b.purchaseBillItem.purchaseBill.purchaseDate).getTime() : new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  return {
    id: product.id,
    name: product.name,
    code: product.code,
    category: product.category,
    barcode: product.barcode,
    units: product.units as UnitDefinition,
    sellingPrice: product.sellingPrice,
    stock: totalStock, // Calculated from batches
    costPrice: averageCostPrice, // Calculated from batches
    batches: sortedBatches.map(b => {
      const batchTyped: ProductBatch = {
        id: b.id,
        productId: b.productId,
        batchNumber: b.batchNumber,
        quantity: b.quantity,
        costPrice: b.costPrice,
        sellingPrice: b.sellingPrice,
        expiryDate: b.expiryDate ? b.expiryDate.toISOString() : null,
        createdAt: b.createdAt ? b.createdAt.toISOString() : undefined,
        purchaseBillItemId: b.purchaseBillItemId,
        purchaseDate: b.purchaseBillItem?.purchaseBill?.purchaseDate 
                        ? new Date(b.purchaseBillItem.purchaseBill.purchaseDate).toISOString() 
                        : (b.createdAt ? b.createdAt.toISOString() : undefined),
        user: b.purchaseBillItem?.purchaseBill?.createdBy?.username || 'N/A',
        productNameAtPurchase: b.purchaseBillItem?.productNameAtPurchase,
      };
      return batchTyped;
    }),
    defaultQuantity: product.defaultQuantity,
    isActive: product.isActive,
    isService: product.isService,
    productSpecificTaxRate: product.productSpecificTaxRate,
    description: product.description,
    imageUrl: product.imageUrl,
    createdAt: product.createdAt?.toISOString(),
    updatedAt: product.updatedAt?.toISOString(),
    createdByUserId: product.createdByUserId,
    updatedByUserId: product.updatedByUserId,
    productDiscountConfigurations: product.productDiscountConfigurations,
    companyId: product.companyId,
  };
}


export async function createProductAction(
  productData: ProductFormData,
  userId: string | null
): Promise<{ success: boolean; data?: ProductType; error?: string, fieldErrors?: Record<string, string[]> }> {
  if (!prisma || !prisma.product) {
    return { success: false, error: "Prisma client or Product model not initialized. Please run 'npx prisma generate'." };
  }
   if (!userId) {
    return { success: false, error: "User is not authenticated. Cannot create product." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.companyId) {
    return { success: false, error: "Could not find the user's company to associate the product with. Please ensure the user is assigned to a company." };
  }
  const companyId = user.companyId;

  const validationResult = ProductFormDataSchema.safeParse(productData);
  if (!validationResult.success) {
    const fieldErrors = validationResult.error.flatten().fieldErrors;
    console.log("Validation errors (create product):", fieldErrors);
    return { success: false, error: "Validation failed. Check field errors.", fieldErrors };
  }
  const validatedProductData = validationResult.data;

  // Destructure to separate the initial stock and cost price which will go into a batch
  const { stock: initialStock, costPrice: initialCostPrice, sellingPrice, ...restOfProductData } = validatedProductData;
  const unitsToStore = restOfProductData.units as Prisma.JsonValue;

  try {
     const newProduct = await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          ...restOfProductData,
          companyId: companyId,
          sellingPrice: sellingPrice,
          units: unitsToStore,
          code: restOfProductData.code || undefined,
          category: restOfProductData.category || undefined,
          barcode: restOfProductData.barcode || undefined,
          productSpecificTaxRate: restOfProductData.productSpecificTaxRate === null ? undefined : restOfProductData.productSpecificTaxRate,
          description: restOfProductData.description || undefined,
          imageUrl: restOfProductData.imageUrl || undefined,
          createdByUserId: userId,
          updatedByUserId: userId,
        },
      });

      // If initial stock is provided, create a corresponding batch for it
      if (initialStock && initialStock > 0 && initialCostPrice !== undefined && initialCostPrice !== null) {
        await tx.productBatch.create({
          data: {
            productId: createdProduct.id,
            batchNumber: 'INITIAL_STOCK',
            quantity: initialStock,
            costPrice: initialCostPrice,
            sellingPrice: sellingPrice, // Use the product's selling price for the initial batch
            expiryDate: null, 
          },
        });
      }
      
      const finalProduct = await tx.product.findUniqueOrThrow({
        where: { id: createdProduct.id },
        include: {
            productDiscountConfigurations: true,
            batches: {
              include: {
                purchaseBillItem: {
                  include: {
                    purchaseBill: {
                      include: {
                        createdBy: {
                          select: {
                            username: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
        }
      });
      return finalProduct;
    });

    return { success: true, data: mapPrismaProductToType(newProduct) };

  } catch (error: any) {
    console.error('Error creating product:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = error.meta?.target as string[] | undefined;
        if (target?.includes('name')) return { success: false, error: 'A product with this name already exists in this company.' };
        if (target?.includes('code')) return { success: false, error: 'A product with this code already exists in this company.' };
        return { success: false, error: `A unique constraint violation occurred on: ${target?.join(', ')}` };
      }
    }
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create product.' };
  }
}

export async function getAllProductsAction(userId: string): Promise<{
  success: boolean;
  data?: ProductType[];
  error?: string;
  detailedError?: string;
}> {
  if (!prisma) {
    return { success: false, error: "Prisma client is not initialized.", detailedError: "The Prisma instance was not available." };
  }
  if (!prisma.product) {
    return { success: false, error: "Product model accessor is missing.", detailedError: "prisma.product was undefined." };
  }
   if (!userId) {
    return { success: false, error: "User is not authenticated." };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user?.companyId) {
        // Super admin without a company can see all products, for setup purposes.
        if (user?.role?.name === 'Admin') {
             const allProductsFromDb = await prisma.product.findMany({
                 orderBy: { name: 'asc' },
                 include: { productDiscountConfigurations: true, batches: { include: { purchaseBillItem: { include: { purchaseBill: { include: { createdBy: { select: { username: true } } } } } } } } }
             });
             return { success: true, data: allProductsFromDb.map(mapPrismaProductToType) };
        }
       return { success: true, data: [] }; // Return empty array if non-admin user has no company
    }

    const productsFromDB = await prisma.product.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: 'asc' },
      include: {
        productDiscountConfigurations: true,
        batches: {
          include: {
            purchaseBillItem: {
              include: {
                purchaseBill: {
                  include: {
                    createdBy: {
                      select: {
                        username: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const mappedProducts: ProductType[] = productsFromDB.map(mapPrismaProductToType);
    return { success: true, data: mappedProducts };

  } catch (error: any) {
    console.error('Error in getAllProductsAction:', error);
    let errorMessage = 'Failed to fetch products.';
    let detailedErrorMessage = String(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) errorMessage = `Database error (Code: ${error.code}). Check server logs for details. It might be a migration issue.`;
    else if (error instanceof z.ZodError) errorMessage = `Data validation error (Zod).`;
    else if (error instanceof Error) errorMessage = `Unexpected error: ${error.message}.`;
    return { success: false, error: errorMessage, detailedError: detailedErrorMessage };
  }
}


export async function getProductByIdAction(
  id: string
): Promise<{ success: boolean; data?: ProductType; error?: string }> {
  if (!prisma || !prisma.product) return { success: false, error: "Prisma client or Product model not initialized." };
  if (!id) return { success: false, error: "Product ID is required." };
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        productDiscountConfigurations: true,
        batches: {
          include: {
            purchaseBillItem: {
              include: {
                purchaseBill: {
                  include: {
                    createdBy: {
                      select: {
                        username: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!product) return { success: false, error: 'Product not found.' };

    return { success: true, data: mapPrismaProductToType(product) };
  } catch (error: any) {
    console.error(`Error in getProductByIdAction for ID ${id}:`, error);
    let errorMessage = 'Failed to fetch product.';
    if (error instanceof z.ZodError) errorMessage = `Product data (units) for ID ${id} is invalid.`;
    else if (error instanceof Error) errorMessage = error.message;
    return { success: false, error: errorMessage };
  }
}

export async function updateProductAction(
  id: string,
  productData: ProductFormData,
  userId: string | null,
  batchIdToUpdate?: string | null,
): Promise<{ success: boolean; data?: ProductType; error?: string, fieldErrors?: Record<string, string[]> }> {
  if (!prisma || !prisma.product) return { success: false, error: "Prisma client or Product model not initialized." };
  if (!id) return { success: false, error: "Product ID is required for update." };

  const validationResult = ProductFormDataSchema.safeParse(productData);
  if (!validationResult.success) {
     const fieldErrors = validationResult.error.flatten().fieldErrors;
     console.log("Validation errors (update product):", fieldErrors);
    return { success: false, error: "Validation failed. Check field errors.", fieldErrors };
  }
  const validatedProductData = validationResult.data;

  if (Object.keys(validatedProductData).length === 0) {
    return { success: false, error: "No data provided for update." };
  }
  
  // Destructure stock and costPrice correctly from the validated data
  const { stock: stockAdjustment, costPrice: adjustmentCostPrice, sellingPrice, ...restOfProductData } = validatedProductData;

  const dataToUpdateOnProduct: Prisma.ProductUpdateInput = {
      ...restOfProductData,
      sellingPrice: sellingPrice,
      updatedByUserId: userId,
  };
  if (validatedProductData.units) dataToUpdateOnProduct.units = validatedProductData.units as Prisma.JsonValue;
  if (validatedProductData.hasOwnProperty('code')) dataToUpdateOnProduct.code = validatedProductData.code === null ? null : validatedProductData.code;

  try {
    const updatedProduct = await prisma.$transaction(async (tx) => {
        // --- 1. Update the Main Product Details ---
        await tx.product.update({
            where: { id },
            data: dataToUpdateOnProduct,
        });

        // --- 2. Update the specific Batch if an ID was passed ---
        if (batchIdToUpdate && adjustmentCostPrice !== undefined && adjustmentCostPrice !== null) {
            await tx.productBatch.update({
                where: { id: batchIdToUpdate },
                data: {
                    sellingPrice: sellingPrice,
                    costPrice: adjustmentCostPrice,
                },
            });
        }
        
        // --- 3. Handle Manual Stock Adjustment ---
        if (stockAdjustment && stockAdjustment > 0 && adjustmentCostPrice !== undefined && adjustmentCostPrice !== null) {
            await tx.productBatch.create({
                data: {
                    productId: id,
                    batchNumber: `MANUAL_ADJUST_${Date.now()}`,
                    quantity: stockAdjustment,
                    costPrice: adjustmentCostPrice,
                    sellingPrice: sellingPrice,
                }
            });
        }
        
        // --- 4. Refetch the final state of the product ---
        const finalProduct = await tx.product.findUniqueOrThrow({
            where: { id: id },
            include: {
                productDiscountConfigurations: true,
                batches: {
                  include: {
                    purchaseBillItem: {
                      include: {
                        purchaseBill: {
                          include: {
                            createdBy: {
                              select: {
                                username: true
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
            }
        });

        return finalProduct;
    });

    return { success: true, data: mapPrismaProductToType(updatedProduct) };
  } catch (error: any) {
    console.error(`Error in updateProductAction for ID ${id}:`, error);
    let errorMessage = 'Failed to update product.';
    if (error instanceof z.ZodError) errorMessage = `Product data is invalid.`;
    else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') errorMessage = 'A product with this name or code already exists.';
        else if (error.code === 'P2025') errorMessage = 'Product or Batch to update not found.';
    } else if (error instanceof Error) errorMessage = error.message;
    return { success: false, error: errorMessage };
  }
}

export async function deleteProductAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  if (!prisma || !prisma.product) return { success: false, error: "Prisma client or Product model not initialized." };
  if (!id) return { success: false, error: "Product ID is required for deletion." };
  try {
    await prisma.product.delete({ where: { id } });
    return { success: true };
  } catch (error: any) {
    console.error(`Error in deleteProductAction for ID ${id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return { success: false, error: 'Product to delete not found.' };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      if (error.message.includes('ProductDiscountConfiguration_productId_fkey')) {
        return { success: false, error: 'Cannot delete product. It is still part of one or more Discount Campaign configurations.' };
      }
      return { success: false, error: 'Cannot delete product. It is referenced in existing sale or purchase records.' };
    }
    return { success: false, error: 'Failed to delete product.' };
  }
}

export async function updateProductStockAction(
  productId: string,
  changeInStock: number,
  userId: string | null,
): Promise<{ success: boolean; data?: ProductType; error?: string }> {
  if (!prisma || !prisma.product) return { success: false, error: "Prisma client or Product model not initialized."};
  if (!productId) return { success: false, error: "Product ID is required." };
  if (typeof changeInStock !== 'number') return { success: false, error: "Invalid change in stock value."};
  
  try {
    return await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({
            where: { id: productId },
            include: { batches: true },
        });

        if (!product) {
            throw new Error("Product not found for stock update.");
        }
        if (product.isService) {
             const finalProduct = await tx.product.findUniqueOrThrow({
              where: {id: productId},
              include: {
                batches: { include: { purchaseBillItem: { include: { purchaseBill: { include: { createdBy: {select: {username: true}}} } } } } },
                productDiscountConfigurations: true
              }
            });
            return { success: true, data: mapPrismaProductToType(finalProduct) };
        }
        
        if (changeInStock < 0) { // Subtracting stock
            const absChange = Math.abs(changeInStock);
            const currentTotalStock = product.batches.reduce((sum, b) => sum + b.quantity, 0);
            if (currentTotalStock < absChange) {
                throw new Error(`Cannot subtract ${absChange}. Only ${currentTotalStock} in stock across all batches.`);
            }

            let amountToDeduct = absChange;
            const sortedBatches = product.batches.filter(b => b.quantity > 0).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // FIFO for manual reduction

            for (const batch of sortedBatches) {
                if(amountToDeduct <= 0) break;
                const deduction = Math.min(amountToDeduct, batch.quantity);
                await tx.productBatch.update({
                    where: { id: batch.id },
                    data: { quantity: { decrement: deduction } },
                });
                amountToDeduct -= deduction;
            }

        } else { // Adding stock
            const latestBatch = product.batches.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            const costPriceForNewStock = latestBatch?.costPrice ?? 0;
            const sellingPriceForNewStock = latestBatch?.sellingPrice ?? product.sellingPrice;
             await tx.productBatch.create({
                data: {
                    productId: productId,
                    batchNumber: 'MANUAL_ADJUSTMENT_ADD',
                    quantity: changeInStock,
                    costPrice: costPriceForNewStock,
                    sellingPrice: sellingPriceForNewStock,
                }
            });
        }

        const updatedProduct = await tx.product.findUniqueOrThrow({
            where: { id: productId },
            include: {
              productDiscountConfigurations: true,
              batches: { include: { purchaseBillItem: { include: { purchaseBill: { include: { createdBy: {select: {username: true}}} } } } } }
            },
        });
        return { success: true, data: mapPrismaProductToType(updatedProduct) };
    });
  } catch (error: any) {
     console.error(`Error in updateProductStockAction for product ${productId}:`, error);
     return { success: false, error: error.message || "Failed to update stock." };
  }
}

export async function deleteProductBatchAction(batchId: string): Promise<{ success: boolean, error?: string }> {
  if (!batchId) {
    return { success: false, error: 'Batch ID is required for deletion.' };
  }
  try {
    const batch = await prisma.productBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      return { success: false, error: 'Batch not found.' };
    }
    if (batch.quantity > 0) {
      return { success: false, error: 'Cannot delete a batch that still has stock.' };
    }
    await prisma.productBatch.delete({ where: { id: batchId } });
    return { success: true };
  } catch (error: any) {
    console.error(`Error deleting batch ID ${batchId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return { success: false, error: 'Batch to delete not found.' };
    }
    return { success: false, error: 'Failed to delete product batch.' };
  }
}
