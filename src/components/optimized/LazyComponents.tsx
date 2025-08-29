// Lazy-loaded components to reduce initial bundle size
import { lazy, Suspense, ComponentType } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Loading fallbacks
const ComponentSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-8 w-3/4" />
  </div>
);

const DialogSkeleton = () => (
  <div className="space-y-4 p-6">
    <Skeleton className="h-6 w-1/2" />
    <Skeleton className="h-20 w-full" />
    <div className="flex gap-2">
      <Skeleton className="h-10 w-20" />
      <Skeleton className="h-10 w-20" />
    </div>
  </div>
);

// Lazy load heavy components
export const LazySettingsDialog = lazy(() => 
  import('@/components/pos/SettingsDialog').then(module => ({
    default: module.SettingsDialog
  }))
);

export const LazyPaymentDialog = lazy(() => 
  import('@/components/pos/PaymentDialog').then(module => ({
    default: module.PaymentDialog
  }))
);

export const LazyDiscountInfoDialog = lazy(() => 
  import('@/components/pos/DiscountInfoDialog').then(module => ({
    default: module.DiscountInfoDialog
  }))
);

export const LazyProductSearch = lazy(() => 
  import('@/components/pos/ProductSearch').then(module => ({
    default: module.default
  }))
);

// HOC for lazy loading with error boundary
export function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  fallback: ComponentType = ComponentSkeleton
) {
  return function LazyWrapper(props: P) {
    return (
      <Suspense fallback={<fallback />}>
        <Component {...props} />
      </Suspense>
    );
  };
}

// Preload components on user interaction
export function preloadComponent(importFn: () => Promise<any>) {
  return () => {
    // Preload on hover/focus
    importFn().catch(console.error);
  };
}

// Wrapped components with suspense
export const SettingsDialog = withLazyLoading(LazySettingsDialog, DialogSkeleton);
export const PaymentDialog = withLazyLoading(LazyPaymentDialog, DialogSkeleton);
export const DiscountInfoDialog = withLazyLoading(LazyDiscountInfoDialog, DialogSkeleton);
export const ProductSearch = withLazyLoading(LazyProductSearch, ComponentSkeleton);