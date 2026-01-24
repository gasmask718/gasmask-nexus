import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ComplianceMetricsSnapshot {
  id: string;
  business_id: string | null;
  snapshot_date: string;
  snapshot_hour: number | null;
  total_calls: number;
  calls_with_ai_permission: number;
  calls_without_permission: number;
  permission_rate: number | null;
  kill_switch_activations: number;
  kill_switch_success_rate: number | null;
  confidence_breaches: number;
  human_takeover_count: number;
  avg_human_takeover_latency_ms: number | null;
  unapproved_technique_uses: number;
  audit_completeness_rate: number | null;
  compliance_status: string;
  risk_score: number | null;
  created_at: string;
}

export interface ComplianceAlert {
  id: string;
  business_id: string | null;
  alert_type: string;
  severity: string;
  title: string;
  description: string | null;
  evidence: any;
  session_id: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export function useComplianceMetrics(businessId: string | null, days: number = 7) {
  return useQuery({
    queryKey: ['compliance-metrics', businessId, days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      let query = supabase
        .from('compliance_metrics_snapshots')
        .select('*')
        .gte('snapshot_date', startDate.toISOString().split('T')[0])
        .order('snapshot_date', { ascending: false })
        .order('snapshot_hour', { ascending: false });
      
      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ComplianceMetricsSnapshot[];
    },
    enabled: true
  });
}

export function useComplianceAlerts(businessId: string | null, unresolvedOnly: boolean = false) {
  return useQuery({
    queryKey: ['compliance-alerts', businessId, unresolvedOnly],
    queryFn: async () => {
      let query = supabase
        .from('compliance_alerts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (businessId) {
        query = query.eq('business_id', businessId);
      }
      
      if (unresolvedOnly) {
        query = query.eq('resolved', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ComplianceAlert[];
    },
    enabled: true
  });
}

export function useLatestComplianceStatus(businessId: string | null) {
  return useQuery({
    queryKey: ['latest-compliance-status', businessId],
    queryFn: async () => {
      let query = supabase
        .from('compliance_metrics_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .order('snapshot_hour', { ascending: false })
        .limit(1);
      
      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data?.[0] as ComplianceMetricsSnapshot | null;
    },
    enabled: true
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ alertId, acknowledgedBy }: { alertId: string; acknowledgedBy?: string }) => {
      const { data, error } = await supabase
        .from('compliance_alerts')
        .update({
          acknowledged: true,
          acknowledged_by: acknowledgedBy,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-alerts'] });
      toast.success('Alert acknowledged');
    },
    onError: (error) => {
      toast.error(`Failed to acknowledge: ${error.message}`);
    }
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      alertId, 
      resolvedBy, 
      resolutionNotes 
    }: { 
      alertId: string; 
      resolvedBy?: string;
      resolutionNotes?: string;
    }) => {
      const { data, error } = await supabase
        .from('compliance_alerts')
        .update({
          resolved: true,
          resolved_by: resolvedBy,
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes
        })
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-alerts'] });
      toast.success('Alert resolved');
    },
    onError: (error) => {
      toast.error(`Failed to resolve: ${error.message}`);
    }
  });
}

export function useRefreshComplianceMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ businessId }: { businessId: string }) => {
      const { data, error } = await supabase.functions.invoke('compliance-metrics-calculator', {
        body: { business_id: businessId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['latest-compliance-status'] });
      toast.success('Metrics refreshed');
    },
    onError: (error) => {
      toast.error(`Failed to refresh metrics: ${error.message}`);
    }
  });
}