// ═══════════════════════════════════════════════════════════════════════════════
// AUTONOMY GUARDRAILS — Floor 4 Phase 3.5
// Hard enforcement logic preventing autonomy on failure conditions
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export type BlockType = 
  | 'declining_trend'
  | 'critical_exception'
  | 'sla_breach'
  | 'low_reliability'
  | 'insufficient_routes'
  | 'requires_training';

export interface AutonomyBlock {
  id: string;
  worker_id: string;
  block_reason: string;
  block_type: BlockType;
  is_active: boolean;
  blocked_at: string;
  expires_at: string | null;
  cleared_at: string | null;
  cleared_by: string | null;
  context: Record<string, any> | null;
}

export interface AutonomyEligibility {
  eligible: boolean;
  current_level: 'manual_only' | 'assisted' | 'auto_eligible';
  trust_score: number;
  reliability_score: number;
  blocks: Array<{
    type: BlockType;
    message: string;
  }>;
}

// Check worker's autonomy eligibility
export function useAutonomyEligibility(workerId: string) {
  return useQuery({
    queryKey: ['autonomy-eligibility', workerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_autonomy_eligibility', {
        p_worker_id: workerId,
      });
      
      if (error) throw error;
      return data as unknown as AutonomyEligibility;
    },
    enabled: !!workerId,
  });
}

// Fetch active blocks for a worker
export function useWorkerAutonomyBlocks(workerId: string) {
  return useQuery({
    queryKey: ['autonomy-blocks', workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('autonomy_blocks')
        .select('*')
        .eq('worker_id', workerId)
        .eq('is_active', true)
        .order('blocked_at', { ascending: false });
      
      if (error) throw error;
      return data as AutonomyBlock[];
    },
    enabled: !!workerId,
  });
}

// Fetch all active blocks (for ops view)
export function useAllActiveBlocks() {
  return useQuery({
    queryKey: ['all-autonomy-blocks'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('autonomy_blocks') as any)
        .select(`
          *,
          worker:profiles!autonomy_blocks_worker_id_fkey(id, name, role, avatar_url)
        `)
        .eq('is_active', true)
        .order('blocked_at', { ascending: false });
      
      if (error) throw error;
      return data as (AutonomyBlock & { worker: any })[];
    },
    refetchInterval: 60000,
  });
}

// Block management
export function useAutonomyBlockActions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Create a manual block
  const createBlock = useMutation({
    mutationFn: async ({
      workerId,
      blockType,
      reason,
      expiresInDays,
    }: {
      workerId: string;
      blockType: BlockType;
      reason: string;
      expiresInDays?: number;
    }) => {
      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
      
      const { error } = await supabase
        .from('autonomy_blocks')
        .insert({
          worker_id: workerId,
          block_type: blockType,
          block_reason: reason,
          expires_at: expiresAt,
        });
      
      if (error) throw error;
      
      // Update worker's autonomy level to manual_only
      await supabase
        .from('worker_performance')
        .update({ 
          autonomy_level: 'manual_only',
          updated_at: new Date().toISOString(),
        })
        .eq('worker_id', workerId);
    },
    onSuccess: (_, { workerId }) => {
      queryClient.invalidateQueries({ queryKey: ['autonomy-blocks', workerId] });
      queryClient.invalidateQueries({ queryKey: ['all-autonomy-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['worker-performance', workerId] });
      toast.success('Autonomy block created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create block: ${error.message}`);
    },
  });
  
  // Clear a block
  const clearBlock = useMutation({
    mutationFn: async (blockId: string) => {
      const { data: block, error: fetchError } = await supabase
        .from('autonomy_blocks')
        .select('worker_id')
        .eq('id', blockId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const { error } = await supabase
        .from('autonomy_blocks')
        .update({
          is_active: false,
          cleared_at: new Date().toISOString(),
          cleared_by: user?.id,
        })
        .eq('id', blockId);
      
      if (error) throw error;
      
      return block.worker_id;
    },
    onSuccess: (workerId) => {
      queryClient.invalidateQueries({ queryKey: ['autonomy-blocks', workerId] });
      queryClient.invalidateQueries({ queryKey: ['all-autonomy-blocks'] });
      toast.success('Block cleared');
    },
    onError: (error: Error) => {
      toast.error(`Failed to clear block: ${error.message}`);
    },
  });
  
  // Promote autonomy level (with guardrail check)
  const promoteAutonomy = useMutation({
    mutationFn: async ({
      workerId,
      newLevel,
    }: {
      workerId: string;
      newLevel: 'assisted' | 'auto_eligible';
    }) => {
      // First check eligibility
      const { data: eligibility, error: checkError } = await supabase.rpc(
        'check_autonomy_eligibility',
        { p_worker_id: workerId }
      );
      
      if (checkError) throw checkError;
      
      const result = eligibility as unknown as AutonomyEligibility;
      
      if (!result.eligible) {
        const blockMessages = result.blocks?.map(b => b.message).join(', ') || 'Unknown blocks';
        throw new Error(`Cannot promote: ${blockMessages}`);
      }
      
      const { error } = await supabase
        .from('worker_performance')
        .update({
          autonomy_level: newLevel,
          autonomy_promoted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('worker_id', workerId);
      
      if (error) throw error;
    },
    onSuccess: (_, { workerId }) => {
      queryClient.invalidateQueries({ queryKey: ['worker-performance', workerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-performance'] });
      toast.success('Autonomy level updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to promote: ${error.message}`);
    },
  });
  
  // Demote autonomy level
  const demoteAutonomy = useMutation({
    mutationFn: async ({
      workerId,
      reason,
    }: {
      workerId: string;
      reason: string;
    }) => {
      // Create a block record
      await supabase
        .from('autonomy_blocks')
        .insert({
          worker_id: workerId,
          block_type: 'declining_trend',
          block_reason: reason,
        });
      
      // Demote to manual_only
      const { error } = await supabase
        .from('worker_performance')
        .update({
          autonomy_level: 'manual_only',
          updated_at: new Date().toISOString(),
        })
        .eq('worker_id', workerId);
      
      if (error) throw error;
    },
    onSuccess: (_, { workerId }) => {
      queryClient.invalidateQueries({ queryKey: ['worker-performance', workerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-performance'] });
      queryClient.invalidateQueries({ queryKey: ['all-autonomy-blocks'] });
      toast.success('Autonomy level demoted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to demote: ${error.message}`);
    },
  });
  
  return {
    createBlock,
    clearBlock,
    promoteAutonomy,
    demoteAutonomy,
  };
}

// Hook to check if worker can be assigned autonomously
export function useCanAssignAutonomously(workerId: string) {
  const { data: eligibility, isLoading } = useAutonomyEligibility(workerId);
  
  return {
    canAssign: eligibility?.eligible && eligibility?.current_level !== 'manual_only',
    isLoading,
    blocks: eligibility?.blocks || [],
    currentLevel: eligibility?.current_level,
  };
}
