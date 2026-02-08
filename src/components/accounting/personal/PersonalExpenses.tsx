import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Receipt, Calendar, Upload } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { toast } from 'sonner';
import { ExportButton } from '@/components/crud/ExportButton';

const PERSONAL_EXPENSE_CATEGORIES = [
  'Housing', 'Transportation', 'Food', 'Insurance',
  'Personal Subscriptions', 'Travel', 'Family',
  'Healthcare', 'Personal Debt', 'Other',
];

export default function PersonalExpenses() {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const queryClient = useQueryClient();

  const now = new Date();
  const startDate = period === 'month'
    ? format(startOfMonth(now), 'yyyy-MM-dd')
    : format(startOfYear(now), 'yyyy-MM-dd');
  const endDate = period === 'month'
    ? format(endOfMonth(now), 'yyyy-MM-dd')
    : format(endOfYear(now), 'yyyy-MM-dd');

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['personal-expenses', startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('personal_transactions')
        .select('*')
        .eq('transaction_type', 'expense')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: false });
      return data || [];
    },
  });

  const addExpense = useMutation({
    mutationFn: async (form: FormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('personal_transactions').insert([{
        transaction_type: 'expense',
        transaction_date: form.get('date') as string,
        amount: Number(form.get('amount')),
        category: form.get('category') as string,
        merchant: (form.get('merchant') as string) || null,
        description: (form.get('description') as string) || null,
        payment_method: (form.get('payment_method') as string) || null,
        user_id: user.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['personal-transactions'] });
      toast.success('Expense added');
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalSpend = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Personal Expenses</h3>
          <p className="text-sm text-muted-foreground">
            Total: <span className="font-bold text-foreground">${totalSpend.toLocaleString()}</span> ({period === 'month' ? 'this month' : 'this year'})
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as 'month' | 'year')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="year">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <ExportButton data={expenses as Record<string, unknown>[]} filename="personal-expenses" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Expense</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Personal Expense</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addExpense.mutate(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <Input name="date" type="date" required defaultValue={format(now, 'yyyy-MM-dd')} />
                <Input name="amount" type="number" step="0.01" placeholder="Amount" required />
                <Select name="category" required>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {PERSONAL_EXPENSE_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input name="merchant" placeholder="Merchant / Vendor" />
                <Input name="description" placeholder="Description (optional)" />
                <Select name="payment_method">
                  <SelectTrigger><SelectValue placeholder="Payment Method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="debit">Debit Card</SelectItem>
                    <SelectItem value="credit">Credit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={addExpense.isPending} className="w-full">
                  {addExpense.isPending ? 'Adding...' : 'Add Expense'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Category Rollup */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(categoryTotals)
          .sort(([, a], [, b]) => b - a)
          .map(([cat, amount]) => (
            <Card key={cat} className="bg-card/50">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground capitalize">{cat}</p>
                <p className="text-lg font-bold">${amount.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Expense List */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Recent Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses recorded for this period.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {exp.merchant || exp.description || 'Expense'}
                      </span>
                      <Badge variant="outline" className="text-[10px] capitalize">{exp.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(exp.transaction_date), 'MMM d, yyyy')}
                      {exp.payment_method && ` · ${exp.payment_method}`}
                    </p>
                  </div>
                  <span className="font-semibold text-red-400">-${Number(exp.amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
