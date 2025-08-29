// Comprehensive performance optimization utilities
import { cache } from './cache';

// Web Worker for heavy computations
export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private worker: Worker | null = null;

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  // Initialize web worker for heavy calculations
  initWorker() {
    if (typeof window === 'undefined' || this.worker) return;

    const workerCode = `
      self.onmessage = function(e) {
        const { type, data } = e.data;
        
        switch (type) {
          case 'CALCULATE_DISCOUNTS':
            const result = calculateDiscounts(data);
            self.postMessage({ type: 'DISCOUNT_RESULT', result });
            break;
          case 'FILTER_PRODUCTS':
            const filtered = filterProducts(data);
            self.postMessage({ type: 'FILTER_RESULT', result: filtered });
            break;
        }
      };

      function calculateDiscounts(data) {
        // Heavy discount calculation logic moved to worker
        const { items, discountRules } = data;
        let totalDiscount = 0;
        
        items.forEach(item => {
          discountRules.forEach(rule => {
            if (rule.applicable) {
              totalDiscount += item.price * rule.percentage / 100;
            }
          });
        });
        
        return { totalDiscount, processedItems: items.length };
      }

      function filterProducts(data) {
        const { products, searchTerm, filters } = data;
        return products.filter(product => {
          const matchesSearch = !searchTerm || 
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.code.toLowerCase().includes(searchTerm.toLowerCase());
          
          const matchesFilters = !filters.category || 
            product.category === filters.category;
          
          return matchesSearch && matchesFilters;
        });
      }
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
  }

  // Offload heavy calculations to web worker
  async calculateInWorker(type: string, data: any): Promise<any> {
    if (!this.worker) {
      this.initWorker();
    }

    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Worker timeout'));
      }, 5000);

      this.worker.onmessage = (e) => {
        clearTimeout(timeout);
        resolve(e.data.result);
      };

      this.worker.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };

      this.worker.postMessage({ type, data });
    });
  }

  // Debounce function calls
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Throttle function calls
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Batch DOM updates
  batchDOMUpdates(updates: (() => void)[]): void {
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  }

  // Preload critical resources
  preloadResources(urls: string[]): void {
    urls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;
      link.as = 'fetch';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }

  // Memory cleanup
  cleanup(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    cache.clear();
  }
}

// Image optimization utilities
export class ImageOptimizer {
  static async compressImage(file: File, quality: number = 0.8): Promise<Blob> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        const maxWidth = 800;
        const maxHeight = 600;
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };

      img.src = URL.createObjectURL(file);
    });
  }

  static createWebPVersion(imageUrl: string): string {
    // Convert to WebP if supported
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (ctx && canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
      return imageUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    }
    
    return imageUrl;
  }
}

// Bundle size analyzer
export function analyzeBundleSize() {
  if (typeof window === 'undefined') return;

  const scripts = Array.from(document.querySelectorAll('script[src]'));
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
  
  console.group('Bundle Analysis');
  console.log('Scripts:', scripts.length);
  console.log('Stylesheets:', styles.length);
  
  // Estimate bundle size
  let totalSize = 0;
  scripts.forEach(script => {
    const src = (script as HTMLScriptElement).src;
    if (src.includes('/_next/static/')) {
      console.log('Script:', src);
    }
  });
  
  console.groupEnd();
}

// Performance metrics collector
export function collectPerformanceMetrics() {
  if (typeof window === 'undefined') return;

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paint = performance.getEntriesByType('paint');
  
  const metrics = {
    // Core Web Vitals
    FCP: paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
    LCP: 0, // Will be updated by observer
    FID: 0, // Will be updated by observer
    CLS: 0, // Will be updated by observer
    
    // Navigation timing
    DNS: navigation.domainLookupEnd - navigation.domainLookupStart,
    TCP: navigation.connectEnd - navigation.connectStart,
    Request: navigation.responseStart - navigation.requestStart,
    Response: navigation.responseEnd - navigation.responseStart,
    Processing: navigation.domComplete - navigation.responseEnd,
    
    // Memory (if available)
    memory: (performance as any).memory ? {
      used: (performance as any).memory.usedJSHeapSize,
      total: (performance as any).memory.totalJSHeapSize,
      limit: (performance as any).memory.jsHeapSizeLimit
    } : null
  };

  console.table(metrics);
  return metrics;
}

// Initialize performance optimizations
export function initPerformanceOptimizations() {
  if (typeof window === 'undefined') return;

  const optimizer = PerformanceOptimizer.getInstance();
  optimizer.initWorker();

  // Preload critical resources
  optimizer.preloadResources([
    '/api/products',
    '/api/discounts',
    '/api/settings'
  ]);

  // Collect metrics after page load
  window.addEventListener('load', () => {
    setTimeout(collectPerformanceMetrics, 1000);
    setTimeout(analyzeBundleSize, 2000);
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    optimizer.cleanup();
  });
}