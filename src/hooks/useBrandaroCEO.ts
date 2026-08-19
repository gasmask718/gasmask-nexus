import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * T5 PM/CEO Dashboard hook.
 *
 * Source map (Phase 0 verified):
 *  - Total / assigned leads  -> brandaro_qualified_leads
 *  - AI dials today          -> brandaro_ai_calls (created_at)
 *  - Human dials today       -> va_call_logs       (called_at)
 *  - Leads worked today      -> DISTINCT lead_id of the two above
 *  - Texts today             -> brandaro_pending_messages where sent_at >= today
 *  - Closes today            -> brandaro_qualified_leads.converted=true AND conversion_date::date = today
 *  - Revenue                 -> sum(revenue_amount) on converted=true leads (today / month / total)
 *
 * Server-side WHERE clauses with count: 'exact', head: true wherever possible.
 */
export function useCEODashboard() {
  return useQuery({
    queryKey: ['brandaro-pm-dashboard'],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startOfDayISO = startOfDay.toISOString();

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const todayDate = new Date().toISOString().split('T')[0];

      const sb: any = supabase as any;

      const [
        totalLeadsRes,
        assignedLeadsRes,
        aiDialsRes,
        humanDialsRes,
        aiCallLeadIdsRes,
        humanCallLeadIdsRes,
        textsTodayRes,
        closesTodayRes,
        totalClosesRes,
        leadsTodayRes,
        revenueMonthRes,
        revenueTotalRes,
        industryRowsRes,
      ] = await Promise.all([
        sb.from('brandaro_qualified_leads').select('*', { count: 'exact', head: true }),
        sb.from('brandaro_qualified_leads').select('*', { count: 'exact', head: true }).not('assigned_va', 'is', null),
        // Rows land in brandaro_ai_calls BEFORE dispatch, so a plain count is
        // attempts, not dials. Pull status and split the two facts apart.
        sb.from('brandaro_ai_calls').select('lead_id, status').gte('created_at', startOfDayISO),
        sb.from('va_call_logs').select('*', { count: 'exact', head: true }).gte('called_at', startOfDayISO),
        sb.from('brandaro_ai_calls').select('lead_id, status').gte('created_at', startOfDayISO),
        sb.from('va_call_logs').select('lead_id').gte('called_at', startOfDayISO),

        sb.from('brandaro_pending_messages').select('*', { count: 'exact', head: true }).gte('sent_at', startOfDayISO),
        sb.from('brandaro_qualified_leads').select('*', { count: 'exact', head: true })
          .eq('converted', true).gte('conversion_date', startOfDayISO),
        sb.from('brandaro_qualified_leads').select('*', { count: 'exact', head: true }).eq('converted', true),
        sb.from('brandaro_qualified_leads').select('*', { count: 'exact', head: true }).gte('created_at', startOfDayISO),
        sb.from('brandaro_qualified_leads').select('revenue_amount').eq('converted', true).gte('conversion_date', monthStart),
        sb.from('brandaro_qualified_leads').select('revenue_amount').eq('converted', true),
        sb.from('brandaro_qualified_leads').select('industry').not('industry', 'is', null).limit(5000),
      ]);

      const totalLeads = totalLeadsRes.count || 0;
      const leadsAssigned = assignedLeadsRes.count || 0;
      const leadsUnassigned = Math.max(0, totalLeads - leadsAssigned);

      const AI_FAIL = ['failed', 'error', 'rejected', 'canceled', 'cancelled'];
      const aiRows = ((aiDialsRes.data || []) as any[]);
      const aiDialsAttemptedToday = aiRows.length;
      const aiDialsFailedToday = aiRows.filter(
        (r) => AI_FAIL.includes(String(r.status || '').toLowerCase()),
      ).length;
      const aiDialsToday = aiDialsAttemptedToday - aiDialsFailedToday; // dispatched
      const aiDialFailureRate = aiDialsAttemptedToday
        ? Math.round((aiDialsFailedToday / aiDialsAttemptedToday) * 100)
        : 0;
      const humanDialsToday = humanDialsRes.count || 0;
      const callsToday = aiDialsToday + humanDialsToday;

      // A lead whose only dial never left the building was not worked.
      const workedLeadSet = new Set<string>();
      ((aiCallLeadIdsRes.data || []) as any[]).forEach((r) => {
        if (r.lead_id && !AI_FAIL.includes(String(r.status || '').toLowerCase())) workedLeadSet.add(r.lead_id);
      });
      ((humanCallLeadIdsRes.data || []) as any[]).forEach((r) => { if (r.lead_id) workedLeadSet.add(r.lead_id); });
      const leadsWorkedToday = workedLeadSet.size;


      const textsToday = textsTodayRes.count || 0;
      const closesToday = closesTodayRes.count || 0;
      const closedDeals = totalClosesRes.count || 0;
      const leadsToday = leadsTodayRes.count || 0;

      const revMonthRows = (revenueMonthRes.data || []) as { revenue_amount: number | null }[];
      const revTotalRows = (revenueTotalRes.data || []) as { revenue_amount: number | null }[];
      const revenueThisMonth = revMonthRows.reduce((s, r) => s + (Number(r.revenue_amount) || 0), 0);
      const totalRevenue = revTotalRows.reduce((s, r) => s + (Number(r.revenue_amount) || 0), 0);
      const avgDealSize = closedDeals > 0 ? totalRevenue / closedDeals : 0;
      const closeRate = leadsWorkedToday > 0 ? (closesToday / leadsWorkedToday) * 100 : 0;

      // Industry distribution (lightweight client-side rollup on lead industry only — no client-services data)
      const industryMap: Record<string, number> = {};
      ((industryRowsRes.data || []) as any[]).forEach((l: any) => {
        if (l.industry) industryMap[l.industry] = (industryMap[l.industry] || 0) + 1;
      });
      const topIndustries = Object.entries(industryMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      const monthlyTarget = 1000000;

      return {
        // ── New operational KPIs (T5) ──
        aiDialsToday,
        aiDialsAttemptedToday,
        aiDialsFailedToday,
        aiDialFailureRate,

        humanDialsToday,
        leadsWorkedToday,
        textsToday,
        closesToday,
        leadsAssigned,
        leadsUnassigned,
        todayDate,

        // ── Existing fields the UI already renders ──
        leadsToday,
        totalLeads,
        callsToday,
        closedDeals,
        revenueThisMonth,
        totalRevenue,
        avgDealSize,
        closeRate,
        pendingQueue: leadsUnassigned,
        topIndustries,
        performanceData: [] as any[],
        monthlyTarget,
        monthlyProgress: (revenueThisMonth / monthlyTarget) * 100,
        dailyTarget: monthlyTarget / 30,
        monthlyRecurring: 0,
        totalActiveClients: 0,
        serviceBreakdown: {} as Record<string, { count: number; revenue: number }>,
        avgLTV: avgDealSize,
        industryPerformance: [] as any[],
      };
    },
    refetchInterval: 60000,
  });
}

export function useLeadsMaster(status?: string) {
  return useQuery({
    queryKey: ['brandaro-leads-master', status],
    queryFn: async () => {
      let query = (supabase as any).from('brandaro_leads_master').select('*').order('created_at', { ascending: false });
      if (status) query = query.eq('status', status);
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCallQueue() {
  return useQuery({
    queryKey: ['brandaro-call-queue'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_call_queue')
        .select('*, brandaro_leads_master(*)')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('next_attempt_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 10000,
  });
}

export function useClientServices() {
  return useQuery({
    queryKey: ['brandaro-client-services'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_client_services')
        .select('*, brandaro_leads_master(business_name, industry)')
        .eq('active', true)
        .order('monthly_value', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useIndustryPerformance() {
  return useQuery({
    queryKey: ['brandaro-industry-performance'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_industry_performance')
        .select('*')
        .order('total_revenue', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}
