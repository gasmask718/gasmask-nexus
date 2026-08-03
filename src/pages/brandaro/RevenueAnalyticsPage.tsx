import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, TrendingUp, DollarSign, CalendarDays, CalendarRange } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { dynastyDateTime } from '@/lib/dates';

type RevenueRow = {
  id: string;
  lead_id: string | null;
  revenue_amount: number;
  revenue_type: string;
  attributed_script_variant: string | null;
  attributed_industry: string | null;
  attributed_campaign: string | null;
  created_at: string;
};

type RangeKey = 'week' | 'month' | 'last_month' | 'all';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'all', label: 'All Time' },
];

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Subscription states that count toward the live monthly run-rate. */
const ACTIVE_SUB_STATUSES = ['active', 'trialing', 'past_due'];

export default function RevenueAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [range, setRange] = useState<RangeKey>('all');
  const [mrr, setMrr] = useState(0);
  const [activeSubs, setActiveSubs] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [ledger, subs] = await Promise.all([
        (supabase as any)
          .from('brandaro_revenue_tracking')
          .select('*')
          .order('created_at', { ascending: false }),
        // TRUE run-rate: sum of currently active subscriptions, the same source
        // brandaro_clients.monthly_recurring is computed from. Never sum
        // historical "recurring-typed" ledger rows — those are cash collected.
        (supabase as any)
          .from('brandaro_subscriptions')
          .select('monthly_fee, status')
          .in('status', ACTIVE_SUB_STATUSES),
      ]);
      setRows((ledger.data as RevenueRow[]) || []);
      const subRows = (subs.data as { monthly_fee: number | null }[]) || [];
      setMrr(subRows.reduce((sum, s) => sum + (Number(s.monthly_fee) || 0), 0));
      setActiveSubs(subRows.length);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const weekStart = startOfWeek(now);
    let total = 0, month = 0, week = 0;
    for (const r of rows) {
      const amt = Number(r.revenue_amount) || 0;
      total += amt;
      const created = new Date(r.created_at);
      if (created >= monthStart) month += amt;
      if (created >= weekStart) week += amt;
    }
    return { total, month, week };
  }, [rows]);


  const filtered = useMemo(() => {
    if (range === 'all') return rows;
    const now = new Date();
    let start: Date;
    let end: Date | null = null;
    if (range === 'week') start = startOfWeek(now);
    else if (range === 'month') start = startOfMonth(now);
    else {
      // last_month
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = startOfMonth(now);
    }
    return rows.filter(r => {
      const c = new Date(r.created_at);
      if (c < start) return false;
      if (end && c >= end) return false;
      return true;
    });
  }, [rows, range]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const statCards = [
    { label: 'Total Revenue', value: formatCurrency(stats.total), icon: DollarSign, sub: 'Cash collected, all time' },
    { label: 'This Month', value: formatCurrency(stats.month), icon: CalendarRange, sub: 'Cash collected this month' },
    {
      label: 'MRR',
      value: formatCurrency(mrr),
      icon: TrendingUp,
      sub: `${activeSubs} active subscription${activeSubs === 1 ? '' : 's'}`,
    },
    { label: 'This Week', value: formatCurrency(stats.week), icon: CalendarDays, sub: 'Cash collected this week' },
  ];


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revenue Analytics</h1>
        <p className="text-muted-foreground">Confirmed payments tracked in Brandaro revenue ledger</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(m => (
          <Card key={m.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <m.icon className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg">Transactions</CardTitle>
          <div className="flex flex-wrap gap-1">
            {RANGE_OPTIONS.map(opt => (
              <Button
                key={opt.key}
                size="sm"
                variant={range === opt.key ? 'default' : 'outline'}
                onClick={() => setRange(opt.key)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No revenue recorded yet.</p>
              <p className="text-sm">Revenue appears here when payments are confirmed.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">{dynastyDateTime(r.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {(r.revenue_type || '').replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(Number(r.revenue_amount) || 0)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.attributed_campaign || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.attributed_industry || r.attributed_script_variant || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
