import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ExecutivePolicy {
  id: string;
  business_id: string;
  policy_name: string;
  policy_scope: string;
  description?: string;
  allowed_actions: string[];
  forbidden_actions: string[];
  approval_required_for: string[];
  risk_classification: string;
  jurisdiction_constraints?: Record<string, unknown>;
  brand_voice_constraints?: Record<string, unknown>;
  max_contact_rate?: number;
  max_contacts_per_day?: number;
  cooldown_rules?: Record<string, unknown>;
  escalation_conditions?: Record<string, unknown>;
  rollback_triggers?: Record<string, unknown>;
  status: string;
  created_by?: string;
  signed_by?: string;
  signed_at?: string;
  signature_hash?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

interface CampaignRun {
  id: string;
  campaign_id: string;
  policy_id: string;
  business_id?: string;
  run_number: number;
  status: string;
  scheduled_start?: string;
  actual_start?: string;
  scheduled_end?: string;
  actual_end?: string;
  total_targets: number;
  contacts_attempted: number;
  contacts_reached: number;
  conversions: number;
  escalations: number;
  opt_outs: number;
  violations: number;
  initial_confidence?: number;
  final_confidence?: number;
  rollback_triggered: boolean;
  rollback_reason?: string;
  rollback_at?: string;
  created_at: string;
  updated_at: string;
  outbound_campaigns?: {
    name: string;
    status: string;
  };
}

interface DecisionEngineState {
  id: string;
  business_id: string;
  status: string;
  mode: string;
  active_policy_ids: string[];
  active_campaign_ids: string[];
  active_run_ids: string[];
  total_decisions_today: number;
  successful_executions_today: number;
  escalations_today: number;
  violations_today: number;
  current_trust_score: number;
  confidence_floor: number;
  drift_ceiling: number;
  human_override_active: boolean;
  override_reason?: string;
  override_by?: string;
  override_expires_at?: string;
}

export function useExecutiveAI(businessId?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [policies, setPolicies] = useState<ExecutivePolicy[]>([]);
  const [activeRuns, setActiveRuns] = useState<CampaignRun[]>([]);
  const [engineState, setEngineState] = useState<DecisionEngineState | null>(null);
  const { toast } = useToast();

  // Fetch all policies
  const fetchPolicies = useCallback(async () => {
    if (!businessId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-policy-manager', {
        body: { action: 'list', business_id: businessId }
      });

      if (error) throw error;
      if (data.success) {
        setPolicies(data.policies);
      }
    } catch (error) {
      console.error('Error fetching policies:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch executive policies',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [businessId, toast]);

  // Create new policy
  const createPolicy = useCallback(async (policyData: Partial<ExecutivePolicy>) => {
    if (!businessId) return null;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-policy-manager', {
        body: { 
          action: 'create', 
          business_id: businessId,
          policy_data: policyData 
        }
      });

      if (error) throw error;
      if (data.success) {
        toast({
          title: 'Policy Created',
          description: `Draft policy "${policyData.policy_name}" created successfully`
        });
        await fetchPolicies();
        return data.policy;
      }
    } catch (error) {
      console.error('Error creating policy:', error);
      toast({
        title: 'Error',
        description: 'Failed to create policy',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
    return null;
  }, [businessId, fetchPolicies, toast]);

  // Sign (activate) policy
  const signPolicy = useCallback(async (policyId: string, notes?: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-policy-manager', {
        body: { 
          action: 'sign', 
          policy_id: policyId,
          signature_notes: notes 
        }
      });

      if (error) throw error;
      if (data.success) {
        toast({
          title: 'Policy Signed',
          description: 'Executive policy is now active. AI may operate within its boundaries.'
        });
        await fetchPolicies();
        return data.policy;
      }
    } catch (error) {
      console.error('Error signing policy:', error);
      toast({
        title: 'Signing Failed',
        description: error instanceof Error ? error.message : 'Failed to sign policy',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
    return null;
  }, [fetchPolicies, toast]);

  // Suspend policy
  const suspendPolicy = useCallback(async (policyId: string, reason?: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-policy-manager', {
        body: { 
          action: 'suspend', 
          policy_id: policyId,
          signature_notes: reason 
        }
      });

      if (error) throw error;
      if (data.success) {
        toast({
          title: 'Policy Suspended',
          description: 'AI operations under this policy have been paused.'
        });
        await fetchPolicies();
      }
    } catch (error) {
      console.error('Error suspending policy:', error);
      toast({
        title: 'Error',
        description: 'Failed to suspend policy',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [fetchPolicies, toast]);

  // Revoke policy
  const revokePolicy = useCallback(async (policyId: string, reason?: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-policy-manager', {
        body: { 
          action: 'revoke', 
          policy_id: policyId,
          signature_notes: reason 
        }
      });

      if (error) throw error;
      if (data.success) {
        toast({
          title: 'Policy Revoked',
          description: 'Policy has been permanently revoked.'
        });
        await fetchPolicies();
      }
    } catch (error) {
      console.error('Error revoking policy:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke policy',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [fetchPolicies, toast]);

  // Get engine status
  const fetchEngineStatus = useCallback(async () => {
    if (!businessId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-decision-engine', {
        body: { action: 'get_status', business_id: businessId }
      });

      if (error) throw error;
      if (data.success) {
        setEngineState(data.engine);
        setActiveRuns(data.active_runs);
      }
    } catch (error) {
      console.error('Error fetching engine status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  // Start campaign run
  const startCampaignRun = useCallback(async (campaignId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-decision-engine', {
        body: { action: 'start_run', campaign_id: campaignId }
      });

      if (error) throw error;
      if (data.success) {
        toast({
          title: 'Campaign Run Started',
          description: `Run #${data.run.run_number} is now active under policy "${data.policy.policy_name}"`
        });
        await fetchEngineStatus();
        return data.run;
      }
    } catch (error) {
      console.error('Error starting run:', error);
      toast({
        title: 'Cannot Start Run',
        description: error instanceof Error ? error.message : 'Failed to start campaign run',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
    return null;
  }, [fetchEngineStatus, toast]);

  // Pause run
  const pauseRun = useCallback(async (runId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-decision-engine', {
        body: { action: 'pause_run', run_id: runId }
      });

      if (error) throw error;
      if (data.success) {
        toast({ title: 'Run Paused', description: 'Campaign run has been paused.' });
        await fetchEngineStatus();
      }
    } catch (error) {
      console.error('Error pausing run:', error);
      toast({ title: 'Error', description: 'Failed to pause run', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [fetchEngineStatus, toast]);

  // Halt run (emergency stop)
  const haltRun = useCallback(async (runId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-decision-engine', {
        body: { action: 'halt_run', run_id: runId }
      });

      if (error) throw error;
      if (data.success) {
        toast({ 
          title: 'Run Halted', 
          description: 'Campaign run has been emergency stopped.',
          variant: 'destructive'
        });
        await fetchEngineStatus();
      }
    } catch (error) {
      console.error('Error halting run:', error);
      toast({ title: 'Error', description: 'Failed to halt run', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [fetchEngineStatus, toast]);

  // Rollback run
  const rollbackRun = useCallback(async (runId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-decision-engine', {
        body: { action: 'rollback_run', run_id: runId }
      });

      if (error) throw error;
      if (data.success) {
        toast({ 
          title: 'Run Rolled Back', 
          description: 'Campaign run has been rolled back.'
        });
        await fetchEngineStatus();
      }
    } catch (error) {
      console.error('Error rolling back run:', error);
      toast({ title: 'Error', description: 'Failed to rollback run', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [fetchEngineStatus, toast]);

  // Toggle human override
  const setHumanOverride = useCallback(async (active: boolean, reason?: string) => {
    if (!businessId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-decision-engine', {
        body: { 
          action: 'update_engine', 
          business_id: businessId,
          engine_update: { 
            human_override_active: active,
            override_reason: reason 
          }
        }
      });

      if (error) throw error;
      if (data.success) {
        toast({ 
          title: active ? 'Override Activated' : 'Override Deactivated',
          description: active 
            ? 'Human override is now active. AI autonomy is restricted.' 
            : 'Human override removed. AI may resume operations.'
        });
        setEngineState(data.engine);
      }
    } catch (error) {
      console.error('Error setting override:', error);
      toast({ title: 'Error', description: 'Failed to update override', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [businessId, toast]);

  return {
    isLoading,
    policies,
    activeRuns,
    engineState,
    fetchPolicies,
    createPolicy,
    signPolicy,
    suspendPolicy,
    revokePolicy,
    fetchEngineStatus,
    startCampaignRun,
    pauseRun,
    haltRun,
    rollbackRun,
    setHumanOverride,
  };
}

export default useExecutiveAI;
