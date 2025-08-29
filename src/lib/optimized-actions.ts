// Optimized server actions with caching and batching
import prisma from './prisma';
import { cache, cacheKeys } from './cache';

// Batch multiple database operations
export async function batchDatabaseOperations<T>(
  operations: (() => Promise<T>)[]
): Promise<T[]> {
  const results = await Promise.allSettled(operations.map(op => op()));
  
  return results.map((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Batch operation ${index} failed:`, result.reason);
      throw result.reason;
    }
    return result.value;
  });
}

// Optimized product fetching with minimal data
export async function getProductsOptimized(companyId: string | null) {
  const cacheKey = cacheKeys.products(companyId || 'global');
  
  return cache.getOrSet(
    cacheKey,
    async () => {
      return prisma.product.findMany({
        where: companyId ? { companyId } : {},
        select: {
          id: true,
          name: true,
          code: true,
          barcode: true,
          sellingPrice: true,
          stock: true,
          isActive: true,
          // Only get essential batch info
          batches: {
            select: {
              id: true,
              quantity: true,
              costPrice: true,
              expiryDate: true
            },
            orderBy: { createdAt: 'desc' },
            take: 3 // Only latest 3 batches
          }
        },
        orderBy: { name: 'asc' }
      });
    },
    { ttl: 1000 * 60 * 10 } // 10 minutes cache
  );
}

// Optimized user authentication with caching
export async function getUserOptimized(userId: string) {
  return cache.getOrSet(
    cacheKeys.user(userId),
    async () => {
      if (userId === 'root-user') {
        // Handle root user without database query
        const permissions = await cache.getOrSet(
          'root-permissions',
          async () => prisma.permission.findMany(),
          { ttl: 1000 * 60 * 30 }
        );
        
        return {
          id: 'root-user',
          username: 'root',
          role: { name: 'Admin', permissions },
          permissions
        };
      }

      return prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          companyId: true,
          role: {
            select: {
              id: true,
              name: true,
              permissions: {
                select: {
                  permission: {
                    select: {
                      id: true,
                      action: true,
                      subject: true
                    }
                  }
                }
              }
            }
          },
          company: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    },
    { ttl: 1000 * 60 * 15 } // 15 minutes cache
  );
}

// Optimized discount sets with lazy loading
export async function getDiscountSetsOptimized(companyId: string | null) {
  const cacheKey = cacheKeys.discountSets(companyId || 'global');
  
  return cache.getOrSet(
    cacheKey,
    async () => {
      return prisma.discountSet.findMany({
        where: {
          ...(companyId ? { companyId } : {}),
          isActive: true
        },
        select: {
          id: true,
          name: true,
          isDefault: true,
          isOneTimePerTransaction: true,
          globalCartPriceRuleJson: true,
          globalCartQuantityRuleJson: true,
          defaultLineItemValueRuleJson: true,
          defaultLineItemQuantityRuleJson: true,
          // Lazy load product configurations only when needed
          productConfigurations: {
            select: {
              id: true,
              productId: true,
              productNameAtConfiguration: true,
              isActiveForProductInCampaign: true
            },
            take: 50 // Limit to prevent large payloads
          }
        },
        orderBy: { name: 'asc' }
      });
    },
    { ttl: 1000 * 60 * 5 }
  );
}

// Debounced cache invalidation
const invalidationQueue = new Set<string>();
let invalidationTimeout: NodeJS.Timeout | null = null;

export function scheduleInvalidation(pattern: string) {
  invalidationQueue.add(pattern);
  
  if (invalidationTimeout) {
    clearTimeout(invalidationTimeout);
  }
  
  invalidationTimeout = setTimeout(() => {
    for (const pattern of invalidationQueue) {
      cache.invalidatePattern(pattern);
    }
    invalidationQueue.clear();
    invalidationTimeout = null;
  }, 1000); // Batch invalidations for 1 second
}

// Preload critical data
export async function preloadCriticalData(userId: string) {
  const user = await getUserOptimized(userId);
  if (!user) return;

  // Preload in parallel
  const preloadPromises = [
    getProductsOptimized(user.companyId),
    getDiscountSetsOptimized(user.companyId)
  ];

  try {
    await Promise.all(preloadPromises);
  } catch (error) {
    console.warn('Failed to preload some data:', error);
  }
}
