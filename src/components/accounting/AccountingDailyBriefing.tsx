import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Users, Package, Calendar, ArrowRight,
  Loader2, RefreshCw,
} from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth, subDays } from 'date-fns';

interface BriefingData {
  madeToday: number;
  madeWTD: number;
  madeMTD: number;
  tubesSoldWTD: number;
  tubesSoldMTD: number;
  unpaidAccounts: Array<{ name: string; amount: number; days_overdue: number }>;
  paidToday: Array<{ name: string; amount: number }>;
  followUpsDue: Array<{ name: string; next_action: string; amount: number }>;
  topSpenders: Array<{ name: string; total: number }>;
  totalOutstanding: number;
  totalOverdue: number;
  netProfit: number;
  expensesMTD: number;
}

function useDailyBriefing() {
  return useQuery({
    queryKey: ['accounting-daily-briefing'],
    queryFn: async (): Promise<BriefingData> => {
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      const wtdStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const mtdStart = format(startOfMonth(now), 'yyyy-MM-dd');

      const [
        { data: todayTx },
        { data: wtdTx },
        { data: mtdTx },
        { data: unpaidAccounts },
        { data: followUps },
        { data: expensesMTD },
      ] = await Promise.all([
        supabase.from('business_transactions').select('*').gte('transaction_date', todayStr),
        supabase.from('business_transactions').select('*').gte('transaction_date', wtdStart),
        supabase.from('business_transactions').select('*').gte('transaction_date', mtdStart),
        supabase.from('collection_accounts').select('*').neq('status', 'closed').order('total_overdue', { ascending: false }).limit(10),
        supabase.from('collection_accounts').select('*').not('next_action_at', 'is', null).lte('next_action_at', format(subDays(now, -14), 'yyyy-MM-dd\'T\'HH:mm:ss')).order('next_action_at', { ascending: true }).limit(10),
        supabase.from('business_expenses').select('amount').gte('expense_date', mtdStart),
      ]);

      const calcRevenue = (tx: any[]) => (tx || []).filter(t => t.transaction_type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const calcExpenses = (tx: any[]) => (tx || []).filter(t => t.transaction_type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

      // Count units (tubes/boxes) from descriptions/tags
      const countUnits = (tx: any[]) => (tx || []).filter(t => t.transaction_type === 'income').length;

      const madeToday = calcRevenue(todayTx || []);
      const madeMTD = calcRevenue(mtdTx || []);
      const expTotal = (expensesMTD || []).reduce((s, e) => s + Number(e.amount), 0);

      // Paid today = income transactions today
      const paidToday = (todayTx || [])
        .filter(t => t.transaction_type === 'income')
        .slice(0, 5)
        .map(t => ({ name: t.description || t.category || 'Payment', amount: Number(t.amount) }));

      return {
        madeToday,
        madeWTD: calcRevenue(wtdTx || []),
        madeMTD,
        tubesSoldWTD: countUnits(wtdTx || []),
        tubesSoldMTD: countUnits(mtdTx || []),
        unpaidAccounts: (unpaidAccounts || []).map(a => ({
          name: a.entity_name || 'Unknown',
          amount: Number(a.total_outstanding || 0),
          days_overdue: a.max_days_overdue || 0,
        })),
        paidToday,
        followUpsDue: (followUps || []).map(a => ({
          name: a.entity_name || 'Unknown',
          next_action: a.next_action_at ? format(new Date(a.next_action_at), 'MMM d') : 'TBD',
          amount: Number(a.total_outstanding || 0),
        })),
        topSpenders: [], // Populated by TopSpenders component
        totalOutstanding: (unpaidAccounts || []).reduce((s, a) => s + Number(a.total_outstanding || 0), 0),
        totalOverdue: (unpaidAccounts || []).reduce((s, a) => s + Number(a.total_overdue || 0), 0),
        netProfit: madeMTD - expTotal,
        expensesMTD: expTotal,
      };
    },
    refetchInterval: 120000, // 2 min
  });
}

export default function AccountingDailyBriefing() {
  const { data, isLoading, refetch } = useDailyBriefing();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const briefingLines = [
    { icon: DollarSign, label: 'Made Today', value: `$${data.madeToday.toLocaleString()}`, color: 'text-emerald-500' },
    { icon: TrendingUp, label: 'Made WTD', value: `$${data.madeWTD.toLocaleString()}`, color: 'text-emerald-400' },
    { icon: TrendingUp, label: 'Made MTD', value: `$${data.madeMTD.toLocaleString()}`, color: 'text-emerald-400' },
    { icon: Package, label: 'Orders WTD', value: `${data.tubesSoldWTD}`, color: 'text-blue-400' },
    { icon: Package, label: 'Orders MTD', value: `${data.tubesSoldMTD}`, color: 'text-blue-400' },
    { icon: AlertTriangle, label: 'Outstanding', value: `$${data.totalOutstanding.toLocaleString()}`, color: 'text-orange-500' },
    { icon: TrendingDown, label: 'Expenses MTD', value: `$${data.expensesMTD.toLocaleString()}`, color: 'text-red-400' },
    { icon: DollarSign, label: 'Net Profit Est.', value: `$${data.netProfit.toLocaleString()}`, color: data.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">📊 Daily Accountant Briefing</h2>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d, yyyy')} — Auto-generated from live data
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {briefingLines.map((line, i) => (
          <Card key={i} className="bg-card/50">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <line.icon className={`h-4 w-4 ${line.color}`} />
                <span className="text-xs text-muted-foreground">{line.label}</span>
              </div>
              <p className={`text-lg font-bold ${line.color}`}>{line.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unpaid Accounts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Who Is Unpaid Today
            </CardTitle>
            <CardDescription className="text-xs">
              {data.unpaidAccounts.length} accounts • ${data.totalOutstanding.toLocaleString()} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.unpaidAccounts.length > 0 ? (
              <div className="space-y-2">
                {data.unpaidAccounts.map((account, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">{account.days_overdue}d overdue</p>
                    </div>
                    <span className="font-bold text-orange-500">${account.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-sm">All accounts current</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Paid Today */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Who Paid Today
            </CardTitle>
            <CardDescription className="text-xs">
              {data.paidToday.length} payments • ${data.madeToday.toLocaleString()} collected
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.paidToday.length > 0 ? (
              <div className="space-y-2">
                {data.paidToday.map((payment, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <p className="text-sm font-medium">{payment.name}</p>
                    <span className="font-bold text-emerald-500">${payment.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No payments recorded today yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Follow-ups Due */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Follow-ups Due (Next 14 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.followUpsDue.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.followUpsDue.map((fu, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{fu.name}</p>
                      <p className="text-xs text-muted-foreground">Due: {fu.next_action}</p>
                    </div>
                    <span className="font-medium text-sm">${fu.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No follow-ups scheduled</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
