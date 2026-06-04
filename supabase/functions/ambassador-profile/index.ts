import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse ambassador ID from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const ambassadorId = pathParts[pathParts.length - 1];

    if (!ambassadorId || ambassadorId === 'ambassador-profile') {
      return new Response(
        JSON.stringify({ error: 'Ambassador ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching ambassador profile for: ${ambassadorId}`);

    // 1. Fetch ambassador base data
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
      return new Response(
        JSON.stringify({ error: 'Ambassador not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch assignments (stores & wholesalers)
    const { data: assignments, error: assignmentsError } = await supabase
      .from('ambassador_assignments')
      .select(`
        *,
        company:companies(id, name, type, status)
      `)
      .eq('ambassador_id', ambassadorId)
      .order('created_at', { ascending: false });

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
    }

    const storeAssignments = (assignments || []).filter((a: any) => 
      a.role_type === 'store_finder' || a.company?.type === 'store'
    );
    const wholesalerAssignments = (assignments || []).filter((a: any) => 
      a.role_type === 'wholesaler_finder' || a.company?.type === 'wholesaler'
    );

    // 3. Fetch commissions from canonical ledger
    const { data: commissions, error: commissionsError } = await supabase
      .from('commission_ledger')
      .select('*')
      .eq('ambassador_id', ambassadorId)
      .neq('status', 'reversed')
      .order('created_at', { ascending: false });

    if (commissionsError) {
      console.error('Error fetching commissions:', commissionsError);
    }

    // 4. Fetch online sales
    const { data: onlineSales, error: onlineSalesError } = await supabase
      .from('ambassador_online_sales')
      .select('*')
      .eq('ambassador_id', ambassadorId)
      .order('sale_date', { ascending: false });

    if (onlineSalesError) {
      console.error('Error fetching online sales:', onlineSalesError);
    }

    // 5. Calculate KPI metrics
    const pendingCommissions = (commissions || []).filter((c: any) => c.status === 'pending');
    const paidCommissions = (commissions || []).filter((c: any) => c.status === 'paid');
    const completedOnlineSales = (onlineSales || []).filter((s: any) => s.status === 'completed');
    
    const onlineRevenue = completedOnlineSales.reduce((sum: number, s: any) => sum + Number(s.order_amount || 0), 0);
    const onlineCommission = completedOnlineSales.reduce((sum: number, s: any) => sum + Number(s.commission_amount || 0), 0);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentOnlineSales = (onlineSales || []).filter((s: any) => new Date(s.sale_date) >= thirtyDaysAgo);

    // Active vs dormant stores
    const activeStores = storeAssignments.filter((a: any) => 
      a.is_active && (a.company?.status === 'active' || a.company?.status === undefined)
    );
    const dormantStores = storeAssignments.filter((a: any) => 
      a.company?.status === 'dormant' || a.company?.status === 'inactive'
    );

    const kpis = {
      totalEarnings: ambassador.total_earnings || 0,
      pendingEarnings: pendingCommissions.reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0),
      paidEarnings: paidCommissions.reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0),
      storesAcquired: storeAssignments.length,
      storesActive: activeStores.length,
      storesDormant: dormantStores.length,
      wholesalersAcquired: wholesalerAssignments.length,
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

    // 6. Build territory coverage
    const territories = storeAssignments.reduce((acc: any, a: any) => {
      const company = a.company;
      if (company) {
        // Would need store location data - using placeholder
        // In production, join with stores table for boro/neighborhood/zip
      }
      return acc;
    }, { boros: new Set(), neighborhoods: new Set(), zips: new Set() });

    const territoryCoverage = {
      totalStores: storeAssignments.length,
      activeStores: activeStores.length,
      dormantStores: dormantStores.length,
      boros: [],  // Would need store location data
      neighborhoods: [],
      zips: [],
      coverageScore: storeAssignments.length > 0 
        ? Math.round((activeStores.length / storeAssignments.length) * 100) 
        : 0,
    };

    // 7. Build store portfolio (pipeline)
    const storePortfolio = storeAssignments.map((a: any) => ({
      id: a.company?.id || a.id,
      name: a.company?.name || 'Unknown Store',
      status: a.company?.status || (a.is_active ? 'active' : 'inactive'),
      assignedAt: a.created_at,
      roleType: a.role_type,
      commissionRate: a.commission_rate || 0,
      lastActivity: a.updated_at,
    }));

    // 8. Generate performance signals
    const performanceSignals = [];

    // Growth momentum signal
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

    // Portfolio health signal
    if (kpis.storesDormant > kpis.storesActive && kpis.storesAcquired > 0) {
      performanceSignals.push({
        type: 'warning',
        signal: 'Dormant-Heavy Portfolio',
        description: `${kpis.storesDormant} of ${kpis.storesAcquired} stores are dormant`,
        severity: 'warning',
      });
    }

    // Retention signal
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

    // Revenue trajectory
    if (kpis.last30DaysRevenue > kpis.totalRevenue * 0.3 && kpis.totalRevenue > 0) {
      performanceSignals.push({
        type: 'positive',
        signal: 'Growth Trajectory',
        description: 'Strong recent revenue performance',
        severity: 'success',
      });
    }

    // 9. Build final response
    const response = {
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
        region: ambassador.region || null,
        neighborhood: ambassador.neighborhood || null,
        city: ambassador.city || null,
        state: ambassador.state || null,
        tags: ambassador.tags || [],
        createdAt: ambassador.created_at,
      },
      kpis,
      territoryCoverage,
      storePortfolio,
      performanceSignals,
      recentCommissions: (commissions || []).slice(0, 10),
      recentOnlineSales: (onlineSales || []).slice(0, 10),
    };

    console.log('Ambassador profile fetched successfully');

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in ambassador-profile function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
