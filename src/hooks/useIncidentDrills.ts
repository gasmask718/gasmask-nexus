import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface IncidentDrill {
  id: string;
  business_id: string | null;
  drill_type: string;
  drill_name: string;
  description: string | null;
  initiated_by: string;
  initiated_at: string;
  completed_at: string | null;
  status: string;
  expected_outcomes: any;
  actual_outcomes: any;
  ai_stopped_correctly: boolean | null;
  human_takeover_activated: boolean | null;
  audit_logs_persisted: boolean | null;
  alerts_fired_correctly: boolean | null;
  latency_metrics: any;
  drill_readiness_score: number | null;
  findings: string[] | null;
  is_drill: boolean;
  created_at: string;
}

export const DRILL_TYPES = [
  { value: 'kill_switch_activation', label: 'Kill Switch Activation', description: 'Test immediate AI stop capability' },
  { value: 'human_takeover', label: 'Human Takeover', description: 'Test human handoff process' },
  { value: 'ai_stop_command', label: 'AI Stop Command', description: 'Test AI stop command response' },
  { value: 'confidence_breach_response', label: 'Confidence Breach', description: 'Test confidence threshold response' },
  { value: 'mass_escalation', label: 'Mass Escalation', description: 'Test multiple concurrent escalations' },
  { value: 'system_failover', label: 'System Failover', description: 'Test backup system activation' },
  { value: 'audit_persistence', label: 'Audit Persistence', description: 'Test audit log persistence' },
  { value: 'alert_verification', label: 'Alert Verification', description: 'Test alert system functionality' }
];

export function useIncidentDrills(businessId: string | null) {
  return useQuery({
    queryKey: ['incident-drills', businessId],
    queryFn: async () => {
      let query = supabase
        .from('incident_drills')
        .select('*')
        .order('initiated_at', { ascending: false });
      
      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as IncidentDrill[];
    },
    enabled: true
  });
}

export function useRunDrill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      businessId, 
      drillType,
      drillName,
      description,
      initiatedBy
    }: { 
      businessId: string; 
      drillType: string;
      drillName: string;
      description?: string;
      initiatedBy: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('incident-drill-runner', {
        body: {
          business_id: businessId,
          drill_type: drillType,
          drill_name: drillName,
          description,
          initiated_by: initiatedBy
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['incident-drills'] });
      if (data.passed) {
        toast.success(`Drill passed with score ${data.readiness_score}%`);
      } else {
        toast.warning(`Drill completed with issues: ${data.findings?.join(', ')}`);
      }
    },
    onError: (error) => {
      toast.error(`Drill failed: ${error.message}`);
    }
  });
}