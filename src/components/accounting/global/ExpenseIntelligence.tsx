import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Receipt, Loader2, AlertTriangle, TrendingUp, Search, Download } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ExportButton } from '@/components/crud/ExportButton';

interface CategoryExpense {
  category: string;
  currentMonth: number;
  previousMonth: number;
  growth: number;
  count: number;
}

interface VendorExpense {
  vendor: string;
  total: number;
  count: number;
  categories: string[];
}

function useExpenseIntelligence() {
  return useQuery({
    queryKey: ['expense-intelligence'],
    queryFn: async () => {
      const now = new Date();
      const currentStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const currentEnd = format(endOfMonth(now), 'yyyy-MM-dd');
      const prevStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
      const prevEnd = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');

      const [{ data: currentExpenses }, { data: prevExpenses }, { data: ledgerOut }] = await Promise.all([
        supabase.from('business_expenses').select('*').gte('expense_date', currentStart).lte('expense_date', currentEnd),
        supabase.from('business_expenses').select('*').gte('expense_date', prevStart).lte('expense_date', prevEnd),
        supabase.from('accounting_ledger').select('*').eq('direction', 'out').gte('created_at', format(subMonths(now, 3), 'yyyy-MM-dd')),
      ]);

      // Category analysis
      const currentByCategory = (currentExpenses || []).reduce<Record<string, { total: number; count: number }>>((acc, e) => {
        const cat = e.category || 'Uncategorized';
        acc[cat] = acc[cat] || { total: 0, count: 0 };
        acc[cat].total += Number(e.amount);
        acc[cat].count++;
        return acc;
      }, {});

      const prevByCategory = (prevExpenses || []).reduce<Record<string, number>>((acc, e) => {
        const cat = e.category || 'Uncategorized';
        acc[cat] = (acc[cat] || 0) + Number(e.amount);
        return acc;
      }, {});

      const categories: CategoryExpense[] = Object.entries(currentByCategory)
        .map(([category, { total, count }]) => {
          const prev = prevByCategory[category] || 0;
          return {
            category,
            currentMonth: total,
            previousMonth: prev,
            growth: prev > 0 ? ((total - prev) / prev) * 100 : total > 0 ? 100 : 0,
            count,
          };
        })
        .sort((a, b) => b.currentMonth - a.currentMonth);

      // Vendor analysis
      const vendorMap = new Map<string, { total: number; count: number; categories: Set<string> }>();
      (currentExpenses || []).forEach(e => {
        const vendor = e.vendor || 'Unknown';
        const existing = vendorMap.get(vendor) || { total: 0, count: 0, categories: new Set<string>() };
        existing.total += Number(e.amount);
        existing.count++;
        existing.categories.add(e.category || 'Uncategorized');
        vendorMap.set(vendor, existing);
      });

      const vendors: VendorExpense[] = Array.from(vendorMap.entries())
        .map(([vendor, data]) => ({
          vendor,
          total: data.total,
          count: data.count,
          categories: Array.from(data.categories),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 15);

      // Detect duplicates / overlaps (vendors appearing in multiple categories)
      const overlaps = vendors.filter(v => v.categories.length > 1);

      const totalCurrent = (currentExpenses || []).reduce((s, e) => s + Number(e.amount), 0);
      const totalPrev = (prevExpenses || []).reduce((s, e) => s + Number(e.amount), 0);

      return {
        categories,
        vendors,
        overlaps,
        totalCurrent,
        totalPrev,
        momGrowth: totalPrev > 0 ? ((totalCurrent - totalPrev) / totalPrev) * 100 : 0,
      };
    },
  });
}

export default function ExpenseIntelligence() {
  const { data, isLoading } = useExpenseIntelligence();
  const [tab, setTab] = useState<'categories' | 'vendors'>('categories');

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!data) return null;

  const exportRows = data.categories.map(c => ({
    Category: c.category,
    'Current Month': c.currentMonth,
    'Previous Month': c.previousMonth,
    'Growth %': c.growth.toFixed(1),
    Transactions: c.count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Expense Intelligence
          </h2>
          <p className="text-sm text-muted-foreground">Cross-business expense patterns, vendor analysis, and anomaly detection</p>
        </div>
        <ExportButton
          data={exportRows}
          filename="expense-intelligence"
          columns={[
            { key: 'Category', label: 'Category' },
            { key: 'Current Month', label: 'Current Month' },
            { key: 'Previous Month', label: 'Previous Month' },
            { key: 'Growth %', label: 'Growth %' },
            { key: 'Transactions', label: 'Transactions' },
          ]}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">This Month</p>
            <p className="text-xl font-bold text-red-400">${data.totalCurrent.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Last Month</p>
            <p className="text-xl font-bold text-muted-foreground">${data.totalPrev.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">MoM Change</p>
            <p className={`text-xl font-bold ${data.momGrowth > 10 ? 'text-red-400' : data.momGrowth < -5 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {data.momGrowth > 0 ? '+' : ''}{data.momGrowth.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card className={`bg-card/50 ${data.overlaps.length > 0 ? 'border-amber-500/20' : ''}`}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Vendor Overlaps</p>
            <p className={`text-xl font-bold ${data.overlaps.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {data.overlaps.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2">
        <Button variant={tab === 'categories' ? 'default' : 'outline'} size="sm" onClick={() => setTab('categories')}>
          By Category
        </Button>
        <Button variant={tab === 'vendors' ? 'default' : 'outline'} size="sm" onClick={() => setTab('vendors')}>
          By Vendor
        </Button>
      </div>

      {/* Category View */}
      {tab === 'categories' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Category Breakdown — This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.categories.map(cat => {
                const isSpike = cat.growth > 25;
                return (
                  <div key={cat.category} className={`flex items-center gap-3 p-3 rounded-lg ${isSpike ? 'bg-red-950/10 border border-red-500/20' : 'bg-muted/30'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{cat.category}</p>
                        {isSpike && <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px]">Spike</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{cat.count} transactions</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-400">${cat.currentMonth.toLocaleString()}</p>
                      <p className={`text-xs ${cat.growth > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                        {cat.growth > 0 ? '+' : ''}{cat.growth.toFixed(0)}% vs last month
                      </p>
                    </div>
                  </div>
                );
              })}
              {data.categories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No expense data this month</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vendor View */}
      {tab === 'vendors' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Vendors — This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.vendors.map(v => (
                <div key={v.vendor} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{v.vendor}</p>
                    <div className="flex gap-1 mt-1">
                      {v.categories.map(c => (
                        <Badge key={c} variant="outline" className="text-[10px] py-0">{c}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${v.total.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{v.count} purchases</p>
                  </div>
                </div>
              ))}
              {data.vendors.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No vendor data this month</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
