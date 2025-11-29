// ═══════════════════════════════════════════════════════════════════════════════
// AI PLAYBOOK ENGINE HOOK
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAiCommandEngine, AiParsedPlan } from './useAiCommandEngine';
import { toast } from 'sonner';

export interface PlaybookStep {
  input: string;
  requires_confirmation: boolean;
}

export interface Playbook {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  steps: PlaybookStep[];
  created_at: string;
  updated_at: string;
}

export interface Routine {
  id: string;
  playbook_id: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom_cron';
  next_run_at: string;
  active: boolean;
  notify_user: boolean;
  created_at: string;
  updated_at: string;
  playbook?: Playbook;
}

export interface RoutineLog {
  id: string;
  routine_id: string | null;
  playbook_id: string | null;
  run_at: string;
  result: StepResult[];
  status: 'success' | 'error' | 'pending';
  error_message: string | null;
}

export interface StepResult {
  step: number;
  input: string;
  plan: AiParsedPlan | null;
  success: boolean;
  affectedIds?: string[];
  error?: string;
}

export interface PlaybookRunResult {
  success: boolean;
  stepResults: StepResult[];
  totalAffected: number;
}

export function usePlaybookEngine() {
  const { parseCommand, executePlan, isExecuting } = useAiCommandEngine();
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<number | null>(null);

  // Create a new playbook
  const createPlaybook = useCallback(async (
    title: string,
    description: string,
    steps: PlaybookStep[]
  ): Promise<Playbook | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const { data, error } = await (supabase as any)
        .from('ai_playbooks')
        .insert({
          user_id: userId,
          title,
          description,
          steps,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Playbook created successfully');
      return data;
    } catch (err) {
      console.error('Failed to create playbook:', err);
      toast.error('Failed to create playbook');
      return null;
    }
  }, []);

  // Update an existing playbook
  const updatePlaybook = useCallback(async (
    id: string,
    updates: Partial<Pick<Playbook, 'title' | 'description' | 'steps'>>
  ): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('ai_playbooks')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      toast.success('Playbook updated');
      return true;
    } catch (err) {
      console.error('Failed to update playbook:', err);
      toast.error('Failed to update playbook');
      return false;
    }
  }, []);

  // Delete a playbook
  const deletePlaybook = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('ai_playbooks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Playbook deleted');
      return true;
    } catch (err) {
      console.error('Failed to delete playbook:', err);
      toast.error('Failed to delete playbook');
      return false;
    }
  }, []);

  // Fetch all playbooks
  const fetchPlaybooks = useCallback(async (): Promise<Playbook[]> => {
    try {
      const { data, error } = await (supabase as any)
        .from('ai_playbooks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Failed to fetch playbooks:', err);
      return [];
    }
  }, []);

  // Run a playbook (either by ID or by steps array)
  const runPlaybook = useCallback(async (
    playbookOrSteps: string | PlaybookStep[],
    options?: { skipConfirmation?: boolean }
  ): Promise<PlaybookRunResult> => {
    setIsRunning(true);
    const stepResults: StepResult[] = [];
    let steps: PlaybookStep[] = [];

    try {
      // Get steps from playbook ID or use provided steps
      if (typeof playbookOrSteps === 'string') {
        const { data, error } = await (supabase as any)
          .from('ai_playbooks')
          .select('steps')
          .eq('id', playbookOrSteps)
          .single();

        if (error) throw error;
        steps = data.steps || [];
      } else {
        steps = playbookOrSteps;
      }

      // Execute each step sequentially
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        setCurrentStep(i);

        try {
          // Parse the command
          const plan = await parseCommand(step.input);

          // Check if confirmation is required
          if (step.requires_confirmation && !options?.skipConfirmation) {
            // In automated mode, we skip confirmation steps that require human approval
            stepResults.push({
              step: i,
              input: step.input,
              plan,
              success: false,
              error: 'Step requires confirmation - skipped in automated run',
            });
            continue;
          }

          // Execute the plan
          const result = await executePlan(plan);

          stepResults.push({
            step: i,
            input: step.input,
            plan,
            success: result.success,
            affectedIds: result.affectedIds,
            error: result.success ? undefined : result.message,
          });

        } catch (stepErr) {
          stepResults.push({
            step: i,
            input: step.input,
            plan: null,
            success: false,
            error: stepErr instanceof Error ? stepErr.message : 'Unknown error',
          });
        }
      }

      const allSuccess = stepResults.every(r => r.success);
      const totalAffected = stepResults.reduce(
        (sum, r) => sum + (r.affectedIds?.length || 0), 
        0
      );

      if (allSuccess) {
        toast.success(`Playbook completed: ${totalAffected} records processed`);
      } else {
        toast.warning('Playbook completed with some errors');
      }

      return {
        success: allSuccess,
        stepResults,
        totalAffected,
      };

    } catch (err) {
      console.error('Playbook execution failed:', err);
      toast.error('Playbook execution failed');
      return {
        success: false,
        stepResults,
        totalAffected: 0,
      };
    } finally {
      setIsRunning(false);
      setCurrentStep(null);
    }
  }, [parseCommand, executePlan]);

  // Create a routine for a playbook
  const createRoutine = useCallback(async (
    playbookId: string,
    frequency: Routine['frequency'],
    notifyUser: boolean = true
  ): Promise<Routine | null> => {
    try {
      const nextRun = calculateNextRun(frequency);

      const { data, error } = await (supabase as any)
        .from('ai_routines')
        .insert({
          playbook_id: playbookId,
          frequency,
          next_run_at: nextRun.toISOString(),
          active: true,
          notify_user: notifyUser,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Routine scheduled');
      return data;
    } catch (err) {
      console.error('Failed to create routine:', err);
      toast.error('Failed to create routine');
      return null;
    }
  }, []);

  // Update routine
  const updateRoutine = useCallback(async (
    id: string,
    updates: Partial<Pick<Routine, 'frequency' | 'active' | 'notify_user'>>
  ): Promise<boolean> => {
    try {
      const updateData: any = { ...updates };
      
      if (updates.frequency) {
        updateData.next_run_at = calculateNextRun(updates.frequency).toISOString();
      }

      const { error } = await (supabase as any)
        .from('ai_routines')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      toast.success('Routine updated');
      return true;
    } catch (err) {
      console.error('Failed to update routine:', err);
      toast.error('Failed to update routine');
      return false;
    }
  }, []);

  // Delete routine
  const deleteRoutine = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('ai_routines')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Routine deleted');
      return true;
    } catch (err) {
      console.error('Failed to delete routine:', err);
      toast.error('Failed to delete routine');
      return false;
    }
  }, []);

  // Fetch all routines with playbook info
  const fetchRoutines = useCallback(async (): Promise<Routine[]> => {
    try {
      const { data, error } = await (supabase as any)
        .from('ai_routines')
        .select(`
          *,
          playbook:ai_playbooks(*)
        `)
        .order('next_run_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Failed to fetch routines:', err);
      return [];
    }
  }, []);

  // Fetch routine logs
  const fetchRoutineLogs = useCallback(async (
    routineId?: string,
    limit: number = 20
  ): Promise<RoutineLog[]> => {
    try {
      let query = (supabase as any)
        .from('ai_routine_logs')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(limit);

      if (routineId) {
        query = query.eq('routine_id', routineId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Failed to fetch routine logs:', err);
      return [];
    }
  }, []);

  // Execute a routine (for manual "Run Now")
  const executeRoutine = useCallback(async (routineId: string): Promise<boolean> => {
    try {
      // Get the routine with playbook
      const { data: routine, error: routineError } = await (supabase as any)
        .from('ai_routines')
        .select(`
          *,
          playbook:ai_playbooks(*)
        `)
        .eq('id', routineId)
        .single();

      if (routineError) throw routineError;

      // Run the playbook
      const result = await runPlaybook(routine.playbook.steps, { skipConfirmation: true });

      // Log the result
      await (supabase as any)
        .from('ai_routine_logs')
        .insert({
          routine_id: routineId,
          playbook_id: routine.playbook_id,
          result: result.stepResults,
          status: result.success ? 'success' : 'error',
          error_message: result.success ? null : 'Some steps failed',
        });

      // Update next run time
      const nextRun = calculateNextRun(routine.frequency);
      await (supabase as any)
        .from('ai_routines')
        .update({ next_run_at: nextRun.toISOString() })
        .eq('id', routineId);

      // Send notification if enabled
      if (routine.notify_user) {
        await (supabase as any)
          .from('ai_communication_queue')
          .insert({
            entity_type: 'routine',
            entity_id: routineId,
            suggested_action: 'notification',
            reason: `Routine "${routine.playbook.title}" completed. ${result.totalAffected} records processed.`,
            urgency: 30,
            status: 'pending',
          });
      }

      return result.success;
    } catch (err) {
      console.error('Failed to execute routine:', err);
      toast.error('Failed to execute routine');
      return false;
    }
  }, [runPlaybook]);

  return {
    // State
    isRunning,
    isExecuting,
    currentStep,
    
    // Playbook operations
    createPlaybook,
    updatePlaybook,
    deletePlaybook,
    fetchPlaybooks,
    runPlaybook,
    
    // Routine operations
    createRoutine,
    updateRoutine,
    deleteRoutine,
    fetchRoutines,
    fetchRoutineLogs,
    executeRoutine,
  };
}

// Helper to calculate next run time
function calculateNextRun(frequency: Routine['frequency']): Date {
  const now = new Date();
  
  switch (frequency) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

// Sample playbooks data
export const SAMPLE_PLAYBOOKS: Omit<Playbook, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  {
    title: 'Daily Delivery Readiness Sweep',
    description: 'Prepare all pending deliveries for tomorrow',
    steps: [
      { input: 'Find all pending deliveries for tomorrow', requires_confirmation: false },
      { input: 'Assign them to available drivers', requires_confirmation: true },
      { input: 'Send route notifications to drivers', requires_confirmation: true },
    ],
  },
  {
    title: 'Weekly Unpaid Collections Sweep',
    description: 'Follow up on all unpaid invoices',
    steps: [
      { input: 'Find all unpaid invoices', requires_confirmation: false },
      { input: 'Send text reminders to store owners', requires_confirmation: true },
      { input: 'Schedule follow-up task for next Monday', requires_confirmation: false },
    ],
  },
  {
    title: 'Low Stock Alert & Auto-Route',
    description: 'Create delivery routes for low stock stores',
    steps: [
      { input: 'Find all stores with low stock inventory', requires_confirmation: false },
      { input: 'Create route for them tomorrow at 9am', requires_confirmation: true },
    ],
  },
  {
    title: 'Inactive Store Recovery',
    description: 'Re-engage stores that have been inactive',
    steps: [
      { input: 'Find stores inactive for 14 days', requires_confirmation: false },
      { input: 'Send recovery text message', requires_confirmation: true },
      { input: 'Schedule follow-up for 3 days later', requires_confirmation: false },
    ],
  },
];
