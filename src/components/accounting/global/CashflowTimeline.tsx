import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Loader2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { format, subMonths, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import {
  useFinancialSnapshots,
  useBusinessEntities,
} from '@/hooks/useGlobalFinancialData';

type ViewMode = '6m' | '12m';

interface CashflowMonth {
  month: string;
  label: string;
  inflows: number;
  outflows: number;
  net: number;
  hasGap: boolean;
  confidence: number;
  businessCount: number;
}

export default function CashflowTimeline() {
  const [view, setView] = useState<ViewMode>('6m');
  const months = view === '6m' ? 6 : 12;
  const { data: snapshots, isLoading: snapLoading } = useFinancialSnapshots(months);
  const { data: businesses, isLoading: bizLoading } = useBusinessEntities();

  const isLoading = snapLoading || bizLoading;

  const timeline: CashflowMonth[] = useMemo(() => {
    const now = new Date();
    const startDate = startOfMonth(subMonths(now, months - 1));
    const monthIntervals = eachMonthOfInterval({ start: startDate, end: endOfMonth(now) });

    return monthIntervals.map(monthDate => {
      const monthStr = format(monthDate, 'yyyy-MM');
      const monthLabel = format(monthDate, 'MMM yy');

      // Aggregate snapshots for this month
      const monthSnapshots = (snapshots || []).filter(s => s.snapshot_date.startsWith(monthStr));

      const inflows = monthSnapshots.reduce((s, sn) => s + sn.total_revenue, 0);
      const outflows = monthSnapshots.reduce((s, sn) => s + sn.total_expenses, 0);
      const avgConf = monthSnapshots.length > 0
        ? Math.round(monthSnapshots.reduce((s, sn) => s + sn.confidence_score, 0) / monthSnapshots.length)
        : 0;

      const uniqueBiz = new Set(monthSnapshots.map(s => s.business_id));

      return {
        month: monthStr,
        label: monthLabel,
        inflows,
        outflows,
        net: inflows - outflows,
        hasGap: monthSnapshots.length === 0,
        confidence: avgConf,
        businessCount: uniqueBiz.size,
      };
    });
  }, [snapshots, months]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const gapMonths = timeline.filter(m => m.hasGap);
  const totalInflows = timeline.reduce((s, m) => s + m.inflows, 0);
  const totalOutflows = timeline.reduce((s, m) => s + m.outflows, 0);
  const avgMonthlyNet = timeline.length > 0 ? (totalInflows - totalOutflows) / timeline.length : 0;
  const activeBizCount = (businesses || []).filter(b => b.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Cashflow Timeline
          </h2>
          <p className="text-sm text-muted-foreground">Monthly inflows vs outflows — dynasty-wide (snapshot-based)</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === '6m' ? 'default' : 'outline'} size="sm" onClick={() => setView('6m')}>6 Months</Button>
          <Button variant={view === '12m' ? 'default' : 'outline'} size="sm" onClick={() => setView('12m')}>12 Months</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Inflows</p>
            <p className="text-xl font-bold text-emerald-400">${totalInflows.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Outflows</p>
            <p className="text-xl font-bold text-red-400">${totalOutflows.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Avg Monthly Net</p>
            <p className={`text-xl font-bold ${avgMonthlyNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${Math.round(avgMonthlyNet).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Data Gaps</p>
            <p className={`text-xl font-bold ${gapMonths.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {gapMonths.length > 0 ? `${gapMonths.length} month${gapMonths.length > 1 ? 's' : ''}` : 'None'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gap + Empty State Warnings */}
      {gapMonths.length === timeline.length && (
        <Card className="border-amber-500/20 bg-amber-950/10">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-amber-300">
                No financial snapshots found. Cashflow will populate as businesses report data via snapshots or manual entry.
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeBizCount} businesses registered • Submit snapshots to activate this view
            </p>
          </CardContent>
        </Card>
      )}

      {gapMonths.length > 0 && gapMonths.length < timeline.length && (
        <Card className="border-amber-500/20 bg-amber-950/10">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-amber-300">
                Data gaps: {gapMonths.map(m => m.label).join(', ')}
              </span>
              <Badge variant="outline" className="border-amber-500/50 text-amber-300 text-[10px] ml-auto">Needs Data</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      <Card>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={timeline} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
              />
              <Legend />
              <Bar dataKey="inflows" fill="hsl(142, 76%, 36%)" name="Inflows" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outflows" fill="hsl(0, 84%, 60%)" name="Outflows" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Detail */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...timeline].reverse().map(m => (
              <div key={m.month} className={`flex items-center gap-3 p-3 rounded-lg ${m.hasGap ? 'bg-amber-950/10 border border-amber-500/20' : 'bg-muted/30'}`}>
                <span className="text-sm font-medium w-16">{m.label}</span>
                <div className="flex-1 flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    <span className="text-sm text-emerald-400">${m.inflows.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-red-500" />
                    <span className="text-sm text-red-400">${m.outflows.toLocaleString()}</span>
                  </div>
                  {m.businessCount > 0 && (
                    <span className="text-[10px] text-muted-foreground">{m.businessCount} biz reporting</span>
                  )}
                </div>
                <span className={`font-bold text-sm ${m.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {m.hasGap ? (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-300 text-[10px]">No Snapshots</Badge>
                  ) : (
                    `$${m.net.toLocaleString()}`
                  )}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
