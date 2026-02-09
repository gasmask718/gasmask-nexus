// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTIONS ENGINE HOOK — Floor 5 Finance & Orders
// Provides unified access to collection accounts, cases, and actions
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CollectionEntityType = 'store' | 'customer' | 'wholesaler' | 'company';
export type CollectionRiskTier = 'low' | 'medium' | 'high' | 'critical';
export type CollectionAccountStatus = 'active' | 'paused' | 'disputed' | 'escalated' | 'closed';
export type CollectionStage = 
  | 'soft_reminder' | 'second_notice' | 'final_notice' | 'payment_plan'
  | 'collections_internal' | 'pre_legal' | 'legal' | 'closed';
export type PromiseStatus = 'active' | 'kept' | 'broken' | 'cancelled';
export type CollectionActionType = 
  | 'email_sent' | 'sms_sent' | 'call_logged' | 'statement_sent' | 'note_added'
  | 'promise_created' | 'promise_broken' | 'promise_kept' | 'escalated' | 'paused'
  | 'dispute_opened' | 'dispute_resolved' | 'assigned' | 'risk_updated';
export type CollectionChannel = 'email' | 'sms' | 'phone' | 'internal' | 'system';

export interface CollectionAccount {
  id: string;
  entity_type: CollectionEntityType;
  entity_id: string;
  entity_name: string | null;
  primary_brand: string | null;
  risk_tier: CollectionRiskTier;
  risk_tier_override: boolean;
  status: CollectionAccountStatus;
  assigned_to_user_id: string | null;
  assigned_ambassador_id: string | null;
  total_outstanding: number;
  total_overdue: number;
  oldest_invoice_date: string | null;
  max_days_overdue: number;
  invoice_count: number;
  notes: string | null;
  last_contact_at: string | null;
  next_action_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollectionCase {
  id: string;
  collection_account_id: string;
  stage: CollectionStage;
  previous_stage: CollectionStage | null;
  reason: string | null;
  escalation_notes: string | null;
  opened_at: string;
  closed_at: string | null;
  closed_reason: string | null;
  created_by: string | null;
  updated_at: string;
}

export interface CollectionAction {
  id: string;
  collection_account_id: string;
  case_id: string | null;
  invoice_id: string | null;
  action_type: CollectionActionType;
  channel: CollectionChannel;
  template_used: string | null;
  subject: string | null;
  message_preview: string | null;
  payload: Record<string, unknown>;
  status: string;
  external_message_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CollectionRule {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  entity_type: CollectionEntityType | null;
  min_balance: number;
  days_overdue_trigger: number;
  risk_tier_trigger: CollectionRiskTier | null;
  action_sequence: ActionSequenceStep[];
  is_enabled: boolean;
  is_auto_send: boolean;
  priority: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionSequenceStep {
  day: number;
  action: CollectionActionType;
  template?: string;
  channel?: CollectionChannel;
  to_stage?: CollectionStage;
}

export interface CollectionQueueItem {
  id: string;
  collection_account_id: string;
  rule_id: string | null;
  action_type: CollectionActionType;
  channel: CollectionChannel;
  template_key: string | null;
  scheduled_for: string;
  status: string;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface CollectionStats {
  total_accounts: number;
  total_outstanding: number;
  total_overdue: number;
  by_risk_tier: Record<CollectionRiskTier, { count: number; amount: number }>;
  by_status: Record<CollectionAccountStatus, number>;
  by_stage: Record<CollectionStage, number>;
  active_promises: number;
  broken_promises_30d: number;
  escalated_count: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTION ACCOUNTS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useCollectionAccounts(filters?: {
  status?: CollectionAccountStatus;
  risk_tier?: CollectionRiskTier;
  entity_type?: CollectionEntityType;
  brand?: string;
  ambassador_id?: string;
}) {
  return useQuery({
    queryKey: ['collection-accounts', filters],
    queryFn: async () => {
      let query = supabase
        .from('collection_accounts')
        .select('*')
        .is('deleted_at', null)
        .order('total_outstanding', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.risk_tier) query = query.eq('risk_tier', filters.risk_tier);
      if (filters?.entity_type) query = query.eq('entity_type', filters.entity_type);
      if (filters?.brand) query = query.eq('primary_brand', filters.brand);
      if (filters?.ambassador_id) query = query.eq('assigned_ambassador_id', filters.ambassador_id);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CollectionAccount[];
    },
  });
}

export function useCollectionAccount(accountId: string | undefined) {
  return useQuery({
    queryKey: ['collection-account', accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data, error } = await supabase
        .from('collection_accounts')
        .select('*')
        .eq('id', accountId)
        .single();
      if (error) throw error;
      return data as CollectionAccount;
    },
    enabled: !!accountId,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTION CASES HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useCollectionCases(accountId?: string) {
  return useQuery({
    queryKey: ['collection-cases', accountId],
    queryFn: async () => {
      let query = supabase
        .from('collection_cases')
        .select('*')
        .order('opened_at', { ascending: false });

      if (accountId) query = query.eq('collection_account_id', accountId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CollectionCase[];
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTION ACTIONS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useCollectionActions(accountId?: string, limit = 50) {
  return useQuery({
    queryKey: ['collection-actions', accountId, limit],
    queryFn: async () => {
      let query = supabase
        .from('collection_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (accountId) query = query.eq('collection_account_id', accountId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(action => ({
        ...action,
        payload: (action.payload as Record<string, unknown>) || {},
      })) as CollectionAction[];
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTION RULES HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useCollectionRules() {
  return useQuery({
    queryKey: ['collection-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_rules')
        .select('*')
        .order('priority', { ascending: true });
      if (error) throw error;
      return (data || []).map(rule => ({
        ...rule,
        action_sequence: (rule.action_sequence as unknown as ActionSequenceStep[]) || [],
      })) as CollectionRule[];
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTION QUEUE HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useCollectionQueue(status: 'pending' | 'processed' | 'failed' = 'pending') {
  return useQuery({
    queryKey: ['collection-queue', status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_queue')
        .select('*')
        .eq('status', status)
        .order('scheduled_for', { ascending: true });
      if (error) throw error;
      return (data || []) as CollectionQueueItem[];
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTION STATS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useCollectionStats() {
  return useQuery({
    queryKey: ['collection-stats'],
    queryFn: async () => {
      // Fetch all accounts for aggregation
      const { data: accounts, error: accountsError } = await supabase
        .from('collection_accounts')
        .select('*')
        .is('deleted_at', null);
      if (accountsError) throw accountsError;

      // Fetch active cases for stage distribution
      const { data: cases, error: casesError } = await supabase
        .from('collection_cases')
        .select('stage')
        .is('closed_at', null);
      if (casesError) throw casesError;

      // Fetch promise stats
      const { data: activePromises, error: promiseError } = await supabase
        .from('payment_promises')
        .select('id')
        .eq('status', 'active');
      if (promiseError) throw promiseError;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: brokenPromises, error: brokenError } = await supabase
        .from('payment_promises')
        .select('id')
        .eq('status', 'broken')
        .gte('broken_at', thirtyDaysAgo.toISOString());
      if (brokenError) throw brokenError;

      // Calculate stats
      const stats: CollectionStats = {
        total_accounts: accounts?.length || 0,
        total_outstanding: 0,
        total_overdue: 0,
        by_risk_tier: {
          low: { count: 0, amount: 0 },
          medium: { count: 0, amount: 0 },
          high: { count: 0, amount: 0 },
          critical: { count: 0, amount: 0 },
        },
        by_status: {
          active: 0,
          paused: 0,
          disputed: 0,
          escalated: 0,
          closed: 0,
        },
        by_stage: {
          soft_reminder: 0,
          second_notice: 0,
          final_notice: 0,
          payment_plan: 0,
          collections_internal: 0,
          pre_legal: 0,
          legal: 0,
          closed: 0,
        },
        active_promises: activePromises?.length || 0,
        broken_promises_30d: brokenPromises?.length || 0,
        escalated_count: 0,
      };

      // Aggregate account data
      (accounts || []).forEach((account: CollectionAccount) => {
        stats.total_outstanding += Number(account.total_outstanding) || 0;
        stats.total_overdue += Number(account.total_overdue) || 0;
        
        if (account.risk_tier in stats.by_risk_tier) {
          stats.by_risk_tier[account.risk_tier].count++;
          stats.by_risk_tier[account.risk_tier].amount += Number(account.total_outstanding) || 0;
        }
        
        if (account.status in stats.by_status) {
          stats.by_status[account.status]++;
        }
        
        if (account.status === 'escalated') {
          stats.escalated_count++;
        }
      });

      // Aggregate case stages
      (cases || []).forEach((c: { stage: CollectionStage }) => {
        if (c.stage in stats.by_stage) {
          stats.by_stage[c.stage]++;
        }
      });

      return stats;
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useCollectionMutations() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Create collection account
  const createAccount = useMutation({
    mutationFn: async (data: Partial<CollectionAccount>) => {
      const insertData = {
        entity_type: data.entity_type!,
        entity_id: data.entity_id!,
        entity_name: data.entity_name,
        primary_brand: data.primary_brand,
        risk_tier: data.risk_tier || 'low',
        status: data.status || 'active',
        assigned_to_user_id: data.assigned_to_user_id,
        assigned_ambassador_id: data.assigned_ambassador_id,
        total_outstanding: data.total_outstanding || 0,
        total_overdue: data.total_overdue || 0,
        notes: data.notes,
      };
      const { data: result, error } = await supabase
        .from('collection_accounts')
        .insert([insertData])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-accounts'] });
      toast({ title: 'Account Created', description: 'Collection account created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update collection account
  const updateAccount = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CollectionAccount> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('collection_accounts')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['collection-account'] });
      toast({ title: 'Account Updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Log collection action
  const logAction = useMutation({
    mutationFn: async (data: {
      collection_account_id: string;
      action_type: CollectionActionType;
      channel: CollectionChannel;
      subject?: string;
      message_preview?: string;
      payload?: Record<string, unknown>;
    }) => {
      const insertData = {
        collection_account_id: data.collection_account_id,
        action_type: data.action_type,
        channel: data.channel,
        subject: data.subject,
        message_preview: data.message_preview,
        payload: data.payload || {},
        created_by: user?.id,
      };
      const { data: result, error } = await (supabase
        .from('collection_actions') as any)
        .insert([insertData])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-actions'] });
    },
  });

  // Escalate account
  const escalateAccount = useMutation({
    mutationFn: async ({ accountId, reason }: { accountId: string; reason: string }) => {
      // Update account status
      await supabase
        .from('collection_accounts')
        .update({ status: 'escalated' })
        .eq('id', accountId);

      // Create escalation case
      const { data: caseData, error: caseError } = await supabase
        .from('collection_cases')
        .insert({
          collection_account_id: accountId,
          stage: 'collections_internal',
          reason,
          created_by: user?.id,
        })
        .select()
        .single();
      if (caseError) throw caseError;

      // Log action
      await supabase
        .from('collection_actions')
        .insert({
          collection_account_id: accountId,
          case_id: caseData.id,
          action_type: 'escalated',
          channel: 'internal',
          message_preview: reason,
          created_by: user?.id,
        });

      return caseData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['collection-cases'] });
      queryClient.invalidateQueries({ queryKey: ['collection-actions'] });
      toast({ title: 'Account Escalated', description: 'Account has been escalated to collections' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update case stage
  const updateCaseStage = useMutation({
    mutationFn: async ({ caseId, stage, notes }: { caseId: string; stage: CollectionStage; notes?: string }) => {
      const { data: existingCase } = await supabase
        .from('collection_cases')
        .select('stage, collection_account_id')
        .eq('id', caseId)
        .single();

      const updateData: Record<string, unknown> = {
        stage,
        previous_stage: existingCase?.stage,
        escalation_notes: notes,
      };

      if (stage === 'closed') {
        updateData.closed_at = new Date().toISOString();
        updateData.closed_reason = notes;
      }

      const { data: result, error } = await supabase
        .from('collection_cases')
        .update(updateData)
        .eq('id', caseId)
        .select()
        .single();
      if (error) throw error;

      // Log action
      if (existingCase?.collection_account_id) {
        await supabase
          .from('collection_actions')
          .insert({
            collection_account_id: existingCase.collection_account_id,
            case_id: caseId,
            action_type: 'escalated',
            channel: 'internal',
            message_preview: `Stage changed to ${stage}`,
            created_by: user?.id,
          });
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-cases'] });
      queryClient.invalidateQueries({ queryKey: ['collection-actions'] });
      toast({ title: 'Case Updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Assign account
  const assignAccount = useMutation({
    mutationFn: async ({ accountId, userId, ambassadorId }: { 
      accountId: string; 
      userId?: string; 
      ambassadorId?: string;
    }) => {
      const updateData: Record<string, unknown> = {};
      if (userId !== undefined) updateData.assigned_to_user_id = userId;
      if (ambassadorId !== undefined) updateData.assigned_ambassador_id = ambassadorId;

      const { data: result, error } = await supabase
        .from('collection_accounts')
        .update(updateData)
        .eq('id', accountId)
        .select()
        .single();
      if (error) throw error;

      // Log action
      await supabase
        .from('collection_actions')
        .insert({
          collection_account_id: accountId,
          action_type: 'assigned',
          channel: 'internal',
          message_preview: `Assigned to ${userId ? 'user' : 'ambassador'}`,
          created_by: user?.id,
        });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['collection-actions'] });
      toast({ title: 'Account Assigned' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle dispute
  const toggleDispute = useMutation({
    mutationFn: async ({ accountId, isDisputed, reason }: { 
      accountId: string; 
      isDisputed: boolean;
      reason?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('collection_accounts')
        .update({ status: isDisputed ? 'disputed' : 'active' })
        .eq('id', accountId)
        .select()
        .single();
      if (error) throw error;

      // Log action
      await supabase
        .from('collection_actions')
        .insert({
          collection_account_id: accountId,
          action_type: isDisputed ? 'dispute_opened' : 'dispute_resolved',
          channel: 'internal',
          message_preview: reason || (isDisputed ? 'Dispute opened' : 'Dispute resolved'),
          created_by: user?.id,
        });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['collection-actions'] });
      toast({ title: 'Dispute Status Updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    createAccount,
    updateAccount,
    logAction,
    escalateAccount,
    updateCaseStage,
    assignAccount,
    toggleDispute,
  };
}
