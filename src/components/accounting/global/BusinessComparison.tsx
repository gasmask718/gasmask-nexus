import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Building2, TrendingUp, TrendingDown, Loader2, ArrowUpDown,
  Wifi, WifiOff, Activity, BarChart3,
} from 'lucide-react';

type SortBy = 'revenue' | 'expenses' | 'profit' | 'name';

interface BusinessFinance {
  id: string;
  name: string;
  industry: string | null;
  business_type: string | null;
  connection_status: string;
  reporting_mode: string;
  data_confidence_pct: number;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
}

function useBusinessComparison() {
  return useQuery({
    queryKey: ['business-comparison'],
    queryFn: async (): Promise<BusinessFinance[]> => {
      const [{ data: businesses }, { data: profiles }, { data: transactions }, { data: expenses }] = await Promise.all([
        supabase.from('businesses').select('id, name, slug, industry, business_type').eq('is_active', true),
        supabase.from('business_financial_profiles').select('*'),
        supabase.from('business_transactions').select('amount, transaction_type, brand'),
        supabase.from('business_expenses').select('amount, brand'),
      ]);

      const profileMap = new Map((profiles || []).map(p => [p.business_id, p]));

      // Build slug-to-id map for brand matching
      const slugToId = new Map<string, string>();
      (businesses || []).forEach(b => {
        slugToId.set(b.slug, b.id);
        slugToId.set(b.name.toLowerCase(), b.id);
      });

      // Aggregate transactions by brand -> business
      const revenueByBiz = new Map<string, number>();
      const expenseByBiz = new Map<string, number>();

      (transactions || []).forEach(t => {
        const brand = t.brand?.toLowerCase() || '';
        const bizId = slugToId.get(brand);
        if (!bizId) return;
        if (t.transaction_type === 'income') {
          revenueByBiz.set(bizId, (revenueByBiz.get(bizId) || 0) + Number(t.amount));
        } else {
          expenseByBiz.set(bizId, (expenseByBiz.get(bizId) || 0) + Number(t.amount));
        }
      });

      (expenses || []).forEach(e => {
        const brand = e.brand?.toLowerCase() || '';
        const bizId = slugToId.get(brand);
        if (!bizId) return;
        expenseByBiz.set(bizId, (expenseByBiz.get(bizId) || 0) + Number(e.amount));
      });

      return (businesses || []).map(b => {
        const fp = profileMap.get(b.id);
        const revenue = revenueByBiz.get(b.id) || Number(fp?.monthly_revenue_estimate || 0);
        const exp = expenseByBiz.get(b.id) || Number(fp?.monthly_expense_estimate || 0);
        const profit = revenue - exp;
        return {
          id: b.id,
          name: b.name,
          industry: b.industry,
          business_type: b.business_type,
          connection_status: fp?.connection_status || 'not_connected',
          reporting_mode: fp?.reporting_mode || 'placeholder',
          data_confidence_pct: fp?.data_confidence_pct || 0,
          revenue,
          expenses: exp,
          profit,
          margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        };
      });
    },
  });
}

export default function BusinessComparison() {
  const { data: businesses, isLoading } = useBusinessComparison();
  const [sortBy, setSortBy] = useState<SortBy>('revenue');
  const [groupBy, setGroupBy] = useState<'none' | 'industry'>('none');

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const sorted = [...(businesses || [])].sort((a, b) => {
    switch (sortBy) {
      case 'revenue': return b.revenue - a.revenue;
      case 'expenses': return b.expenses - a.expenses;
      case 'profit': return b.profit - a.profit;
      case 'name': return a.name.localeCompare(b.name);
      default: return 0;
    }
  });

  // Group by industry if selected
  const grouped = groupBy === 'industry'
    ? Object.entries(sorted.reduce<Record<string, BusinessFinance[]>>((acc, b) => {
        const key = b.industry?.replace(/_/g, ' ') || 'Unclassified';
        (acc[key] = acc[key] || []).push(b);
        return acc;
      }, {})).sort((a, b) => a[0].localeCompare(b[0]))
    : [['All Businesses', sorted] as [string, BusinessFinance[]]];

  const totalRevenue = sorted.reduce((s, b) => s + b.revenue, 0);
  const totalExpenses = sorted.reduce((s, b) => s + b.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Business Comparison
          </h2>
          <p className="text-sm text-muted-foreground">Revenue, expenses, and profit across all entities</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={groupBy} onValueChange={v => setGroupBy(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Grouping</SelectItem>
              <SelectItem value="industry">By Industry</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="revenue">Sort by Revenue</SelectItem>
              <SelectItem value="expenses">Sort by Expenses</SelectItem>
              <SelectItem value="profit">Sort by Profit</SelectItem>
              <SelectItem value="name">Sort by Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold text-emerald-400">${totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-bold text-red-400">${totalExpenses.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Dynasty Profit</p>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${totalProfit.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Table */}
      {grouped.map(([groupName, items]) => (
        <Card key={groupName}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base capitalize">{groupName}</CardTitle>
            <CardDescription className="text-xs">{items.length} business{items.length !== 1 ? 'es' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-2 px-3 font-medium">Business</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-right py-2 px-3 font-medium">Revenue</th>
                    <th className="text-right py-2 px-3 font-medium">Expenses</th>
                    <th className="text-right py-2 px-3 font-medium">Profit</th>
                    <th className="text-right py-2 px-3 font-medium">Margin</th>
                    <th className="text-center py-2 px-3 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(biz => (
                    <tr key={biz.id} className="border-b last:border-0 hover:bg-accent/20 transition-colors">
                      <td className="py-2.5 px-3">
                        <p className="font-medium">{biz.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{biz.industry?.replace(/_/g, ' ') || '—'}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className={`text-[10px] ${
                          biz.connection_status === 'api_connected' ? 'border-emerald-500/50 text-emerald-300' :
                          biz.connection_status === 'partial' ? 'border-amber-500/50 text-amber-300' :
                          biz.connection_status === 'manual' ? 'border-blue-500/50 text-blue-300' :
                          'border-muted text-muted-foreground'
                        }`}>
                          {biz.connection_status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-emerald-400">
                        {biz.revenue > 0 ? `$${biz.revenue.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-red-400">
                        {biz.expenses > 0 ? `$${biz.expenses.toLocaleString()}` : '—'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${biz.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {biz.revenue > 0 || biz.expenses > 0 ? `$${biz.profit.toLocaleString()}` : '—'}
                      </td>
                      <td className={`py-2.5 px-3 text-right ${biz.margin >= 20 ? 'text-emerald-400' : biz.margin > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                        {biz.revenue > 0 ? `${biz.margin.toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${biz.data_confidence_pct >= 70 ? 'bg-emerald-500' : biz.data_confidence_pct >= 40 ? 'bg-amber-500' : 'bg-muted-foreground/30'}`}
                              style={{ width: `${biz.data_confidence_pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{biz.data_confidence_pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
