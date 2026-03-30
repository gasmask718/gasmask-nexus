import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log("🔄 Starting Brandaro lead sync: qualified_leads → leads_master");

    // Fetch all qualified leads
    const { data: qualifiedLeads, error: fetchErr } = await supabase
      .from("brandaro_qualified_leads")
      .select("id, business_name, phone_number, email, industry, city, state, has_website, priority_score, website_status, lead_status")
      .limit(500);

    if (fetchErr) throw fetchErr;
    if (!qualifiedLeads?.length) {
      return new Response(JSON.stringify({ synced: 0, message: "No qualified leads to sync" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing phones in leads_master to avoid duplicates
    const phones = qualifiedLeads.map(l => l.phone_number).filter(Boolean);
    const { data: existing } = await supabase
      .from("brandaro_leads_master")
      .select("phone")
      .in("phone", phones);

    const existingPhones = new Set((existing || []).map(e => e.phone));

    // Filter to only new leads
    const newLeads = qualifiedLeads.filter(l => l.phone_number && !existingPhones.has(l.phone_number));

    if (!newLeads.length) {
      return new Response(JSON.stringify({ synced: 0, skipped: qualifiedLeads.length, message: "All leads already synced" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map qualified leads to leads_master schema
    const inserts = newLeads.map(l => ({
      business_name: l.business_name,
      phone: l.phone_number,
      email: l.email || null,
      industry: l.industry || null,
      location: [l.city, l.state].filter(Boolean).join(", ") || null,
      has_website: l.has_website ?? false,
      source: "qualified_leads_sync",
      status: "new",
      intent_score: Math.round(l.priority_score || 0),
    }));

    // Batch insert
    const batchSize = 50;
    let synced = 0;
    for (let i = 0; i < inserts.length; i += batchSize) {
      const batch = inserts.slice(i, i + batchSize);
      const { error: insertErr } = await supabase.from("brandaro_leads_master").insert(batch);
      if (insertErr) {
        console.error(`❌ Batch insert error at ${i}:`, insertErr);
      } else {
        synced += batch.length;
      }
    }

    console.log(`✅ Lead sync complete: ${synced} new leads synced, ${existingPhones.size} already existed`);

    return new Response(JSON.stringify({
      synced,
      skipped: qualifiedLeads.length - newLeads.length,
      total_qualified: qualifiedLeads.length,
      message: `Synced ${synced} new leads to pipeline`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("❌ Lead sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
