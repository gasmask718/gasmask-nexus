// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA AUTOPILOT HOOKS
// Phase 6: React hooks for the autopilot task system
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGrabbaIntelligence } from '@/hooks/useGrabbaIntelligence';
import { generateAutopilotTasks, getTaskStats, type AutopilotTask, type AutopilotPriority, type AutopilotStatus } from '@/engine/GrabbaAutopilotEngine';
import { GRABBA_AUTOPILOT_CONFIG } from '@/config/grabbaAutopilotConfig';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH TASKS
// ═══════════════════════════════════════════════════════════════════════════════

interface TaskFilters {
  floor?: number;
  status?: AutopilotStatus;
  priority?: AutopilotPriority;
  limit?: number;
}

export function useAutopilotTasks(filters?: TaskFilters) {
  return useQuery({
    queryKey: ['grabba-autopilot-tasks', filters],
    queryFn: async () => {
      let query = supabase
        .from('grabba_autopilot_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.floor !== undefined) {
        query = query.eq('floor', filters.floor);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: GRABBA_AUTOPILOT_CONFIG.taskRefreshInterval,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK STATS
// ═══════════════════════════════════════════════════════════════════════════════

export function useAutopilotTaskStats() {
  const { data: tasks } = useAutopilotTasks({ status: 'pending' });
  
  return {
    total: tasks?.length || 0,
    critical: tasks?.filter((t: any) => t.priority === 'critical').length || 0,
    high: tasks?.filter((t: any) => t.priority === 'high').length || 0,
    medium: tasks?.filter((t: any) => t.priority === 'medium').length || 0,
    low: tasks?.filter((t: any) => t.priority === 'low').length || 0,
    byFloor: tasks?.reduce((acc: Record<number, number>, t: any) => {
      acc[t.floor] = (acc[t.floor] || 0) + 1;
      return acc;
    }, {}) || {},
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE TASKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useCreateAutopilotTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tasks: Omit<AutopilotTask, 'id' | 'createdAt'>[]) => {
      const tasksToInsert = tasks.map(task => ({
        type: task.type,
        floor: task.floor,
        brand: task.brand || null,
        priority: task.priority,
        title: task.title,
        description: task.description,
        entity_id: task.entityId || null,
        entity_type: task.entityType || null,
        suggested_due_date: task.suggestedDueDate || null,
        source: task.source,
        status: 'pending',
      }));

      const { data, error } = await supabase
        .from('grabba_autopilot_tasks')
        .insert(tasksToInsert)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grabba-autopilot-tasks'] });
      toast.success('Tasks added to autopilot queue');
    },
    onError: (error) => {
      console.error('Failed to create tasks:', error);
      toast.error('Failed to add tasks');
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE TASK STATUS
// ═══════════════════════════════════════════════════════════════════════════════

export function useUpdateAutopilotTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      taskId, 
      status, 
      notes 
    }: { 
      taskId: string; 
      status: AutopilotStatus; 
      notes?: string;
    }) => {
      const updateData: any = { status };
      
      if (status === 'completed' || status === 'dismissed') {
        updateData.completed_at = new Date().toISOString();
      }
      if (notes) {
        updateData.notes = notes;
      }

      const { data, error } = await supabase
        .from('grabba_autopilot_tasks')
        .update(updateData)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['grabba-autopilot-tasks'] });
      const messages: Record<AutopilotStatus, string> = {
        pending: 'Task moved to pending',
        in_progress: 'Task started',
        completed: 'Task completed',
        dismissed: 'Task dismissed',
      };
      toast.success(messages[variables.status]);
    },
    onError: (error) => {
      console.error('Failed to update task:', error);
      toast.error('Failed to update task');
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH PLAYBOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function usePlaybooks() {
  return useQuery({
    queryKey: ['grabba-playbooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grabba_playbooks')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE SUGGESTIONS (from Intelligence Core)
// ═══════════════════════════════════════════════════════════════════════════════

export function useAutopilotSuggestions(floor?: number) {
  const { data: intelligence, isLoading } = useGrabbaIntelligence();

  if (isLoading || !intelligence) {
    return { suggestions: [], isLoading, stats: null };
  }

  const allTasks = generateAutopilotTasks(intelligence);
  const suggestions = floor !== undefined 
    ? allTasks.filter(t => t.floor === floor).slice(0, GRABBA_AUTOPILOT_CONFIG.maxSuggestionsPerFloor)
    : allTasks.slice(0, GRABBA_AUTOPILOT_CONFIG.maxDailyTasks);

  const stats = getTaskStats(allTasks);

  return { suggestions, isLoading, stats };
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useQueueSuggestions() {
  const createTasks = useCreateAutopilotTasks();
  const { data: existingTasks } = useAutopilotTasks({ status: 'pending' });

  const queueSuggestions = async (suggestions: AutopilotTask[]) => {
    // Filter out duplicates (same entity + type within 24h)
    const now = Date.now();
    const duplicateWindow = GRABBA_AUTOPILOT_CONFIG.skipDuplicateWindow;

    const newTasks = suggestions.filter(suggestion => {
      if (!suggestion.entityId) return true;
      
      const isDuplicate = existingTasks?.some((existing: any) => {
        const existingTime = new Date(existing.created_at).getTime();
        return (
          existing.entity_id === suggestion.entityId &&
          existing.type === suggestion.type &&
          (now - existingTime) < duplicateWindow
        );
      });

      return !isDuplicate;
    });

    if (newTasks.length === 0) {
      toast.info('All suggestions are already in the queue');
      return;
    }

    await createTasks.mutateAsync(newTasks);
  };

  return { queueSuggestions, isLoading: createTasks.isPending };
}
