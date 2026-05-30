import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Receipt, Plus, Wallet } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { ExportButton } from '@/components/crud/ExportButton';

const EXPENSE_CATEGORIES = [
  'Office Pay Weekly', 'Rent', 'Utilities', 'Insurance',
  'Marketing', 'Transportation', 'Legal', 'Software/SaaS',
  'Equipment', 'Maintenance', 'Professional Services',
  'Travel', 'Meals & Entertainment', 'Miscellaneous',
];

export default function Floor5ExpensesView() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    category: '',
    vendor: '',
    description: '',
    payment_method: '',
    brand: '',
  });

  const now = new Date();
  const start = format(startOfMonth(now), 'yyyy-MM-dd');
  const end = format(endOfMonth(now), 'yyyy-MM-dd');

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['floor5-expenses', start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_expenses')
        .select('*')
        .gte('expense_date', start)
        .lte('expense_date', end)
        .order('expense_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (expense: typeof form) => {
      const { error } = await supabase
        .from('business_expenses')
        .insert({
          expense_date: expense.expense_date,
          amount: parseFloat(expense.amount),
          category: expense.category,
          vendor: expense.vendor || null,
          description: expense.description || null,
          payment_method: expense.payment_method || null,
          brand: expense.brand || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor5-expenses'] });
      toast.success('Expense added');
      setDialogOpen(false);
      setForm({ expense_date: format(new Date(), 'yyyy-MM-dd'), amount: '', category: '', vendor: '', description: '', payment_method: '', brand: '' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalExpenses = expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0;

  const expensesByCategory = (expenses || []).reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-red-500" />
            Operational Expenses
          </h2>
          <p className="text-sm text-muted-foreground">Brand-level expense tracking (non-COGS)</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            data={(expenses || []) as Record<string, unknown>[]}
            filename="expenses"
            columns={[
              { key: 'expense_date', label: 'Date' },
              { key: 'category', label: 'Category' },
              { key: 'amount', label: 'Amount' },
              { key: 'vendor', label: 'Vendor' },
              { key: 'payment_method', label: 'Payment Method' },
            ]}
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Expense</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Amount ($)</Label>
                    <Input type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Vendor</Label>
                    <Input placeholder="Who" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Payment Method</Label>
                    <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Brand</Label>
                  <Input placeholder="e.g. Grabba, GasMask" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input placeholder="Notes..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <Button
                  className="w-full"
                  disabled={!form.amount || !form.category || addMutation.isPending}
                  onClick={() => addMutation.mutate(form)}
                >
                  {addMutation.isPending ? 'Saving...' : 'Add Expense'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Expenses (Month)</p>
            <p className="text-2xl font-bold text-red-500">${totalExpenses.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{expenses?.length || 0} entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Largest Category</p>
            {Object.entries(expensesByCategory).length > 0 ? (
              <>
                <p className="text-2xl font-bold">{Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1])[0][0]}</p>
                <p className="text-xs text-muted-foreground">${Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1])[0][1].toLocaleString()}</p>
              </>
            ) : (
              <p className="text-lg text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg per Entry</p>
            <p className="text-2xl font-bold">
              ${expenses && expenses.length > 0 ? (totalExpenses / expenses.length).toFixed(0) : '0'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Expenses This Month</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : expenses && expenses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Vendor</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Method</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Description</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.slice(0, 25).map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-accent/30">
                      <td className="py-2 px-2">{format(new Date(e.expense_date), 'MMM d, yyyy')}</td>
                      <td className="py-2 px-2"><Badge variant="outline" className="text-xs">{e.category}</Badge></td>
                      <td className="py-2 px-2 text-muted-foreground">{e.vendor || '—'}</td>
                      <td className="py-2 px-2 text-muted-foreground">{e.payment_method || '—'}</td>
                      <td className="py-2 px-2 text-muted-foreground truncate max-w-[200px]">{e.description || '—'}</td>
                      <td className="py-2 px-2 text-right font-medium text-red-500">${Number(e.amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No expenses this month</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
