import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, AlertTriangle, TrendingUp, Target, ShieldAlert } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { toast } from 'sonner';

const DEFAULT_BUDGET_CATEGORIES = [
  { key: 'housing', label: 'Housing', target: 0 },
  { key: 'transportation', label: 'Transportation', target: 0 },
  { key: 'food', label: 'Food', target: 0 },
  { key: 'insurance', label: 'Insurance', target: 0 },
  { key: 'personal subscriptions', label: 'Subscriptions', target: 0 },
  { key: 'travel', label: 'Travel', target: 0 },
  { key: 'family', label: 'Family', target: 0 },
  { key: 'healthcare', label: 'Healthcare', target: 0 },
  { key: 'personal debt', label: 'Personal Debt', target: 0 },
  { key: 'other', label: 'Other', target: 0 },
];

export default function PersonalBudget() {
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();
  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
  const prevMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
  const prevMonthEnd = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');

  // Get budget profile
  const { data: budgets = [] } = useQuery({
    queryKey: ['personal-budget-profiles'],
    queryFn: async () => {
      const { data } = await supabase
        .from('budget_profiles')
        .select('*')
        .eq('profile_type', 'personal')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      return data || [];
    },
  });

  // Get actual spending
  const { data: currentSpending = [] } = useQuery({
    queryKey: ['personal-expenses-budget', monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('personal_transactions')
        .select('category, amount')
        .eq('transaction_type', 'expense')
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd);
      return data || [];
    },
  });

  const { data: prevSpending = [] } = useQuery({
    queryKey: ['personal-expenses-budget-prev', prevMonthStart, prevMonthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('personal_transactions')
        .select('category, amount')
        .eq('transaction_type', 'expense')
        .gte('transaction_date', prevMonthStart)
        .lte('transaction_date', prevMonthEnd);
      return data || [];
    },
  });

  const saveBudget = useMutation({
    mutationFn: async (form: FormData) => {
      const categoryBudgets: Record<string, number> = {};
      let total = 0;
      DEFAULT_BUDGET_CATEGORIES.forEach(cat => {
        const val = Number(form.get(cat.key)) || 0;
        categoryBudgets[cat.key] = val;
        total += val;
      });

      const payload = {
        profile_name: `Personal Budget ${format(now, 'MMM yyyy')}`,
        profile_type: 'personal' as const,
        total_budget: total,
        category_budgets: categoryBudgets,
        start_date: monthStart,
        end_date: monthEnd,
        is_active: true,
      };

      if (budgets.length > 0) {
        const { error } = await supabase
          .from('budget_profiles')
          .update(payload)
          .eq('id', budgets[0].id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('budget_profiles')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-budget-profiles'] });
      toast.success('Budget saved');
      setEditOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const budget = budgets[0];
  const categoryBudgets = (budget?.category_budgets || {}) as Record<string, number>;

  // Aggregate actual spending by category
  const actualByCategory = currentSpending.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
    return acc;
  }, {} as Record<string, number>);

  const prevByCategory = prevSpending.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
    return acc;
  }, {} as Record<string, number>);

  // Lifestyle creep detection
  const totalCurrent = Object.values(actualByCategory).reduce((s, v) => s + v, 0);
  const totalPrev = Object.values(prevByCategory).reduce((s, v) => s + v, 0);
  const lifestyleCreep = totalPrev > 0 ? ((totalCurrent - totalPrev) / totalPrev) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Personal Budget</h3>
          <p className="text-sm text-muted-foreground">{format(now, 'MMMM yyyy')} — Monthly targets vs actuals</p>
        </div>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Target className="h-4 w-4 mr-1" />
              {budget ? 'Edit Budget' : 'Set Budget'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Set Monthly Budget Targets</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveBudget.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
              {DEFAULT_BUDGET_CATEGORIES.map(cat => (
                <div key={cat.key} className="flex items-center gap-3">
                  <label className="text-sm w-32">{cat.label}</label>
                  <Input
                    name={cat.key}
                    type="number"
                    step="0.01"
                    placeholder="$0"
                    defaultValue={categoryBudgets[cat.key] || ''}
                    className="flex-1"
                  />
                </div>
              ))}
              <Button type="submit" disabled={saveBudget.isPending} className="w-full">
                {saveBudget.isPending ? 'Saving...' : 'Save Budget'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lifestyle Creep Warning */}
      {lifestyleCreep > 10 && (
        <Card className="bg-amber-900/20 border-amber-500/30">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-200">⚠️ Lifestyle Creep Detected</p>
              <p className="text-xs text-amber-300/80">
                Spending is up {lifestyleCreep.toFixed(1)}% vs last month. Review discretionary categories.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget vs Actual Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DEFAULT_BUDGET_CATEGORIES.map(cat => {
          const target = categoryBudgets[cat.key] || 0;
          const actual = actualByCategory[cat.key] || 0;
          const variance = target - actual;
          const pct = target > 0 ? (actual / target) * 100 : 0;
          const isOver = actual > target && target > 0;
          const isUnder = actual < target * 0.5 && target > 0;

          return (
            <Card key={cat.key} className="bg-card/50 border-border/50">
              <CardContent className="pt-4 pb-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">{cat.label}</span>
                  {isOver && <Badge variant="destructive" className="text-[10px]">OVER</Badge>}
                  {isUnder && <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-300">Under</Badge>}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Spent: ${actual.toLocaleString()}</span>
                  <span>Budget: ${target > 0 ? target.toLocaleString() : '—'}</span>
                </div>
                {target > 0 && (
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                )}
                {target > 0 && (
                  <p className={`text-xs mt-1 ${variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {variance >= 0 ? `$${variance.toLocaleString()} remaining` : `$${Math.abs(variance).toLocaleString()} over budget`}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
