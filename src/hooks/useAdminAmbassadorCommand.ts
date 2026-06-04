/**
 * Admin Ambassador Command Intelligence Hook
 * Aggregates all ambassador performance for Floor 8 Command View
 * MASTER GENIUS ARCHITECT: Real-time intelligence for growth operations
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminAmbassadorProfile {
  id: string;
  name: string;
  user_id: string | null;
  tier: string;
  is_active: boolean;
  tracking_code: string;
  referral_code: string | null;
  phone_primary: string | null;
  phone_whatsapp: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  recruited_by_ambassador_id: string | null;
  created_at: string;
  total_earnings: number;
  // Computed metrics
  stores_acquired: number;
  active_stores: number;
  orders_generated: number;
  revenue_generated: number;
  pending_payout: number;
  paid_total: number;
  last_activity: string | null;
  trend: 'improving' | 'stable' | 'declining' | 'new';
  recruits_count: number;
}

export interface AdminCommandMetrics {
  total_ambassadors: number;
  active_today: number;
  stores_acquired_today: number;
  stores_acquired_7d: number;
  stores_acquired_30d: number;
  orders_today: number;
  revenue_today: number;
  pending_payouts: number;
  overdue_followups: number;
  at_risk_ambassadors: number;
}

export interface AdminTopPerformer {
  id: string;
  name: string;
  tier: string;
  stores_acquired: number;
  revenue_generated: number;
  trend: string;
}

export function useAdminAmbassadorCommand() {
  // Fetch all ambassadors with aggregated metrics
  const ambassadorsQuery = useQuery({
    queryKey: ['admin-ambassador-command-all'],
    queryFn: async () => {
      // Get all active ambassadors
      const { data: ambassadors, error: ambError } = await supabase
        .from('ambassadors')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (ambError) throw ambError;

      // Get store assignments per ambassador
      const { data: assignments, error: assignError } = await supabase
        .from('ambassador_assignments')
        .select('ambassador_id, store_id, active, created_at')
        .eq('active', true);

      if (assignError) throw assignError;

      // Get commissions from canonical ledger
      const { data: commissions, error: commError } = await supabase
        .from('commission_ledger')
        .select('ambassador_id, commission_amount, status, created_at, gross_amount')
        .neq('status', 'reversed');

      if (commError) throw commError;

      // Get recruits (ambassadors recruited by other ambassadors)
      const recruitsMap = new Map<string, number>();
      ambassadors?.forEach((a) => {
        if (a.recruited_by_ambassador_id) {
          recruitsMap.set(
            a.recruited_by_ambassador_id,
            (recruitsMap.get(a.recruited_by_ambassador_id) || 0) + 1
          );
        }
      });

      // Build enriched profiles
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const profiles: AdminAmbassadorProfile[] = (ambassadors || []).map((amb) => {
        const ambAssignments = (assignments || []).filter(a => a.ambassador_id === amb.id);
        const ambCommissions = (commissions || []).filter(c => c.ambassador_id === amb.id);
        
        const storesAcquired = ambAssignments.length;
        const activeStores = ambAssignments.filter(a => a.active).length;
        
        const pendingCommissions = ambCommissions.filter(c => c.status === 'pending');
        const paidCommissions = ambCommissions.filter(c => c.status === 'paid');
        
        const pendingPayout = pendingCommissions.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);
        const paidTotal = paidCommissions.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);
        const revenueGenerated = ambCommissions.reduce((sum, c) => sum + Number(c.gross_amount || 0), 0);
        
        // Calculate trend based on recent activity
        const recentAssignments = ambAssignments.filter(
          a => new Date(a.created_at) >= thirtyDaysAgo
        ).length;
        const recentCommissions = ambCommissions.filter(
          c => new Date(c.created_at) >= thirtyDaysAgo
        ).length;
        
        let trend: 'improving' | 'stable' | 'declining' | 'new' = 'stable';
        const accountAge = (now.getTime() - new Date(amb.created_at).getTime()) / (24 * 60 * 60 * 1000);
        
        if (accountAge < 30) {
          trend = 'new';
        } else if (recentAssignments >= 3 || recentCommissions >= 5) {
          trend = 'improving';
        } else if (recentAssignments === 0 && recentCommissions === 0) {
          trend = 'declining';
        }

        // Last activity
        const lastAssignment = ambAssignments.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        const lastCommission = ambCommissions.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        
        let lastActivity: string | null = null;
        if (lastAssignment && lastCommission) {
          lastActivity = new Date(lastAssignment.created_at) > new Date(lastCommission.created_at)
            ? lastAssignment.created_at
            : lastCommission.created_at;
        } else if (lastAssignment) {
          lastActivity = lastAssignment.created_at;
        } else if (lastCommission) {
          lastActivity = lastCommission.created_at;
        }

        return {
          id: amb.id,
          name: amb.name || 'Unnamed Ambassador',
          user_id: amb.user_id,
          tier: amb.tier || 'starter',
          is_active: amb.is_active,
          tracking_code: amb.tracking_code,
          referral_code: amb.referral_code,
          phone_primary: amb.phone_primary,
          phone_whatsapp: amb.phone_whatsapp,
          city: amb.city,
          state: amb.state,
          neighborhood: amb.neighborhood,
          recruited_by_ambassador_id: amb.recruited_by_ambassador_id,
          created_at: amb.created_at,
          total_earnings: Number(amb.total_earnings || 0),
          stores_acquired: storesAcquired,
          active_stores: activeStores,
          orders_generated: ambCommissions.length,
          revenue_generated: revenueGenerated,
          pending_payout: pendingPayout,
          paid_total: paidTotal,
          last_activity: lastActivity,
          trend,
          recruits_count: recruitsMap.get(amb.id) || 0,
        };
      });

      return profiles;
    },
    staleTime: 30000, // 30 seconds
  });

  // Calculate command metrics
  const commandMetrics = useQuery({
    queryKey: ['admin-ambassador-command-metrics'],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Get counts
      const { count: totalAmbassadors } = await supabase
        .from('ambassadors')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: storesToday } = await supabase
        .from('ambassador_assignments')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart)
        .eq('active', true);

      const { count: stores7d } = await supabase
        .from('ambassador_assignments')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo)
        .eq('active', true);

      const { count: stores30d } = await supabase
        .from('ambassador_assignments')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo)
        .eq('active', true);

      // Get pending payouts
      const { data: pendingPayouts } = await supabase
        .from('commission_ledger')
        .select('commission_amount')
        .eq('status', 'pending');

      const totalPending = (pendingPayouts || []).reduce(
        (sum, c) => sum + Number(c.commission_amount || 0), 0
      );

      // Get today's revenue from commissions
      const { data: todayCommissions } = await supabase
        .from('commission_ledger')
        .select('gross_amount')
        .neq('status', 'reversed')
        .gte('created_at', todayStart);

      const revenueToday = (todayCommissions || []).reduce(
        (sum, c) => sum + Number(c.gross_amount || 0), 0
      );

      return {
        total_ambassadors: totalAmbassadors || 0,
        active_today: 0, // Would need activity log
        stores_acquired_today: storesToday || 0,
        stores_acquired_7d: stores7d || 0,
        stores_acquired_30d: stores30d || 0,
        orders_today: todayCommissions?.length || 0,
        revenue_today: revenueToday,
        pending_payouts: totalPending,
        overdue_followups: 0, // Would need follow-up system
        at_risk_ambassadors: 0, // Calculated from trends
      } satisfies AdminCommandMetrics;
    },
    staleTime: 60000, // 1 minute
  });

  // Derive top performers
  const topPerformers: AdminTopPerformer[] = (ambassadorsQuery.data || [])
    .sort((a, b) => b.revenue_generated - a.revenue_generated)
    .slice(0, 5)
    .map(a => ({
      id: a.id,
      name: a.name,
      tier: a.tier,
      stores_acquired: a.stores_acquired,
      revenue_generated: a.revenue_generated,
      trend: a.trend,
    }));

  // At-risk ambassadors (declining trend or no recent activity)
  const atRiskAmbassadors = (ambassadorsQuery.data || [])
    .filter(a => a.trend === 'declining')
    .slice(0, 10);

  const defaultMetrics: AdminCommandMetrics = {
    total_ambassadors: 0,
    active_today: 0,
    stores_acquired_today: 0,
    stores_acquired_7d: 0,
    stores_acquired_30d: 0,
    orders_today: 0,
    revenue_today: 0,
    pending_payouts: 0,
    overdue_followups: 0,
    at_risk_ambassadors: atRiskAmbassadors.length,
  };

  return {
    ambassadors: ambassadorsQuery.data || [],
    metrics: commandMetrics.data || defaultMetrics,
    topPerformers,
    atRiskAmbassadors,
    isLoading: ambassadorsQuery.isLoading || commandMetrics.isLoading,
    isError: ambassadorsQuery.isError || commandMetrics.isError,
    refetch: () => {
      ambassadorsQuery.refetch();
      commandMetrics.refetch();
    },
  };
}
