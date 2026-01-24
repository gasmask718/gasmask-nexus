import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * GOVERNED OUTBOUND CALL HOOK
 * 
 * Provides full governance binding for outbound AI calls:
 * - Kill switch checking
 * - Campaign validation
 * - Disclosure enforcement
 * - Frame guarantees
 * - Test call isolation
 */

export interface GateCheck {
  name: string;
  passed: boolean;
  reason?: string;
}

export interface GovernedCallResult {
  success: boolean;
  session_id?: string;
  campaign_id?: string;
  campaign_run_id?: string;
  execution_mode?: string;
  is_test_call?: boolean;
  disclosure_required?: boolean;
  disclosure_text?: string;
  gate_checks?: GateCheck[];
  failed_gates?: string[];
  error?: string;
}

export interface KillSwitchState {
  id: string;
  scope: 'global' | 'business' | 'campaign';
  business_id?: string;
  campaign_id?: string;
  is_active: boolean;
  triggered_at?: string;
  trigger_reason?: string;
  triggered_by?: string;
  reset_at?: string;
}

// Kill Switch Status Hook
export function useKillSwitchStatus(
  scope: 'global' | 'business' | 'campaign',
  businessId?: string,
  campaignId?: string
) {
  return useQuery({
    queryKey: ['kill-switch', scope, businessId, campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('realtime-kill-switch', {
        body: { 
          action: 'check', 
          scope, 
          business_id: businessId, 
          campaign_id: campaignId 
        }
      });
      if (error) throw error;
      return data as { active: boolean; scope?: string; reason?: string };
    },
    refetchInterval: 5000, // Check every 5 seconds
  });
}

// Trigger Kill Switch
export function useTriggerKillSwitch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { 
      scope: 'global' | 'business' | 'campaign'; 
      business_id?: string; 
      campaign_id?: string; 
      reason: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('realtime-kill-switch', {
        body: { action: 'trigger', ...params }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kill-switch'] });
      queryClient.invalidateQueries({ queryKey: ['outbound-campaigns'] });
      toast.warning(`Kill switch activated: ${data.sessions_terminated} sessions terminated`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to trigger kill switch: ${error.message}`);
    }
  });
}

// Reset Kill Switch
export function useResetKillSwitch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { 
      scope: 'global' | 'business' | 'campaign'; 
      business_id?: string; 
      campaign_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('realtime-kill-switch', {
        body: { action: 'reset', ...params }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kill-switch'] });
      toast.success('Kill switch reset successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reset kill switch: ${error.message}`);
    }
  });
}

// Initiate Governed Call
export function useGovernedCall() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      campaign_id: string;
      campaign_run_id: string;
      target_phone: string;
      target_name?: string;
      target_entity_type?: string;
      target_entity_id?: string;
      playbook_id?: string;
      playbook_type?: 'product' | 'vendor';
      execution_mode: 'test' | 'canary' | 'assisted' | 'live';
      is_test_call?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('governed-outbound-call', {
        body: params
      });
      if (error) throw error;
      return data as GovernedCallResult;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['campaign-runs'] });
        toast.success('Call session created - disclosure required');
      } else {
        toast.error(`Call blocked: ${data.failed_gates?.join(', ')}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Call initiation failed: ${error.message}`);
    }
  });
}

// Log Disclosure
export function useLogDisclosure() {
  return useMutation({
    mutationFn: async (params: {
      session_id: string;
      campaign_id?: string;
      campaign_run_id?: string;
      disclosure_spoken?: boolean;
      disclosure_text?: string;
      disclosure_timestamp_ms?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('call-disclosure-handler', {
        body: { action: 'log_disclosure', ...params }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Disclosure logged');
    }
  });
}

// Report Disclosure Failure
export function useReportDisclosureFailure() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      session_id: string;
      campaign_id?: string;
      campaign_run_id?: string;
      failure_reason: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('call-disclosure-handler', {
        body: { action: 'report_failure', ...params }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-runs'] });
      toast.error('Disclosure failure logged - call terminated');
    }
  });
}

// Write Campaign Frame
export function useWriteCampaignFrame() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      session_id: string;
      campaign_id: string;
      campaign_run_id: string;
      target_phone?: string;
      disclosure_spoken?: boolean;
      confidence_score?: number;
      compliance_score?: number;
      objections?: Array<{ type: string; text: string; handled: boolean }>;
      opt_out_requested?: boolean;
      escalation_triggered?: boolean;
      call_outcome?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('campaign-frame-writer', {
        body: { action: 'write_frame', ...params }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-frames'] });
      if (data.frame_valid) {
        toast.success('Campaign frame written');
      } else {
        toast.warning(`Frame written with validation errors: ${data.validation_errors?.join(', ')}`);
      }
    }
  });
}

// Test Call Whitelist
export function useTestCallWhitelist(businessId: string | null) {
  return useQuery({
    queryKey: ['test-call-whitelist', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('test_call_whitelist')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });
}

// Add to Test Whitelist
export function useAddToTestWhitelist() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      business_id: string;
      phone_number: string;
      label?: string;
      is_internal?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('test_call_whitelist')
        .insert({
          ...params,
          added_by: user?.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['test-call-whitelist', variables.business_id] });
      toast.success('Phone number added to test whitelist');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add: ${error.message}`);
    }
  });
}

// Campaign Runs
export function useCampaignRuns(campaignId: string | null) {
  return useQuery({
    queryKey: ['campaign-runs', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_runs')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });
}

// Create Campaign Run
export function useCreateCampaignRun() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      campaign_id: string;
      business_id: string;
      execution_mode: 'test' | 'canary' | 'assisted' | 'live';
      total_targets?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Insert with explicit column mapping
      const { data, error } = await supabase
        .from('campaign_runs')
        .insert({
          campaign_id: params.campaign_id,
          business_id: params.business_id,
          started_by: user?.id
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-runs', variables.campaign_id] });
      toast.success('Campaign run created');
    }
  });
}

// Start Campaign Run
export function useStartCampaignRun() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase
        .from('campaign_runs')
        .update({
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', runId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-runs'] });
      toast.success('Campaign run started');
    }
  });
}