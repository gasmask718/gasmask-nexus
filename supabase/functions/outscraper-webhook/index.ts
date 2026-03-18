import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const payload = await req.json();
    console.log("[OUTSCRAPER-WEBHOOK] Received payload keys:", Object.keys(payload));

    // Outscraper sends: { id, status, data: [[...businesses]] } or { id, status, data: [...businesses] }
    const jobId = payload.id || payload.request_id || null;
    const rawData = payload.data;

    // Flatten: Outscraper sometimes nests results as data[0] = [businesses]
    let businesses: any[] = [];
    if (Array.isArray(rawData)) {
      if (rawData.length > 0 && Array.isArray(rawData[0])) {
        businesses = rawData[0];
      } else {
        businesses = rawData;
      }
    }

    console.log(`[OUTSCRAPER-WEBHOOK] Job ${jobId}, ${businesses.length} businesses received`);

    if (businesses.length === 0) {
      // Update job as completed with 0 results
      if (jobId) {
        await supabase.from("brandaro_lead_jobs")
          .update({ status: "completed", total_received: 0, completed_at: new Date().toISOString() })
          .eq("outscraper_request_id", jobId);
      }
      return new Response(JSON.stringify({ success: true, inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize leads
    const batchId = `webhook_${jobId || Date.now()}`;
    const leads = businesses.map((b: any) => ({
      business_name: b.name || b.query || "Unknown",
      phone_number: b.phone || b.phone_number || null,
      address: b.full_address || b.address || null,
      city: b.city || null,
      state: b.state || null,
      zip_code: b.postal_code || b.zip_code || null,
      industry: b.category || b.type || null,
      rating: b.rating ? parseFloat(b.rating) : null,
      review_count: b.reviews ? parseInt(b.reviews) : 0,
      website_url: b.site || b.website || null,
      website_status: (!b.site && !b.website) || b.site === "" ? "no_website" : "has_website",
      email: b.email_1 || b.email || null,
      google_maps_url: b.google_maps_url || b.link || null,
      source: "outscraper_webhook",
      import_batch_id: batchId,
      raw_data: b,
    }));

    // Deduplicate against existing CRM by phone
    const phones = leads.filter((l: any) => l.phone_number).map((l: any) => l.phone_number);
    let existingPhones = new Set<string>();
    if (phones.length > 0) {
      const { data: existing } = await supabase
        .from("brandaro_raw_leads")
        .select("phone_number")
        .in("phone_number", phones.slice(0, 200));
      existingPhones = new Set((existing || []).map((e: any) => e.phone_number));
    }

    const unique = leads.filter((l: any) => !l.phone_number || !existingPhones.has(l.phone_number));
    const duplicates = leads.length - unique.length;
    const noWebsite = unique.filter((l: any) => l.website_status === "no_website").length;

    if (unique.length > 0) {
      const { error } = await supabase.from("brandaro_raw_leads").insert(unique);
      if (error) {
        console.error("[OUTSCRAPER-WEBHOOK] Insert error:", error);
        throw error;
      }
    }

    console.log(`[OUTSCRAPER-WEBHOOK] Inserted ${unique.length}, dupes ${duplicates}, no_website ${noWebsite}`);

    // Update job tracking row
    if (jobId) {
      const { error: jobErr } = await supabase.from("brandaro_lead_jobs")
        .update({
          status: "completed",
          total_received: businesses.length,
          inserted_count: unique.length,
          duplicate_count: duplicates,
          no_website_count: noWebsite,
          completed_at: new Date().toISOString(),
        })
        .eq("outscraper_request_id", jobId);
      if (jobErr) console.error("[OUTSCRAPER-WEBHOOK] Job update error:", jobErr);
    }

    return new Response(JSON.stringify({
      success: true,
      total_received: businesses.length,
      inserted: unique.length,
      duplicates,
      no_website: noWebsite,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[OUTSCRAPER-WEBHOOK] Error:", err);

    // Try to mark job as failed
    try {
      const body = await req.clone().json().catch(() => null);
      const jobId = body?.id || body?.request_id;
      if (jobId) {
        await supabase.from("brandaro_lead_jobs")
          .update({ status: "failed", error_message: err.message, completed_at: new Date().toISOString() })
          .eq("outscraper_request_id", jobId);
      }
    } catch (_) { /* best effort */ }

    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
