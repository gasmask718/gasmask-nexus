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

    console.log('Starting auto-assignment of signed deals');

    // Fetch signed deals without assignments
    const { data: signedDeals, error: dealsError } = await supabase
      .from("acquisitions_pipeline")
      .select(`
        *,
        leads_raw(*, ai_comps(*))
      `)
      .eq("status", "signed")
      .is("buyer_name", null);

    if (dealsError) throw dealsError;

    let assignedCount = 0;

    for (const deal of signedDeals || []) {
      const lead = deal.leads_raw;
      const comps = lead?.ai_comps?.[0];
      
      if (!comps) continue;

      // Find matching investors with active subscriptions
      const { data: investors, error: investorsError } = await supabase
        .from("investor_buy_boxes")
        .select(`
          *,
          investor_subscriptions!inner(*)
        `)
        .eq("is_active", true)
        .eq("investor_subscriptions.active", true)
        .order("investor_subscriptions.tier", { ascending: false });

      if (investorsError) throw investorsError;

      // Match based on buy box criteria
      const matches = investors?.filter(investor => {
        const priceMatch = 
          (!investor.min_price || comps.resale_price >= investor.min_price) &&
          (!investor.max_price || comps.resale_price <= investor.max_price);

        const typeMatch = 
          !investor.preferred_property_types?.length ||
          investor.preferred_property_types.includes(lead.property_type);

        const locationMatch =
          !investor.target_zip_codes?.length ||
          investor.target_zip_codes.includes(lead.zip_code);

        return priceMatch && typeMatch && locationMatch;
      }) || [];

      if (matches.length > 0) {
        const bestInvestor = matches[0];

        // Create investor order
        const { error: orderError } = await supabase
          .from("investor_orders")
          .insert([{
            investor_id: bestInvestor.id,
            lead_id: lead.id,
            status: 'sent',
          }]);

        if (!orderError) {
          // Update acquisition pipeline
          await supabase
            .from("acquisitions_pipeline")
            .update({
              buyer_name: bestInvestor.investor_name,
              buyer_contact: bestInvestor.contact_email,
              status: 'assigned',
            })
            .eq("id", deal.id);

          // Create notification
          await supabase
            .from("real_estate_notifications")
            .insert([{
              notification_type: 'buyer_assigned',
              entity_type: 'acquisition',
              entity_id: deal.id,
              title: 'Deal Assigned to Investor',
              message: `${lead.address} has been assigned to ${bestInvestor.investor_name}`,
              priority: 'high',
            }]);

          assignedCount++;
        }
      }
    }

    console.log(`Auto-assignment completed: ${assignedCount} deals assigned`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        assigned_count: assignedCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error auto-assigning deals:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
