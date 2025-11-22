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

    const { action, limit = 10, region, brand } = await req.json();

    if (action === 'getTopStoresNeedingVisit') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get all stores with their last visit
      const { data: stores } = await supabaseClient
        .from('stores')
        .select(`
          id, name, address_city, status,
          visit_logs (visit_datetime)
        `)
        .order('visit_logs.visit_datetime', { ascending: false })
        .limit(limit);

      const storesWithScore = stores?.map(store => {
        const lastVisit = store.visit_logs?.[0]?.visit_datetime;
        const daysSinceVisit = lastVisit 
          ? Math.floor((Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        let score = 0;
        if (store.status === 'prospect') score += 50;
        if (store.status === 'inactive') score += 40;
        if (daysSinceVisit > 30) score += 30;
        if (daysSinceVisit > 60) score += 20;

        return { ...store, daysSinceVisit, urgencyScore: score };
      }).sort((a, b) => b.urgencyScore - a.urgencyScore).slice(0, limit);

      return new Response(JSON.stringify({ stores: storesWithScore }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'getExpansionClusters') {
      const { data: prospects } = await supabaseClient
        .from('stores')
        .select('id, name, address_city, address_state, lat, lng')
        .eq('status', 'prospect');

      // Group by city
      const clusters = prospects?.reduce((acc, store) => {
        const city = store.address_city || 'Unknown';
        if (!acc[city]) {
          acc[city] = { city, count: 0, stores: [] };
        }
        acc[city].count++;
        acc[city].stores.push(store);
        return acc;
      }, {} as Record<string, any>);

      const clusterArray = Object.values(clusters || {}).sort((a, b) => b.count - a.count);

      return new Response(JSON.stringify({ clusters: clusterArray }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'recommendInfluencers') {
      let query = supabaseClient
        .from('influencers')
        .select('*')
        .in('status', ['prospect', 'contacted']);

      if (region) {
        query = query.ilike('city', `%${region}%`);
      }

      const { data: influencers } = await query.limit(limit);

      // Score influencers
      const scored = influencers?.map(inf => {
        let score = 0;
        if (inf.engagement_rate > 3) score += 30;
        if (inf.followers >= 5000 && inf.followers <= 500000) score += 20;
        if (inf.status === 'prospect') score += 15;
        
        return { ...inf, recommendationScore: score };
      }).sort((a, b) => b.recommendationScore - a.recommendationScore);

      return new Response(JSON.stringify({ influencers: scored }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'calculateRouteInsights') {
      // Calculate insights for all stores with visit history
      const { data: stores } = await supabaseClient
        .from('stores')
        .select('id');

      const insights = [];

      for (const store of stores || []) {
        const { data: visits } = await supabaseClient
          .from('visit_logs')
          .select('visit_datetime, visit_type')
          .eq('store_id', store.id)
          .order('visit_datetime', { ascending: false })
          .limit(20);

        if (!visits || visits.length === 0) continue;

        // Calculate success rate
        const totalScheduled = visits.length;
        const successful = visits.filter(v => v.visit_type === 'delivery').length;
        const successRate = (successful / totalScheduled) * 100;

        // Calculate avg time patterns
        const hourCounts: Record<number, number> = {};
        visits.forEach(v => {
          const hour = new Date(v.visit_datetime).getHours();
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        const bestHour = Object.entries(hourCounts)
          .sort(([, a], [, b]) => b - a)[0]?.[0];
        
        const bestTimeWindow = bestHour 
          ? `${bestHour}:00-${parseInt(bestHour) + 2}:00`
          : null;

        // Upsert insight
        await supabaseClient
          .from('route_insights')
          .upsert({
            store_id: store.id,
            average_service_time_minutes: 15, // Default estimate
            average_arrival_delay_minutes: 5,
            visit_success_rate: successRate,
            best_time_window: bestTimeWindow,
            notes: `Based on ${visits.length} recent visits`,
          }, { onConflict: 'store_id' });

        insights.push({ store_id: store.id, success_rate: successRate });
      }

      return new Response(JSON.stringify({ insights, calculated: insights.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in optimization function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});