import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { PiggyBank, Plus, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

const ASSET_CATEGORIES = [
  { key: 'cash', label: 'Cash & Checking' },
  { key: 'savings', label: 'Savings Accounts' },
  { key: 'investments', label: 'Investments (Stocks, Funds)' },
  { key: 'retirement', label: 'Retirement Accounts' },
  { key: 'businesses', label: 'Business Equity (Est.)' },
  { key: 'real_estate', label: 'Real Estate' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'other_assets', label: 'Other Assets' },
];

const LIABILITY_CATEGORIES = [
  { key: 'mortgage', label: 'Mortgage' },
  { key: 'auto_loan', label: 'Auto Loans' },
  { key: 'credit_cards', label: 'Credit Card Debt' },
  { key: 'student_loans', label: 'Student Loans' },
  { key: 'personal_loans', label: 'Personal Loans' },
  { key: 'business_debt', label: 'Business Debt' },
  { key: 'other_liabilities', label: 'Other Liabilities' },
];

export default function PersonalNetWorth() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['networth-snapshots'],
    queryFn: async () => {
      const { data } = await supabase
        .from('networth_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(12);
      return data || [];
    },
  });

  const saveSnapshot = useMutation({
    mutationFn: async (form: FormData) => {
      const assetsBreakdown: Record<string, number> = {};
      let totalAssets = 0;
      ASSET_CATEGORIES.forEach(cat => {
        const val = Number(form.get(`asset_${cat.key}`)) || 0;
        assetsBreakdown[cat.key] = val;
        totalAssets += val;
      });

      const liabilitiesBreakdown: Record<string, number> = {};
      let totalLiabilities = 0;
      LIABILITY_CATEGORIES.forEach(cat => {
        const val = Number(form.get(`liability_${cat.key}`)) || 0;
        liabilitiesBreakdown[cat.key] = val;
        totalLiabilities += val;
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('networth_snapshots').insert([{
        snapshot_date: format(new Date(), 'yyyy-MM-dd'),
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        assets_breakdown: assetsBreakdown,
        liabilities_breakdown: liabilitiesBreakdown,
        notes: (form.get('notes') as string) || null,
        user_id: user.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networth-snapshots'] });
      toast.success('Net worth snapshot saved');
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const latest = snapshots[0];
  const previous = snapshots[1];
  const netWorth = latest ? Number(latest.total_assets) - Number(latest.total_liabilities) : 0;
  const prevNetWorth = previous ? Number(previous.total_assets) - Number(previous.total_liabilities) : 0;
  const change = previous ? netWorth - prevNetWorth : 0;

  const latestAssets = (latest?.assets_breakdown || {}) as Record<string, number>;
  const latestLiabilities = (latest?.liabilities_breakdown || {}) as Record<string, number>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Net Worth Tracker</h3>
          <p className="text-sm text-muted-foreground">
            {latest ? `Last updated: ${format(new Date(latest.snapshot_date), 'MMM d, yyyy')}` : 'No snapshots yet'}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Snapshot</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Net Worth Snapshot</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveSnapshot.mutate(new FormData(e.currentTarget)); }} className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-emerald-400 mb-3">Assets</h4>
                <div className="space-y-2">
                  {ASSET_CATEGORIES.map(cat => (
                    <div key={cat.key} className="flex items-center gap-3">
                      <label className="text-sm w-48">{cat.label}</label>
                      <Input
                        name={`asset_${cat.key}`}
                        type="number"
                        step="0.01"
                        placeholder="$0"
                        defaultValue={latestAssets[cat.key] || ''}
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-red-400 mb-3">Liabilities</h4>
                <div className="space-y-2">
                  {LIABILITY_CATEGORIES.map(cat => (
                    <div key={cat.key} className="flex items-center gap-3">
                      <label className="text-sm w-48">{cat.label}</label>
                      <Input
                        name={`liability_${cat.key}`}
                        type="number"
                        step="0.01"
                        placeholder="$0"
                        defaultValue={latestLiabilities[cat.key] || ''}
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <Input name="notes" placeholder="Notes (optional)" />
              <Button type="submit" disabled={saveSnapshot.isPending} className="w-full">
                {saveSnapshot.isPending ? 'Saving...' : 'Save Snapshot'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Net Worth Hero */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground uppercase tracking-wider">Total Net Worth</p>
            <p className={`text-4xl font-bold mt-2 ${netWorth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${netWorth.toLocaleString()}
            </p>
            {previous && (
              <div className="flex items-center justify-center gap-1 mt-2">
                {change >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
                <span className={`text-sm ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {change >= 0 ? '+' : ''}${change.toLocaleString()} since last snapshot
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assets & Liabilities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-emerald-400">Assets — ${latest ? Number(latest.total_assets).toLocaleString() : '0'}</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(latestAssets).length === 0 ? (
              <p className="text-sm text-muted-foreground">No assets recorded.</p>
            ) : (
              <div className="space-y-2">
                {ASSET_CATEGORIES.filter(c => (latestAssets[c.key] || 0) > 0).map(cat => (
                  <div key={cat.key} className="flex justify-between p-2 bg-muted/30 rounded-lg">
                    <span className="text-sm">{cat.label}</span>
                    <span className="text-sm font-medium text-emerald-400">${(latestAssets[cat.key] || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-400">Liabilities — ${latest ? Number(latest.total_liabilities).toLocaleString() : '0'}</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(latestLiabilities).length === 0 ? (
              <p className="text-sm text-muted-foreground">No liabilities recorded.</p>
            ) : (
              <div className="space-y-2">
                {LIABILITY_CATEGORIES.filter(c => (latestLiabilities[c.key] || 0) > 0).map(cat => (
                  <div key={cat.key} className="flex justify-between p-2 bg-muted/30 rounded-lg">
                    <span className="text-sm">{cat.label}</span>
                    <span className="text-sm font-medium text-red-400">${(latestLiabilities[cat.key] || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Snapshot History */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Snapshot History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No snapshots yet. Create your first one above.</p>
          ) : (
            <div className="space-y-2">
              {snapshots.map((snap, i) => {
                const nw = Number(snap.total_assets) - Number(snap.total_liabilities);
                const prevSnap = snapshots[i + 1];
                const prevNw = prevSnap ? Number(prevSnap.total_assets) - Number(prevSnap.total_liabilities) : null;
                const diff = prevNw !== null ? nw - prevNw : null;
                return (
                  <div key={snap.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <span className="text-sm font-medium">{format(new Date(snap.snapshot_date), 'MMM d, yyyy')}</span>
                      {snap.notes && <p className="text-xs text-muted-foreground">{snap.notes}</p>}
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${nw >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        ${nw.toLocaleString()}
                      </span>
                      {diff !== null && (
                        <p className={`text-xs ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {diff >= 0 ? '+' : ''}{diff.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
