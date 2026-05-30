import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWholesalerProfile } from "./useWholesalerProfile";
import { subDays, format, differenceInHours } from "date-fns";

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface PipelineStage {
  stage: string;
  label: string;
  count: number;
  amount: number;
  color: string;
}

export interface PerformanceMetrics {
  avgFulfillmentHours: number;
  onTimePercent: number;
  disputePercent: number;
  refundPercent: number;
  cancellationPercent: number;
  tier: 'Standard' | 'Silver' | 'Gold' | 'Platinum';
  tierProgress: string;
}

export interface TrendKPI {
  label: string;
  value: number;
  previousValue: number;
  trend: 'up' | 'down' | 'flat';
  trendPercent: number;
  format: 'currency' | 'number' | 'percent' | 'hours';
}

export function useWholesalerAnalytics() {
  const { profile } = useWholesalerProfile();

  // Revenue over time (30 days)
  const revenueQuery = useQuery({
    queryKey: ['wholesaler-revenue-chart', profile?.id],
    queryFn: async (): Promise<RevenueDataPoint[]> => {
      if (!profile) return [];

      const since = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from('wholesaler_payouts')
        .select('amount, created_at')
        .eq('wholesaler_id', profile.id)
        .gte('created_at', since)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by date
      const byDate: Record<string, { revenue: number; orders: number }> = {};
      for (let i = 0; i < 30; i++) {
        const d = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd');
        byDate[d] = { revenue: 0, orders: 0 };
      }

      (data || []).forEach(row => {
        const d = format(new Date(row.created_at!), 'yyyy-MM-dd');
        if (byDate[d]) {
          byDate[d].revenue += Number(row.amount || 0);
          byDate[d].orders += 1;
        }
      });

      return Object.entries(byDate).map(([date, vals]) => ({
        date: format(new Date(date), 'MMM d, yyyy'),
        ...vals,
      }));
    },
    enabled: !!profile,
  });

  // Settlement pipeline breakdown
  const pipelineQuery = useQuery({
    queryKey: ['wholesaler-pipeline', profile?.id],
    queryFn: async (): Promise<PipelineStage[]> => {
      if (!profile) return [];

      const { data, error } = await supabase
        .from('wholesaler_payouts')
        .select('status, net_amount')
        .eq('wholesaler_id', profile.id);

      if (error) throw error;

      const stages: Record<string, { count: number; amount: number }> = {
        pending: { count: 0, amount: 0 },
        approved_pending_delivery: { count: 0, amount: 0 },
        in_settlement: { count: 0, amount: 0 },
        approved: { count: 0, amount: 0 },
        paid: { count: 0, amount: 0 },
      };

      (data || []).forEach(row => {
        const s = row.status || 'pending';
        if (stages[s]) {
          stages[s].count += 1;
          stages[s].amount += Number(row.net_amount || 0);
        }
      });

      const colorMap: Record<string, string> = {
        pending: '#f59e0b',
        approved_pending_delivery: '#a855f7',
        in_settlement: '#06b6d4',
        approved: '#3b82f6',
        paid: '#10b981',
      };

      const labelMap: Record<string, string> = {
        pending: 'Pending',
        approved_pending_delivery: 'Shipped',
        in_settlement: 'Settlement',
        approved: 'Approved',
        paid: 'Paid',
      };

      return Object.entries(stages).map(([stage, vals]) => ({
        stage,
        label: labelMap[stage] || stage,
        ...vals,
        color: colorMap[stage] || '#71717a',
      }));
    },
    enabled: !!profile,
  });

  // Dispute trend data
  const disputeTrendQuery = useQuery({
    queryKey: ['wholesaler-dispute-trend', profile?.id],
    queryFn: async () => {
      if (!profile) return [];

      const since = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from('wholesaler_payouts')
        .select('status, created_at')
        .eq('wholesaler_id', profile.id)
        .in('status', ['held', 'reversed'])
        .gte('created_at', since);

      if (error) throw error;

      const byDate: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        byDate[format(subDays(new Date(), 29 - i), 'MMM d, yyyy')] = 0;
      }

      (data || []).forEach(row => {
        const d = format(new Date(row.created_at!), 'MMM d, yyyy');
        if (byDate[d] !== undefined) byDate[d] += 1;
      });

      return Object.entries(byDate).map(([date, disputes]) => ({ date, disputes }));
    },
    enabled: !!profile,
  });

  // Performance metrics
  const performanceQuery = useQuery({
    queryKey: ['wholesaler-performance', profile?.id],
    queryFn: async (): Promise<PerformanceMetrics | null> => {
      if (!profile) return null;

      // Get fulfillment timing data
      const { data: fulfillments, error } = await supabase
        .from('marketplace_fulfillments')
        .select('status, created_at, updated_at')
        .eq('wholesaler_id', profile.id);

      if (error) throw error;

      const all = fulfillments || [];
      const completed = all.filter(f => f.status === 'completed');
      const total = all.length || 1;

      // Calculate avg fulfillment time (created → completed)
      let totalHours = 0;
      let onTimeCount = 0;
      completed.forEach(f => {
        const hours = differenceInHours(new Date(f.updated_at!), new Date(f.created_at!));
        totalHours += hours;
        if (hours <= 48) onTimeCount++;
      });
      const avgFulfillmentHours = completed.length > 0 ? totalHours / completed.length : 0;
      const onTimePercent = completed.length > 0 ? (onTimeCount / completed.length) * 100 : 100;

      // Dispute / reversal rates from payouts
      const { data: payouts } = await supabase
        .from('wholesaler_payouts')
        .select('status')
        .eq('wholesaler_id', profile.id);

      const payoutAll = payouts || [];
      const payoutTotal = payoutAll.length || 1;
      const disputePercent = (payoutAll.filter(p => p.status === 'held').length / payoutTotal) * 100;
      const refundPercent = (payoutAll.filter(p => p.status === 'reversed').length / payoutTotal) * 100;
      const cancellationPercent = 0; // Future: track cancellations

      // Determine tier
      let tier: PerformanceMetrics['tier'] = 'Standard';
      let tierProgress = 'Maintain 95% on-time to reach Silver';
      if (onTimePercent >= 99 && disputePercent < 1) {
        tier = 'Platinum';
        tierProgress = 'Top-tier vendor status achieved';
      } else if (onTimePercent >= 98 && disputePercent < 2) {
        tier = 'Gold';
        tierProgress = 'Maintain 99% on-time & <1% disputes for Platinum';
      } else if (onTimePercent >= 95 && disputePercent < 5) {
        tier = 'Silver';
        tierProgress = 'Maintain 98% on-time & <2% disputes for Gold';
      }

      return {
        avgFulfillmentHours,
        onTimePercent,
        disputePercent,
        refundPercent,
        cancellationPercent,
        tier,
        tierProgress,
      };
    },
    enabled: !!profile,
  });

  // Executive KPIs with trends
  const trendKPIsQuery = useQuery({
    queryKey: ['wholesaler-trend-kpis', profile?.id],
    queryFn: async (): Promise<TrendKPI[]> => {
      if (!profile) return [];

      const now = new Date();
      const periods = [
        { label: 'current', start: subDays(now, 7), end: now },
        { label: 'previous', start: subDays(now, 14), end: subDays(now, 7) },
      ];

      const fetchPeriod = async (start: Date, end: Date) => {
        const { data: payouts } = await supabase
          .from('wholesaler_payouts')
          .select('amount, net_amount, platform_fee, status, created_at')
          .eq('wholesaler_id', profile.id)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());

        const rows = payouts || [];
        return {
          grossSales: rows.reduce((s, r) => s + Number(r.amount || 0), 0),
          netEarnings: rows.reduce((s, r) => s + Number(r.net_amount || 0), 0),
          orderCount: rows.length,
          disputeCount: rows.filter(r => r.status === 'held' || r.status === 'reversed').length,
        };
      };

      const [current, previous] = await Promise.all([
        fetchPeriod(periods[0].start, periods[0].end),
        fetchPeriod(periods[1].start, periods[1].end),
      ]);

      const calcTrend = (curr: number, prev: number) => {
        if (prev === 0) return { trend: curr > 0 ? 'up' as const : 'flat' as const, pct: 0 };
        const pct = ((curr - prev) / prev) * 100;
        return { trend: pct > 0 ? 'up' as const : pct < 0 ? 'down' as const : 'flat' as const, pct: Math.abs(pct) };
      };

      const gross = calcTrend(current.grossSales, previous.grossSales);
      const net = calcTrend(current.netEarnings, previous.netEarnings);
      const orders = calcTrend(current.orderCount, previous.orderCount);

      return [
        { label: 'Gross Sales (7d)', value: current.grossSales, previousValue: previous.grossSales, trend: gross.trend, trendPercent: gross.pct, format: 'currency' },
        { label: 'Net Earnings (7d)', value: current.netEarnings, previousValue: previous.netEarnings, trend: net.trend, trendPercent: net.pct, format: 'currency' },
        { label: 'Orders (7d)', value: current.orderCount, previousValue: previous.orderCount, trend: orders.trend, trendPercent: orders.pct, format: 'number' },
        { label: 'Dispute Rate', value: current.orderCount > 0 ? (current.disputeCount / current.orderCount) * 100 : 0, previousValue: previous.orderCount > 0 ? (previous.disputeCount / previous.orderCount) * 100 : 0, trend: 'flat', trendPercent: 0, format: 'percent' },
      ];
    },
    enabled: !!profile,
  });

  // Vendor liabilities
  const liabilitiesQuery = useQuery({
    queryKey: ['wholesaler-liabilities', profile?.id],
    queryFn: async () => {
      if (!profile) return { total: 0, items: [] };

      const { data, error } = await supabase
        .from('vendor_liabilities')
        .select('*')
        .eq('vendor_id', profile.id)
        .eq('status', 'open');

      if (error) throw error;

      const items = data || [];
      const total = items.reduce((s, r) => s + Number(r.amount || 0), 0);

      return { total, items };
    },
    enabled: !!profile,
  });

  return {
    revenueData: revenueQuery.data || [],
    pipelineData: pipelineQuery.data || [],
    disputeTrend: disputeTrendQuery.data || [],
    performance: performanceQuery.data,
    trendKPIs: trendKPIsQuery.data || [],
    liabilities: liabilitiesQuery.data || { total: 0, items: [] },
    isLoading: revenueQuery.isLoading || pipelineQuery.isLoading || performanceQuery.isLoading || trendKPIsQuery.isLoading,
  };
}
