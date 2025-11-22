import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { action, period = 'daily', date } = await req.json();

    if (action === 'generateReport') {
      const reportDate = date ? new Date(date) : new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calculate date range based on period
      let startDate = new Date(reportDate);
      let endDate = new Date(reportDate);
      
      if (period === 'weekly') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === 'monthly') {
        startDate.setMonth(startDate.getMonth() - 1);
      }

      // Fetch revenue data
      const { data: visitLogs } = await supabaseClient
        .from('visit_logs')
        .select('cash_collected, visit_datetime')
        .gte('visit_datetime', startDate.toISOString())
        .lte('visit_datetime', endDate.toISOString());

      const totalRevenue = visitLogs?.reduce((sum, log) => sum + (log.cash_collected || 0), 0) || 0;

      // Fetch store metrics
      const { data: stores } = await supabaseClient
        .from('stores')
        .select('status');

      const activeStores = stores?.filter(s => s.status === 'active').length || 0;
      const inactiveStores = stores?.filter(s => s.status === 'inactive').length || 0;
      const prospects = stores?.filter(s => s.status === 'prospect').length || 0;

      // Fetch route metrics
      const { data: routes } = await supabaseClient
        .from('routes')
        .select('status, estimated_profit, assigned_to')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      const completedRoutes = routes?.filter(r => r.status === 'completed').length || 0;
      const routeRevenue = routes?.reduce((sum, r) => sum + (r.estimated_profit || 0), 0) || 0;

      // Fetch mission metrics
      const { data: missions } = await supabaseClient
        .from('mission_assignments')
        .select('status, user_id, progress_current, progress_target')
        .gte('assigned_at', startDate.toISOString())
        .lte('assigned_at', endDate.toISOString());

      const completedMissions = missions?.filter(m => m.status === 'completed').length || 0;

      // Fetch top performers
      const { data: topPerformers } = await supabaseClient
        .from('worker_scores')
        .select('user_id, xp_total, level, missions_completed, profiles(name)')
        .order('xp_total', { ascending: false })
        .limit(5);

      // Fetch influencer metrics
      const { data: influencers } = await supabaseClient
        .from('influencers')
        .select('status');

      const activeInfluencers = influencers?.filter(i => i.status === 'active').length || 0;

      // Fetch wholesale metrics
      const { data: wholesaleHubs } = await supabaseClient
        .from('wholesale_hubs')
        .select('status');

      const activeWholesalers = wholesaleHubs?.filter(w => w.status === 'active').length || 0;

      // Build report data
      const reportData = {
        summary: {
          totalRevenue,
          activeStores,
          inactiveStores,
          prospects,
          completedRoutes,
          completedMissions,
          activeInfluencers,
          activeWholesalers,
        },
        topPerformers: topPerformers || [],
        routeMetrics: {
          total: routes?.length || 0,
          completed: completedRoutes,
          totalProfit: routeRevenue,
        },
        storeGrowth: {
          active: activeStores,
          inactive: inactiveStores,
          prospects,
          total: stores?.length || 0,
        },
      };

      // Save report
      const { data: report, error } = await supabaseClient
        .from('executive_reports')
        .insert({
          report_date: reportDate.toISOString().split('T')[0],
          period,
          data: reportData,
          delivered_channels: { in_app: true },
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ report }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'getReports') {
      const { limit = 10 } = await req.json();

      const { data: reports } = await supabaseClient
        .from('executive_reports')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(limit);

      return new Response(JSON.stringify({ reports }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in executive-reports function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
