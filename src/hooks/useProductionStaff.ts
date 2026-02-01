import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ProductionRole = 'office_manager' | 'supervisor' | 'worker';

export interface ProductionOfficeUser {
  id: string;
  user_id: string;
  office_id: string;
  role: ProductionRole;
  active: boolean;
  assigned_at: string;
  assigned_by: string | null;
  // Enriched data (fetched separately)
  user_email?: string;
  user_name?: string;
  office_name?: string;
}

export interface AssignStaffInput {
  user_id: string;
  office_id: string;
  role: ProductionRole;
}

/**
 * Get all staff assigned to a specific office (with profile enrichment)
 */
export function useOfficeStaff(officeId: string | null) {
  return useQuery({
    queryKey: ['production-office-staff', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      
      // First get the assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('production_office_users')
        .select('*')
        .eq('office_id', officeId)
        .eq('active', true)
        .order('role');
      
      if (assignmentsError) throw assignmentsError;
      if (!assignments?.length) return [];
      
      // Get unique user IDs
      const userIds = [...new Set(assignments.map(a => a.user_id))];
      
      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);
      
      if (profilesError) {
        console.warn('Failed to fetch profiles:', profilesError);
      }
      
      // Create a lookup map
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      
      // Enrich assignments with profile data
      return assignments.map(assignment => {
        const profile = profileMap.get(assignment.user_id);
        return {
          ...assignment,
          user_email: profile?.email,
          user_name: profile?.name,
        };
      });
    },
    enabled: !!officeId,
  });
}

/**
 * Get all staff across all offices (admin view)
 */
export function useAllProductionStaff() {
  return useQuery({
    queryKey: ['production-all-staff'],
    queryFn: async () => {
      // First get all assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('production_office_users')
        .select('*')
        .eq('active', true)
        .order('office_id')
        .order('role');
      
      if (assignmentsError) throw assignmentsError;
      if (!assignments?.length) return [];
      
      // Get unique user IDs and office IDs
      const userIds = [...new Set(assignments.map(a => a.user_id))];
      const officeIds = [...new Set(assignments.map(a => a.office_id))];
      
      // Fetch profiles and offices in parallel
      const [profilesResult, officesResult] = await Promise.all([
        supabase.from('profiles').select('id, name, email').in('id', userIds),
        supabase.from('production_offices').select('id, name').in('id', officeIds),
      ]);
      
      // Create lookup maps
      const profileMap = new Map((profilesResult.data || []).map(p => [p.id, p]));
      const officeMap = new Map((officesResult.data || []).map(o => [o.id, o]));
      
      // Enrich assignments
      return assignments.map(assignment => {
        const profile = profileMap.get(assignment.user_id);
        const office = officeMap.get(assignment.office_id);
        return {
          ...assignment,
          user_email: profile?.email,
          user_name: profile?.name,
          office_name: office?.name,
        };
      });
    },
  });
}

/**
 * Get current user's office assignments
 */
export function useMyOfficeAssignments() {
  return useQuery({
    queryKey: ['my-office-assignments'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get user's assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('production_office_users')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true);
      
      if (assignmentsError) throw assignmentsError;
      if (!assignments?.length) return [];
      
      // Fetch office details
      const officeIds = [...new Set(assignments.map(a => a.office_id))];
      const { data: offices } = await supabase
        .from('production_offices')
        .select('id, name, location, status')
        .in('id', officeIds);
      
      const officeMap = new Map((offices || []).map(o => [o.id, o]));
      
      return assignments.map(assignment => ({
        ...assignment,
        office: officeMap.get(assignment.office_id),
      }));
    },
  });
}

/**
 * Assign a user to an office
 */
export function useAssignStaff() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: AssignStaffInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('production_office_users')
        .upsert({
          user_id: input.user_id,
          office_id: input.office_id,
          role: input.role,
          active: true,
          assigned_by: user?.id,
          assigned_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,office_id',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['production-office-staff', variables.office_id] });
      queryClient.invalidateQueries({ queryKey: ['production-all-staff'] });
      toast.success('Staff member assigned successfully');
    },
    onError: (error) => {
      console.error('Failed to assign staff:', error);
      toast.error('Failed to assign staff member');
    },
  });
}

/**
 * Update a staff member's role
 */
export function useUpdateStaffRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: ProductionRole }) => {
      const { data, error } = await supabase
        .from('production_office_users')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-office-staff'] });
      queryClient.invalidateQueries({ queryKey: ['production-all-staff'] });
      toast.success('Role updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update role:', error);
      toast.error('Failed to update role');
    },
  });
}

/**
 * Remove a staff member from an office (soft delete)
 */
export function useRemoveStaff() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('production_office_users')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-office-staff'] });
      queryClient.invalidateQueries({ queryKey: ['production-all-staff'] });
      toast.success('Staff member removed');
    },
    onError: (error) => {
      console.error('Failed to remove staff:', error);
      toast.error('Failed to remove staff member');
    },
  });
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: ProductionRole): string {
  switch (role) {
    case 'office_manager': return 'Office Manager';
    case 'supervisor': return 'Supervisor';
    case 'worker': return 'Worker';
    default: return role;
  }
}

/**
 * Get role badge color
 */
export function getRoleBadgeColor(role: ProductionRole): string {
  switch (role) {
    case 'office_manager': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'supervisor': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'worker': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    default: return 'bg-gray-100 text-gray-800';
  }
}
