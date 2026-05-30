import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  FileText, Download, TrendingUp, TrendingDown,
  DollarSign, Loader2, BarChart3, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';

type ReportPeriod = 'daily' | 'weekly' | 'biweekly' | 'monthly';

interface PLReport {
  revenue: number;
  expenses: number;
  netProfit: number;
  margin: number;
  revenueByCategory: Record<string, number>;
  expensesByCategory: Record<string, number>;
  periodLabel: string;
}

function usePLReport(period: ReportPeriod, offset: number) {
  return useQuery({
    queryKey: ['pl-report', period, offset],
    queryFn: async (): Promise<PLReport> => {
      const now = new Date();
      let start: Date, end: Date, label: string;

      switch (period) {
        case 'daily':
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
          end = start;
          label = format(start, 'MMM d, yyyy');
          break;
        case 'weekly':
          const weekStart = startOfWeek(subWeeks(now, offset), { weekStartsOn: 1 });
          start = weekStart;
          end = endOfWeek(weekStart, { weekStartsOn: 1 });
          label = `Week of ${format(start, 'MMM d, yyyy')}`;
          break;
        case 'biweekly':
          const bwStart = startOfWeek(subWeeks(now, offset * 2), { weekStartsOn: 1 });
          start = bwStart;
          end = endOfWeek(addWeeks(bwStart, 1), { weekStartsOn: 1 });
          label = `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
          break;
        case 'monthly':
        default:
          start = startOfMonth(subMonths(now, offset));
          end = endOfMonth(start);
          label = format(start, 'MMMM yyyy');
          break;
      }

      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      const [{ data: transactions }, { data: expenses }] = await Promise.all([
        supabase.from('business_transactions').select('*').gte('transaction_date', startStr).lte('transaction_date', endStr),
        supabase.from('business_expenses').select('*').gte('expense_date', startStr).lte('expense_date', endStr),
      ]);

      const income = (transactions || []).filter(t => t.transaction_type === 'income');
      const txExpenses = (transactions || []).filter(t => t.transaction_type === 'expense');

      const totalRevenue = income.reduce((s, t) => s + Number(t.amount), 0);
      const totalTxExpenses = txExpenses.reduce((s, t) => s + Number(t.amount), 0);
      const totalBizExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
      const totalExpenses = totalTxExpenses + totalBizExpenses;
      const netProfit = totalRevenue - totalExpenses;

      const revenueByCategory: Record<string, number> = {};
      income.forEach(t => {
        revenueByCategory[t.category] = (revenueByCategory[t.category] || 0) + Number(t.amount);
      });

      const expensesByCategory: Record<string, number> = {};
      txExpenses.forEach(t => {
        expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + Number(t.amount);
      });
      (expenses || []).forEach(e => {
        expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.amount);
      });

      return {
        revenue: totalRevenue,
        expenses: totalExpenses,
        netProfit,
        margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
        revenueByCategory,
        expensesByCategory,
        periodLabel: label,
      };
    },
  });
}

function exportPLReport(report: PLReport) {
  const lines = [
    `PROFIT & LOSS REPORT`,
    `Period: ${report.periodLabel}`,
    `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`,
    ``,
    `REVENUE`,
    ...Object.entries(report.revenueByCategory).map(([cat, amt]) => `  ${cat}: $${amt.toFixed(2)}`),
    `  TOTAL REVENUE: $${report.revenue.toFixed(2)}`,
    ``,
    `EXPENSES`,
    ...Object.entries(report.expensesByCategory).map(([cat, amt]) => `  ${cat}: $${amt.toFixed(2)}`),
    `  TOTAL EXPENSES: $${report.expenses.toFixed(2)}`,
    ``,
    `NET PROFIT: $${report.netProfit.toFixed(2)}`,
    `PROFIT MARGIN: ${report.margin.toFixed(1)}%`,
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PL-Report-${report.periodLabel.replace(/\s+/g, '_')}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AccountingReports() {
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const [offset, setOffset] = useState(0);
  const { data: report, isLoading } = usePLReport(period, offset);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            Executive Reports
          </h2>
          <p className="text-sm text-muted-foreground">P&L, Cashflow summaries — Daily / Weekly / Biweekly / Monthly</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => { setPeriod(v as ReportPeriod); setOffset(0); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Biweekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setOffset(o => o + 1)}>← Older</Button>
          <Button variant="outline" size="sm" onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0}>Newer →</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : report ? (
        <>
          {/* Period Header */}
          <Card className="bg-gradient-to-r from-purple-950/30 to-background border-purple-500/20">
            <CardContent className="pt-6 pb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Profit & Loss</p>
                <p className="text-xl font-bold">{report.periodLabel}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => exportPLReport(report)}>
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </Button>
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Revenue</span>
                </div>
                <p className="text-2xl font-bold text-emerald-500">${report.revenue.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-muted-foreground">Expenses</span>
                </div>
                <p className="text-2xl font-bold text-red-500">${report.expenses.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className={`h-4 w-4 ${report.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                  <span className="text-xs text-muted-foreground">Net Profit</span>
                </div>
                <p className={`text-2xl font-bold ${report.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  ${report.netProfit.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className={`h-4 w-4 ${report.margin >= 20 ? 'text-emerald-500' : 'text-amber-500'}`} />
                  <span className="text-xs text-muted-foreground">Margin</span>
                </div>
                <p className={`text-2xl font-bold ${report.margin >= 20 ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {report.margin.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-emerald-500 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Revenue by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(report.revenueByCategory).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(report.revenueByCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, amt]) => (
                        <div key={cat} className="flex items-center justify-between p-2 rounded bg-muted/30">
                          <span className="text-sm">{cat}</span>
                          <span className="font-medium">${amt.toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No revenue data</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-red-500 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Expenses by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(report.expensesByCategory).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(report.expensesByCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, amt]) => (
                        <div key={cat} className="flex items-center justify-between p-2 rounded bg-muted/30">
                          <span className="text-sm">{cat}</span>
                          <span className="font-medium text-red-400">${amt.toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No expense data</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
