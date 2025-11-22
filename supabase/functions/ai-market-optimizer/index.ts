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

    console.log('AI Market Optimizer: Analyzing market performance and opportunities');

    // Fetch market-specific data
    const { data: leads } = await supabase
      .from("leads_raw")
      .select("*, ai_comps(*)");

    const { data: closings } = await supabase
      .from("deal_closings")
      .select("*");

    // Analyze by market
    const marketPerformance: Record<string, any> = {};
    
    leads?.forEach(lead => {
      const market = `${lead.city}, ${lead.state}`;
      if (!marketPerformance[market]) {
        marketPerformance[market] = {
          leads: 0,
          avgValue: 0,
          totalValue: 0,
          closings: 0,
          revenue: 0
        };
      }
      marketPerformance[market].leads++;
      marketPerformance[market].totalValue += lead.estimated_value || 0;
    });

    closings?.forEach(closing => {
      // You'd need to join with leads to get market info
      // Simplified for this example
      marketPerformance['aggregate'] = marketPerformance['aggregate'] || { closings: 0, revenue: 0 };
      marketPerformance['aggregate'].closings++;
      marketPerformance['aggregate'].revenue += closing.assignment_fee || 0;
    });

    // Calculate averages
    Object.keys(marketPerformance).forEach(market => {
      if (marketPerformance[market].leads > 0) {
        marketPerformance[market].avgValue = 
          marketPerformance[market].totalValue / marketPerformance[market].leads;
      }
    });

    // Use AI to optimize market strategy
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
            content: 'You are an AI market analyst for real estate wholesaling. Identify opportunities and optimize resource allocation.'
          },
          {
            role: 'user',
            content: `Analyze market performance and optimize strategy:

MARKET DATA:
${JSON.stringify(marketPerformance, null, 2)}

Provide:
1. Top 3 performing markets (why they work)
2. Top 3 underperforming markets (problems and fixes)
3. 3 new markets to enter (with reasoning)
4. Resource reallocation recommendations
5. Lead generation budget adjustments by market
6. Market-specific strategies

Format as JSON with keys: top_markets, underperforming_markets, new_markets, resource_allocation, budget_adjustments, market_strategies`
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    let optimization;
    try {
      optimization = JSON.parse(content);
    } catch {
      optimization = {
        top_markets: [],
        underperforming_markets: [],
        new_markets: [],
        resource_allocation: {},
        budget_adjustments: {},
        market_strategies: content
      };
    }

    // Store learning
    const { data: learning, error: learningError } = await supabase
      .from("ceo_learning_logs")
      .insert([{
        learning_type: 'market_optimization',
        data_source: 'market_performance_analysis',
        insights: optimization,
        strategy_adjustments: optimization.resource_allocation || {}
      }])
      .select()
      .single();

    if (learningError) throw learningError;

    console.log(`Market optimization complete: ${learning.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        learning_id: learning.id,
        optimization,
        market_performance: marketPerformance
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in market optimizer:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});