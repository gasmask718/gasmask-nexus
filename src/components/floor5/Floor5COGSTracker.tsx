import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Package, Plus, Boxes, Flame, ShieldCheck, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { ExportButton } from '@/components/crud/ExportButton';

const COGS_CATEGORIES = [
  'Tubes', 'Bags', 'Packaging', 'Heat Guns', 'Shredders',
  'Garbage Bags', 'Air Fresheners', 'Cleaning Products',
  'Filtration Masks', 'Labels/Stickers', 'Display Materials',
  'Shipping Supplies', 'Raw Materials', 'Other Supplies',
];

export default function Floor5COGSTracker() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    category: '',
    vendor: '',
    description: '',
    brand: '',
  });

  const now = new Date();
  const start = format(startOfMonth(now), 'yyyy-MM-dd');
  const end = format(endOfMonth(now), 'yyyy-MM-dd');

  const { data: cogsExpenses, isLoading } = useQuery({
    queryKey: ['floor5-cogs', start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_expenses')
        .select('*')
        .gte('expense_date', start)
        .lte('expense_date', end)
        .in('category', COGS_CATEGORIES)
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
          brand: expense.brand || null,
          department: 'COGS',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor5-cogs'] });
      toast.success('COGS expense added');
      setDialogOpen(false);
      setForm({ expense_date: format(new Date(), 'yyyy-MM-dd'), amount: '', category: '', vendor: '', description: '', brand: '' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalCOGS = cogsExpenses?.reduce((s, e) => s + Number(e.amount), 0) || 0;

  const cogsByCategory = (cogsExpenses || []).reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Boxes className="h-5 w-5 text-amber-500" />
            COGS Tracker
          </h2>
          <p className="text-sm text-muted-foreground">Cost of Goods Sold — tubes, bags, packaging, supplies</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            data={(cogsExpenses || []) as Record<string, unknown>[]}
            filename="cogs-expenses"
            columns={[
              { key: 'expense_date', label: 'Date' },
              { key: 'category', label: 'Category' },
              { key: 'amount', label: 'Amount' },
              { key: 'vendor', label: 'Vendor' },
            ]}
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add COGS
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add COGS Expense</DialogTitle>
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
                      {COGS_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Vendor</Label>
                    <Input placeholder="Supplier name" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Brand</Label>
                    <Input placeholder="e.g. Grabba" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
                  </div>
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
                  {addMutation.isPending ? 'Saving...' : 'Add COGS Expense'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total COGS (This Month)</p>
            <p className="text-2xl font-bold text-amber-500">${totalCOGS.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{cogsExpenses?.length || 0} items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Top Category</p>
            {Object.entries(cogsByCategory).length > 0 ? (
              <>
                <p className="text-2xl font-bold">{Object.entries(cogsByCategory).sort((a, b) => b[1] - a[1])[0]?.[0]}</p>
                <p className="text-xs text-muted-foreground">
                  ${Object.entries(cogsByCategory).sort((a, b) => b[1] - a[1])[0]?.[1].toLocaleString()}
                </p>
              </>
            ) : (
              <p className="text-lg text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Categories Used</p>
            <p className="text-2xl font-bold">{Object.keys(cogsByCategory).length}</p>
            <p className="text-xs text-muted-foreground">of {COGS_CATEGORIES.length} tracked</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">COGS by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.entries(cogsByCategory).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(cogsByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => (
                  <div key={cat} className="flex items-center justify-between p-2 rounded hover:bg-accent/50">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{cat}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">${amount.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">
                        ({totalCOGS > 0 ? ((amount / totalCOGS) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No COGS recorded this month</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent COGS Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : cogsExpenses && cogsExpenses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Vendor</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Description</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {cogsExpenses.slice(0, 15).map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-accent/30">
                      <td className="py-2 px-2">{format(new Date(e.expense_date), 'MMM d, yyyy')}</td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-xs">{e.category}</Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{e.vendor || '—'}</td>
                      <td className="py-2 px-2 text-muted-foreground truncate max-w-[200px]">{e.description || '—'}</td>
                      <td className="py-2 px-2 text-right font-medium text-amber-500">${Number(e.amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No COGS entries yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
