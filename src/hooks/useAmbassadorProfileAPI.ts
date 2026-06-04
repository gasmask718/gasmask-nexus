import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AmbassadorKPIs {
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  storesAcquired: number;
  storesActive: number;
  storesDormant: number;
  wholesalersAcquired: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  onlineSalesCount: number;
  onlineSalesRevenue: number;
  onlineCommission: number;
  conversionRate: number;
  last30DaysRevenue: number;
  last30DaysOrders: number;
  retentionRate: number;
}

export interface AmbassadorTerritoryCoverage {
  totalStores: number;
  activeStores: number;
  dormantStores: number;
  boros: string[];
  neighborhoods: string[];
  zips: string[];
  coverageScore: number;
}

export interface AmbassadorStorePortfolio {
  id: string;
  name: string;
  status: string;
  assignedAt: string;
  roleType: string;
  commissionRate: number;
  lastActivity: string;
}

export interface AmbassadorPerformanceSignal {
  type: 'positive' | 'warning' | 'critical';
  signal: string;
  description: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

export interface AmbassadorProfileData {
  ambassador: {
    id: string;
    name: string;
    email: string | null;
    avatarUrl: string | null;
    status: 'active' | 'inactive';
    tier: string | null;
    trackingCode: string | null;
    phoneMain: string | null;
    phoneWhatsapp: string | null;
    socialMedia: string | null;
    region: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    tags: string[];
    createdAt: string;
  };
  kpis: AmbassadorKPIs;
  territoryCoverage: AmbassadorTerritoryCoverage;
  storePortfolio: AmbassadorStorePortfolio[];
  performanceSignals: AmbassadorPerformanceSignal[];
  recentCommissions: any[];
  recentOnlineSales: any[];
}

export function useAmbassadorProfileAPI(ambassadorId: string | null) {
  return useQuery<AmbassadorProfileData | null>({
    queryKey: ['ambassador-profile-api', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return null;

      try {
        // Try edge function first
        const { data, error } = await supabase.functions.invoke('ambassador-profile', {
          body: { ambassadorId },
        });

        if (error) {
          console.warn('Edge function error, falling back to direct query:', error);
          throw error;
        }

        return data as AmbassadorProfileData;
      } catch (error) {
        console.warn('Falling back to direct database query');
        return fetchAmbassadorProfileDirect(ambassadorId);
      }
    },
    enabled: !!ambassadorId,
    staleTime: 30000, // 30 seconds
  });
}

// Fallback direct query function
async function fetchAmbassadorProfileDirect(ambassadorId: string): Promise<AmbassadorProfileData | null> {
  // Fetch ambassador base data
  const { data: ambassador, error: ambassadorError } = await supabase
    .from('ambassadors')
    .select(`
      *,
      profiles:user_id (name, email, avatar_url)
    `)
    .eq('id', ambassadorId)
    .single();

  if (ambassadorError || !ambassador) {
    console.error('Ambassador not found:', ambassadorError);
    return null;
  }

  // Fetch assignments
  const { data: assignments } = await supabase
    .from('ambassador_assignments')
    .select(`
      *,
      company:companies(id, name, type, status)
    `)
    .eq('ambassador_id', ambassadorId);

  // Fetch commissions
  const { data: commissions } = await supabase
    .from('commission_ledger')
    .select('*')
    .eq('ambassador_id', ambassadorId)
    .neq('status', 'reversed')
    .order('created_at', { ascending: false });

  // Fetch online sales
  const { data: onlineSales } = await supabase
    .from('ambassador_online_sales')
    .select('*')
    .eq('ambassador_id', ambassadorId)
    .order('sale_date', { ascending: false });

  const storeAssignments = (assignments || []).filter((a: any) => 
    a.role_type === 'store_finder' || a.company?.type === 'store'
  );
  
  const activeStores = storeAssignments.filter((a: any) => 
    a.is_active && (a.company?.status === 'active' || !a.company?.status)
  );
  const dormantStores = storeAssignments.filter((a: any) => 
    a.company?.status === 'dormant' || a.company?.status === 'inactive'
  );

  const pendingCommissions = (commissions || []).filter((c: any) => c.status === 'pending');
  const paidCommissions = (commissions || []).filter((c: any) => c.status === 'paid');
  const completedOnlineSales = (onlineSales || []).filter((s: any) => s.status === 'completed');
  
  const onlineRevenue = completedOnlineSales.reduce((sum: number, s: any) => sum + Number(s.order_amount || 0), 0);
  const onlineCommission = completedOnlineSales.reduce((sum: number, s: any) => sum + Number(s.commission_amount || 0), 0);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentOnlineSales = (onlineSales || []).filter((s: any) => new Date(s.sale_date) >= thirtyDaysAgo);

  const kpis: AmbassadorKPIs = {
    totalEarnings: ambassador.total_earnings || 0,
    pendingEarnings: pendingCommissions.reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0),
    paidEarnings: paidCommissions.reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0),
    storesAcquired: storeAssignments.length,
    storesActive: activeStores.length,
    storesDormant: dormantStores.length,
    wholesalersAcquired: (assignments || []).filter((a: any) => 
      a.role_type === 'wholesaler_finder' || a.company?.type === 'wholesaler'
    ).length,
    totalOrders: (onlineSales || []).length,
    totalRevenue: onlineRevenue,
    avgOrderValue: (onlineSales || []).length > 0 ? onlineRevenue / (onlineSales || []).length : 0,
    onlineSalesCount: (onlineSales || []).length,
    onlineSalesRevenue: onlineRevenue,
    onlineCommission,
    conversionRate: (onlineSales || []).length > 0 
      ? (completedOnlineSales.length / (onlineSales || []).length) * 100 
      : 0,
    last30DaysRevenue: recentOnlineSales.filter((s: any) => s.status === 'completed').reduce((sum: number, s: any) => sum + Number(s.order_amount || 0), 0),
    last30DaysOrders: recentOnlineSales.length,
    retentionRate: storeAssignments.length > 0 
      ? Math.round((activeStores.length / storeAssignments.length) * 100) 
      : 0,
  };

  // Build performance signals
  const performanceSignals: AmbassadorPerformanceSignal[] = [];

  if (kpis.last30DaysOrders >= 10) {
    performanceSignals.push({
      type: 'positive',
      signal: 'Strong Acquisition Momentum',
      description: `${kpis.last30DaysOrders} orders in last 30 days`,
      severity: 'info',
    });
  } else if (kpis.last30DaysOrders === 0 && kpis.totalOrders > 0) {
    performanceSignals.push({
      type: 'warning',
      signal: 'Activity Drop-Off',
      description: 'No orders in last 30 days',
      severity: 'warning',
    });
  }

  if (kpis.storesDormant > kpis.storesActive && kpis.storesAcquired > 0) {
    performanceSignals.push({
      type: 'warning',
      signal: 'Dormant-Heavy Portfolio',
      description: `${kpis.storesDormant} of ${kpis.storesAcquired} stores are dormant`,
      severity: 'warning',
    });
  }

  if (kpis.retentionRate < 50 && kpis.storesAcquired >= 3) {
    performanceSignals.push({
      type: 'critical',
      signal: 'High Churn Risk',
      description: `Only ${kpis.retentionRate}% store retention`,
      severity: 'error',
    });
  } else if (kpis.retentionRate >= 80) {
    performanceSignals.push({
      type: 'positive',
      signal: 'Excellent Retention',
      description: `${kpis.retentionRate}% store retention rate`,
      severity: 'success',
    });
  }

  return {
    ambassador: {
      id: ambassador.id,
      name: ambassador.name || ambassador.profiles?.name || 'Unknown Ambassador',
      email: ambassador.profiles?.email || null,
      avatarUrl: ambassador.profiles?.avatar_url || null,
      status: ambassador.is_active ? 'active' : 'inactive',
      tier: ambassador.tier || null,
      trackingCode: ambassador.tracking_code || null,
      phoneMain: ambassador.phone_primary || null,
      phoneWhatsapp: ambassador.phone_whatsapp || null,
      socialMedia: ambassador.social_media || null,
      region: (ambassador as any).region || null,
      neighborhood: ambassador.neighborhood || null,
      city: ambassador.city || null,
      state: ambassador.state || null,
      tags: Array.isArray(ambassador.tags) ? ambassador.tags : [],
      createdAt: ambassador.created_at,
    },
    kpis,
    territoryCoverage: {
      totalStores: storeAssignments.length,
      activeStores: activeStores.length,
      dormantStores: dormantStores.length,
      boros: [],
      neighborhoods: [],
      zips: [],
      coverageScore: storeAssignments.length > 0 
        ? Math.round((activeStores.length / storeAssignments.length) * 100) 
        : 0,
    },
    storePortfolio: storeAssignments.map((a: any) => ({
      id: a.company?.id || a.id,
      name: a.company?.name || 'Unknown Store',
      status: a.company?.status || (a.is_active ? 'active' : 'inactive'),
      assignedAt: a.created_at,
      roleType: a.role_type,
      commissionRate: a.commission_rate || 0,
      lastActivity: a.updated_at,
    })),
    performanceSignals,
    recentCommissions: (commissions || []).slice(0, 10),
    recentOnlineSales: (onlineSales || []).slice(0, 10),
  };
}
