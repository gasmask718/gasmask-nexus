import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Territory AI: Starting analysis...');

    // Fetch regions with basic stats
    const { data: regions, error: regionsError } = await supabase
      .from('regions')
      .select('*');

    if (regionsError) throw regionsError;

    // Fetch stores grouped by state/region
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, name, state, city, zip_code, region_id, store_health_score, status');

    if (storesError) throw storesError;

    // Fetch zip density data
    const { data: zipDensity, error: zipError } = await supabase
      .from('zip_density')
      .select('*');

    if (zipError) throw zipError;

    // Aggregate data by state and region
    const stateAggregates = stores?.reduce((acc: any, store: any) => {
      const state = store.state || 'Unknown';
      if (!acc[state]) {
        acc[state] = {
          storeCount: 0,
          avgHealth: 0,
          activeCount: 0,
          cities: new Set()
        };
      }
      acc[state].storeCount++;
      acc[state].avgHealth += store.store_health_score || 50;
      if (store.status === 'active') acc[state].activeCount++;
      if (store.city) acc[state].cities.add(store.city);
      return acc;
    }, {});

    // Calculate averages
    Object.keys(stateAggregates || {}).forEach(state => {
      const agg = stateAggregates[state];
      agg.avgHealth = agg.storeCount > 0 ? Math.round(agg.avgHealth / agg.storeCount) : 0;
      agg.cities = Array.from(agg.cities);
    });

    const regionSummaries = regions?.map((region: any) => {
      const regionStores = stores?.filter((s: any) => s.region_id === region.id) || [];
      const avgHealth = regionStores.length > 0
        ? regionStores.reduce((sum: number, s: any) => sum + (s.store_health_score || 50), 0) / regionStores.length
        : 0;

      return {
        id: region.id,
        name: region.name,
        state: region.state,
        status: region.status,
        storeCount: regionStores.length,
        avgHealth: Math.round(avgHealth),
        targetStoreCount: region.target_store_count || 0
      };
    });

    // Build compact context for AI
    const context = {
      regions: regionSummaries || [],
      stateAggregates: stateAggregates || {},
      zipDensityCount: zipDensity?.length || 0,
      totalStores: stores?.length || 0
    };

    console.log('Territory AI: Calling Lovable AI...');

    // Call Lovable AI for analysis
    const aiPrompt = `You are GasMask Territory Expansion AI. Analyze this territory data and provide expansion recommendations.

Data Summary:
- Total stores: ${context.totalStores}
- Regions: ${context.regions.length}
- States covered: ${Object.keys(context.stateAggregates).length}

Region Details:
${JSON.stringify(context.regions, null, 2)}

State Aggregates:
${JSON.stringify(context.stateAggregates, null, 2)}

Return a JSON object with the following structure (valid JSON only, no markdown):
{
  "expansionTargets": [
    {
      "regionId": "uuid or null for new",
      "locationName": "city or region name",
      "state": "state code",
      "score": 85,
      "priority": 1,
      "reasoning": "why expand here",
      "recommendedActions": ["action 1", "action 2"]
    }
  ],
  "defenseTargets": [
    {
      "regionId": "uuid",
      "score": 70,
      "reasoning": "why defend this region",
      "recommendedActions": ["action"]
    }
  ],
  "deprioritizeTargets": [
    {
      "regionId": "uuid",
      "score": 30,
      "reasoning": "why deprioritize"
    }
  ],
  "newRegionSuggestions": [
    {
      "state": "NJ",
      "cityCluster": ["Newark", "Jersey City"],
      "rationale": "high density opportunity"
    }
  ],
  "heatmapConfig": {
    "metric": "penetration",
    "notes": "focus areas"
  }
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a territory expansion AI. Always respond with valid JSON only.' },
          { role: 'user', content: aiPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '{}';

    console.log('Territory AI: Parsing AI response...');

    // Parse AI response with fallback
    let analysis;
    try {
      // Remove markdown code blocks if present
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      analysis = {
        expansionTargets: [],
        defenseTargets: [],
        deprioritizeTargets: [],
        newRegionSuggestions: [],
        heatmapConfig: { metric: 'penetration', notes: 'AI parsing failed' }
      };
    }

    console.log('Territory AI: Analysis complete');

    return new Response(
      JSON.stringify({
        success: true,
        ...analysis,
        context: {
          totalRegions: regions?.length || 0,
          totalStores: stores?.length || 0,
          analyzedAt: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Territory AI error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        expansionTargets: [],
        defenseTargets: [],
        deprioritizeTargets: [],
        newRegionSuggestions: [],
        heatmapConfig: { metric: 'penetration', notes: 'Error occurred' }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});