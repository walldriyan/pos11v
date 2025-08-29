
import { verifyAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAllSaleRecordsAction } from '@/app/actions/saleActions';
import { ReturnsClientPage } from './ReturnsClientPage';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const ITEMS_PER_PAGE = 20;

// This is now a SERVER COMPONENT
export default async function ReturnsPageContainer() {
  const { user } = await verifyAuth();
  if (!user) {
    redirect('/login');
  }

  // Fetch initial data on the server
  const initialSalesResult = await getAllSaleRecordsAction(user.id, 1, ITEMS_PER_PAGE);

  const initialSales = initialSalesResult.success ? initialSalesResult.data?.sales ?? [] : [];
  const initialTotalCount = initialSalesResult.success ? initialSalesResult.data?.totalCount ?? 0 : 0;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground p-4 md:p-6 space-y-4">
        <header className="flex items-center justify-between pb-4 border-b border-border">
            <h1 className="text-2xl font-semibold text-foreground">Process Item Return</h1>
            <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <Link href="/"> <ArrowLeft className="mr-2 h-4 w-4" /> Back to POS </Link>
            </Button>
        </header>

        {/* Pass server-fetched initial data to the client component */}
        <ReturnsClientPage 
            initialSales={initialSales} 
            initialTotalCount={initialTotalCount} 
        />
    </div>
  );
}
