import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useClientReports(clientId?: string) {
  return useQuery({
    queryKey: ['brandaro-client-reports', clientId],
    queryFn: async () => {
      let query = (supabase as any).from('brandaro_client_reports')
        .select('*, brandaro_leads_master(business_name, industry)')
        .order('created_at', { ascending: false });
      if (clientId) query = query.eq('client_id', clientId);
      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useAIAccountManager() {
  return useQuery({
    queryKey: ['brandaro-ai-account-manager'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_ai_account_manager')
        .select('*, brandaro_leads_master(business_name, industry, phone)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 30000,
  });
}

export function useAdsCampaigns() {
  return useQuery({
    queryKey: ['brandaro-ads-campaigns'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_ads_campaigns')
        .select('*, brandaro_leads_master(business_name, industry)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useReportingOverview() {
  return useQuery({
    queryKey: ['brandaro-reporting-overview'],
    queryFn: async () => {
      const [reports, manager, ads] = await Promise.all([
        (supabase as any).from('brandaro_client_reports').select('visitors, leads_generated, conversions, revenue_estimate, period, sent_at'),
        (supabase as any).from('brandaro_ai_account_manager').select('satisfaction_score, engagement_level, auto_messages_sent'),
        (supabase as any).from('brandaro_ads_campaigns').select('budget, spend, leads_generated, revenue_attributed, roi_pct, status').eq('status', 'active'),
      ]);

      const allReports = (reports.data || []) as any[];
      const managers = (manager.data || []) as any[];
      const activeCampaigns = (ads.data || []) as any[];

      const totalVisitors = allReports.reduce((s: number, r: any) => s + (r.visitors || 0), 0);
      const totalLeads = allReports.reduce((s: number, r: any) => s + (r.leads_generated || 0), 0);
      const totalRevEst = allReports.reduce((s: number, r: any) => s + (r.revenue_estimate || 0), 0);
      const reportsSent = allReports.filter((r: any) => r.sent_at).length;

      const avgSatisfaction = managers.length > 0
        ? managers.reduce((s: number, m: any) => s + (m.satisfaction_score || 0), 0) / managers.length : 0;
      const totalAutoMessages = managers.reduce((s: number, m: any) => s + (m.auto_messages_sent || 0), 0);

      const totalAdSpend = activeCampaigns.reduce((s: number, a: any) => s + (a.spend || 0), 0);
      const totalAdLeads = activeCampaigns.reduce((s: number, a: any) => s + (a.leads_generated || 0), 0);
      const totalAdRevenue = activeCampaigns.reduce((s: number, a: any) => s + (a.revenue_attributed || 0), 0);
      const avgROI = activeCampaigns.length > 0
        ? activeCampaigns.reduce((s: number, a: any) => s + (a.roi_pct || 0), 0) / activeCampaigns.length : 0;

      return {
        totalVisitors, totalLeads, totalRevEst, reportsSent,
        avgSatisfaction, totalAutoMessages, managedClients: managers.length,
        totalAdSpend, totalAdLeads, totalAdRevenue, avgROI, activeCampaigns: activeCampaigns.length,
      };
    },
    refetchInterval: 30000,
  });
}
