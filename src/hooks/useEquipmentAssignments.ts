/**
 * EQUIPMENT ASSIGNMENT HOOKS
 * Tracks tool/equipment assignment to workers.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EquipmentAssignment {
  id: string;
  office_id: string;
  equipment_name: string;
  equipment_serial: string | null;
  assigned_to_user_id: string | null;
  assigned_at: string;
  unassigned_at: string | null;
  assignment_notes: string | null;
  created_by: string | null;
  created_at: string;
}

export function useEquipmentAssignments(officeId: string | undefined) {
  return useQuery({
    queryKey: ['equipment-assignments', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('production_equipment_assignments')
        .select('*')
        .eq('office_id', officeId)
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      return (data || []) as EquipmentAssignment[];
    },
    enabled: !!officeId,
  });
}

export function useActiveEquipmentAssignments(officeId: string | undefined) {
  return useQuery({
    queryKey: ['equipment-assignments-active', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('production_equipment_assignments')
        .select('*')
        .eq('office_id', officeId)
        .is('unassigned_at', null)
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      return (data || []) as EquipmentAssignment[];
    },
    enabled: !!officeId,
  });
}

export function useAssignEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      officeId: string;
      equipmentName: string;
      equipmentSerial?: string;
      assignedToUserId?: string;
      notes?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();

      // Auto-close any existing active assignment for this equipment
      if (params.equipmentSerial) {
        await supabase
          .from('production_equipment_assignments')
          .update({ unassigned_at: new Date().toISOString() })
          .eq('office_id', params.officeId)
          .eq('equipment_serial', params.equipmentSerial)
          .is('unassigned_at', null);
      }

      const { data, error } = await supabase
        .from('production_equipment_assignments')
        .insert({
          office_id: params.officeId,
          equipment_name: params.equipmentName,
          equipment_serial: params.equipmentSerial || null,
          assigned_to_user_id: params.assignedToUserId || null,
          assignment_notes: params.notes || null,
          created_by: userData.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-assignments-active'] });
      toast({ title: 'Equipment assigned', description: 'Assignment recorded.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Assignment failed', description: err.message, variant: 'destructive' });
    },
  });
}

export function useUnassignEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('production_equipment_assignments')
        .update({ unassigned_at: new Date().toISOString() })
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-assignments-active'] });
      toast({ title: 'Equipment unassigned' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });
}
