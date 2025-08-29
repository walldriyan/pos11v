
import Link from 'next/link';
import { getAllProductsAction } from '@/app/actions/productActions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, PlusCircle, RefreshCw } from 'lucide-react';
import { ProductList } from './ProductList'; // This will be our new client component
import { verifyAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { store } from '@/store/store';
import { initializeAllProducts } from '@/store/slices/saleSlice';

export default async function ProductManagementPage() {
  const { user } = await verifyAuth();
  if (!user) {
    redirect('/login');
  }

  const productsResult = await getAllProductsAction(user.id);
  const products = productsResult.success ? productsResult.data ?? [] : [];

  // Initialize the server-side store, so client components opening from here are up-to-date
  store.dispatch(initializeAllProducts(products));

  return (
      <div className="flex flex-col flex-1 p-4 md:p-6 bg-gradient-to-br from-background to-secondary text-foreground">
        <header className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center space-x-3">
             <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground self-start sm:self-center">
                <Link href="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                </Link>
             </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-primary">
              Product Management
            </h1>
          </div>
        </header>
        {/* Pass server-fetched data to a client component */}
        <ProductList initialProducts={products} />
      </div>
  );
}
