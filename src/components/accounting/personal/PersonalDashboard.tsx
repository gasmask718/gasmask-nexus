import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Wallet, TrendingUp, TrendingDown, DollarSign,
  ShieldCheck, PiggyBank, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

function usePersonalDashboardData() {
  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
  const prevStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
  const prevEnd = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');

  const currentMonth = useQuery({
    queryKey: ['personal-transactions', 'current', monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('personal_transactions')
        .select('*')
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd)
        .order('transaction_date', { ascending: false });
      return data || [];
    },
  });

  const prevMonth = useQuery({
    queryKey: ['personal-transactions', 'prev', prevStart, prevEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('personal_transactions')
        .select('*')
        .gte('transaction_date', prevStart)
        .lte('transaction_date', prevEnd);
      return data || [];
    },
  });

  const netWorth = useQuery({
    queryKey: ['networth-latest'],
    queryFn: async () => {
      const { data } = await supabase
        .from('networth_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
  });

  return { currentMonth, prevMonth, netWorth };
}

export default function PersonalDashboard() {
  const { currentMonth, prevMonth, netWorth } = usePersonalDashboardData();
  const txns = currentMonth.data || [];
  const prevTxns = prevMonth.data || [];

  const stats = useMemo(() => {
    const expenses = txns.filter(t => t.transaction_type === 'expense');
    const income = txns.filter(t => t.transaction_type === 'income');
    const totalSpend = expenses.reduce((s, t) => s + Number(t.amount), 0);
    const totalIncome = income.reduce((s, t) => s + Number(t.amount), 0);
    const netCashflow = totalIncome - totalSpend;

    const prevExpenses = prevTxns.filter(t => t.transaction_type === 'expense');
    const prevSpend = prevExpenses.reduce((s, t) => s + Number(t.amount), 0);

    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dayOfMonth = new Date().getDate();
    const burnRate = dayOfMonth > 0 ? (totalSpend / dayOfMonth) * daysInMonth : 0;

    const spendByCategory: Record<string, number> = {};
    expenses.forEach(t => {
      spendByCategory[t.category] = (spendByCategory[t.category] || 0) + Number(t.amount);
    });

    // Safe owner draw = business revenue that can safely flow to personal
    // Simplified: net cashflow positive means safe
    const safeDrawIndicator = netCashflow > 0 ? 'safe' : netCashflow > -1000 ? 'caution' : 'danger';

    return {
      totalSpend,
      totalIncome,
      netCashflow,
      burnRate,
      prevSpend,
      spendChange: prevSpend > 0 ? ((totalSpend - prevSpend) / prevSpend) * 100 : 0,
      spendByCategory,
      safeDrawIndicator,
    };
  }, [txns, prevTxns]);

  const nw = netWorth.data;
  const netWorthTotal = nw ? Number(nw.total_assets) - Number(nw.total_liabilities) : 0;

  const kpiCards = [
    {
      title: 'Monthly Spend',
      value: `$${stats.totalSpend.toLocaleString()}`,
      icon: Wallet,
      change: stats.spendChange,
      changeLabel: 'vs last month',
      color: 'text-red-400',
    },
    {
      title: 'Net Cashflow',
      value: `$${stats.netCashflow.toLocaleString()}`,
      icon: stats.netCashflow >= 0 ? TrendingUp : TrendingDown,
      color: stats.netCashflow >= 0 ? 'text-emerald-400' : 'text-red-400',
    },
    {
      title: 'Burn Rate (Projected)',
      value: `$${Math.round(stats.burnRate).toLocaleString()}/mo`,
      icon: DollarSign,
      color: 'text-amber-400',
    },
    {
      title: 'Net Worth',
      value: nw ? `$${netWorthTotal.toLocaleString()}` : 'Not set',
      icon: PiggyBank,
      color: 'text-blue-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{kpi.title}</p>
                  <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                  {kpi.change !== undefined && (
                    <div className="flex items-center gap-1 mt-1">
                      {kpi.change > 0 ? (
                        <ArrowUpRight className="h-3 w-3 text-red-400" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-emerald-400" />
                      )}
                      <span className={`text-xs ${kpi.change > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {Math.abs(kpi.change).toFixed(1)}% {kpi.changeLabel}
                      </span>
                    </div>
                  )}
                </div>
                <kpi.icon className={`h-8 w-8 ${kpi.color} opacity-50`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Safe Owner Draw Indicator */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Safe Owner Draw Indicator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={
                stats.safeDrawIndicator === 'safe'
                  ? 'border-emerald-500/60 bg-emerald-900/40 text-emerald-200'
                  : stats.safeDrawIndicator === 'caution'
                  ? 'border-amber-500/60 bg-amber-900/40 text-amber-200'
                  : 'border-red-500/60 bg-red-900/40 text-red-200'
              }
            >
              {stats.safeDrawIndicator === 'safe' ? '✅ SAFE' : stats.safeDrawIndicator === 'caution' ? '⚠️ CAUTION' : '🚫 DANGER'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {stats.safeDrawIndicator === 'safe'
                ? 'Personal cashflow is positive. Owner draws are safe.'
                : stats.safeDrawIndicator === 'caution'
                ? 'Cashflow is tight. Limit owner draws.'
                : 'Spending exceeds income. Halt owner draws.'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Spending by Category */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Spending by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(stats.spendByCategory).length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions this month yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.spendByCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([category, amount]) => {
                  const pct = stats.totalSpend > 0 ? (amount / stats.totalSpend) * 100 : 0;
                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{category}</span>
                        <span className="font-medium">${amount.toLocaleString()} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
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
