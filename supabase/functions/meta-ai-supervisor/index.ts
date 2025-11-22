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

    console.log('Meta-AI Supervisor: Starting full system scan...');

    // Gather operational data
    const [stores, drivers, routes, checkins, communications, wholesalers, influencers, inventory] = await Promise.all([
      supabase.from('stores').select('*'),
      supabase.from('profiles').select('*').eq('role', 'driver'),
      supabase.from('routes_generated').select('*').gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
      supabase.from('route_checkins').select('*').gte('checkin_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('communication_events').select('*').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('wholesale_hubs').select('*'),
      supabase.from('influencers').select('*'),
      supabase.from('store_product_state').select('*'),
    ]);

    // Build comprehensive system context
    const systemContext = {
      stores: {
        total: stores.data?.length || 0,
        active: stores.data?.filter(s => s.status === 'active').length || 0,
        data: stores.data || [],
      },
      drivers: {
        total: drivers.data?.length || 0,
        data: drivers.data || [],
      },
      routes: {
        total: routes.data?.length || 0,
        avgDistance: routes.data?.reduce((sum, r) => sum + (r.distance_km || 0), 0) / (routes.data?.length || 1),
        data: routes.data || [],
      },
      checkins: {
        total: checkins.data?.length || 0,
        completed: checkins.data?.filter(c => c.completed).length || 0,
        data: checkins.data || [],
      },
      communications: {
        total: communications.data?.length || 0,
        byChannel: communications.data?.reduce((acc: any, c: any) => {
          acc[c.channel] = (acc[c.channel] || 0) + 1;
          return acc;
        }, {}),
        data: communications.data || [],
      },
      wholesalers: {
        total: wholesalers.data?.length || 0,
        data: wholesalers.data || [],
      },
      influencers: {
        total: influencers.data?.length || 0,
        data: influencers.data || [],
      },
      inventory: {
        total: inventory.data?.length || 0,
        criticalStock: inventory.data?.filter(i => i.last_inventory_level === 'out_of_stock' || i.last_inventory_level === 'low').length || 0,
        data: inventory.data || [],
      },
    };

    console.log('System context gathered:', systemContext);

    // Call Lovable AI for analysis
    const prompt = `You are the Meta-AI Supervisor for GasMask OS, a logistics and distribution platform. Analyze this operational data and provide insights:

SYSTEM DATA:
- Stores: ${systemContext.stores.total} (${systemContext.stores.active} active)
- Drivers: ${systemContext.drivers.total}
- Routes (last 7 days): ${systemContext.routes.total}
- Check-ins (last 7 days): ${systemContext.checkins.total} (${systemContext.checkins.completed} completed)
- Communications (last 30 days): ${systemContext.communications.total}
- Wholesalers: ${systemContext.wholesalers.total}
- Influencers: ${systemContext.influencers.total}
- Critical inventory items: ${systemContext.inventory.criticalStock}

ANALYSIS REQUIREMENTS:
1. Identify stores at risk of churning (no recent check-ins, low communication)
2. Detect driver performance issues (low completion rates, slow routes)
3. Flag route inefficiencies
4. Identify inventory shortages requiring urgent action
5. Detect communication gaps (stores not contacted in 30+ days)
6. Find wholesaler engagement opportunities
7. Identify influencer activation needs

Provide recommendations in these categories:
- ALERTS: Critical issues requiring immediate action
- OPPORTUNITIES: Growth or efficiency improvements
- WARNINGS: Predictive issues that may worsen
- ACTIONS: Specific recommended actions
- MISSIONS: Auto-generated tasks for team members

Return valid JSON only.`;

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
            content: 'You are a logistics AI supervisor. Return analysis as structured JSON with alerts, opportunities, warnings, recommendedActions, autoGeneratedMissions, and aiHealthScore (0-100).'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let analysis = JSON.parse(aiData.choices[0].message.content);

    console.log('AI analysis complete:', analysis);

    // Calculate health scores
    const storesHealthAvg = Math.round(systemContext.stores.active / systemContext.stores.total * 100) || 50;
    const driversHealthAvg = Math.round(systemContext.checkins.completed / systemContext.checkins.total * 100) || 50;
    const routesEfficiency = Math.round((systemContext.routes.total / systemContext.drivers.total) * 10) || 50;
    const communicationHealth = Math.min(100, Math.round((systemContext.communications.total / systemContext.stores.total) * 2)) || 50;
    const inventoryHealth = 100 - Math.round((systemContext.inventory.criticalStock / systemContext.inventory.total) * 100) || 50;

    const overallHealthScore = Math.round(
      (storesHealthAvg + driversHealthAvg + routesEfficiency + communicationHealth + inventoryHealth) / 5
    );

    // Save system health snapshot
    await supabase.from('ai_system_health').insert({
      overall_health_score: overallHealthScore,
      stores_health_avg: storesHealthAvg,
      drivers_health_avg: driversHealthAvg,
      routes_efficiency_score: routesEfficiency,
      communication_health_score: communicationHealth,
      inventory_health_score: inventoryHealth,
      insights: analysis,
    });

    // Save recommendations
    const recommendations = [];
    
    if (analysis.alerts) {
      for (const alert of analysis.alerts) {
        recommendations.push({
          category: 'alert',
          severity: 'critical',
          title: alert.title || 'Critical Alert',
          description: alert.description || alert,
          reasoning: alert.reasoning,
          confidence_score: alert.confidence || 90,
        });
      }
    }

    if (analysis.opportunities) {
      for (const opp of analysis.opportunities) {
        recommendations.push({
          category: 'opportunity',
          severity: 'medium',
          title: opp.title || 'Opportunity',
          description: opp.description || opp,
          reasoning: opp.reasoning,
          confidence_score: opp.confidence || 75,
        });
      }
    }

    if (analysis.warnings) {
      for (const warn of analysis.warnings) {
        recommendations.push({
          category: 'warning',
          severity: 'high',
          title: warn.title || 'Warning',
          description: warn.description || warn,
          reasoning: warn.reasoning,
          confidence_score: warn.confidence || 80,
        });
      }
    }

    if (recommendations.length > 0) {
      await supabase.from('ai_recommendations').insert(recommendations);
    }

    console.log(`Saved ${recommendations.length} recommendations`);

    return new Response(JSON.stringify({
      success: true,
      analysis,
      systemHealth: {
        overallHealthScore,
        storesHealthAvg,
        driversHealthAvg,
        routesEfficiency,
        communicationHealth,
        inventoryHealth,
      },
      recommendationsSaved: recommendations.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in meta-ai-supervisor:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
