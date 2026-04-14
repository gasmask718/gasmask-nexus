import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const leads = Array.isArray(body) ? body : [body];

    if (leads.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No leads provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase
      .from("brandaro_leads_intake")
      .insert(
        leads.map((lead: Record<string, unknown>) => ({
          business_name: lead.business_name || lead.name,
          phone: lead.phone || lead.phone_number,
          category: lead.category || lead.industry,
          city: lead.city,
          state: lead.state,
          area_code: lead.area_code,
          full_address: lead.full_address || lead.address,
          website: lead.website,
          rating: lead.rating,
          reviews_count: lead.reviews_count || lead.review_count,
          source: "outscraper",
        }))
      );

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        inserted: leads.length,
        message: `${leads.length} leads received and syncing to pipeline`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
