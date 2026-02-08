import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Download, TrendingUp, Users, Loader2, Crown, Medal, Award } from 'lucide-react';
import { format, subDays, startOfMonth } from 'date-fns';

type TimeRange = '30' | '60' | '90' | 'lifetime';

interface TopSpender {
  entity_name: string;
  entity_type: string;
  total_paid: number;
  invoice_count: number;
  last_payment_date: string | null;
  brand: string | null;
}

function useTopSpenders(range: TimeRange) {
  return useQuery({
    queryKey: ['top-spenders', range],
    queryFn: async (): Promise<TopSpender[]> => {
      // Use accounting_ledger for authoritative data where direction = 'in'
      let query = supabase
        .from('accounting_ledger')
        .select('*')
        .eq('direction', 'in')
        .order('amount', { ascending: false });

      if (range !== 'lifetime') {
        const daysAgo = format(subDays(new Date(), parseInt(range)), 'yyyy-MM-dd');
        query = query.gte('created_at', daysAgo);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;

      // Aggregate by source
      const spenderMap = new Map<string, TopSpender>();
      (data || []).forEach(entry => {
        const key = entry.source_id || entry.notes || 'Unknown';
        const existing = spenderMap.get(key);
        if (existing) {
          existing.total_paid += Number(entry.amount);
          existing.invoice_count += 1;
        } else {
          spenderMap.set(key, {
            entity_name: entry.notes || entry.source_type || 'Unknown',
            entity_type: entry.source_type || 'unknown',
            total_paid: Number(entry.amount),
            invoice_count: 1,
            last_payment_date: entry.created_at,
            brand: entry.brand,
          });
        }
      });

      return Array.from(spenderMap.values())
        .sort((a, b) => b.total_paid - a.total_paid)
        .slice(0, 25);
    },
  });
}

function exportToCSV(data: TopSpender[], range: string) {
  const headers = ['Rank', 'Name', 'Type', 'Total Paid', 'Orders', 'Brand', 'Last Payment'];
  const rows = data.map((s, i) => [
    i + 1,
    s.entity_name,
    s.entity_type,
    s.total_paid.toFixed(2),
    s.invoice_count,
    s.brand || '-',
    s.last_payment_date ? format(new Date(s.last_payment_date), 'yyyy-MM-dd') : '-',
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `top-spenders-${range}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const rankIcons = [Crown, Medal, Award];

export default function TopSpendersReport() {
  const [range, setRange] = useState<TimeRange>('30');
  const { data: spenders, isLoading } = useTopSpenders(range);

  const totalRevenue = (spenders || []).reduce((s, sp) => s + sp.total_paid, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Top Spenders Report
          </h2>
          <p className="text-sm text-muted-foreground">
            Ranked by total spend — largest to smallest
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="lifetime">Lifetime</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={!spenders?.length}
            onClick={() => spenders && exportToCSV(spenders, range)}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Revenue ({range === 'lifetime' ? 'All Time' : `${range}d`})</p>
            <p className="text-2xl font-bold text-emerald-500">${totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Unique Spenders</p>
            <p className="text-2xl font-bold">{(spenders || []).length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Avg per Spender</p>
            <p className="text-2xl font-bold">
              ${(spenders?.length ? totalRevenue / spenders.length : 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Spenders Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Spending Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (spenders || []).length > 0 ? (
            <div className="space-y-2">
              {spenders!.map((spender, i) => {
                const RankIcon = rankIcons[i] || null;
                const pct = totalRevenue > 0 ? ((spender.total_paid / totalRevenue) * 100) : 0;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-8 text-center">
                      {RankIcon ? (
                        <RankIcon className={`h-5 w-5 mx-auto ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-zinc-400' : 'text-amber-700'}`} />
                      ) : (
                        <span className="text-sm text-muted-foreground font-mono">#{i + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{spender.entity_name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{spender.invoice_count} orders</span>
                        {spender.brand && (
                          <Badge variant="outline" className="text-[10px] py-0">{spender.brand}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${spender.total_paid.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% of total</p>
                    </div>
                    {/* Revenue bar */}
                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(pct * 2, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No transaction data found for this period</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
