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

    console.log('AI Scaling Strategy: Analyzing growth opportunities');

    // Fetch comprehensive business data
    const [leads, pipeline, closings, investors, campaigns, vas] = await Promise.all([
      supabase.from("leads_raw").select("*").limit(1000),
      supabase.from("acquisitions_pipeline").select("*"),
      supabase.from("deal_closings").select("*"),
      supabase.from("investor_buy_boxes").select("*"),
      supabase.from("mass_offer_campaigns").select("*"),
      supabase.from("vas").select("*")
    ]);

    // Calculate growth metrics
    const leadsByCity: Record<string, number> = {};
    leads.data?.forEach(lead => {
      const key = `${lead.city}, ${lead.state}`;
      leadsByCity[key] = (leadsByCity[key] || 0) + 1;
    });

    const closingsByMonth: Record<string, number> = {};
    closings.data?.forEach(closing => {
      const month = new Date(closing.closing_date).toISOString().slice(0, 7);
      closingsByMonth[month] = (closingsByMonth[month] || 0) + 1;
    });

    // Use AI to generate scaling strategy
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: 'You are an AI CEO specializing in scaling real estate wholesaling operations to $10M/month and beyond.'
          },
          {
            role: 'user',
            content: `Generate a comprehensive scaling strategy:

CURRENT STATE:
- Total Leads: ${leads.data?.length || 0}
- Active Pipeline: ${pipeline.data?.length || 0}
- Deals Closed: ${closings.data?.length || 0}
- Active Investors: ${investors.data?.length || 0}
- Active VAs: ${vas.data?.length || 0}
- Top Markets: ${Object.entries(leadsByCity).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}(${v})`).join(', ')}

Provide strategic recommendations for:
1. Market Expansion (which cities/states to enter)
2. Team Scaling (hiring needs: VAs, closers, analysts)
3. Technology Investments (automation priorities)
4. Budget Allocation (marketing, operations, overhead)
5. Process Optimization (bottleneck removal)
6. Revenue Diversification (new revenue streams)
7. 90-Day Roadmap (milestones and targets)

Format as JSON with keys: market_expansion, team_scaling, technology_investments, budget_allocation, process_optimization, revenue_diversification, roadmap_90_days`
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    let strategy;
    try {
      strategy = JSON.parse(content);
    } catch {
      strategy = {
        market_expansion: [{ market: "requires_analysis", priority: "high" }],
        team_scaling: [{ role: "review_needed", count: 0 }],
        technology_investments: [],
        budget_allocation: {},
        process_optimization: [],
        revenue_diversification: [],
        roadmap_90_days: content
      };
    }

    // Store the strategy
    const { data: storedForecast, error: forecastError } = await supabase
      .from("ceo_forecasts")
      .insert([{
        forecast_type: 'scaling_strategy',
        forecast_period: '90_days',
        metrics: strategy,
        forecast_date: new Date().toISOString().split('T')[0]
      }])
      .select()
      .single();

    if (forecastError) throw forecastError;

    console.log(`Scaling strategy generated: ${storedForecast.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        forecast_id: storedForecast.id,
        strategy
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating scaling strategy:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});