import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useClientLifecycle() {
  return useQuery({
    queryKey: ['brandaro-client-lifecycle'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_client_lifecycle')
        .select('*, brandaro_leads_master(business_name, industry, phone)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useClientValue() {
  return useQuery({
    queryKey: ['brandaro-client-value'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_client_value')
        .select('*, brandaro_leads_master(business_name, industry)')
        .order('total_spent', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useRetentionMetrics() {
  return useQuery({
    queryKey: ['brandaro-retention-metrics'],
    queryFn: async () => {
      const [lifecycle, value, services, touchpoints] = await Promise.all([
        (supabase as any).from('brandaro_client_lifecycle').select('stage, satisfaction_score'),
        (supabase as any).from('brandaro_client_value').select('total_spent, monthly_value, churn_risk, months_active, client_grade'),
        (supabase as any).from('brandaro_client_services').select('monthly_value, active').eq('active', true),
        (supabase as any).from('brandaro_client_touchpoints').select('status, message_type'),
      ]);

      const clients = (lifecycle.data || []) as any[];
      const values = (value.data || []) as any[];
      const activeServices = (services.data || []) as any[];
      const touches = (touchpoints.data || []) as any[];

      // Stage counts
      const stages: Record<string, number> = {};
      clients.forEach((c: any) => { stages[c.stage] = (stages[c.stage] || 0) + 1; });

      // MRR
      const mrr = activeServices.reduce((s: number, v: any) => s + (v.monthly_value || 0), 0);

      // Avg satisfaction
      const avgSatisfaction = clients.length > 0
        ? clients.reduce((s: number, c: any) => s + (c.satisfaction_score || 0), 0) / clients.length
        : 0;

      // Churn risk distribution
      const atRisk = values.filter((v: any) => v.churn_risk > 60).length;
      const healthy = values.filter((v: any) => v.churn_risk <= 30).length;

      // Avg LTV
      const avgLTV = values.length > 0
        ? values.reduce((s: number, v: any) => s + (v.total_spent || 0), 0) / values.length
        : 0;

      // Avg lifespan
      const avgLifespan = values.length > 0
        ? values.reduce((s: number, v: any) => s + (v.months_active || 0), 0) / values.length
        : 0;

      // Grade distribution
      const grades: Record<string, number> = {};
      values.forEach((v: any) => { grades[v.client_grade] = (grades[v.client_grade] || 0) + 1; });

      // Churn rate estimate
      const churned = stages['churned'] || 0;
      const totalClients = clients.length || 1;
      const churnRate = (churned / totalClients) * 100;

      return {
        stages,
        mrr,
        avgSatisfaction,
        atRisk,
        healthy,
        avgLTV,
        avgLifespan,
        grades,
        churnRate,
        totalClients: clients.length,
        touchpointsSent: touches.filter((t: any) => t.status === 'sent').length,
        touchpointsPending: touches.filter((t: any) => t.status === 'scheduled').length,
      };
    },
    refetchInterval: 30000,
  });
}
