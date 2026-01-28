/**
 * Ambassador Leads Hook - Pipeline management for store/wholesaler leads
 * Uses sales_prospects table for lead tracking
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Lead {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  stage: string;
  source: string | null;
  notes: string | null;
  next_follow_up: string | null;
  likelihood: number | null;
  created_at: string;
  updated_at: string;
  lead_type: 'store' | 'wholesaler' | 'influencer' | 'ambassador';
}

export interface LeadsByStage {
  [stage: string]: Lead[];
}

// Stages must be lowercase to match DB constraint
const STORE_STAGES = ['new', 'contacted', 'meeting set', 'proposal', 'negotiation', 'won', 'lost'];
const WHOLESALER_STAGES = ['identified', 'reached out', 'qualified', 'onboarding', 'active'];
const INFLUENCER_STAGES = ['identified', 'contacted', 'interested', 'training', 'active'];
const AMBASSADOR_STAGES = ['applied', 'screening', 'interview', 'background check', 'onboarding', 'active'];

// Display names for UI (title case)
const STAGE_DISPLAY_NAMES: Record<string, string> = {
  'new': 'New',
  'contacted': 'Contacted',
  'meeting set': 'Meeting Set',
  'proposal': 'Proposal',
  'negotiation': 'Negotiation',
  'won': 'Won',
  'lost': 'Lost',
  'identified': 'Identified',
  'reached out': 'Reached Out',
  'qualified': 'Qualified',
  'onboarding': 'Onboarding',
  'active': 'Active',
  'interested': 'Interested',
  'training': 'Training',
  'applied': 'Applied',
  'screening': 'Screening',
  'interview': 'Interview',
  'background check': 'Background Check',
};

/**
 * Fetch ambassador's leads
 */
export function useAmbassadorLeads(leadType?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const leadsQuery = useQuery({
    queryKey: ['ambassador-leads', user?.id, leadType],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('sales_prospects')
        .select('*')
        .eq('assigned_to', user.id)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      
      if (error) {
        console.error('Leads fetch error:', error);
        return [];
      }

      return (data || []).map((lead: any): Lead => ({
        id: lead.id,
        name: lead.store_name,
        contact_name: lead.contact_name,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        stage: lead.pipeline_stage || 'New',
        source: lead.source,
        notes: lead.notes,
        next_follow_up: lead.next_follow_up,
        likelihood: lead.likelihood_to_activate,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        // Infer type from source - IMPORTANT: ambassador_referral means store lead FROM an ambassador
        // Only 'ambassador_recruit' should be typed as 'ambassador' (recruiting new ambassadors)
        lead_type: lead.source?.toLowerCase().includes('wholesaler') || lead.source?.toLowerCase().includes('wholesale') ? 'wholesaler' : 
                   lead.source?.toLowerCase().includes('influencer') ? 'influencer' :
                   lead.source?.toLowerCase() === 'ambassador_recruit' ? 'ambassador' : 'store',
      }));
    },
    enabled: !!user?.id,
  });

  // Group leads by stage
  const getLeadsByStage = (type: string): LeadsByStage => {
    const leads = leadsQuery.data || [];
    const filteredLeads = type === 'all' ? leads : leads.filter(l => l.lead_type === type);
    
    const stages = type === 'wholesaler' ? WHOLESALER_STAGES :
                   type === 'influencer' ? INFLUENCER_STAGES :
                   type === 'ambassador' ? AMBASSADOR_STAGES : STORE_STAGES;
    
    const byStage: LeadsByStage = {};
    stages.forEach(stage => {
      byStage[stage] = filteredLeads.filter(l => l.stage === stage);
    });
    
    return byStage;
  };

  // Create lead mutation
  const createLeadMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      contact_name?: string;
      phone?: string;
      email?: string;
      address?: string;
      city?: string;
      state?: string;
      zipcode?: string;
      source?: string;
      notes?: string;
      lead_type?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('sales_prospects')
        .insert({
          store_name: input.name,
          contact_name: input.contact_name,
          phone: input.phone,
          email: input.email,
          address: input.address,
          city: input.city,
          state: input.state,
          source: input.source || `${input.lead_type || 'ambassador'}_referral`,
          notes: input.notes,
          pipeline_stage: 'new', // lowercase to match DB constraint
          assigned_to: user.id,
          zipcode: input.zipcode,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-leads'] });
      toast.success('Lead added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add lead: ${error.message}`);
    },
  });

  // Update stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async (input: { leadId: string; newStage: string }) => {
      const { error } = await supabase
        .from('sales_prospects')
        .update({ 
          pipeline_stage: input.newStage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-leads'] });
      toast.success('Lead stage updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update lead: ${error.message}`);
    },
  });

  // Convert lead to store assignment
  const convertLeadMutation = useMutation({
    mutationFn: async (input: { leadId: string; lead: Lead }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // First get ambassador ID - use .limit(1) since user may have multiple ambassador records
      const { data: ambassadors, error: ambError } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (ambError) throw ambError;
      const ambassador = ambassadors?.[0];
      if (!ambassador) throw new Error('No active ambassador profile found. Please contact your manager.');

      // Create store in store_master - use correct column names
      const { data: store, error: storeError } = await supabase
        .from('store_master')
        .insert({
          store_name: input.lead.name,
          owner_name: input.lead.contact_name || null,
          phone: input.lead.phone || null,
          email: input.lead.email || null,
          address: input.lead.address || '',
          city: input.lead.city || '',
          state: input.lead.state || '',
          zip: '00000',
          country: 'US',
        })
        .select()
        .single();

      if (storeError) throw storeError;

      // Create ambassador assignment (sourced)
      const { error: assignmentError } = await supabase
        .from('ambassador_assignments')
        .insert({
          ambassador_id: ambassador.id,
          store_id: store.id,
          assignment_type: 'sourced',
          active: true,
          is_primary: true,
          start_date: new Date().toISOString(),
        });

      if (assignmentError) throw assignmentError;

      // Update lead as converted
      await supabase
        .from('sales_prospects')
        .update({
          pipeline_stage: 'won', // lowercase to match DB constraint
          converted_store_id: store.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.leadId);

      return store;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-leads'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-portfolio-stores'] });
      toast.success('Lead converted to store!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to convert lead: ${error.message}`);
    },
  });

  const leads = leadsQuery.data || [];
  const storeLeads = leads.filter(l => l.lead_type === 'store');
  const wholesalerLeads = leads.filter(l => l.lead_type === 'wholesaler');
  const influencerLeads = leads.filter(l => l.lead_type === 'influencer');
  const ambassadorLeads = leads.filter(l => l.lead_type === 'ambassador');

  return {
    leads,
    storeLeads,
    wholesalerLeads,
    influencerLeads,
    ambassadorLeads,
    getLeadsByStage,
    storeStages: STORE_STAGES,
    wholesalerStages: WHOLESALER_STAGES,
    influencerStages: INFLUENCER_STAGES,
    ambassadorStages: AMBASSADOR_STAGES,
    isLoading: leadsQuery.isLoading,
    isError: leadsQuery.isError,
    createLead: createLeadMutation.mutateAsync,
    isCreatingLead: createLeadMutation.isPending,
    updateStage: updateStageMutation.mutateAsync,
    isUpdatingStage: updateStageMutation.isPending,
    convertLead: convertLeadMutation.mutateAsync,
    isConvertingLead: convertLeadMutation.isPending,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['ambassador-leads'] }),
    getStageDisplayName: (stage: string) => STAGE_DISPLAY_NAMES[stage.toLowerCase()] || stage,
  };
}
