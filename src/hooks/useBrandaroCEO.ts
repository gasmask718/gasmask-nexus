import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useCEODashboard() {
  return useQuery({
    queryKey: ['brandaro-ceo-dashboard'],
    queryFn: async () => {
      // Parallel queries for dashboard metrics
      const [leads, calls, payments, queue, performance] = await Promise.all([
        supabase.from('brandaro_leads_master').select('id, status, industry, created_at'),
        supabase.from('brandaro_calls').select('id, outcome, ai_handled, duration_seconds, created_at'),
        supabase.from('brandaro_payment_plans').select('total_amount, status, created_at'),
        supabase.from('brandaro_call_queue').select('id, status'),
        supabase.from('brandaro_performance_ai').select('*').order('created_at', { ascending: false }).limit(10),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const allLeads = leads.data || [];
      const allCalls = calls.data || [];
      const allPayments = payments.data || [];
      const queueItems = queue.data || [];

      const leadsToday = allLeads.filter(l => l.created_at?.startsWith(today)).length;
      const callsToday = allCalls.filter(c => c.created_at?.startsWith(today)).length;
      const closedDeals = allCalls.filter(c => c.outcome === 'closed').length;
      const paidPayments = allPayments.filter(p => p.status === 'paid');
      const revenueThisMonth = paidPayments
        .filter(p => p.created_at && p.created_at >= monthStart)
        .reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const totalRevenue = paidPayments.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const avgDealSize = paidPayments.length > 0 ? totalRevenue / paidPayments.length : 0;
      const closeRate = allCalls.length > 0 ? (closedDeals / allCalls.length) * 100 : 0;
      const pendingQueue = queueItems.filter(q => q.status === 'pending').length;

      // Industry breakdown
      const industryMap: Record<string, number> = {};
      allLeads.forEach(l => {
        if (l.industry) industryMap[l.industry] = (industryMap[l.industry] || 0) + 1;
      });
      const topIndustries = Object.entries(industryMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      return {
        leadsToday,
        totalLeads: allLeads.length,
        callsToday,
        closedDeals,
        revenueThisMonth,
        totalRevenue,
        avgDealSize,
        closeRate,
        pendingQueue,
        topIndustries,
        performanceData: performance.data || [],
        // Target tracking
        monthlyTarget: 100000,
        monthlyProgress: (revenueThisMonth / 100000) * 100,
        dailyTarget: 100000 / 30,
      };
    },
    refetchInterval: 30000,
  });
}

export function useLeadsMaster(status?: string) {
  return useQuery({
    queryKey: ['brandaro-leads-master', status],
    queryFn: async () => {
      let query = supabase.from('brandaro_leads_master').select('*').order('created_at', { ascending: false });
      if (status) query = query.eq('status', status);
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data;
    },
  });
}

export function useCallQueue() {
  return useQuery({
    queryKey: ['brandaro-call-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_call_queue')
        .select('*, brandaro_leads_master(*)')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('next_attempt_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });
}
