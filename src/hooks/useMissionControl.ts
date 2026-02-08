/**
 * Mission Control Hook — Data layer for Owner Mission Control
 * Handles CRUD operations on owner_missions with real-time updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type MissionStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'deferred' | 'cancelled';
export type MissionPriority = 'low' | 'medium' | 'high' | 'critical';
export type MissionSource = 'owner_manual' | 'floor_generated' | 'ai_suggested' | 'delegated' | 'recurring_auto' | 'external';
export type MissionCategory = 'strategic' | 'operational' | 'financial' | 'personal' | 'compliance' | 'growth';

export interface Mission {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  category: MissionCategory;
  priority: MissionPriority;
  status: MissionStatus;
  source: MissionSource;
  business_id: string | null;
  floor_origin: string | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  is_recurring: boolean | null;
  recurrence_pattern: string | null;
  recurrence_config: Record<string, unknown> | null;
  next_recurrence_at: string | null;
  ai_confidence_score: number | null;
  ai_reasoning: string | null;
  delegated_to: string | null;
  delegated_at: string | null;
  completion_notes: string | null;
  streak_count: number | null;
  times_deferred: number | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  // Joined
  businesses?: { business_name: string } | null;
}

export interface CreateMissionInput {
  title: string;
  description?: string;
  category?: MissionCategory;
  priority?: MissionPriority;
  source?: MissionSource;
  business_id?: string | null;
  floor_origin?: string | null;
  due_date?: string | null;
  tags?: string[];
  delegated_to?: string | null;
  is_recurring?: boolean;
  recurrence_pattern?: string | null;
}

const QUERY_KEY = 'owner-missions';

export function useMissionControl() {
  const queryClient = useQueryClient();

  // Fetch all missions
  const missionsQuery = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('owner_missions')
        .select('*, businesses(name)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(d => ({
        ...d,
        businesses: d.businesses ? { business_name: (d.businesses as any).name } : null,
      })) as Mission[];
    },
  });

  // Create mission
  const createMission = useMutation({
    mutationFn: async (input: CreateMissionInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('owner_missions')
        .insert({
          owner_id: user.id,
          title: input.title,
          description: input.description || null,
          category: input.category || 'operational',
          priority: input.priority || 'medium',
          source: input.source || 'owner_manual',
          business_id: input.business_id || null,
          floor_origin: input.floor_origin || null,
          due_date: input.due_date || null,
          tags: input.tags || [],
          delegated_to: input.delegated_to || null,
          is_recurring: input.is_recurring || false,
          recurrence_pattern: input.recurrence_pattern || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('owner_mission_activity').insert({
        mission_id: data.id,
        action: 'created',
        details: `Mission created: ${input.title}`,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Mission created');
    },
    onError: (err) => toast.error(`Failed to create mission: ${err.message}`),
  });

  // Update mission status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: MissionStatus; notes?: string }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (status === 'in_progress') updateData.started_at = new Date().toISOString();
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        if (notes) updateData.completion_notes = notes;
      }
      if (status === 'deferred') {
        // Increment deferred count
        const { data: current } = await supabase
          .from('owner_missions')
          .select('times_deferred')
          .eq('id', id)
          .single();
        updateData.times_deferred = (current?.times_deferred || 0) + 1;
      }

      const { error } = await supabase
        .from('owner_missions')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await supabase.from('owner_mission_activity').insert({
        mission_id: id,
        action: status,
        details: notes || `Status changed to ${status}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Mission updated');
    },
    onError: (err) => toast.error(`Failed to update: ${err.message}`),
  });

  // Update mission fields
  const updateMission = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<CreateMissionInput>) => {
      const { error } = await supabase
        .from('owner_missions')
        .update(fields)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Mission updated');
    },
    onError: (err) => toast.error(`Failed to update: ${err.message}`),
  });

  // Delete mission
  const deleteMission = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('owner_missions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Mission deleted');
    },
    onError: (err) => toast.error(`Failed to delete: ${err.message}`),
  });

  // Computed views
  const missions = missionsQuery.data || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  const activeMissions = missions.filter(m => ['pending', 'in_progress', 'blocked'].includes(m.status));
  const completedMissions = missions.filter(m => m.status === 'completed');
  const overdueMissions = activeMissions.filter(m => m.due_date && new Date(m.due_date) < today);
  const todayMissions = activeMissions.filter(m => {
    if (!m.due_date) return false;
    const due = new Date(m.due_date);
    return due >= today && due <= endOfToday;
  });

  // Momentum metrics
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  const completedThisWeek = completedMissions.filter(m => 
    m.completed_at && new Date(m.completed_at) >= last7Days
  ).length;

  const totalDeferred = missions.reduce((sum, m) => sum + (m.times_deferred || 0), 0);
  const completionRate = missions.length > 0 
    ? Math.round((completedMissions.length / missions.length) * 100) 
    : 0;

  return {
    missions,
    activeMissions,
    completedMissions,
    overdueMissions,
    todayMissions,
    isLoading: missionsQuery.isLoading,
    error: missionsQuery.error,
    // Mutations
    createMission,
    updateStatus,
    updateMission,
    deleteMission,
    // Metrics
    momentum: {
      completedThisWeek,
      totalDeferred,
      completionRate,
      totalActive: activeMissions.length,
      totalOverdue: overdueMissions.length,
    },
  };
}
