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

    // Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from("leads_raw")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadError) throw leadError;

    console.log(`Calculating comps for ${lead.address}`);

    // Use Lovable AI to analyze the property
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
            content: 'You are a real estate investment analyst. Analyze properties and provide ARV, repair costs, and offer recommendations.'
          },
          {
            role: 'user',
            content: `Analyze this property and provide investment metrics:
            
Address: ${lead.address}, ${lead.city}, ${lead.state}
Property Type: ${lead.property_type}
Estimated Value: $${lead.estimated_value}
Bedrooms: ${lead.bedrooms || 'unknown'}
Square Feet: ${lead.square_feet || 'unknown'}

Provide:
1. ARV (After Repair Value)
2. As-is value
3. Estimated repair cost
4. Recommended offer price (70% ARV rule)
5. Potential resale price to investor
6. Expected assignment fee

Format as JSON with these exact keys: arv, as_is_value, repair_cost, offer_price, resale_price, assignment_fee`
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const analysis = aiData.choices[0].message.content;
    
    // Parse AI response
    let metrics;
    try {
      metrics = JSON.parse(analysis);
    } catch {
      // If AI doesn't return valid JSON, use conservative estimates
      const arv = lead.estimated_value * 1.1;
      const repair_cost = lead.estimated_value * 0.15;
      const offer_price = arv * 0.70 - repair_cost;
      
      metrics = {
        arv,
        as_is_value: lead.estimated_value * 0.85,
        repair_cost,
        offer_price,
        resale_price: arv * 0.75,
        assignment_fee: offer_price * 0.05,
      };
    }

    // Insert comps into database
    const { data: comps, error: compsError } = await supabase
      .from("ai_comps")
      .insert([{
        lead_id,
        ...metrics,
        profit_margin: metrics.assignment_fee / metrics.offer_price,
      }])
      .select()
      .single();

    if (compsError) throw compsError;

    return new Response(
      JSON.stringify({ success: true, comps }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error calculating comps:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});