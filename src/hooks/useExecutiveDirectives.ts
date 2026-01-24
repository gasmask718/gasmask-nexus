import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ExecutiveDirective {
  id: string;
  business_id: string;
  issued_by: string;
  directive_type: 'growth' | 'recovery' | 'test' | 'hold' | 'optimize' | 'experiment';
  scope_type: 'brand' | 'business' | 'campaign' | 'segment';
  scope_ids: string[];
  intent_description: string;
  constraints: {
    max_daily_calls?: number;
    max_daily_spend?: number;
    allowed_playbooks?: string[];
    forbidden_actions?: string[];
    cooldown_hours?: number;
    sentiment_floor?: number;
    compliance_threshold?: number;
  };
  success_metrics: {
    target_conversion_rate?: number;
    target_interest_rate?: number;
    max_opt_out_rate?: number;
    min_call_quality?: number;
  };
  expires_at?: string;
  revocable: boolean;
  status: 'draft' | 'active' | 'paused' | 'expired' | 'revoked';
  created_at: string;
  activated_at?: string;
  revoked_at?: string;
  revoked_by?: string;
  revocation_reason?: string;
}

export interface SimulationResult {
  id: string;
  directive_id: string;
  simulation_type: 'full' | 'stress' | 'compliance';
  projected_call_volume: number;
  projected_cost: number;
  risk_exposure: number;
  sentinel_stress: number;
  compliance_load: number;
  projected_outcomes: {
    conversions: number;
    interests: number;
    opt_outs: number;
    escalations: number;
  };
  warnings: string[];
  blockers: string[];
  recommendation: 'approve' | 'review' | 'reject';
  created_at: string;
}

export interface PowersMatrix {
  power_id: string;
  power_name: string;
  category: 'can' | 'cannot' | 'requires_approval';
  description: string;
  enforced_at: string[];
  last_invoked?: string;
}

export function useExecutiveDirectives(businessId?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [directives, setDirectives] = useState<ExecutiveDirective[]>([]);
  const [simulations, setSimulations] = useState<SimulationResult[]>([]);
  const [powersMatrix, setPowersMatrix] = useState<PowersMatrix[]>([]);
  const [advisoryMode, setAdvisoryMode] = useState(false);

  // Fetch all directives
  const fetchDirectives = useCallback(async () => {
    if (!businessId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-directive-manager', {
        body: { action: 'list', business_id: businessId }
      });

      if (error) throw error;
      if (data.success) {
        setDirectives(data.directives);
        setAdvisoryMode(data.advisory_only_mode || false);
      }
    } catch (error) {
      console.error('Error fetching directives:', error);
      toast.error('Failed to fetch executive directives');
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  // Create new directive
  const createDirective = useCallback(async (directiveData: Partial<ExecutiveDirective>) => {
    if (!businessId) return null;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-directive-manager', {
        body: { 
          action: 'create', 
          business_id: businessId,
          directive_data: directiveData 
        }
      });

      if (error) throw error;
      if (data.success) {
        toast.success(`Directive created: ${directiveData.directive_type}`);
        await fetchDirectives();
        return data.directive;
      }
    } catch (error) {
      console.error('Error creating directive:', error);
      toast.error('Failed to create directive');
    } finally {
      setIsLoading(false);
    }
    return null;
  }, [businessId, fetchDirectives]);

  // Activate directive
  const activateDirective = useCallback(async (directiveId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-directive-manager', {
        body: { action: 'activate', directive_id: directiveId }
      });

      if (error) throw error;
      if (data.success) {
        toast.success('Directive activated - AI may now execute within constraints');
        await fetchDirectives();
        return data.directive;
      }
    } catch (error) {
      console.error('Error activating directive:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to activate directive');
    } finally {
      setIsLoading(false);
    }
    return null;
  }, [fetchDirectives]);

  // Revoke directive
  const revokeDirective = useCallback(async (directiveId: string, reason: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-directive-manager', {
        body: { 
          action: 'revoke', 
          directive_id: directiveId,
          revocation_reason: reason 
        }
      });

      if (error) throw error;
      if (data.success) {
        toast.warning('Directive revoked - linked campaigns paused');
        await fetchDirectives();
      }
    } catch (error) {
      console.error('Error revoking directive:', error);
      toast.error('Failed to revoke directive');
    } finally {
      setIsLoading(false);
    }
  }, [fetchDirectives]);

  // Run simulation
  const runSimulation = useCallback(async (
    directiveId: string, 
    simulationType: 'full' | 'stress' | 'compliance' = 'full'
  ): Promise<SimulationResult | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('executive-directive-manager', {
        body: { 
          action: 'simulate', 
          directive_id: directiveId,
          simulation_type: simulationType 
        }
      });

      if (error) throw error;
      if (data.success) {
        const simulation = data.simulation as SimulationResult;
        setSimulations(prev => [simulation, ...prev]);
        return simulation;
      }
    } catch (error) {
      console.error('Error running simulation:', error);
      toast.error('Simulation failed');
    } finally {
      setIsLoading(false);
    }
    return null;
  }, []);

  // Fetch powers matrix
  const fetchPowersMatrix = useCallback(async () => {
    if (!businessId) return;
    try {
      const { data, error } = await supabase.functions.invoke('executive-directive-manager', {
        body: { action: 'get_powers_matrix', business_id: businessId }
      });

      if (error) throw error;
      if (data.success) {
        setPowersMatrix(data.powers);
      }
    } catch (error) {
      console.error('Error fetching powers matrix:', error);
    }
  }, [businessId]);

  // Check if action is allowed
  const checkPowerAllowed = useCallback((powerName: string): { allowed: boolean; requiresApproval: boolean } => {
    const power = powersMatrix.find(p => p.power_name === powerName);
    if (!power) return { allowed: false, requiresApproval: true };
    
    return {
      allowed: power.category === 'can',
      requiresApproval: power.category === 'requires_approval'
    };
  }, [powersMatrix]);

  // Get active directives only
  const activeDirectives = directives.filter(d => d.status === 'active');
  const draftDirectives = directives.filter(d => d.status === 'draft');

  return {
    isLoading,
    directives,
    activeDirectives,
    draftDirectives,
    simulations,
    powersMatrix,
    advisoryMode,
    fetchDirectives,
    createDirective,
    activateDirective,
    revokeDirective,
    runSimulation,
    fetchPowersMatrix,
    checkPowerAllowed,
  };
}

export default useExecutiveDirectives;
