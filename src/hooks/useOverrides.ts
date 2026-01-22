import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Types
export interface OverridePlan {
  id: string;
  name: string;
  description: string | null;
  role_type: 'team_lead' | 'manager' | 'regional_manager' | 'recruiter' | 'custom';
  override_type: 'percentage' | 'flat';
  override_value: number;
  applies_to_channel: string | null;
  priority: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OverrideAssignment {
  id: string;
  override_plan_id: string;
  beneficiary_ambassador_id: string;
  source_ambassador_id: string | null;
  source_store_id: string | null;
  active: boolean;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  override_plan?: OverridePlan;
  beneficiary?: { id: string; full_name: string; email: string };
  source_ambassador?: { id: string; full_name: string } | null;
  source_store?: { id: string; store_name: string } | null;
}

export interface OverrideSummary {
  plan_id: string;
  plan_name: string;
  role_type: string;
  override_type: string;
  override_value: number;
  applies_to_channel: string | null;
  plan_active: boolean;
  assignment_count: number;
  commissions_generated: number;
  total_paid_out: number;
}

// Hook: Fetch all override plans
export function useOverridePlans() {
  return useQuery({
    queryKey: ['override-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_override_plans')
        .select('*')
        .order('priority', { ascending: true });

      if (error) throw error;
      return data as OverridePlan[];
    },
  });
}

// Hook: Fetch single override plan with assignments
export function useOverridePlan(planId: string | undefined) {
  return useQuery({
    queryKey: ['override-plan', planId],
    queryFn: async () => {
      if (!planId) return null;

      const { data, error } = await supabase
        .from('commission_override_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) throw error;
      return data as OverridePlan;
    },
    enabled: !!planId,
  });
}

// Hook: Fetch assignments for a plan
export function useOverrideAssignments(planId?: string) {
  return useQuery({
    queryKey: ['override-assignments', planId],
    queryFn: async () => {
      let query = supabase
        .from('commission_override_assignments')
        .select(`
          *,
          override_plan:commission_override_plans(*),
          beneficiary:ambassadors!beneficiary_ambassador_id(id, user_id, tier),
          source_ambassador:ambassadors!source_ambassador_id(id, user_id, tier),
          source_store:store_master!source_store_id(id, store_name)
        `)
        .order('created_at', { ascending: false });

      if (planId) {
        query = query.eq('override_plan_id', planId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Hook: Fetch override summary (admin view)
export function useOverrideSummary() {
  return useQuery({
    queryKey: ['override-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_override_summary')
        .select('*');

      if (error) throw error;
      return data as OverrideSummary[];
    },
  });
}

// Hook: Create override plan
export function useCreateOverridePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (plan: Omit<OverridePlan, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('commission_override_plans')
        .insert(plan)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['override-plans'] });
      queryClient.invalidateQueries({ queryKey: ['override-summary'] });
      toast.success('Override plan created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create plan: ${error.message}`);
    },
  });
}

// Hook: Update override plan
export function useUpdateOverridePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OverridePlan> & { id: string }) => {
      const { data, error } = await supabase
        .from('commission_override_plans')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['override-plans'] });
      queryClient.invalidateQueries({ queryKey: ['override-plan', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['override-summary'] });
      toast.success('Override plan updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update plan: ${error.message}`);
    },
  });
}

// Hook: Delete override plan
export function useDeleteOverridePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from('commission_override_plans')
        .delete()
        .eq('id', planId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['override-plans'] });
      queryClient.invalidateQueries({ queryKey: ['override-summary'] });
      toast.success('Override plan deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete plan: ${error.message}`);
    },
  });
}

// Hook: Create override assignment
export function useCreateOverrideAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignment: {
      override_plan_id: string;
      beneficiary_ambassador_id: string;
      source_ambassador_id?: string | null;
      source_store_id?: string | null;
      start_date?: string;
      end_date?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('commission_override_assignments')
        .insert(assignment)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['override-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['override-summary'] });
      toast.success('Override assignment created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create assignment: ${error.message}`);
    },
  });
}

// Hook: Update override assignment
export function useUpdateOverrideAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OverrideAssignment> & { id: string }) => {
      const { data, error } = await supabase
        .from('commission_override_assignments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['override-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['override-summary'] });
      toast.success('Override assignment updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update assignment: ${error.message}`);
    },
  });
}

// Hook: Delete override assignment
export function useDeleteOverrideAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('commission_override_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['override-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['override-summary'] });
      toast.success('Override assignment deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete assignment: ${error.message}`);
    },
  });
}

// Hook: Fetch ambassadors for assignment dropdown
export function useAmbassadorsForOverrides() {
  return useQuery({
    queryKey: ['ambassadors-for-overrides'],
    queryFn: async () => {
      const { data: ambassadors, error } = await supabase
        .from('ambassadors')
        .select('id, user_id, tier')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const userIds = (ambassadors || []).map(a => a.user_id).filter(Boolean);
      
      if (userIds.length === 0) return ambassadors?.map(amb => ({ ...amb, profiles: null })) || [];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds as string[]);
      
      return ambassadors?.map(amb => ({
        ...amb,
        profiles: (profiles || []).find((p: any) => p.id === amb.user_id) || null
      })) || [];
    },
  });
}

// Hook: Fetch stores for assignment dropdown
export function useStoresForOverrides() {
  return useQuery({
    queryKey: ['stores-for-overrides'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('store_master')
        .select('id, store_name, city, state')
        .eq('status', 'active')
        .order('store_name', { ascending: true }) as any);

      if (error) throw error;
      return data || [];
    },
  });
}
