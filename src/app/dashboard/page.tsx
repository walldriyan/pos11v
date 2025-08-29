
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowRight, Users, TrendingUp, ShoppingBag, DollarSign, Package, TrendingDown, ImageOff, CheckCircle, XCircle, Search, Bell, MessageSquare, ShoppingCart, User, Briefcase, BarChart3, Users2, Calendar as CalendarIcon, Clock, Moon } from 'lucide-react';
import { getDashboardSummaryAction } from '@/app/actions/reportActions';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/store/slices/authSlice';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Input } from '@/components/ui/input';


interface DashboardData {
    totalCustomers: number;
    newCustomersToday: number;
    totalSuppliers: number;
    recentParties: { id: string; name: string; }[];
    financials: {
        totalIncome: number;
        totalExpenses: number;
        chartData: { date: string; income: number; expenses: number }[];
    };
    recentProducts: { id: string; name: string; category: string | null; sellingPrice: number; isActive: boolean; imageUrl: string | null; stock: number; }[];
}


export default function WelcomePage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const currentUser = useSelector(selectCurrentUser);
    const [timeFilter, setTimeFilter] = useState<'today' | 'last7days' | 'thismonth'>('last7days');

    const loadData = useCallback(async (filter: 'today' | 'last7days' | 'thismonth') => {
        if (!currentUser?.id) return;
        setIsLoading(true);
        const result = await getDashboardSummaryAction(currentUser.id, filter);
        if (result.success && result.data) {
            setData(result.data);
        }
        setIsLoading(false);
    }, [currentUser]);

    useEffect(() => {
        loadData(timeFilter);
    }, [currentUser, timeFilter, loadData]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const incomePayload = payload.find((p: any) => p.dataKey === 'income');
            const expensePayload = payload.find((p: any) => p.dataKey === 'expenses');
            return (
            <div className="rounded-lg border bg-background p-2 shadow-sm">
                <div className="flex flex-col space-y-1">
                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                    {label}
                    </span>
                    {incomePayload && 
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="font-bold text-muted-foreground">
                            Income:
                            </span>
                             <span className="font-bold">
                               Rs. {incomePayload.value.toLocaleString()}
                            </span>
                        </div>
                    }
                     {expensePayload && 
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full" style={{backgroundColor: '#ef444490'}}></div>
                            <span className="font-bold text-muted-foreground">
                            Expenses:
                            </span>
                             <span className="font-bold">
                               Rs. {expensePayload.value.toLocaleString()}
                            </span>
                        </div>
                    }
                </div>
            </div>
            );
        }
        return null;
    };
    
    const { incomePercentage, totalFinancials } = useMemo(() => {
      if (!data) return { incomePercentage: 0, totalFinancials: 0 };
      const { totalIncome, totalExpenses } = data.financials;
      const total = totalIncome + totalExpenses;
      const percentage = total > 0 ? (totalIncome / total) * 100 : 0;
      return { incomePercentage: percentage, totalFinancials: total };
    }, [data]);

    const filterLabels: Record<typeof timeFilter, string> = {
        today: 'Today',
        last7days: 'Last 7 Days',
        thismonth: 'This Month'
    };

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 flex flex-col gap-6">
        <header className="flex items-center justify-between p-4 bg-card/50 rounded-full shadow-lg">
          <div className="flex items-center flex-1">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Search anything..." className="bg-background rounded-full pl-12 h-11 border-transparent focus-visible:ring-primary" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full border-border ml-[10px]">{filterLabels[timeFilter]}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setTimeFilter('today')}><Clock className="mr-2 h-4 w-4"/>Today</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTimeFilter('last7days')}><CalendarIcon className="mr-2 h-4 w-4"/>Last 7 days</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTimeFilter('thismonth')}><Moon className="mr-2 h-4 w-4"/>This month</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-full bg-background text-muted-foreground w-11 h-11">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full bg-background text-muted-foreground w-11 h-11">
              <MessageSquare className="h-5 w-5" />
            </Button>
            <Avatar className="h-11 w-11 border-2 border-primary/50">
              <AvatarFallback>{currentUser?.username ? currentUser.username.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
            </Avatar>
            <Button asChild className="rounded-full bg-primary text-primary-foreground font-semibold h-11 px-6 hover:bg-primary/90">
              <Link href="/">
                <ShoppingCart className="mr-2 h-4 w-4" /> POS
              </Link>
            </Button>
          </div>
        </header>

        <Card className="bg-card border-border p-6 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <CardTitle className="text-lg font-semibold">Overview</CardTitle>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-6">
            <Card className="bg-background/40 p-4 flex flex-col justify-between">
              <div className="flex items-center text-sm text-muted-foreground gap-2"><Users className="h-4 w-4" /> Customers</div>
              <div>
                {isLoading ? <Skeleton className="h-10 w-24" /> : <span className="text-4xl font-bold">{(data?.totalCustomers || 0).toLocaleString()}</span>}
              </div>
            </Card>
            <Card className="bg-background/40 p-4 flex flex-col justify-between">
              <div className="flex items-center text-sm text-muted-foreground gap-2"><ShoppingBag className="h-4 w-4" /> Suppliers</div>
              <div>
                {isLoading ? <Skeleton className="h-10 w-24" /> : <span className="text-4xl font-bold">{(data?.totalSuppliers || 0).toLocaleString()}</span>}
              </div>
            </Card>
          </div>
          <div className="mt-6">
            {isLoading ? <Skeleton className="h-5 w-48" /> : <p className="font-semibold">{data?.newCustomersToday || 0} new customers today!</p>}
            <p className="text-sm text-muted-foreground mb-3">Recent activity in contacts.</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center -space-x-3">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-10 rounded-full" />)
                ) : (data?.recentParties || []).map((party) => (
                  <Avatar key={party.id} className="border-2 border-card">
                    <AvatarFallback>{party.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <Button variant="ghost" size="icon"><ArrowRight className="h-5 w-5" /></Button>
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border p-6 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <CardTitle className="text-lg font-semibold">Income &amp; Expense</CardTitle>
            </div>
          </div>
          <div className="flex-1 min-h-[250px]">
            {isLoading ? <Skeleton className="w-full h-full" /> :
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.financials.chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.3)" />
                  <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--primary) / 0.1)' }} />
                  <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#ef444490" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            }
          </div>
        </Card>
      </div>

      <div className="col-span-1 flex flex-col gap-6">
        <Card className="bg-card border-border p-6 flex flex-col">
          <CardTitle className="text-lg font-semibold mb-4">{filterLabels[timeFilter]}</CardTitle>
           <div className="flex-1 flex items-center justify-center">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                <path className="stroke-current text-muted-foreground/20"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" strokeWidth="3"></path>
                <path className="stroke-current text-green-500"
                  strokeDasharray={`${incomePercentage.toFixed(2)}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" strokeWidth="3" strokeLinecap="round"></path>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold">{incomePercentage.toFixed(1)}%</span>
                <span className="text-muted-foreground">Income</span>
              </div>
            </div>
          </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
                <div>
                    <p className="text-sm text-muted-foreground">Total Income</p>
                    <p className="font-bold text-lg">Rs. {(data?.financials.totalIncome || 0).toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Total Expenses</p>
                    <p className="font-bold text-lg">Rs. {(data?.financials.totalExpenses || 0).toLocaleString()}</p>
                </div>
            </div>
        </Card>

        <Card className="bg-card border-border p-6 flex flex-col">
          <CardTitle className="text-lg font-semibold mb-4">Popular products</CardTitle>
          <div className="flex-1 space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : (data?.recentProducts || []).length > 0 ? (
              (data?.recentProducts || []).map((product) => (
                <div key={product.id} className="flex items-center gap-4 p-2 rounded-md transition-colors hover:bg-muted/30 hover:border-border border border-transparent">
                  <div className="relative w-12 h-12 rounded-md bg-muted flex-shrink-0">
                    {product.imageUrl ? (
                      <Image src={product.imageUrl} alt={product.name} layout="fill" className="object-cover rounded-md" data-ai-hint="product image" />
                    ) : (
                      <ImageOff className="h-6 w-6 text-muted-foreground m-auto" />
                    )}
                  </div>
                  <div className="flex-grow">
                    <p className="font-semibold text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.category || 'No Category'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">Rs. {product.sellingPrice.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Stock: {product.stock}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm text-center py-10">No recent products to display.</p>
            )}
          </div>
          <Button variant="outline" className="w-full mt-4">All products</Button>
        </Card>
      </div>
    </div>
  );
}

