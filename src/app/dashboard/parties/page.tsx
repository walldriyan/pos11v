
import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { verifyAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAllPartiesAction } from '@/app/actions/partyActions';
import { PartyList } from './PartyList'; // This will be our new client component

export default async function PartiesPage() {
  const { user } = await verifyAuth();
  if (!user) {
    redirect('/login');
  }

  const partiesResult = await getAllPartiesAction(user.id);
  const parties = partiesResult.success ? partiesResult.data ?? [] : [];

  return (
    <div className="flex flex-col flex-1 p-4 md:p-6 bg-gradient-to-br from-background to-secondary text-foreground">
      <header className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-3">
           <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground self-start sm:self-center">
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
              </Link>
           </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center">
            <Users className="mr-3 h-7 w-7" />
            Party Management (Customers & Suppliers)
          </h1>
        </div>
      </header>
      
      <PartyList initialParties={parties} />
    </div>
  );
}
