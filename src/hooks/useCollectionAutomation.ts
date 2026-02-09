// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTION AUTOMATION HOOK — Rule Engine & Queue Management
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { 
  CollectionRule, 
  CollectionAccount, 
  CollectionQueueItem,
  CollectionActionType,
  CollectionChannel,
  ActionSequenceStep,
} from './useCollections';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AutomationQueueStats {
  pending_emails: number;
  pending_sms: number;
  pending_calls: number;
  pending_statements: number;
  pending_escalations: number;
  failed_count: number;
  processed_today: number;
}

export interface RuleMatch {
  account: CollectionAccount;
  rule: CollectionRule;
  next_action: ActionSequenceStep;
  days_since_last_action: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE STATS
// ═══════════════════════════════════════════════════════════════════════════════

export function useAutomationQueueStats() {
  return useQuery({
    queryKey: ['automation-queue-stats'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Pending by action type
      const { data: pending, error: pendingError } = await supabase
        .from('collection_queue')
        .select('action_type')
        .eq('status', 'pending');
      if (pendingError) throw pendingError;

      // Failed count
      const { count: failedCount, error: failedError } = await supabase
        .from('collection_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');
      if (failedError) throw failedError;

      // Processed today
      const { count: processedToday, error: processedError } = await supabase
        .from('collection_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'processed')
        .gte('processed_at', today.toISOString());
      if (processedError) throw processedError;

      const pendingItems = pending || [];
      const stats: AutomationQueueStats = {
        pending_emails: pendingItems.filter(p => p.action_type === 'email_sent').length,
        pending_sms: pendingItems.filter(p => p.action_type === 'sms_sent').length,
        pending_calls: pendingItems.filter(p => p.action_type === 'call_logged').length,
        pending_statements: pendingItems.filter(p => p.action_type === 'statement_sent').length,
        pending_escalations: pendingItems.filter(p => p.action_type === 'escalated').length,
        failed_count: failedCount || 0,
        processed_today: processedToday || 0,
      };

      return stats;
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE ITEMS BY TYPE
// ═══════════════════════════════════════════════════════════════════════════════

export function useQueueByType(actionType?: CollectionActionType) {
  return useQuery({
    queryKey: ['collection-queue-by-type', actionType],
    queryFn: async () => {
      let query = supabase
        .from('collection_queue')
        .select('*')
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true });

      if (actionType) {
        query = query.eq('action_type', actionType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CollectionQueueItem[];
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RULE MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useRuleMutations() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Create rule
  const createRule = useMutation({
    mutationFn: async (data: Omit<CollectionRule, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const insertData = {
        name: data.name,
        description: data.description,
        brand: data.brand,
        entity_type: data.entity_type,
        min_balance: data.min_balance,
        days_overdue_trigger: data.days_overdue_trigger,
        risk_tier_trigger: data.risk_tier_trigger,
        action_sequence: data.action_sequence,
        is_enabled: data.is_enabled,
        is_auto_send: data.is_auto_send,
        priority: data.priority,
        created_by: user?.id,
      };
      const { data: result, error } = await (supabase
        .from('collection_rules') as any)
        .insert([insertData])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-rules'] });
      toast({ title: 'Rule Created', description: 'Automation rule created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update rule
  const updateRule = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CollectionRule> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.brand !== undefined) updateData.brand = data.brand;
      if (data.entity_type !== undefined) updateData.entity_type = data.entity_type;
      if (data.min_balance !== undefined) updateData.min_balance = data.min_balance;
      if (data.days_overdue_trigger !== undefined) updateData.days_overdue_trigger = data.days_overdue_trigger;
      if (data.risk_tier_trigger !== undefined) updateData.risk_tier_trigger = data.risk_tier_trigger;
      if (data.action_sequence !== undefined) updateData.action_sequence = data.action_sequence as unknown as Record<string, unknown>[];
      if (data.is_enabled !== undefined) updateData.is_enabled = data.is_enabled;
      if (data.is_auto_send !== undefined) updateData.is_auto_send = data.is_auto_send;
      if (data.priority !== undefined) updateData.priority = data.priority;
      
      const { data: result, error } = await supabase
        .from('collection_rules')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-rules'] });
      toast({ title: 'Rule Updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle rule
  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { data: result, error } = await supabase
        .from('collection_rules')
        .update({ is_enabled: enabled })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (_, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['collection-rules'] });
      toast({ title: enabled ? 'Rule Enabled' : 'Rule Disabled' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete rule
  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('collection_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-rules'] });
      toast({ title: 'Rule Deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    createRule,
    updateRule,
    toggleRule,
    deleteRule,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useQueueMutations() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Process queue item (mark as processed)
  const processQueueItem = useMutation({
    mutationFn: async (itemId: string) => {
      // Get item details
      const { data: item } = await supabase
        .from('collection_queue')
        .select('*')
        .eq('id', itemId)
        .single();

      // Update queue status
      const { data: result, error } = await supabase
        .from('collection_queue')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .select()
        .single();
      if (error) throw error;

      // Create action record
      if (item) {
        await supabase
          .from('collection_actions')
          .insert({
            collection_account_id: item.collection_account_id,
            action_type: item.action_type,
            channel: item.channel,
            template_used: item.template_key,
            status: 'completed',
            created_by: user?.id,
          });
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-queue'] });
      queryClient.invalidateQueries({ queryKey: ['collection-queue-by-type'] });
      queryClient.invalidateQueries({ queryKey: ['automation-queue-stats'] });
      queryClient.invalidateQueries({ queryKey: ['collection-actions'] });
      toast({ title: 'Action Processed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Mark queue item as failed
  const failQueueItem = useMutation({
    mutationFn: async ({ itemId, errorMessage }: { itemId: string; errorMessage: string }) => {
      const { data: result, error } = await supabase
        .from('collection_queue')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('id', itemId)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-queue'] });
      queryClient.invalidateQueries({ queryKey: ['automation-queue-stats'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Retry failed items
  const retryFailed = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('collection_queue')
        .update({
          status: 'pending',
          error_message: null,
        })
        .eq('status', 'failed')
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['collection-queue'] });
      queryClient.invalidateQueries({ queryKey: ['automation-queue-stats'] });
      toast({ title: 'Retrying', description: `${data?.length || 0} items queued for retry` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Add to queue manually
  const addToQueue = useMutation({
    mutationFn: async (data: {
      collection_account_id: string;
      action_type: CollectionActionType;
      channel: CollectionChannel;
      template_key?: string;
      scheduled_for?: Date;
    }) => {
      const { data: result, error } = await supabase
        .from('collection_queue')
        .insert({
          ...data,
          scheduled_for: (data.scheduled_for || new Date()).toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-queue'] });
      queryClient.invalidateQueries({ queryKey: ['automation-queue-stats'] });
      toast({ title: 'Added to Queue' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    processQueueItem,
    failQueueItem,
    retryFailed,
    addToQueue,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION ENGINE (Utility for scheduler)
// ═══════════════════════════════════════════════════════════════════════════════

export async function runAutomationCycle(): Promise<{
  processed: number;
  queued: number;
  errors: string[];
}> {
  const result = { processed: 0, queued: 0, errors: [] as string[] };

  try {
    // 1. Fetch enabled rules
    const { data: rulesData, error: rulesError } = await supabase
      .from('collection_rules')
      .select('*')
      .eq('is_enabled', true)
      .order('priority', { ascending: true });

    if (rulesError) throw rulesError;
    if (!rulesData || rulesData.length === 0) return result;
    
    // Map to typed rules
    const rules: CollectionRule[] = rulesData.map(r => ({
      ...r,
      action_sequence: (r.action_sequence as unknown as ActionSequenceStep[]) || [],
    }));

    // 2. Fetch active accounts with balances
    const { data: accounts, error: accountsError } = await supabase
      .from('collection_accounts')
      .select('*')
      .is('deleted_at', null)
      .in('status', ['active', 'escalated'])
      .gt('total_outstanding', 0);

    if (accountsError) throw accountsError;
    if (!accounts || accounts.length === 0) return result;

    // 3. For each account, find matching rules and determine next action
    for (const account of accounts as CollectionAccount[]) {
      try {
        // Get last action for this account
        const { data: lastAction } = await supabase
          .from('collection_actions')
          .select('action_type, created_at')
          .eq('collection_account_id', account.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const daysSinceLastAction = lastAction 
          ? Math.floor((Date.now() - new Date(lastAction.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : account.max_days_overdue;

        // Check existing queue items to prevent duplicates
        const { data: existingQueue } = await supabase
          .from('collection_queue')
          .select('action_type')
          .eq('collection_account_id', account.id)
          .eq('status', 'pending');

        const queuedActions = new Set((existingQueue || []).map(q => q.action_type));

        // Find matching rules
        for (const rule of rules as CollectionRule[]) {
          // Check rule criteria
          if (rule.min_balance && account.total_outstanding < rule.min_balance) continue;
          if (rule.brand && account.primary_brand !== rule.brand) continue;
          if (rule.entity_type && account.entity_type !== rule.entity_type) continue;
          if (rule.risk_tier_trigger && account.risk_tier !== rule.risk_tier_trigger) continue;

          // Find next action in sequence
          const sequence = (rule.action_sequence || []) as ActionSequenceStep[];
          for (const step of sequence) {
            if (account.max_days_overdue >= step.day && !queuedActions.has(step.action)) {
              // Queue this action
              const channel: CollectionChannel = step.channel || 
                (step.action.includes('email') ? 'email' : 
                 step.action.includes('sms') ? 'sms' : 
                 step.action.includes('call') ? 'phone' : 'internal');

              await supabase
                .from('collection_queue')
                .insert({
                  collection_account_id: account.id,
                  rule_id: rule.id,
                  action_type: step.action,
                  channel,
                  template_key: step.template,
                  scheduled_for: new Date().toISOString(),
                });

              result.queued++;
              queuedActions.add(step.action);
              break; // Only queue one action per rule per account per cycle
            }
          }
        }

        result.processed++;
      } catch (accountError) {
        result.errors.push(`Account ${account.id}: ${accountError}`);
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Automation cycle error: ${error}`);
    return result;
  }
}
