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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, store_id } = await req.json();

    if (action === 'analyzeAllStores') {
      console.log('Starting route learning analysis for all stores...');
      
      // Get all stores
      const { data: stores } = await supabaseClient
        .from('stores')
        .select('id, name');

      if (!stores || stores.length === 0) {
        return new Response(JSON.stringify({ message: 'No stores found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const insights = [];
      
      for (const store of stores) {
        const insight = await analyzeStore(supabaseClient, store.id);
        if (insight) insights.push(insight);
      }

      return new Response(JSON.stringify({ 
        message: `Analyzed ${insights.length} stores`,
        insights 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'analyzeStore' && store_id) {
      console.log(`Analyzing route insights for store ${store_id}...`);
      
      const insight = await analyzeStore(supabaseClient, store_id);
      
      return new Response(JSON.stringify({ insight }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in route-learning function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function analyzeStore(supabaseClient: any, store_id: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get visit logs for this store in the last 30 days
  const { data: visitLogs } = await supabaseClient
    .from('visit_logs')
    .select('*')
    .eq('store_id', store_id)
    .gte('visit_datetime', thirtyDaysAgo.toISOString());

  // Get route stops for this store
  const { data: routeStops } = await supabaseClient
    .from('route_stops')
    .select('*, routes(*)')
    .eq('store_id', store_id)
    .gte('routes.date', thirtyDaysAgo.toISOString().split('T')[0]);

  if (!visitLogs || visitLogs.length === 0) {
    console.log(`No visit data for store ${store_id}, skipping...`);
    return null;
  }

  // Calculate metrics
  const totalVisits = visitLogs.length;
  const successfulVisits = visitLogs.filter((v: any) => 
    v.visit_type === 'delivery' && v.cash_collected > 0
  ).length;
  
  const visitSuccessRate = totalVisits > 0 ? (successfulVisits / totalVisits) * 100 : 0;

  // Calculate average service time (mock - would need actual timestamps)
  const avgServiceTime = Math.floor(15 + Math.random() * 20); // 15-35 minutes

  // Determine difficulty score based on success rate
  let difficultyScore = 3; // medium by default
  if (visitSuccessRate > 80) difficultyScore = 1; // easy
  else if (visitSuccessRate > 60) difficultyScore = 2; // easy-medium
  else if (visitSuccessRate > 40) difficultyScore = 3; // medium
  else if (visitSuccessRate > 20) difficultyScore = 4; // hard
  else difficultyScore = 5; // very hard

  // Determine best time window based on successful visits
  const timeWindows: { [key: string]: number } = {};
  visitLogs.forEach((log: any) => {
    if (log.visit_datetime) {
      const hour = new Date(log.visit_datetime).getHours();
      const window = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      timeWindows[window] = (timeWindows[window] || 0) + 1;
    }
  });

  const bestTimeWindow = Object.entries(timeWindows)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'morning';

  // Group recommendation based on location and patterns
  const routeGroup = routeStops && routeStops.length > 0
    ? routeStops[0].routes?.territory || 'unassigned'
    : 'unassigned';

  // Generate insight notes
  const notes = generateInsightNotes(difficultyScore, visitSuccessRate, avgServiceTime, bestTimeWindow);

  // Upsert insights
  const { data: insight, error } = await supabaseClient
    .from('route_insights')
    .upsert({
      store_id,
      average_service_time_minutes: avgServiceTime,
      average_arrival_delay_minutes: Math.floor(Math.random() * 10), // mock data
      difficulty_score: difficultyScore,
      best_time_window: bestTimeWindow,
      recommended_route_group: routeGroup,
      visit_success_rate: visitSuccessRate,
      notes,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'store_id'
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting insight:', error);
    return null;
  }

  console.log(`Successfully analyzed store ${store_id}`);
  return insight;
}

function generateInsightNotes(
  difficulty: number, 
  successRate: number, 
  avgTime: number, 
  bestTime: string
): string {
  const notes = [];
  
  if (difficulty === 1) {
    notes.push('⭐ Smooth store - high success rate and consistent service time.');
  } else if (difficulty === 5) {
    notes.push('⚠️ High friction - requires extra attention or different approach.');
  } else {
    notes.push('⚡ Moderate difficulty - standard procedures apply.');
  }

  if (successRate < 50) {
    notes.push('Low success rate suggests timing or communication issues.');
  }

  if (avgTime > 30) {
    notes.push('Longer service time - factor in additional buffer.');
  }

  notes.push(`Best visited during ${bestTime} hours.`);

  return notes.join(' ');
}