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
    const { driverId, storeIds, startingLocation, maxTimeMinutes } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Optimizing route for driver ${driverId} with ${storeIds.length} stores`);

    // Fetch store details
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, name, lat, lng, address_street, address_city, priority')
      .in('id', storeIds);

    if (storesError) throw storesError;

    // Fetch driver info
    const { data: driver } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', driverId)
      .single();

    // Prepare AI prompt
    const storeDetails = stores?.map(s => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      address: `${s.address_street}, ${s.address_city}`,
      priority: s.priority || 'normal'
    })) || [];

    const prompt = `You are a route optimization AI for NYC delivery drivers.

Driver: ${driver?.name || 'Unknown'}
Starting Location: ${JSON.stringify(startingLocation)}
Number of Stops: ${storeDetails.length}
Max Time: ${maxTimeMinutes || 480} minutes

Stores to visit:
${JSON.stringify(storeDetails, null, 2)}

Task:
1. Calculate the most efficient route order considering:
   - Distance between stops
   - Priority stores (visit high priority first when possible)
   - NYC traffic patterns (avoid congested areas during peak hours)
   - Proximity clustering (group nearby stores)
   - Return to starting point efficiency

2. Estimate:
   - Total distance in km
   - Total time including 10-15 min per stop
   - Confidence score (0-100) based on route quality

3. Return ONLY valid JSON in this exact format:
{
  "optimizedOrder": ["store-id-1", "store-id-2", ...],
  "totalDistanceKm": number,
  "estimatedMinutes": number,
  "confidenceScore": number,
  "reasoning": "brief explanation"
}`;

    console.log('Calling Lovable AI for route optimization...');

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a logistics optimization expert. Always return valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    console.log('AI Response:', content);

    // Parse AI response
    let optimizationResult;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      optimizationResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      
      // Fallback: simple distance-based ordering
      console.log('Using fallback route optimization');
      const ordered = [...storeIds];
      optimizationResult = {
        optimizedOrder: ordered,
        totalDistanceKm: ordered.length * 3, // rough estimate
        estimatedMinutes: ordered.length * 25, // 15 min per stop + 10 min travel
        confidenceScore: 50,
        reasoning: 'Fallback route using simple ordering'
      };
    }

    // Save generated route
    const { data: route, error: routeError } = await supabase
      .from('routes_generated')
      .insert({
        driver_id: driverId,
        date: new Date().toISOString().split('T')[0],
        stops: optimizationResult.optimizedOrder,
        distance_km: optimizationResult.totalDistanceKm,
        estimated_minutes: optimizationResult.estimatedMinutes,
        ai_confidence_score: optimizationResult.confidenceScore,
        status: 'active'
      })
      .select()
      .single();

    if (routeError) throw routeError;

    console.log('Route saved successfully:', route.id);

    return new Response(JSON.stringify({
      success: true,
      route,
      optimization: optimizationResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in route-ai:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
