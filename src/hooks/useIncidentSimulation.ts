import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface IncidentSimulation {
  id: string;
  business_id: string | null;
  name: string;
  description: string | null;
  scenario_type: string;
  scenario_config: any;
  expected_outcome: string | null;
  severity: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SimulationRun {
  id: string;
  simulation_id: string | null;
  business_id: string | null;
  started_at: string;
  completed_at: string | null;
  status: string;
  synthetic_session_id: string | null;
  call_state_log: any[];
  audit_trail: any[];
  result_summary: any;
  passed: boolean | null;
  failure_reason: string | null;
  run_by: string | null;
  run_duration_ms: number | null;
  created_at: string;
}

export interface IncidentFinding {
  id: string;
  run_id: string | null;
  simulation_id: string | null;
  finding_type: string;
  severity: string;
  description: string;
  evidence: any;
  timestamp_at: string | null;
  recommended_action: string | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export function useIncidentSimulations(businessId: string | null) {
  return useQuery({
    queryKey: ['incident-simulations', businessId],
    queryFn: async () => {
      let query = supabase
        .from('incident_simulations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as IncidentSimulation[];
    },
    enabled: true
  });
}

export function useSimulationRuns(simulationId: string | null) {
  return useQuery({
    queryKey: ['simulation-runs', simulationId],
    queryFn: async () => {
      if (!simulationId) return [];
      
      const { data, error } = await supabase
        .from('incident_simulation_runs')
        .select('*')
        .eq('simulation_id', simulationId)
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data as SimulationRun[];
    },
    enabled: !!simulationId
  });
}

export function useIncidentFindings(runId: string | null) {
  return useQuery({
    queryKey: ['incident-findings', runId],
    queryFn: async () => {
      if (!runId) return [];
      
      const { data, error } = await supabase
        .from('incident_findings')
        .select('*')
        .eq('run_id', runId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as IncidentFinding[];
    },
    enabled: !!runId
  });
}

export function useCreateSimulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (simulation: Partial<IncidentSimulation>) => {
      const { data, error } = await supabase
        .from('incident_simulations')
        .insert(simulation as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident-simulations'] });
      toast.success('Simulation created');
    },
    onError: (error) => {
      toast.error(`Failed to create simulation: ${error.message}`);
    }
  });
}

export function useRunSimulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ simulationId, businessId }: { simulationId: string; businessId: string }) => {
      const { data, error } = await supabase.functions.invoke('incident-simulator', {
        body: {
          simulation_id: simulationId,
          business_id: businessId
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['simulation-runs'] });
      queryClient.invalidateQueries({ queryKey: ['incident-findings'] });
      if (data.passed) {
        toast.success(`Simulation passed in ${data.duration_ms}ms`);
      } else {
        toast.warning(`Simulation failed with ${data.findings} findings`);
      }
    },
    onError: (error) => {
      toast.error(`Simulation failed: ${error.message}`);
    }
  });
}

export function useResolveFinding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ findingId, resolvedBy }: { findingId: string; resolvedBy?: string }) => {
      const { data, error } = await supabase
        .from('incident_findings')
        .update({
          resolved: true,
          resolved_by: resolvedBy,
          resolved_at: new Date().toISOString()
        })
        .eq('id', findingId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident-findings'] });
      toast.success('Finding resolved');
    },
    onError: (error) => {
      toast.error(`Failed to resolve finding: ${error.message}`);
    }
  });
}