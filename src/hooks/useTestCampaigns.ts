import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * TEST CAMPAIGN HOOKS
 * ===================
 * Direct Supabase queries for test campaigns and playbooks.
 * These use client-side queries with proper business scoping.
 */

export interface TestCampaign {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  campaign_type: string;
  status: string;
  execution_mode?: string;
  product_playbook_id?: string;
  vendor_playbook_id?: string;
  created_at: string;
  created_by?: string;
}

export interface TestPlaybook {
  id: string;
  business_id: string;
  product_name: string;
  product_description: string;
  key_value_propositions: string[];
  is_active: boolean;
  created_at: string;
}

// ============================================
// CAMPAIGN HOOKS (Direct Supabase)
// ============================================

export function useTestCampaigns(businessId: string | null) {
  return useQuery({
    queryKey: ['test-campaigns', businessId],
    queryFn: async () => {
      if (!businessId) return [];

      const { data, error } = await supabase
        .from('outbound_campaigns')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch campaigns:', error.message);
        throw new Error(`Failed to fetch campaigns: ${error.message}`);
      }
      return data as TestCampaign[];
    },
    enabled: !!businessId,
  });
}

export function useCreateTestCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      business_id: string;
      name: string;
      description?: string;
      campaign_type: string;
      product_playbook_id?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('outbound_campaigns')
        .insert({
          business_id: params.business_id,
          name: params.name,
          description: params.description || null,
          campaign_type: params.campaign_type,
          status: 'draft',
          product_playbook_id: params.product_playbook_id || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create campaign:', error.message);
        throw new Error(`Failed to create campaign: ${error.message}`);
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['test-campaigns', variables.business_id] });
      queryClient.invalidateQueries({ queryKey: ['outbound-campaigns', variables.business_id] });
      toast.success('Campaign created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ============================================
// PLAYBOOK HOOKS (Direct Supabase)
// ============================================

export function useTestPlaybooks(businessId: string | null) {
  return useQuery({
    queryKey: ['test-playbooks', businessId],
    queryFn: async () => {
      if (!businessId) return [];

      const { data, error } = await supabase
        .from('product_playbooks')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch playbooks:', error.message);
        throw new Error(`Failed to fetch playbooks: ${error.message}`);
      }
      return data as TestPlaybook[];
    },
    enabled: !!businessId,
  });
}

export function useCreateTestPlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      business_id: string;
      product_name: string;
      product_description: string;
      key_value_propositions?: string[];
    }) => {
      const { data, error } = await supabase
        .from('product_playbooks')
        .insert({
          business_id: params.business_id,
          product_name: params.product_name,
          product_description: params.product_description,
          key_value_propositions: params.key_value_propositions || [],
          is_active: false, // Requires approval
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create playbook:', error.message);
        throw new Error(`Failed to create playbook: ${error.message}`);
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['test-playbooks', variables.business_id] });
      queryClient.invalidateQueries({ queryKey: ['product-playbooks', variables.business_id] });
      toast.success('Playbook created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ============================================
// CAMPAIGN RUN HOOKS
// ============================================

export interface CampaignRun {
  id: string;
  campaign_id: string;
  policy_id: string;
  status: string;
  run_number: number;
  scheduled_start?: string;
  actual_start?: string;
  created_at: string;
}

export function useCampaignRuns(campaignId: string | null) {
  return useQuery({
    queryKey: ['campaign-runs', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .from('campaign_runs')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch campaign runs:', error.message);
        throw new Error(`Failed to fetch runs: ${error.message}`);
      }
      return (data || []) as CampaignRun[];
    },
    enabled: !!campaignId,
  });
}

export function useCreateCampaignRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      campaign_id: string;
      business_id: string;
    }) => {
      // First, get or create a default policy for this business
      // @ts-ignore - Supabase types can be recursive
      const { data: policies } = await supabase
        .from('executive_policies')
        .select('id')
        .eq('business_id', params.business_id)
        .eq('is_active', true)
        .limit(1);

      let policyId = (policies as { id: string }[] | null)?.[0]?.id;

      // If no policy exists, create a default one
      if (!policyId) {
        const { data: newPolicy, error: createPolicyError } = await supabase
          .from('executive_policies')
          .insert({
            business_id: params.business_id,
            policy_name: 'Default Test Policy',
            policy_scope: 'test',
            allowed_actions: ['test_call'],
            forbidden_actions: [],
            approval_required_for: [],
          } as never)
          .select('id')
          .single();

        if (createPolicyError) {
          throw new Error(`Failed to create policy: ${createPolicyError.message}`);
        }
        policyId = (newPolicy as { id: string })?.id;
      }

      // Now create the campaign run
      const { data, error } = await supabase
        .from('campaign_runs')
        .insert({
          campaign_id: params.campaign_id,
          policy_id: policyId,
          business_id: params.business_id,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create campaign run:', error.message);
        throw new Error(`Failed to create run: ${error.message}`);
      }
      return data as CampaignRun;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-runs', variables.campaign_id] });
      toast.success('Campaign run started');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ============================================
// QUICK CREATE DEFAULT TEST SETUP
// ============================================

export function useCreateDefaultTestSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (businessId: string) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Step 1: Create default playbook
      const { data: playbook, error: playbookError } = await supabase
        .from('product_playbooks')
        .insert({
          business_id: businessId,
          product_name: 'Default Test Playbook',
          product_description: 'A minimal test playbook for validating the AI calling system.',
          key_value_propositions: [
            'Test call to validate AI disclosure',
            'Verify call routing works correctly',
          ],
          is_active: true, // Auto-approve for test
        })
        .select()
        .single();

      if (playbookError) {
        throw new Error(`Playbook creation failed: ${playbookError.message}`);
      }

      // Step 2: Create test campaign bound to playbook
      const { data: campaign, error: campaignError } = await supabase
        .from('outbound_campaigns')
        .insert({
          business_id: businessId,
          name: 'Default Test Campaign',
          description: 'Auto-generated test campaign for validating the outbound system.',
          campaign_type: 'product_launch',
          status: 'draft',
          product_playbook_id: playbook.id,
          created_by: user?.id,
        })
        .select()
        .single();

      if (campaignError) {
        throw new Error(`Campaign creation failed: ${campaignError.message}`);
      }

      return { playbook, campaign };
    },
    onSuccess: (_, businessId) => {
      queryClient.invalidateQueries({ queryKey: ['test-campaigns', businessId] });
      queryClient.invalidateQueries({ queryKey: ['test-playbooks', businessId] });
      queryClient.invalidateQueries({ queryKey: ['outbound-campaigns', businessId] });
      queryClient.invalidateQueries({ queryKey: ['product-playbooks', businessId] });
      toast.success('Default test setup created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
