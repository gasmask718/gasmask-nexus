import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { exportData } from '@/utils/exportUtils';
import {
  FileText, Download, Shield, Loader2, DollarSign,
  Calendar, BarChart3, Lock,
} from 'lucide-react';
import { format } from 'date-fns';

interface TaxSummary {
  year: number;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  expensesByCategory: Record<string, number>;
  revenueByCategory: Record<string, number>;
  quarterlyBreakdown: Array<{
    quarter: string;
    revenue: number;
    expenses: number;
    net: number;
  }>;
}

function useTaxSummary(year: number) {
  return useQuery({
    queryKey: ['tax-summary', year],
    queryFn: async (): Promise<TaxSummary> => {
      const start = format(new Date(year, 0, 1), 'yyyy-MM-dd');
      const end = format(new Date(year, 11, 31), 'yyyy-MM-dd');

      const [{ data: transactions }, { data: expenses }] = await Promise.all([
        supabase.from('business_transactions').select('*').gte('transaction_date', start).lte('transaction_date', end),
        supabase.from('business_expenses').select('*').gte('expense_date', start).lte('expense_date', end),
      ]);

      const income = (transactions || []).filter(t => t.transaction_type === 'income');
      const txExpenses = (transactions || []).filter(t => t.transaction_type === 'expense');

      const totalRevenue = income.reduce((s, t) => s + Number(t.amount), 0);
      const totalTxExpenses = txExpenses.reduce((s, t) => s + Number(t.amount), 0);
      const totalBizExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
      const totalExpensesAmount = totalTxExpenses + totalBizExpenses;

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

      // Quarterly breakdown
      const quarterlyBreakdown = [1, 2, 3, 4].map(q => {
        const qStart = new Date(year, (q - 1) * 3, 1);
        const qEnd = new Date(year, q * 3, 0);
        const qStartStr = format(qStart, 'yyyy-MM-dd');
        const qEndStr = format(qEnd, 'yyyy-MM-dd');

        const qIncome = income
          .filter(t => t.transaction_date >= qStartStr && t.transaction_date <= qEndStr)
          .reduce((s, t) => s + Number(t.amount), 0);
        const qTxExp = txExpenses
          .filter(t => t.transaction_date >= qStartStr && t.transaction_date <= qEndStr)
          .reduce((s, t) => s + Number(t.amount), 0);
        const qBizExp = (expenses || [])
          .filter(e => e.expense_date >= qStartStr && e.expense_date <= qEndStr)
          .reduce((s, e) => s + Number(e.amount), 0);

        return {
          quarter: `Q${q}`,
          revenue: qIncome,
          expenses: qTxExp + qBizExp,
          net: qIncome - (qTxExp + qBizExp),
        };
      });

      return {
        year,
        totalRevenue,
        totalExpenses: totalExpensesAmount,
        netIncome: totalRevenue - totalExpensesAmount,
        expensesByCategory,
        revenueByCategory,
        quarterlyBreakdown,
      };
    },
  });
}

function exportCPAPackage(summary: TaxSummary) {
  const rows: Record<string, unknown>[] = [];

  Object.entries(summary.revenueByCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
    rows.push({ Section: 'Revenue', Category: cat, Amount: amt, Year: summary.year });
  });
  rows.push({ Section: 'Revenue', Category: 'TOTAL REVENUE', Amount: summary.totalRevenue, Year: summary.year });

  Object.entries(summary.expensesByCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
    rows.push({ Section: 'Expenses', Category: cat, Amount: amt, Year: summary.year });
  });
  rows.push({ Section: 'Expenses', Category: 'TOTAL EXPENSES', Amount: summary.totalExpenses, Year: summary.year });

  rows.push({ Section: 'Summary', Category: 'NET INCOME', Amount: summary.netIncome, Year: summary.year });

  summary.quarterlyBreakdown.forEach(q => {
    rows.push({ Section: 'Quarterly', Category: `${q.quarter} Revenue`, Amount: q.revenue, Year: summary.year });
    rows.push({ Section: 'Quarterly', Category: `${q.quarter} Expenses`, Amount: q.expenses, Year: summary.year });
    rows.push({ Section: 'Quarterly', Category: `${q.quarter} Net`, Amount: q.net, Year: summary.year });
  });

  exportData({
    filename: `CPA-Export-${summary.year}`,
    format: 'excel',
    data: rows,
    columns: [
      { key: 'Section', label: 'Section' },
      { key: 'Category', label: 'Category' },
      { key: 'Amount', label: 'Amount ($)' },
      { key: 'Year', label: 'Tax Year' },
    ],
  });
}

