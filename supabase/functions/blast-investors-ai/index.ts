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

    const { deal_sheet_id, lead_id } = await req.json();

    console.log(`Blasting deal sheet ${deal_sheet_id} to investors`);

    // Fetch deal sheet
    const { data: dealSheet, error: sheetError } = await supabase
      .from("deal_sheets")
      .select("*")
      .eq("id", deal_sheet_id)
      .single();

    if (sheetError) throw sheetError;

    // Fetch lead for matching
    const { data: lead, error: leadError } = await supabase
      .from("leads_raw")
      .select("*, ai_comps(*)")
      .eq("id", lead_id)
      .single();

    if (leadError) throw leadError;

    const comps = lead.ai_comps?.[0];

    // Fetch matching investors
    const { data: investors, error: investorsError } = await supabase
      .from("investor_buy_boxes")
      .select("*")
      .eq("is_active", true);

    if (investorsError) throw investorsError;

    // Match investors based on buy box criteria
    const matches = investors?.filter(investor => {
      const priceMatch = 
        (!investor.min_price || (comps?.offer_price || 0) >= investor.min_price) &&
        (!investor.max_price || (comps?.offer_price || 0) <= investor.max_price);

      const typeMatch = 
        !investor.preferred_property_types?.length ||
        investor.preferred_property_types.includes(lead.property_type);

      const locationMatch =
        !investor.target_zip_codes?.length ||
        investor.target_zip_codes.includes(lead.zip_code);

      return priceMatch && typeMatch && locationMatch;
    }) || [];

    console.log(`Found ${matches.length} matching investors`);

    // Log email sends
    const emailLogs = await Promise.all(
      matches.map(investor =>
        supabase
          .from("investor_email_logs")
          .insert([{
            deal_sheet_id,
            investor_id: investor.id,
            investor_email: investor.contact_email,
            interest_level: 'pending'
          }])
          .select()
          .single()
      )
    );

    // Create engagement records
    await Promise.all(
      matches.map(investor =>
        supabase
          .from("investor_engagement")
          .insert([{
            investor_id: investor.id,
            deal_sheet_id,
            engagement_type: 'email_sent',
            engagement_score: 1
          }])
      )
    );

    console.log(`Sent to ${matches.length} investors`);

    return new Response(
      JSON.stringify({ 
        success: true,
        investors_contacted: matches.length,
        top_matches: matches.slice(0, 5).map(i => ({
          name: i.investor_name,
          email: i.contact_email
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error blasting investors:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});