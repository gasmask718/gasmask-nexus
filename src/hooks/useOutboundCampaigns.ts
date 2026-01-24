import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface OutboundCampaign {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  campaign_type: 'product_launch' | 'vendor_recruitment' | 'marketplace_growth' | 'store_reactivation' | 'b2b_outreach';
  status: 'draft' | 'pending_approval' | 'approved' | 'active' | 'paused' | 'halted' | 'completed' | 'cancelled';
  audience_type: string;
  max_calls_per_day: number;
  total_targets: number;
  calls_made: number;
  conversions: number;
  opt_outs: number;
  escalations: number;
  kill_switch_triggered: boolean;
  sentinel_approved: boolean;
  created_at: string;
  approved_at?: string;
}

export interface ProductPlaybook {
  id: string;
  business_id: string;
  product_name: string;
  product_description: string;
  key_value_propositions: string[];
  forbidden_promises: string[];
  escalation_triggers: string[];
  confidence_floor: number;
  is_active: boolean;
  approved_at?: string;
}

export interface VendorPlaybook {
  id: string;
  business_id: string;
  service_category: string;
  outreach_goal: string;
  website_signup_explanation: string;
  benefits_framing: string[];
  confidence_floor: number;
  is_active: boolean;
  approved_at?: string;
}

// Campaign Hooks
export function useOutboundCampaigns(businessId: string | null) {
  return useQuery({
    queryKey: ['outbound-campaigns', businessId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('outbound-campaign-manager', {
        body: { action: 'list', business_id: businessId }
      });
      if (error) throw error;
      return data.campaigns as OutboundCampaign[];
    },
    enabled: !!businessId,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { business_id: string; data: Partial<OutboundCampaign> }) => {
      const { data, error } = await supabase.functions.invoke('outbound-campaign-manager', {
        body: { action: 'create', business_id: params.business_id, data: params.data }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outbound-campaigns', variables.business_id] });
      toast.success('Campaign created');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useApproveCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { campaign_id: string; approved_by: string }) => {
      const { data, error } = await supabase.functions.invoke('outbound-campaign-manager', {
        body: { action: 'approve', campaign_id: params.campaign_id, approved_by: params.approved_by }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-campaigns'] });
      toast.success('Campaign approved');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCampaignAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { action: 'pause' | 'resume' | 'halt'; campaign_id: string; data?: any }) => {
      const { data, error } = await supabase.functions.invoke('outbound-campaign-manager', {
        body: { action: params.action, campaign_id: params.campaign_id, data: params.data }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outbound-campaigns'] });
      toast.success(`Campaign ${variables.action}d`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// Kill Switch Hooks
export function useKillSwitchStatus(scope: 'global' | 'business' | 'campaign', businessId?: string, campaignId?: string) {
  return useQuery({
    queryKey: ['kill-switch-status', scope, businessId, campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('campaign-kill-switch', {
        body: { action: 'status', scope, business_id: businessId, campaign_id: campaignId }
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });
}

export function useTriggerKillSwitch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { scope: 'global' | 'business' | 'campaign'; business_id?: string; campaign_id?: string; triggered_by: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('campaign-kill-switch', {
        body: { action: 'trigger', ...params }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kill-switch-status'] });
      queryClient.invalidateQueries({ queryKey: ['outbound-campaigns'] });
      toast.warning('Kill switch triggered - all affected campaigns halted');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// Playbook Hooks
export function useProductPlaybooks(businessId: string | null) {
  return useQuery({
    queryKey: ['product-playbooks', businessId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('playbook-manager', {
        body: { action: 'list', playbook_type: 'product', business_id: businessId }
      });
      if (error) throw error;
      return data.playbooks as ProductPlaybook[];
    },
    enabled: !!businessId,
  });
}

export function useVendorPlaybooks(businessId: string | null) {
  return useQuery({
    queryKey: ['vendor-playbooks', businessId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('playbook-manager', {
        body: { action: 'list', playbook_type: 'vendor', business_id: businessId }
      });
      if (error) throw error;
      return data.playbooks as VendorPlaybook[];
    },
    enabled: !!businessId,
  });
}
