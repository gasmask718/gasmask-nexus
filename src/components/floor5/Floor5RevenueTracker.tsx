import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { ExportButton } from '@/components/crud/ExportButton';

type Period = 'today' | 'week' | 'biweekly' | 'month';

function getDateRange(period: Period) {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
    case 'week':
      return { start: format(startOfWeek(now), 'yyyy-MM-dd'), end: format(endOfWeek(now), 'yyyy-MM-dd') };
    case 'biweekly':
      return { start: format(subDays(now, 14), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
    case 'month':
      return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
  }
}

export default function Floor5RevenueTracker() {
  const [period, setPeriod] = useState<Period>('month');
  const { start, end } = getDateRange(period);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['floor5-revenue', start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_transactions')
        .select('*')
        .gte('transaction_date', start)
        .lte('transaction_date', end)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const income = transactions?.filter(t => t.transaction_type === 'income') || [];
  const expenses = transactions?.filter(t => t.transaction_type === 'expense') || [];
  const totalRevenue = income.reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Group by category
  const revenueByCategory = income.reduce((acc, t) => {
    acc[t.category || 'Uncategorized'] = (acc[t.category || 'Uncategorized'] || 0) + Number(t.amount);
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories = Object.entries(revenueByCategory).sort((a, b) => b[1] - a[1]);

  // Group by brand
  const revenueByBrand = income.reduce((acc, t) => {
    acc[t.brand || 'General'] = (acc[t.brand || 'General'] || 0) + Number(t.amount);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Revenue & Orders</h2>
          <p className="text-sm text-muted-foreground">Income tracking across all channels</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="biweekly">Biweekly</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <ExportButton
            data={(transactions || []) as Record<string, unknown>[]}
            filename={`revenue-${period}`}
            columns={[
              { key: 'transaction_date', label: 'Date' },
              { key: 'category', label: 'Category' },
              { key: 'amount', label: 'Amount' },
              { key: 'brand', label: 'Brand' },
              { key: 'description', label: 'Description' },
            ]}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-emerald-500">${totalRevenue.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-500/40" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{income.length} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold text-red-500">${totalExpenses.toLocaleString()}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500/40" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{expenses.length} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  ${netProfit.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Margin</p>
                <p className={`text-2xl font-bold ${margin >= 20 ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {margin.toFixed(1)}%
                </p>
              </div>
              <Badge variant={margin >= 20 ? 'default' : 'destructive'} className="text-xs">
                {margin >= 20 ? 'Healthy' : 'Below 20%'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedCategories.length > 0 ? (
              <div className="space-y-3">
                {sortedCategories.map(([cat, amount]) => (
                  <div key={cat} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{cat}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">${amount.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">
                        ({totalRevenue > 0 ? ((amount / totalRevenue) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No revenue data for this period</p>
            )}
          </CardContent>
        </Card>

        {/* By Brand */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Brand</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(revenueByBrand).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(revenueByBrand)
                  .sort((a, b) => b[1] - a[1])
                  .map(([brand, amount]) => (
                    <div key={brand} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50">
                      <span className="text-sm font-medium">{brand}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">${amount.toLocaleString()}</span>
                        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No brand data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Transactions</CardTitle>
          <CardDescription>{transactions?.length || 0} transactions in period</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : transactions && transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Brand</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Description</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 20).map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-accent/30">
                      <td className="py-2 px-2">{format(new Date(t.transaction_date), 'MMM d, yyyy')}</td>
                      <td className="py-2 px-2">
                        <Badge variant={t.transaction_type === 'income' ? 'default' : 'destructive'} className="text-xs">
                          {t.transaction_type}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">{t.category}</td>
                      <td className="py-2 px-2 text-muted-foreground">{t.brand || '—'}</td>
                      <td className="py-2 px-2 text-muted-foreground truncate max-w-[200px]">{t.description || '—'}</td>
                      <td className={`py-2 px-2 text-right font-medium ${t.transaction_type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {t.transaction_type === 'income' ? '+' : '-'}${Number(t.amount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No transactions for this period</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
