import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════
// Delivery Checklist Task Definitions — Canonical task registry
// ═══════════════════════════════════════════════════════════════

export interface ChecklistTask {
  key: string;
  label: string;
  category: ChecklistCategory;
  required: boolean;
}

export type ChecklistCategory = 
  | 'inventory' 
  | 'orders' 
  | 'growth' 
  | 'contacts' 
  | 'stickers';

export const CHECKLIST_TASKS: ChecklistTask[] = [
  // Inventory Verification
  { key: 'inventory_update_all', label: 'Update tube inventory (ALL brands)', category: 'inventory', required: true },
  { key: 'inventory_exact_count', label: 'Confirm exact counts per brand', category: 'inventory', required: true },
  { key: 'inventory_photo', label: 'Take photo of inventory', category: 'inventory', required: false },
  
  // Orders to Deliver
  { key: 'orders_view', label: 'View orders assigned to this store', category: 'orders', required: false },
  { key: 'orders_confirm', label: 'Confirm items delivered', category: 'orders', required: false },
  { key: 'orders_photo', label: 'Take photo of delivery', category: 'orders', required: false },
  { key: 'orders_recipient', label: 'Record who received the order', category: 'orders', required: false },
  
  // Growth & Opportunity
  { key: 'growth_new_stores', label: 'Ask for additional store locations', category: 'growth', required: false },
  { key: 'growth_sells_flowers', label: 'Ask if they sell flowers', category: 'growth', required: true },
  
  // Contact Intelligence
  { key: 'contacts_boss_name', label: 'Confirm boss/owner name', category: 'contacts', required: true },
  { key: 'contacts_boss_phone', label: 'Confirm boss phone number', category: 'contacts', required: true },
  { key: 'contacts_responsiveness', label: 'Check responsiveness (call/text/none)', category: 'contacts', required: true },
  { key: 'contacts_workers', label: 'Capture worker contact(s) if available', category: 'contacts', required: false },
  { key: 'contacts_replace_unresponsive', label: 'Replace non-responsive numbers', category: 'contacts', required: false },
  { key: 'contacts_who_spoke', label: 'Record who you spoke with', category: 'contacts', required: true },
  
  // Stickers & Visibility
  { key: 'stickers_present', label: 'Stickers present', category: 'stickers', required: true },
  { key: 'stickers_condition', label: 'Sticker condition good', category: 'stickers', required: true },
  { key: 'stickers_added', label: 'Added new stickers if missing', category: 'stickers', required: false },
];

export function getTasksByCategory(category: ChecklistCategory): ChecklistTask[] {
  return CHECKLIST_TASKS.filter(t => t.category === category);
}

export function getRequiredTasks(): ChecklistTask[] {
  return CHECKLIST_TASKS.filter(t => t.required);
}

// ═══════════════════════════════════════════════════════════════
// Checklist completion state
// ═══════════════════════════════════════════════════════════════

export interface TaskCompletion {
  completed: boolean;
  completed_at: string | null;
  metadata?: Record<string, any>;
}

export type TasksCompletedMap = Record<string, TaskCompletion>;

export interface DeliveryChecklist {
  id: string;
  store_id: string;
  user_id: string;
  visit_date: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  tasks_completed: TasksCompletedMap;
  inventory_updates: Record<string, any>;
  order_confirmations: Record<string, any>;
  growth_captures: Record<string, any>;
  contact_updates: Record<string, any>;
  sticker_status: Record<string, any>;
  photo_urls: string[];
  notes: string | null;
}

// ═══════════════════════════════════════════════════════════════
// Hook: Manage delivery checklist for a store visit
// ═══════════════════════════════════════════════════════════════

