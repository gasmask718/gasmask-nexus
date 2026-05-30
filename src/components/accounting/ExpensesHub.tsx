import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Receipt, Plus, Download, Loader2, DollarSign,
  TrendingDown, Package, Filter,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const EXPENSE_TEMPLATES = [
  'Office Pay (Weekly)', 'Tubes', 'Heat Guns', 'Shredders',
  'Worker Pay', 'Garbage Bags', 'Air Fresheners', 'Cleaning Products',
  'Filtration Masks', 'Packaging', 'Gas/Fuel', 'Insurance',
  'Rent', 'Utilities', 'Supplies', 'Marketing', 'Software', 'Other',
];

interface ExpenseEntry {
  id: string;
  expense_date: string;
  amount: number;
  category: string;
  vendor: string | null;
  description: string | null;
  payment_method: string | null;
  recurring: boolean;
  brand: string | null;
  receipt_url: string | null;
}

function useExpenses(month: Date) {
  const start = format(startOfMonth(month), 'yyyy-MM-dd');
  const end = format(endOfMonth(month), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['accounting-expenses', start, end],
    queryFn: async (): Promise<ExpenseEntry[]> => {
      const { data, error } = await supabase
        .from('business_expenses')
        .select('*')
        .gte('expense_date', start)
        .lte('expense_date', end)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      return (data || []).map(e => ({
        id: e.id,
        expense_date: e.expense_date,
        amount: Number(e.amount),
        category: e.category || 'Uncategorized',
        vendor: e.vendor,
        description: e.description,
        payment_method: e.payment_method,
        recurring: e.recurring || false,
        brand: e.brand,
        receipt_url: e.receipt_url,
      }));
    },
  });
}

function useAddExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (expense: {
      expense_date: string;
      amount: number;
      category: string;
      vendor?: string;
      description?: string;
      payment_method?: string;
      brand?: string;
    }) => {
      const { error } = await supabase.from('business_expenses').insert(expense);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-expenses'] });
      toast.success('Expense added');
    },
    onError: (err: Error) => {
      toast.error('Failed to add expense: ' + err.message);
    },
  });
}

export default function ExpensesHub() {
  const [month, setMonth] = useState(new Date());
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newExpense, setNewExpense] = useState({
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    category: '',
    vendor: '',
    description: '',
    payment_method: 'cash',
    brand: '',
  });

  const { data: expenses, isLoading } = useExpenses(month);
  const addMutation = useAddExpense();

  const filtered = (expenses || []).filter(e =>
    categoryFilter === 'all' || e.category === categoryFilter
  );

  // Group by category
  const byCategory = filtered.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);
  const categories = [...new Set((expenses || []).map(e => e.category))].sort();

  const handleSubmit = () => {
    if (!newExpense.amount || !newExpense.category) {
      toast.error('Amount and category are required');
      return;
    }
    addMutation.mutate({
      expense_date: newExpense.expense_date,
      amount: parseFloat(newExpense.amount),
      category: newExpense.category,
      vendor: newExpense.vendor || undefined,
      description: newExpense.description || undefined,
      payment_method: newExpense.payment_method || undefined,
      brand: newExpense.brand || undefined,
    });
    setShowAdd(false);
    setNewExpense({
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      amount: '', category: '', vendor: '', description: '', payment_method: 'cash', brand: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-red-500" />
            Expenses & COGS
          </h2>
          <p className="text-sm text-muted-foreground">
            Track operational expenses, COGS, and receipts • {format(month, 'MMMM yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonth(subMonths(month, 1))}>
            ← Prev
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>
            This Month
          </Button>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Expense</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={newExpense.expense_date}
                      onChange={e => setNewExpense(p => ({ ...p, expense_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Amount ($)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={newExpense.amount}
                      onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={newExpense.category} onValueChange={v => setNewExpense(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_TEMPLATES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Vendor</Label>
                    <Input
                      placeholder="e.g. Home Depot"
                      value={newExpense.vendor}
                      onChange={e => setNewExpense(p => ({ ...p, vendor: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Payment Method</Label>
                    <Select value={newExpense.payment_method} onValueChange={v => setNewExpense(p => ({ ...p, payment_method: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="zelle">Zelle</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="ach">ACH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    placeholder="What was this expense for?"
                    value={newExpense.description}
                    onChange={e => setNewExpense(p => ({ ...p, description: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={addMutation.isPending}>
                  {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add Expense
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/50 col-span-2 md:col-span-1">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total This Month</p>
            <p className="text-2xl font-bold text-red-500">${totalExpenses.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{filtered.length} entries</p>
          </CardContent>
        </Card>
        {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cat, amt]) => (
          <Card key={cat} className="bg-card/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground truncate">{cat}</p>
              <p className="text-lg font-bold">${amt.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                {totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(0) : 0}% of total
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Expense List */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map(expense => (
                <div key={expense.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{expense.category}</p>
                      {expense.recurring && <Badge variant="outline" className="text-[10px] py-0">Recurring</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{format(new Date(expense.expense_date), 'MMM d, yyyy')}</span>
                      {expense.vendor && <span>• {expense.vendor}</span>}
                      {expense.payment_method && <span>• {expense.payment_method}</span>}
                    </div>
                    {expense.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{expense.description}</p>
                    )}
                  </div>
                  <p className="font-bold text-red-500">${expense.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No expenses for this period</p>
              <Button className="mt-3" size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Expense
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
