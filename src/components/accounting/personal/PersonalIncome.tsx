import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Banknote, Calendar, TrendingUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { ExportButton } from '@/components/crud/ExportButton';

const INCOME_CATEGORIES = [
  'Owner Draw', 'Salary', 'Investment Income', 'Dividends', 'Other Income',
];

export default function PersonalIncome() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

  const { data: income = [], isLoading } = useQuery({
    queryKey: ['personal-income', monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('personal_transactions')
        .select('*')
        .eq('transaction_type', 'income')
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd)
        .order('transaction_date', { ascending: false });
      return data || [];
    },
  });

  const addIncome = useMutation({
    mutationFn: async (form: FormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const category = form.get('category') as string;
      const amount = Number(form.get('amount'));
      const date = form.get('date') as string;
      const description = form.get('description') as string;

      // Insert personal income
      const { error } = await supabase.from('personal_transactions').insert([{
        transaction_type: 'income',
        transaction_date: date,
        amount,
        category,
        description: description || null,
        user_id: user.id,
      }]);
      if (error) throw error;

      // If owner draw, also log a linked business expense
      if (category === 'owner draw') {
        await supabase.from('accounting_ledger').insert({
          amount,
          direction: 'out',
          source_type: 'owner_draw',
          category: 'Owner Draw',
          notes: `Owner draw: ${description || 'Transfer to personal'}`,
          created_at: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-income'] });
      queryClient.invalidateQueries({ queryKey: ['personal-transactions'] });
      toast.success('Income recorded');
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalIncome = income.reduce((s, t) => s + Number(t.amount), 0);
  const byCategory = income.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Personal Income</h3>
          <p className="text-sm text-muted-foreground">
            Total this month: <span className="font-bold text-emerald-400">${totalIncome.toLocaleString()}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={income as Record<string, unknown>[]} filename="personal-income" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Income</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Personal Income</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); addIncome.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
                <Input name="date" type="date" required defaultValue={format(now, 'yyyy-MM-dd')} />
                <Input name="amount" type="number" step="0.01" placeholder="Amount" required />
                <Select name="category" required>
                  <SelectTrigger><SelectValue placeholder="Income Type" /></SelectTrigger>
                  <SelectContent>
                    {INCOME_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input name="description" placeholder="Description / Source" />
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200">
                  <strong>Owner Draws</strong> will be logged in BOTH personal income AND business ledger (outflow) to maintain ledger separation.
                </div>
                <Button type="submit" disabled={addIncome.isPending} className="w-full">
                  {addIncome.isPending ? 'Recording...' : 'Record Income'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Income by Source */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(byCategory)
          .sort(([, a], [, b]) => b - a)
          .map(([cat, amount]) => (
            <Card key={cat} className="bg-card/50">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground capitalize">{cat}</p>
                <p className="text-lg font-bold text-emerald-400">${amount.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Income List */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            Income Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : income.length === 0 ? (
            <p className="text-sm text-muted-foreground">No income recorded this month.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {income.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.description || item.category}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{item.category}</Badge>
                      {item.category === 'owner draw' && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-300">Dual Ledger</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {format(new Date(item.transaction_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <span className="font-semibold text-emerald-400">+${Number(item.amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
