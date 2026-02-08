import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Loader2 } from 'lucide-react';
import {
  useBusinessEntities,
  useFinancialSnapshots,
  useIndustryCatalog,
  getConnectionLabel,
  getConfidenceLabel,
  type BusinessEntity,
} from '@/hooks/useGlobalFinancialData';

type SortBy = 'revenue' | 'expenses' | 'profit' | 'name' | 'confidence';

interface BusinessFinanceRow extends BusinessEntity {
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  snapshotSource: boolean;
}

export default function BusinessComparison() {
  const { data: businesses, isLoading: bizLoading } = useBusinessEntities();
  const { data: snapshots, isLoading: snapLoading } = useFinancialSnapshots(1);
  const { data: industries } = useIndustryCatalog();
  const [sortBy, setSortBy] = useState<SortBy>('revenue');
  const [groupBy, setGroupBy] = useState<'none' | 'industry' | 'connection'>('none');

  const isLoading = bizLoading || snapLoading;

  // Build industry name map
  const industryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (industries || []).forEach(i => map.set(i.id, i.industry_name));
    return map;
  }, [industries]);

  // Build snapshot aggregation per business
  const snapshotByBiz = useMemo(() => {
    const map = new Map<string, { revenue: number; expenses: number }>();
    (snapshots || []).forEach(s => {
      const existing = map.get(s.business_id) || { revenue: 0, expenses: 0 };
      existing.revenue += s.total_revenue;
      existing.expenses += s.total_expenses;
      map.set(s.business_id, existing);
    });
    return map;
  }, [snapshots]);

  const rows: BusinessFinanceRow[] = useMemo(() => {
    return (businesses || []).map(b => {
      const snap = snapshotByBiz.get(b.id);
      const hasSnapshot = snap && (snap.revenue > 0 || snap.expenses > 0);
      const revenue = hasSnapshot ? snap!.revenue : b.monthly_revenue_estimate;
      const expenses = hasSnapshot ? snap!.expenses : b.monthly_expense_estimate;
      const profit = revenue - expenses;
      return {
        ...b,
        revenue,
        expenses,
        profit,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        snapshotSource: !!hasSnapshot,
      };
    });
  }, [businesses, snapshotByBiz]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      switch (sortBy) {
        case 'revenue': return b.revenue - a.revenue;
        case 'expenses': return b.expenses - a.expenses;
        case 'profit': return b.profit - a.profit;
        case 'confidence': return b.data_confidence_pct - a.data_confidence_pct;
        case 'name': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });
  }, [rows, sortBy]);

  const grouped = useMemo(() => {
    if (groupBy === 'none') return [['All Businesses', sorted] as [string, BusinessFinanceRow[]]];
    if (groupBy === 'connection') {
      return Object.entries(sorted.reduce<Record<string, BusinessFinanceRow[]>>((acc, b) => {
        const key = getConnectionLabel(b.connection_status).label;
        (acc[key] = acc[key] || []).push(b);
        return acc;
      }, {})).sort((a, b) => b[1].length - a[1].length);
    }
    // By industry
    return Object.entries(sorted.reduce<Record<string, BusinessFinanceRow[]>>((acc, b) => {
      const key = b.industry_catalog_id
        ? industryNameMap.get(b.industry_catalog_id) || b.industry?.replace(/_/g, ' ') || 'Unclassified'
        : b.industry?.replace(/_/g, ' ') || 'Unclassified';
      (acc[key] = acc[key] || []).push(b);
      return acc;
    }, {})).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sorted, groupBy, industryNameMap]);

  const totalRevenue = sorted.reduce((s, b) => s + b.revenue, 0);
  const totalExpenses = sorted.reduce((s, b) => s + b.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Business Comparison
          </h2>
          <p className="text-sm text-muted-foreground">
            {sorted.length} entities — revenue, expenses, and profit across all businesses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={groupBy} onValueChange={v => setGroupBy(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Grouping</SelectItem>
              <SelectItem value="industry">By Industry</SelectItem>
              <SelectItem value="connection">By Connection</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="revenue">Sort by Revenue</SelectItem>
              <SelectItem value="expenses">Sort by Expenses</SelectItem>
              <SelectItem value="profit">Sort by Profit</SelectItem>
              <SelectItem value="confidence">Sort by Confidence</SelectItem>
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

      {/* Comparison Tables */}
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
                    <th className="text-left py-2 px-3 font-medium">Source</th>
                    <th className="text-right py-2 px-3 font-medium">Revenue</th>
                    <th className="text-right py-2 px-3 font-medium">Expenses</th>
                    <th className="text-right py-2 px-3 font-medium">Profit</th>
                    <th className="text-right py-2 px-3 font-medium">Margin</th>
                    <th className="text-center py-2 px-3 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(biz => {
                    const conn = getConnectionLabel(biz.connection_status);
                    const conf = getConfidenceLabel(biz.data_confidence_pct);
                    const hasData = biz.revenue > 0 || biz.expenses > 0;
                    return (
                      <tr key={biz.id} className={`border-b last:border-0 transition-colors ${biz.is_active ? 'hover:bg-accent/20' : 'opacity-50'}`}>
                        <td className="py-2.5 px-3">
                          <p className="font-medium">{biz.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {biz.industry?.replace(/_/g, ' ') || '—'}
                          </p>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className={`text-[10px] ${conn.className}`}>
                            {conn.label}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className={`text-[10px] ${conf.className}`}>
                            {biz.snapshotSource ? 'Snapshot' : conf.label}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-emerald-400">
                          {hasData ? `$${biz.revenue.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-red-400">
                          {hasData ? `$${biz.expenses.toLocaleString()}` : '—'}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${biz.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {hasData ? `$${biz.profit.toLocaleString()}` : '—'}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
