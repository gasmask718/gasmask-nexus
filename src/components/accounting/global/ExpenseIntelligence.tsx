import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, AlertCircle } from 'lucide-react';
import { ExportButton } from '@/components/crud/ExportButton';
import {
  useFinancialSnapshots,
  useBusinessEntities,
  useExpenseCategoryCatalog,
} from '@/hooks/useGlobalFinancialData';

interface CategoryExpense {
  category: string;
  categoryGroup: string;
  taxDeductible: boolean;
  total: number;
  businessCount: number;
}

interface BusinessExpenseRow {
  businessName: string;
  totalExpenses: number;
  confidence: number;
  topCategories: string[];
}

export default function ExpenseIntelligence() {
  const { data: snapshots, isLoading: snapLoading } = useFinancialSnapshots(2);
  const { data: businesses, isLoading: bizLoading } = useBusinessEntities();
  const { data: expenseCategories } = useExpenseCategoryCatalog();
  const [tab, setTab] = useState<'categories' | 'businesses'>('categories');

  const isLoading = snapLoading || bizLoading;

  // Build business name map
  const bizNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (businesses || []).forEach(b => map.set(b.id, b.name));
    return map;
  }, [businesses]);

  // Build category lookup
  const categoryLookup = useMemo(() => {
    const map = new Map<string, { group: string; taxDeductible: boolean }>();
    (expenseCategories || []).forEach(c => map.set(c.category_name.toLowerCase(), { group: c.category_group, taxDeductible: c.tax_deductible }));
    return map;
  }, [expenseCategories]);

  // Aggregate expense breakdowns from snapshots
  const { categories, businessRows, totalExpenses } = useMemo(() => {
    const categoryMap = new Map<string, { total: number; businesses: Set<string> }>();
    const bizMap = new Map<string, { total: number; categories: Set<string>; confidence: number }>();

    (snapshots || []).forEach(s => {
      const breakdown = s.expense_breakdown as Record<string, number> | null;
      if (breakdown) {
        Object.entries(breakdown).forEach(([cat, amount]) => {
          const existing = categoryMap.get(cat) || { total: 0, businesses: new Set<string>() };
          existing.total += Number(amount);
          existing.businesses.add(s.business_id);
          categoryMap.set(cat, existing);

          const biz = bizMap.get(s.business_id) || { total: 0, categories: new Set<string>(), confidence: s.confidence_score };
          biz.categories.add(cat);
          bizMap.set(s.business_id, biz);
        });
      }

      // Also aggregate total expenses per business
      const existing = bizMap.get(s.business_id) || { total: 0, categories: new Set<string>(), confidence: s.confidence_score };
      existing.total += s.total_expenses;
      bizMap.set(s.business_id, existing);
    });

    const cats: CategoryExpense[] = Array.from(categoryMap.entries())
      .map(([category, data]) => {
        const lookup = categoryLookup.get(category.toLowerCase());
        return {
          category,
          categoryGroup: lookup?.group || 'uncategorized',
          taxDeductible: lookup?.taxDeductible || false,
          total: data.total,
          businessCount: data.businesses.size,
        };
      })
      .sort((a, b) => b.total - a.total);

    const bizRows: BusinessExpenseRow[] = Array.from(bizMap.entries())
      .map(([bizId, data]) => ({
        businessName: bizNameMap.get(bizId) || 'Unknown',
        totalExpenses: data.total,
        confidence: data.confidence,
        topCategories: Array.from(data.categories).slice(0, 3),
      }))
      .sort((a, b) => b.totalExpenses - a.totalExpenses);

    const total = bizRows.reduce((s, b) => s + b.totalExpenses, 0);

    return { categories: cats, businessRows: bizRows, totalExpenses: total };
  }, [snapshots, bizNameMap, categoryLookup]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const hasData = categories.length > 0 || businessRows.length > 0;

  const exportRows = categories.map(c => ({
    Category: c.category,
    Group: c.categoryGroup,
    'Tax Deductible': c.taxDeductible ? 'Yes' : 'No',
    Total: c.total,
    'Business Count': c.businessCount,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Expense Intelligence
          </h2>
          <p className="text-sm text-muted-foreground">
            Cross-business expense analysis from financial snapshots
          </p>
        </div>
        {hasData && (
          <ExportButton
            data={exportRows}
            filename="expense-intelligence"
            columns={[
              { key: 'Category', label: 'Category' },
              { key: 'Group', label: 'Group' },
              { key: 'Tax Deductible', label: 'Tax Deductible' },
              { key: 'Total', label: 'Total' },
              { key: 'Business Count', label: 'Businesses' },
            ]}
          />
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-xl font-bold text-red-400">${totalExpenses.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Categories Tracked</p>
            <p className="text-xl font-bold">{categories.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Businesses Reporting</p>
            <p className="text-xl font-bold">{businessRows.length}</p>
          </CardContent>
        </Card>
      </div>

      {!hasData && (
        <Card className="border-amber-500/20 bg-amber-950/10">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-amber-300">
                No expense breakdown data in snapshots yet. Expense intelligence will activate when businesses submit snapshots with expense_breakdown fields.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <>
          {/* Tab Selector */}
          <div className="flex gap-2">
            <Button variant={tab === 'categories' ? 'default' : 'outline'} size="sm" onClick={() => setTab('categories')}>
              By Category
            </Button>
            <Button variant={tab === 'businesses' ? 'default' : 'outline'} size="sm" onClick={() => setTab('businesses')}>
              By Business
            </Button>
          </div>

          {tab === 'categories' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Expense Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categories.map(cat => (
                    <div key={cat.category} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium capitalize">{cat.category}</p>
                          <Badge variant="outline" className="text-[10px] py-0 capitalize">{cat.categoryGroup}</Badge>
                          {cat.taxDeductible && (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">Deductible</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{cat.businessCount} business{cat.businessCount !== 1 ? 'es' : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-400">${cat.total.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {tab === 'businesses' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Expenses by Business</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {businessRows.map(biz => (
                    <div key={biz.businessName} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{biz.businessName}</p>
                        <div className="flex gap-1 mt-1">
                          {biz.topCategories.map(c => (
                            <Badge key={c} variant="outline" className="text-[10px] py-0 capitalize">{c}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-400">${biz.totalExpenses.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Conf: {biz.confidence}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
