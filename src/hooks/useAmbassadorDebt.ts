// ═══════════════════════════════════════════════════════════════════════════════
// AMBASSADOR DEBT TRACKING HOOK — Accountability & Performance
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CollectionAccount, CollectionRiskTier } from './useCollections';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AmbassadorDebtSummary {
  ambassador_id: string;
  ambassador_name: string | null;
  total_outstanding: number;
  total_overdue: number;
  account_count: number;
  accounts_with_balance: number;
  broken_promises: number;
  risk_distribution: Record<CollectionRiskTier, number>;
  top_delinquent: CollectionAccount[];
}

export interface AmbassadorDebtDetail {
  ambassador_id: string;
  managed_accounts: CollectionAccount[];
  sourced_accounts: CollectionAccount[];
  total_managed_outstanding: number;
  total_sourced_outstanding: number;
  requires_followup: CollectionAccount[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// AMBASSADOR DEBT OVERVIEW (All ambassadors)
// ═══════════════════════════════════════════════════════════════════════════════

export function useAmbassadorDebtOverview() {
  return useQuery({
    queryKey: ['ambassador-debt-overview'],
    queryFn: async () => {
      // Fetch all collection accounts with ambassador assignments
      const { data: accounts, error: accountsError } = await supabase
        .from('collection_accounts')
        .select('*')
        .is('deleted_at', null)
        .not('assigned_ambassador_id', 'is', null)
        .gt('total_outstanding', 0);

      if (accountsError) throw accountsError;

      // Fetch ambassador names
      const ambassadorIds = [...new Set((accounts || []).map(a => a.assigned_ambassador_id).filter(Boolean))];
      const { data: ambassadors } = ambassadorIds.length > 0 
        ? await supabase
            .from('ambassadors')
            .select('id, name')
            .in('id', ambassadorIds as string[])
        : { data: [] };

      const ambassadorMap = new Map((ambassadors || []).map(a => [a.id, a.name]));

      // Fetch broken promises per account
      const { data: brokenPromises } = await supabase
        .from('payment_promises')
        .select('collection_account_id')
        .eq('status', 'broken');

      const brokenByAccount = new Map<string, number>();
      (brokenPromises || []).forEach(p => {
        brokenByAccount.set(p.collection_account_id, (brokenByAccount.get(p.collection_account_id) || 0) + 1);
      });

      // Group by ambassador
      const summaryMap = new Map<string, AmbassadorDebtSummary>();

      (accounts || []).forEach((account: CollectionAccount) => {
        const ambId = account.assigned_ambassador_id!;
        
        if (!summaryMap.has(ambId)) {
          summaryMap.set(ambId, {
            ambassador_id: ambId,
            ambassador_name: ambassadorMap.get(ambId) || null,
            total_outstanding: 0,
            total_overdue: 0,
            account_count: 0,
            accounts_with_balance: 0,
            broken_promises: 0,
            risk_distribution: { low: 0, medium: 0, high: 0, critical: 0 },
            top_delinquent: [],
          });
        }

        const summary = summaryMap.get(ambId)!;
        summary.total_outstanding += Number(account.total_outstanding) || 0;
        summary.total_overdue += Number(account.total_overdue) || 0;
        summary.account_count++;
        if (account.total_outstanding > 0) summary.accounts_with_balance++;
        summary.broken_promises += brokenByAccount.get(account.id) || 0;
        summary.risk_distribution[account.risk_tier]++;
        summary.top_delinquent.push(account);
      });

      // Sort top delinquent and limit
      summaryMap.forEach(summary => {
        summary.top_delinquent = summary.top_delinquent
          .sort((a, b) => b.total_outstanding - a.total_outstanding)
          .slice(0, 10);
      });

      // Convert to array and sort by total outstanding
      return Array.from(summaryMap.values())
        .sort((a, b) => b.total_outstanding - a.total_outstanding);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE AMBASSADOR DEBT DETAIL
// ═══════════════════════════════════════════════════════════════════════════════

export function useAmbassadorDebtDetail(ambassadorId: string | undefined) {
  return useQuery({
    queryKey: ['ambassador-debt-detail', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return null;

      // Fetch managed accounts (assigned to this ambassador)
      const { data: managedAccounts, error: managedError } = await supabase
        .from('collection_accounts')
        .select('*')
        .is('deleted_at', null)
        .eq('assigned_ambassador_id', ambassadorId)
        .gt('total_outstanding', 0)
        .order('total_outstanding', { ascending: false });

      if (managedError) throw managedError;

      // For sourced accounts, we need to check store_master for the original ambassador
      // This requires joining with stores that were sourced by this ambassador
      const { data: sourcedStores }: { data: Array<{ id: string }> | null } = await (supabase as any)
        .from('store_master')
        .select('id')
        .eq('ambassador_id', ambassadorId);

      const sourcedStoreIds: string[] = (sourcedStores || []).map(s => s.id);

      // Get collection accounts for sourced stores
      const { data: sourcedAccounts } = sourcedStoreIds.length > 0 
        ? await supabase
            .from('collection_accounts')
            .select('*')
            .is('deleted_at', null)
            .eq('entity_type', 'store')
            .in('entity_id', sourcedStoreIds)
            .gt('total_outstanding', 0)
            .order('total_outstanding', { ascending: false })
        : { data: [] };

      // Identify accounts requiring followup (high/critical risk or overdue > 30 days)
      const requiresFollowup = (managedAccounts || []).filter((a: CollectionAccount) => 
        a.risk_tier === 'high' || 
        a.risk_tier === 'critical' || 
        a.max_days_overdue > 30
      );

      const detail: AmbassadorDebtDetail = {
        ambassador_id: ambassadorId,
        managed_accounts: (managedAccounts || []) as CollectionAccount[],
        sourced_accounts: (sourcedAccounts || []) as CollectionAccount[],
        total_managed_outstanding: (managedAccounts || []).reduce(
          (sum: number, a: CollectionAccount) => sum + (Number(a.total_outstanding) || 0), 
          0
        ),
        total_sourced_outstanding: (sourcedAccounts || []).reduce(
          (sum: number, a: CollectionAccount) => sum + (Number(a.total_outstanding) || 0), 
          0
        ),
        requires_followup: requiresFollowup as CollectionAccount[],
      };

      return detail;
    },
    enabled: !!ambassadorId,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AMBASSADOR COLLECTIONS TAB DATA (For ambassador profile)
// ═══════════════════════════════════════════════════════════════════════════════

export function useAmbassadorCollectionsTab(ambassadorId: string | undefined) {
  return useQuery({
    queryKey: ['ambassador-collections-tab', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return null;

      // Get all accounts assigned or sourced by this ambassador
      const { data: assignedAccounts } = await supabase
        .from('collection_accounts')
        .select('*')
        .is('deleted_at', null)
        .eq('assigned_ambassador_id', ambassadorId)
        .order('total_outstanding', { ascending: false });

      // Get stores sourced by this ambassador
      const { data: sourcedStores }: { data: Array<{ id: string; store_name: string }> | null } = await (supabase as any)
        .from('store_master')
        .select('id, store_name')
        .eq('ambassador_id', ambassadorId);

      const sourcedStoreIds = (sourcedStores || []).map(s => s.id);
      const sourcedStoreNames = new Map<string, string>(
        (sourcedStores || []).map(s => [s.id, s.store_name])
      );

      // Get collection accounts for sourced stores (even if managed by someone else)
      const { data: sourcedAccounts } = sourcedStoreIds.length > 0
        ? await supabase
            .from('collection_accounts')
            .select('*')
            .is('deleted_at', null)
            .eq('entity_type', 'store')
            .in('entity_id', sourcedStoreIds)
            .order('total_outstanding', { ascending: false })
        : { data: [] };

      // Get recent actions for assigned accounts
      const accountIds = (assignedAccounts || []).map(a => a.id);
      const { data: recentActions } = accountIds.length > 0
        ? await supabase
            .from('collection_actions')
            .select('*')
            .in('collection_account_id', accountIds)
            .order('created_at', { ascending: false })
            .limit(20)
        : { data: [] };

      // Get active promises
      const { data: activePromises } = accountIds.length > 0
        ? await supabase
            .from('payment_promises')
            .select('*')
            .in('collection_account_id', accountIds)
            .eq('status', 'active')
        : { data: [] };

      const assignedList = (assignedAccounts || []) as CollectionAccount[];
      const sourcedList = (sourcedAccounts || []) as CollectionAccount[];
      
      const sourcedWithNames = sourcedList.map(a => ({
        ...a,
        sourced_store_name: sourcedStoreNames.get(a.entity_id) || null,
      }));
      
      return {
        assigned_accounts: assignedList,
        sourced_accounts: sourcedWithNames,
        recent_actions: recentActions || [],
        active_promises: activePromises || [],
        stats: {
          total_assigned: assignedList.length,
          total_sourced: sourcedList.length,
          total_outstanding: assignedList.reduce(
            (sum, a) => sum + (Number(a.total_outstanding) || 0), 
            0
          ),
          high_risk_count: assignedList.filter(
            a => a.risk_tier === 'high' || a.risk_tier === 'critical'
          ).length,
          active_promises_count: (activePromises || []).length,
        },
      };
    },
    enabled: !!ambassadorId,
  });
}
