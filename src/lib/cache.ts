// High-performance caching layer with Redis-like in-memory cache
import { LRUCache } from 'lru-cache';

interface CacheOptions {
  ttl?: number;
  max?: number;
}

class PerformanceCache {
  private cache: LRUCache<string, any>;
  private static instance: PerformanceCache;

  private constructor() {
    this.cache = new LRUCache({
      max: 1000, // Maximum 1000 items
      ttl: 1000 * 60 * 5, // 5 minutes TTL
      allowStale: false,
      updateAgeOnGet: false,
      updateAgeOnHas: false,
    });
  }

  static getInstance(): PerformanceCache {
    if (!PerformanceCache.instance) {
      PerformanceCache.instance = new PerformanceCache();
    }
    return PerformanceCache.instance;
  }

  set(key: string, value: any, options?: CacheOptions): void {
    const ttl = options?.ttl || 1000 * 60 * 5;
    this.cache.set(key, value, { ttl });
  }

  get<T>(key: string): T | undefined {
    return this.cache.get(key) as T;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Cache with automatic key generation
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, options);
    return value;
  }

  // Invalidate cache by pattern
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

export const cache = PerformanceCache.getInstance();

// Cache key generators
export const cacheKeys = {
  user: (id: string) => `user:${id}`,
  products: (companyId: string) => `products:${companyId}`,
  discountSets: (companyId: string) => `discounts:${companyId}`,
  roles: () => 'roles:all',
  companies: () => 'companies:all',
  taxRate: () => 'tax:rate',
  userPermissions: (userId: string) => `permissions:${userId}`,
};
