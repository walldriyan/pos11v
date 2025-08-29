

import { store } from '@/store/store';
import {
  initializeAllProducts,
  initializeDiscountSets,
  initializeTaxRate,
} from '@/store/slices/saleSlice';
import { setUser } from '@/store/slices/authSlice';
import { getDiscountSetsAction, getTaxRateAction } from '@/app/actions/settingsActions';
import { getAllProductsAction } from '@/app/actions/productActions';
import { POSClientComponent } from '@/components/pos/POSClientComponent';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAuth } from '@/lib/auth';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Optimized Server Component with parallel data fetching
export default async function PosPageContainer() {
  // Verify user authentication on the server before rendering anything.
  const { user } = await verifyAuth();
  
  // If no valid user session is found from the cookie, redirect to login from the server.
  if (!user) {
    return redirect('/login');
  }

  // Use parallel data fetching to reduce latency
  const [productsResult, discountSetsResult, taxRateResult] = await Promise.allSettled([
    getAllProductsAction(user.id),
    getDiscountSetsAction(user.id),
    getTaxRateAction()
  ]);

  // Extract results with fallbacks
  const productsData = productsResult.status === 'fulfilled' && productsResult.value.success 
    ? productsResult.value.data ?? [] 
    : [];
  const discountSetsData = discountSetsResult.status === 'fulfilled' && discountSetsResult.value.success 
    ? discountSetsResult.value.data ?? [] 
    : [];
  const taxRate = taxRateResult.status === 'fulfilled' && taxRateResult.value.success 
    ? taxRateResult.value.data?.value ?? 0 
    : 0;

  // Create optimized initial state to pass to the client component
  // This avoids the client having to fetch this data itself.
  const initialState = {
    auth: { user, status: 'succeeded', error: null },
    sale: {
      allProducts: productsData,
      discountSets: discountSetsData,
      taxRate,
      saleItems: [],
      activeDiscountSetId: discountSetsData.find(ds => ds.isDefault && ds.isActive)?.id || null,
      discountSetsLoaded: true,
    }
  };
  
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    }>
      <POSClientComponent serverState={initialState} />
    </Suspense>
  );
}
