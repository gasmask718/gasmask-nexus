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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { lead_id } = await req.json();

    // Fetch lead and comps
    const { data: lead, error: leadError } = await supabase
      .from("leads_raw")
      .select("*, ai_comps(*)")
      .eq("id", lead_id)
      .single();

    if (leadError) throw leadError;

    console.log(`Finding investors for ${lead.address}`);

    // Fetch active investors
    const { data: investors, error: investorsError } = await supabase
      .from("investor_buy_boxes")
      .select("*")
      .eq("is_active", true);

    if (investorsError) throw investorsError;

    const comps = lead.ai_comps?.[0];
    if (!comps) {
      throw new Error("No comps available for this property");
    }

    // Match investors based on criteria
    const matches = investors.filter(investor => {
      const priceMatch = 
        (!investor.min_price || comps.offer_price >= investor.min_price) &&
        (!investor.max_price || comps.offer_price <= investor.max_price);

      const typeMatch = 
        !investor.preferred_property_types?.length ||
        investor.preferred_property_types.includes(lead.property_type);

      const locationMatch =
        !investor.target_zip_codes?.length ||
        investor.target_zip_codes.includes(lead.zip_code) ||
        !investor.target_cities?.length ||
        investor.target_cities.includes(lead.city) ||
        !investor.target_states?.length ||
        investor.target_states.includes(lead.state);

      return priceMatch && typeMatch && locationMatch;
    });

    // Sort by priority level
    matches.sort((a, b) => (b.priority_level || 0) - (a.priority_level || 0));

    // Create investor orders for top matches
    const orders = await Promise.all(
      matches.slice(0, 5).map(investor =>
        supabase
          .from("investor_orders")
          .insert([{
            investor_id: investor.id,
            lead_id,
            status: 'sent',
          }])
          .select()
          .single()
      )
    );

    console.log(`Matched with ${matches.length} investors, sent to top 5`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        matches: matches.length,
        sent: orders.length,
        topMatches: matches.slice(0, 5).map(i => i.investor_name)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error matching investors:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});