import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTERNAL_URL = "https://fjrbnbxvpdlmhchddopl.supabase.co";
const EXTERNAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcmJuYnh2cGRsbWhjaGRkb3BsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzY1ODcsImV4cCI6MjA5MDAxMjU4N30.vOGwwkhg17AOReewuKVgay8bePRvH81fC2W1dXWFb-I";

function parseAddress(raw: string | null): {
  address: string;
  city: string;
  state: string;
  zip_code: string;
} {
  if (!raw) return { address: "Unknown", city: "Unknown", state: "NA", zip_code: "00000" };
  // Try "Street, City, ST ZIP"
  const match = raw.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5})/);
  if (match) {
    return { address: match[1].trim(), city: match[2].trim(), state: match[3], zip_code: match[4] };
  }
  return { address: raw, city: "Unknown", state: "NA", zip_code: "00000" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Internal Supabase client (this project)
    const localClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // External Supabase client (BrightSun Solar)
    const extClient = createClient(EXTERNAL_URL, EXTERNAL_ANON_KEY);

    // Fetch all leads from external project
    const { data: externalLeads, error: fetchErr } = await extClient
      .from("solar_master_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!externalLeads || externalLeads.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: "No leads found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing external IDs to avoid duplicates
    const { data: existing } = await localClient
      .from("leads_raw")
      .select("external_sync_id")
      .eq("lead_source", "solar_website")
      .not("external_sync_id", "is", null);

    const existingIds = new Set((existing || []).map((r: any) => r.external_sync_id));

    const newLeads = externalLeads.filter((l: any) => !existingIds.has(l.id));

    if (newLeads.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: "All leads already synced" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map external leads to leads_raw schema
    const mapped = newLeads.map((l: any) => {
      const parsed = parseAddress(l.address);
      return {
        address: parsed.address,
        city: parsed.city,
        state: parsed.state,
        zip_code: parsed.zip_code,
        lead_source: "solar_website",
        owner_name: null,
        owner_phone: l.phone || null,
        owner_email: l.email || null,
        estimated_value: l.yearly_savings ? l.yearly_savings * 20 : null,
        distress_signals: JSON.stringify([
          { type: "solar_interest", bill: l.current_bill, savings: l.estimated_savings },
        ]),
        external_sync_id: l.id,
      };
    });

    const { data: inserted, error: insertErr } = await localClient
      .from("leads_raw")
      .insert(mapped)
      .select("id");

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ synced: inserted?.length || 0, total_external: externalLeads.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
