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

    console.log('Running Scale Engine analysis');

    // Gather metrics
    const { data: pipelineStats } = await supabase
      .from("acquisitions_pipeline")
      .select("status, expected_assignment_fee, created_at");

    const { data: closingStats } = await supabase
      .from("deal_closings")
      .select("assignment_fee, closing_date, net_profit");

    const { data: leadStats } = await supabase
      .from("leads_raw")
      .select("status, lead_source, created_at");

    // Calculate key metrics
    const totalLeads = leadStats?.length || 0;
    const contractedDeals = pipelineStats?.filter(d => d.status === 'signed').length || 0;
    const closedDeals = closingStats?.length || 0;
    const totalRevenue = closingStats?.reduce((sum, d) => sum + (d.assignment_fee || 0), 0) || 0;
    const avgFee = closedDeals > 0 ? totalRevenue / closedDeals : 0;
    const conversionRate = totalLeads > 0 ? (contractedDeals / totalLeads) * 100 : 0;

    // Prepare analysis prompt
    const analysisPrompt = `Analyze this real estate acquisition business data and provide a strategic action plan:

Metrics:
- Total Leads: ${totalLeads}
- Contracted Deals: ${contractedDeals}
- Closed Deals: ${closedDeals}
- Total Revenue: $${totalRevenue.toLocaleString()}
- Average Assignment Fee: $${avgFee.toLocaleString()}
- Lead-to-Contract Conversion: ${conversionRate.toFixed(2)}%
- Goal: $10M/month

Provide:
1. Top 3 bottlenecks limiting scale
2. Specific actions to increase deal flow
3. Recommended markets to expand into
4. Hiring needs (roles and quantities)
5. Offer strategy adjustments
6. Weekly action plan

Format as actionable bullet points.`;

    // Use Lovable AI to generate insights
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
            content: 'You are a real estate business analyst specializing in wholesaling and acquisitions at scale.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const actionPlan = aiData.choices[0].message.content;

    return new Response(
      JSON.stringify({ 
        success: true,
        metrics: {
          totalLeads,
          contractedDeals,
          closedDeals,
          totalRevenue,
          avgFee,
          conversionRate,
        },
        action_plan: actionPlan,
        goal_progress: (totalRevenue / 10000000) * 100,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error running scale engine:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
