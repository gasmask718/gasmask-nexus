import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Download, FileText, Calculator } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from 'date-fns';
import { exportData } from '@/utils/exportUtils';

const TAX_DEDUCTIBLE_CATEGORIES = [
  'healthcare', 'insurance', 'personal debt', 'housing',
];

export default function PersonalTaxes() {
  const now = new Date();
  const yearStart = format(startOfYear(now), 'yyyy-MM-dd');
  const yearEnd = format(endOfYear(now), 'yyyy-MM-dd');
  const qStart = format(startOfQuarter(now), 'yyyy-MM-dd');
  const qEnd = format(endOfQuarter(now), 'yyyy-MM-dd');

  const { data: yearTxns = [] } = useQuery({
    queryKey: ['personal-tax-year', yearStart, yearEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('personal_transactions')
        .select('*')
        .gte('transaction_date', yearStart)
        .lte('transaction_date', yearEnd)
        .order('transaction_date', { ascending: false });
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const income = yearTxns.filter(t => t.transaction_type === 'income');
    const expenses = yearTxns.filter(t => t.transaction_type === 'expense');

    const totalIncome = income.reduce((s, t) => s + Number(t.amount), 0);
    const totalExpenses = expenses.reduce((s, t) => s + Number(t.amount), 0);

    // Tax deductible items
    const deductibleExpenses = expenses.filter(t =>
      TAX_DEDUCTIBLE_CATEGORIES.includes(t.category)
    );
    const totalDeductible = deductibleExpenses.reduce((s, t) => s + Number(t.amount), 0);

    // Owner draws are taxable income
    const ownerDraws = income.filter(t => t.category === 'owner draw');
    const totalDraws = ownerDraws.reduce((s, t) => s + Number(t.amount), 0);

    // Estimated tax (simplified 25% bracket)
    const taxableIncome = totalIncome - totalDeductible;
    const estimatedTax = Math.max(0, taxableIncome * 0.25);
    const quarterlyEstimate = estimatedTax / 4;

    // Income by category
    const incomeByCategory = income.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalIncome,
      totalExpenses,
      totalDeductible,
      taxableIncome,
      estimatedTax,
      quarterlyEstimate,
      totalDraws,
      incomeByCategory,
      deductibleExpenses,
    };
  }, [yearTxns]);

  const handleExportTaxSummary = () => {
    const data = [
      { item: 'Total Income', amount: stats.totalIncome, taxable: 'Yes' },
      { item: 'Owner Draws', amount: stats.totalDraws, taxable: 'Yes' },
      { item: 'Total Deductions', amount: stats.totalDeductible, taxable: 'Deductible' },
      { item: 'Taxable Income', amount: stats.taxableIncome, taxable: '—' },
      { item: 'Estimated Annual Tax (25%)', amount: stats.estimatedTax, taxable: '—' },
      { item: 'Quarterly Estimate', amount: stats.quarterlyEstimate, taxable: '—' },
    ];
    exportData({
      filename: `personal-tax-summary-${now.getFullYear()}`,
      format: 'excel',
      data,
      columns: [
        { key: 'item', label: 'Item' },
        { key: 'amount', label: 'Amount' },
        { key: 'taxable', label: 'Tax Status' },
      ],
    });
  };

  const quarters = [1, 2, 3, 4];
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Personal Taxes</h3>
          <p className="text-sm text-muted-foreground">Tax year {now.getFullYear()} — Estimated obligations</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleExportTaxSummary}>
          <Download className="h-4 w-4 mr-1" /> Export Tax Summary
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Gross Income (YTD)</p>
            <p className="text-2xl font-bold text-emerald-400">${stats.totalIncome.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Deductions</p>
            <p className="text-2xl font-bold text-blue-400">${stats.totalDeductible.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Taxable Income</p>
            <p className="text-2xl font-bold">${stats.taxableIncome.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Est. Annual Tax</p>
            <p className="text-2xl font-bold text-red-400">${stats.estimatedTax.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quarterly Obligations */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Estimated Quarterly Tax Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quarters.map(q => (
              <div key={q} className={`p-3 rounded-lg border ${q <= currentQ ? 'bg-muted/50 border-border/50' : 'bg-muted/20 border-border/30'}`}>
                <p className="text-xs text-muted-foreground">Q{q} {now.getFullYear()}</p>
                <p className="text-lg font-bold">${stats.quarterlyEstimate.toLocaleString()}</p>
                {q < currentQ && (
                  <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-300 mt-1">Due</Badge>
                )}
                {q === currentQ && (
                  <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-300 mt-1">Current</Badge>
                )}
                {q > currentQ && (
                  <Badge variant="outline" className="text-[10px] mt-1">Upcoming</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Income Breakdown for Tax */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Income by Source (Tax Categorization)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(stats.incomeByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amount]) => (
                <div key={cat} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm capitalize">{cat}</span>
                    <Badge variant="outline" className="text-[10px]">Taxable</Badge>
                  </div>
                  <span className="text-sm font-medium">${amount.toLocaleString()}</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
