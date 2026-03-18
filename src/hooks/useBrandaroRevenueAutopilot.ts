import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdsOverview } from './useBrandaroAdsEngine';
import { useCEODashboard } from './useBrandaroCEO';

export function useRevenueAutopilotDashboard() {
  const ads = useAdsOverview();
  const { data: ceo } = useCEODashboard();

  const { data: attributions = [] } = useQuery({
    queryKey: ['brandaro-revenue-attributions'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_revenue_attribution')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['brandaro-budget-allocations'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_budget_allocations')
        .select('*')
        .eq('status', 'active');
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: scalingActions = [] } = useQuery({
    queryKey: ['brandaro-scaling-actions'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_scaling_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ['brandaro-reinvestment-cycles'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_reinvestment_cycles')
        .select('*')
        .order('cycle_number', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as any[];
    },
  });

  // Computed metrics
  const totalRevenue = ceo?.totalRevenue || 0;
  const totalAdSpend = ads.totalInternalSpend + ads.totalClientSpend;
  const overallROI = totalAdSpend > 0 ? ((totalRevenue - totalAdSpend) / totalAdSpend) * 100 : 0;

  // Channel breakdown from attributions
  const channelBreakdown: Record<string, { revenue: number; cost: number; leads: number }> = {};
  attributions.forEach((a: any) => {
    const ch = a.channel || 'organic';
    if (!channelBreakdown[ch]) channelBreakdown[ch] = { revenue: 0, cost: 0, leads: 0 };
    channelBreakdown[ch].revenue += Number(a.revenue_generated || 0);
    channelBreakdown[ch].cost += Number(a.cost_per_lead || 0);
    channelBreakdown[ch].leads++;
  });

  const channels = Object.entries(channelBreakdown)
    .map(([name, data]) => ({
      name,
      ...data,
      roi: data.cost > 0 ? ((data.revenue - data.cost) / data.cost) * 100 : 0,
    }))
    .sort((a, b) => b.roi - a.roi);

  const lastCycle = cycles[0] || null;
  const reinvestmentRate = lastCycle?.reinvestment_pct || 30;

  return {
    totalRevenue,
    totalAdSpend,
    overallROI,
    channels,
    budgets,
    scalingActions,
    cycles,
    lastCycle,
    reinvestmentRate,
    monthlyRecurring: ceo?.monthlyRecurring || 0,
    activeClients: ceo?.totalActiveClients || 0,
  };
}

export function useRunAutopilotCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('brandaro-revenue-autopilot', {
        body: { action: 'full-cycle' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brandaro-reinvestment-cycles'] });
      qc.invalidateQueries({ queryKey: ['brandaro-scaling-actions'] });
      qc.invalidateQueries({ queryKey: ['brandaro-budget-allocations'] });
    },
  });
}