export function useDeliveryChecklist(storeId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: checklist, isLoading } = useQuery({
    queryKey: ['delivery-checklist', storeId, today],
    queryFn: async () => {
      if (!storeId || !user?.id) return null;

      const { data, error } = await supabase
        .from('delivery_checklists')
        .select('*')
        .eq('store_id', storeId)
        .eq('user_id', user.id)
        .eq('visit_date', today)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        return {
          ...data,
          tasks_completed: (data.tasks_completed || {}) as unknown as TasksCompletedMap,
          inventory_updates: (data.inventory_updates || {}) as Record<string, any>,
          order_confirmations: (data.order_confirmations || {}) as Record<string, any>,
          growth_captures: (data.growth_captures || {}) as Record<string, any>,
          contact_updates: (data.contact_updates || {}) as Record<string, any>,
          sticker_status: (data.sticker_status || {}) as Record<string, any>,
          photo_urls: (data.photo_urls || []) as string[],
        } as DeliveryChecklist;
      }
      
      return null;
    },
    enabled: !!storeId && !!user?.id,
  });

  // Initialize or get existing checklist
  const initChecklist = useMutation({
    mutationFn: async () => {
      if (!storeId || !user?.id) throw new Error('Missing store or user');

      const { data, error } = await supabase
        .from('delivery_checklists')
        .upsert({
          store_id: storeId,
          user_id: user.id,
          visit_date: today,
          status: 'in_progress',
        }, {
          onConflict: 'store_id,user_id,visit_date',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-checklist', storeId, today] });
    },
  });

  // Toggle a task completion
  const toggleTask = useMutation({
    mutationFn: async ({ taskKey, completed, metadata }: { 
      taskKey: string; 
      completed: boolean;
      metadata?: Record<string, any>;
    }) => {
      if (!checklist?.id) {
        // Auto-create checklist if it doesn't exist
        const { data: newChecklist, error: initError } = await supabase
          .from('delivery_checklists')
          .upsert({
            store_id: storeId!,
            user_id: user!.id,
            visit_date: today,
            status: 'in_progress',
          }, {
            onConflict: 'store_id,user_id,visit_date',
          })
          .select()
          .single();

        if (initError) throw initError;

        const currentTasks = (newChecklist?.tasks_completed || {}) as unknown as TasksCompletedMap;
        const updatedTasks: TasksCompletedMap = {
          ...currentTasks,
          [taskKey]: {
            completed,
            completed_at: completed ? new Date().toISOString() : null,
            metadata,
          },
        };

        const { error } = await supabase
          .from('delivery_checklists')
          .update({ tasks_completed: updatedTasks as any })
          .eq('id', newChecklist!.id);

        if (error) throw error;
        return;
      }

      const currentTasks = checklist.tasks_completed || {};
      const updatedTasks: TasksCompletedMap = {
        ...currentTasks,
        [taskKey]: {
          completed,
          completed_at: completed ? new Date().toISOString() : null,
          metadata,
        },
      };

      const { error } = await supabase
        .from('delivery_checklists')
        .update({ tasks_completed: updatedTasks as any })
        .eq('id', checklist.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-checklist', storeId, today] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update task: ${error.message}`);
    },
  });

  // Update structured data section
  const updateSectionData = useMutation({
    mutationFn: async ({ section, data: sectionData }: {
      section: 'inventory_updates' | 'order_confirmations' | 'growth_captures' | 'contact_updates' | 'sticker_status';
      data: Record<string, any>;
    }) => {
      if (!checklist?.id) return;

      const { error } = await supabase
        .from('delivery_checklists')
        .update({ [section]: sectionData as any })
        .eq('id', checklist.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-checklist', storeId, today] });
    },
  });

  // Complete entire checklist
  const completeChecklist = useMutation({
    mutationFn: async () => {
      if (!checklist?.id) throw new Error('No active checklist');

      const { error } = await supabase
        .from('delivery_checklists')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', checklist.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-checklist', storeId, today] });
      toast.success('Delivery checklist completed!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to complete checklist: ${error.message}`);
    },
  });

  // Computed stats
  const tasksCompleted = checklist?.tasks_completed || {};
  const completedCount = Object.values(tasksCompleted).filter(t => t.completed).length;
  const totalTasks = CHECKLIST_TASKS.length;
  const requiredTasks = getRequiredTasks();
  const allRequiredDone = requiredTasks.every(t => tasksCompleted[t.key]?.completed);
  const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const isTaskCompleted = (taskKey: string): boolean => {
    return tasksCompleted[taskKey]?.completed === true;
  };

  const getCategoryProgress = (category: ChecklistCategory) => {
    const categoryTasks = getTasksByCategory(category);
    const done = categoryTasks.filter(t => tasksCompleted[t.key]?.completed).length;
    return { done, total: categoryTasks.length };
  };

  return {
    checklist,
    isLoading,
    initChecklist,
    toggleTask,
    updateSectionData,
    completeChecklist,
    isTaskCompleted,
    getCategoryProgress,
    completedCount,
    totalTasks,
    allRequiredDone,
    progressPercent,
  };
}
