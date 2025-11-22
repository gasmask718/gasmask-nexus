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

    const { action, periodType } = await req.json();

    if (action === 'getCurrentForecast') {
      // Get active stores count
      const { data: stores } = await supabaseClient
        .from('stores')
        .select('id')
        .eq('status', 'member');

      const activeStores = stores?.length || 0;

      // Get wholesale hubs count
      const { data: hubs } = await supabaseClient
        .from('wholesale_hubs')
        .select('id')
        .eq('status', 'active');

      const activeHubs = hubs?.length || 0;

      // Get last 30 days visits for revenue estimation
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: visits } = await supabaseClient
        .from('visit_logs')
        .select('cash_collected')
        .gte('visit_datetime', thirtyDaysAgo.toISOString());

      const last30DaysRevenue = visits?.reduce((sum, v) => sum + (Number(v.cash_collected) || 0), 0) || 0;
      const avgPerStore = activeStores > 0 ? last30DaysRevenue / activeStores : 0;

      // Simple forecast model
      const predictedStoresRevenue = activeStores * avgPerStore * 1.1; // 10% growth assumption
      const predictedWholesaleRevenue = activeHubs * 5000; // $5k avg per hub
      const predictedInfluencerRevenue = 2000; // Static for now

      return new Response(JSON.stringify({
        activeStores,
        activeHubs,
        last30DaysRevenue,
        avgPerStore,
        predictedStoresRevenue,
        predictedWholesaleRevenue,
        predictedInfluencerRevenue,
        predictedTotal: predictedStoresRevenue + predictedWholesaleRevenue + predictedInfluencerRevenue,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'generateSnapshot') {
      const now = new Date();
      const periodStart = periodType === 'weekly' 
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
        : new Date(now.getFullYear(), now.getMonth(), 1);
      
      const periodEnd = periodType === 'weekly'
        ? new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000)
        : new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Get forecast data
      const forecastReq = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/forecasting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization') || '',
        },
        body: JSON.stringify({ action: 'getCurrentForecast' }),
      });

      const forecast = await forecastReq.json();

      const { error } = await supabaseClient
        .from('forecast_snapshots')
        .insert({
          period_type: periodType,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          predicted_revenue_total: forecast.predictedTotal,
          predicted_revenue_stores: forecast.predictedStoresRevenue,
          predicted_revenue_wholesale: forecast.predictedWholesaleRevenue,
          predicted_revenue_influencer: forecast.predictedInfluencerRevenue,
          assumptions: {
            active_stores: forecast.activeStores,
            active_hubs: forecast.activeHubs,
            avg_per_store: forecast.avgPerStore,
          },
        });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in forecasting function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});