function exportProofOfIncome(summary: TaxSummary) {
  const rows: Record<string, unknown>[] = [
    { Metric: 'Total Gross Revenue', Value: `$${summary.totalRevenue.toFixed(2)}`, Period: `Tax Year ${summary.year}` },
    { Metric: 'Monthly Average Revenue', Value: `$${(summary.totalRevenue / 12).toFixed(2)}`, Period: 'Monthly' },
    { Metric: 'Total Expenses', Value: `$${summary.totalExpenses.toFixed(2)}`, Period: `Tax Year ${summary.year}` },
    { Metric: 'Total Net Income', Value: `$${summary.netIncome.toFixed(2)}`, Period: `Tax Year ${summary.year}` },
    { Metric: 'Monthly Average Net', Value: `$${(summary.netIncome / 12).toFixed(2)}`, Period: 'Monthly' },
    { Metric: 'Profit Margin', Value: `${summary.totalRevenue > 0 ? ((summary.netIncome / summary.totalRevenue) * 100).toFixed(1) : '0'}%`, Period: `Tax Year ${summary.year}` },
  ];

  summary.quarterlyBreakdown.forEach(q => {
    rows.push({ Metric: `${q.quarter} Revenue`, Value: `$${q.revenue.toFixed(2)}`, Period: q.quarter });
    rows.push({ Metric: `${q.quarter} Net Income`, Value: `$${q.net.toFixed(2)}`, Period: q.quarter });
  });

  exportData({
    filename: `Proof-Of-Income-${summary.year}`,
    format: 'excel',
    data: rows,
    columns: [
      { key: 'Metric', label: 'Metric' },
      { key: 'Value', label: 'Value' },
      { key: 'Period', label: 'Period' },
    ],
  });
}

export default function TaxPrepVault() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: summary, isLoading } = useTaxSummary(year);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Tax Prep Vault
          </h2>
          <p className="text-sm text-muted-foreground">CPA-ready exports, Proof of Income packages, quarterly estimates</p>
        </div>
        <Select value={year.toString()} onValueChange={v => setYear(parseInt(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[currentYear, currentYear - 1, currentYear - 2].map(y => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : summary ? (
        <>
          {/* Annual Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Gross Revenue</p>
                <p className="text-2xl font-bold text-emerald-500">${summary.totalRevenue.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold text-red-500">${summary.totalExpenses.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Net Income</p>
                <p className={`text-2xl font-bold ${summary.netIncome >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  ${summary.netIncome.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Monthly Avg</p>
                <p className="text-2xl font-bold">${(summary.totalRevenue / 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </CardContent>
            </Card>
          </div>

          {/* Quarterly Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Quarterly Breakdown — {year}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {summary.quarterlyBreakdown.map(q => (
                  <Card key={q.quarter} className="bg-muted/30">
                    <CardContent className="pt-4 pb-3">
                      <p className="text-sm font-bold mb-2">{q.quarter}</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Revenue</span>
                          <span className="text-emerald-500">${q.revenue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Expenses</span>
                          <span className="text-red-400">${q.expenses.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-border/50">
                          <span className="font-medium">Net</span>
                          <span className={`font-bold ${q.net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            ${q.net.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Export Actions */}
          <Card className="border-blue-500/20 bg-gradient-to-r from-blue-950/20 to-background">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-500" />
                Export Packages
              </CardTitle>
              <CardDescription className="text-xs">Download CPA-ready reports and income documentation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button variant="outline" className="h-auto py-4 flex flex-col items-start gap-1" onClick={() => exportCPAPackage(summary)}>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">CPA Export</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Categorized income & expenses for your accountant</span>
                </Button>

                <Button variant="outline" className="h-auto py-4 flex flex-col items-start gap-1" onClick={() => exportProofOfIncome(summary)}>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span className="font-medium">Proof of Income</span>
                  </div>
                  <span className="text-xs text-muted-foreground">12-month summary + P&L for loans & applications</span>
                </Button>

                <Button variant="outline" className="h-auto py-4 flex flex-col items-start gap-1 opacity-60" disabled>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span className="font-medium">Balance Sheet</span>
                    <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">Assets, liabilities, and equity snapshot</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Category Detail */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Income Categories (CPA View)</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(summary.revenueByCategory).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(summary.revenueByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                      <div key={cat} className="flex justify-between p-2 rounded bg-muted/30">
                        <span className="text-sm">{cat}</span>
                        <span className="font-medium">${amt.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No income data for {year}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Expense Categories (CPA View)</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(summary.expensesByCategory).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(summary.expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                      <div key={cat} className="flex justify-between p-2 rounded bg-muted/30">
                        <span className="text-sm">{cat}</span>
                        <span className="font-medium text-red-400">${amt.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No expense data for {year}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
