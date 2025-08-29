// Optimized Prisma client with connection pooling and query optimization
import { PrismaClient } from '@prisma/client';
import { cache, cacheKeys } from './cache';

// Enhanced Prisma client with performance optimizations
class OptimizedPrismaClient extends PrismaClient {
    constructor() {
        // Only pass datasources if DATABASE_URL is available
        const config: any = {
            log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        };

        if (process.env.DATABASE_URL) {
            config.datasources = {
                db: {
                    url: process.env.DATABASE_URL,
                },
            };
        }

        super(config);

        // Add query performance monitoring
        this.$use(async (params, next) => {
            const before = Date.now();
            const result = await next(params);
            const after = Date.now();

            if (after - before > 100) { // Log slow queries
                console.warn(`Slow query detected: ${params.model}.${params.action} took ${after - before}ms`);
            }

            return result;
        });
    }

    // Optimized user query with caching
    async findUserOptimized(userId: string) {
        return cache.getOrSet(
            cacheKeys.user(userId),
            async () => {
                return this.user.findUnique({
                    where: { id: userId },
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true
                                    }
                                }
                            }
                        },
                        company: true
                    }
                });
            },
            { ttl: 1000 * 60 * 10 } // 10 minutes cache
        );
    }

    // Batch product queries to avoid N+1
    async findProductsOptimized(companyId: string | null) {
        const cacheKey = cacheKeys.products(companyId || 'global');

        return cache.getOrSet(
            cacheKey,
            async () => {
                const whereClause = companyId ? { companyId } : {};

                return this.product.findMany({
                    where: whereClause,
                    include: {
                        batches: {
                            orderBy: { createdAt: 'desc' },
                            take: 5 // Only get latest 5 batches per product
                        },
                        discountConfigurations: {
                            include: {
                                discountSet: {
                                    select: { id: true, name: true, isActive: true }
                                }
                            }
                        }
                    },
                    orderBy: { name: 'asc' }
                });
            },
            { ttl: 1000 * 60 * 5 } // 5 minutes cache
        );
    }

    // Optimized discount sets with minimal data
    async findDiscountSetsOptimized(companyId: string | null) {
        const cacheKey = cacheKeys.discountSets(companyId || 'global');

        return cache.getOrSet(
            cacheKey,
            async () => {
                const whereClause = companyId ? { companyId } : {};

                return this.discountSet.findMany({
                    where: { ...whereClause, isActive: true },
                    include: {
                        productConfigurations: {
                            include: {
                                product: {
                                    select: {
                                        id: true,
                                        name: true,
                                        sellingPrice: true,
                                        code: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: { name: 'asc' }
                });
            },
            { ttl: 1000 * 60 * 5 }
        );
    }

    // Batch operations for better performance
    async batchCreateSaleItems(items: any[]) {
        return this.$transaction(
            items.map(item =>
                this.saleItem.create({ data: item })
            )
        );
    }

    // Optimized stock adjustment with batch processing
    async batchStockAdjustments(adjustments: any[]) {
        return this.$transaction(async (tx) => {
            const results = [];

            for (const adjustment of adjustments) {
                // Update product stock
                const updatedProduct = await tx.product.update({
                    where: { id: adjustment.productId },
                    data: {
                        stock: {
                            increment: adjustment.quantityChanged
                        }
                    }
                });

                // Log the adjustment
                const log = await tx.stockAdjustmentLog.create({
                    data: adjustment
                });

                results.push({ product: updatedProduct, log });
            }

            return results;
        });
    }

    // Clear related caches when data changes
    invalidateCache(type: 'user' | 'products' | 'discounts', identifier?: string) {
        switch (type) {
            case 'user':
                if (identifier) {
                    cache.delete(cacheKeys.user(identifier));
                }
                break;
            case 'products':
                cache.invalidatePattern('products:.*');
                break;
            case 'discounts':
                cache.invalidatePattern('discounts:.*');
                break;
        }
    }
}

// Singleton instance
const globalForPrisma = globalThis as unknown as {
    prismaOptimized: OptimizedPrismaClient | undefined;
};

const prismaOptimized = globalForPrisma.prismaOptimized ?? new OptimizedPrismaClient();

export default prismaOptimized;

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prismaOptimized = prismaOptimized;
}
