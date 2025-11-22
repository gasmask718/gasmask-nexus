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

    const { lead_id } = await req.json();

    console.log(`Optimizing assignment fee for lead: ${lead_id}`);

    // Fetch lead and comps
    const { data: lead, error: leadError } = await supabase
      .from("leads_raw")
      .select("*, ai_comps(*)")
      .eq("id", lead_id)
      .single();

    if (leadError) throw leadError;

    const comps = lead.ai_comps?.[0];

    // Fetch recent closings in area for market data
    const { data: recentClosings } = await supabase
      .from("deal_closings")
      .select("assignment_fee, purchase_price")
      .limit(50);

    // Calculate market averages
    const avgAssignmentFee = recentClosings?.length 
      ? recentClosings.reduce((sum, c) => sum + (c.assignment_fee || 0), 0) / recentClosings.length
      : 10000;

    // Use AI to optimize assignment fee
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
            content: 'You are a wholesale real estate pricing expert. Optimize assignment fees for maximum profit.'
          },
          {
            role: 'user',
            content: `Optimize assignment fee for this wholesale deal:

Property: ${lead.address}, ${lead.city}, ${lead.state}
Offer Price: $${comps?.offer_price || lead.estimated_value}
ARV: $${comps?.arv || 'N/A'}
Repair Cost: $${comps?.repair_cost || 'N/A'}
Current Assignment Fee: $${comps?.assignment_fee || avgAssignmentFee}
Market Average Fee: $${avgAssignmentFee}
Property Type: ${lead.property_type}

Analyze:
1. Market demand for this property type
2. Profit margin for end buyer
3. Competitive pricing
4. Maximum fee before buyer walks

Return JSON with: { recommended_fee, min_fee, max_fee, reasoning }`
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
        recommended_fee: Math.round(avgAssignmentFee),
        min_fee: Math.round(avgAssignmentFee * 0.7),
        max_fee: Math.round(avgAssignmentFee * 1.5),
        reasoning: content
      };
    }

    // Update comps with optimized fee
    if (comps) {
      await supabase
        .from("ai_comps")
        .update({ assignment_fee: optimization.recommended_fee })
        .eq("id", comps.id);
    }

    console.log(`Optimized assignment fee: $${optimization.recommended_fee}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        optimization
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error optimizing assignment fee:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});