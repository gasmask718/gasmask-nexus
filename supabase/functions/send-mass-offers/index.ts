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

    const { target_count = 100 } = await req.json();

    console.log(`Starting mass offer campaign for ${target_count} leads`);

    // Fetch leads without offers
    const { data: leads, error: leadsError } = await supabase
      .from("leads_raw")
      .select("*, ai_comps(*)")
      .is("offer_sent_date", null)
      .eq("status", "new")
      .limit(target_count);

    if (leadsError) throw leadsError;

    let sentCount = 0;
    const offers = [];

    for (const lead of leads || []) {
      const comps = lead.ai_comps?.[0];
      
      if (!comps?.offer_price) continue;

      // Create offer document
      const offerText = `
Dear ${lead.owner_name},

We are interested in purchasing your property at ${lead.address}, ${lead.city}, ${lead.state} ${lead.zip_code}.

Our cash offer: $${comps.offer_price.toLocaleString()}

This is a no-obligation offer. We can close quickly with cash.

To discuss, reply to this message or call us.

Best regards,
GMA Real Estate
`;

      const { data: offerDoc, error: offerError } = await supabase
        .from("offer_documents")
        .insert([{
          lead_id: lead.id,
          document_type: "loi",
          terms: {
            offer_amount: comps.offer_price,
            property_address: `${lead.address}, ${lead.city}, ${lead.state} ${lead.zip_code}`,
            seller_name: lead.owner_name,
            offer_text: offerText,
          },
        }])
        .select()
        .single();

      if (!offerError) {
        // Mark offer sent
        await supabase
          .from("leads_raw")
          .update({ offer_sent_date: new Date().toISOString() })
          .eq("id", lead.id);

        offers.push(offerDoc);
        sentCount++;
      }
    }

    console.log(`Mass offer campaign completed: ${sentCount} offers sent`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent_count: sentCount,
        offers_created: offers.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error sending mass offers:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
