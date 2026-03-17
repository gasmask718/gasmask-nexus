import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { dry_run } = await req.json().catch(() => ({ dry_run: false }));

    const today = new Date().toISOString().split("T")[0];

    // Check if already ran today (idempotency)
    const { data: existingRun } = await supabase
      .from("brandaro_nightly_discovery_log")
      .select("id, status")
      .eq("run_date", today)
      .single();

    if (existingRun?.status === "completed") {
      return new Response(JSON.stringify({ ok: true, already_ran: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or update run log
    const runId = existingRun?.id;
    if (!runId) {
      await supabase.from("brandaro_nightly_discovery_log").insert({
        run_date: today,
        status: "running",
        started_at: new Date().toISOString(),
        sources_queried: ["outscraper_pending", "yelp_pending", "google_maps_pending"],
      });
    } else {
      await supabase.from("brandaro_nightly_discovery_log")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", runId);
    }

    if (dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true, run_date: today }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SHELL: External API calls will be added here when OutScraper/Yelp/Google integrations are configured
    // For now, log the structure and mark as pending_integration
    const results = {
      outscraper: { status: "pending_integration", leads_found: 0 },
      yelp: { status: "pending_integration", leads_found: 0 },
      google_maps: { status: "pending_integration", leads_found: 0 },
    };

    // Update log
    await supabase.from("brandaro_nightly_discovery_log")
      .update({
        status: "completed",
        leads_found: 0,
        sources_queried: Object.entries(results).map(([k, v]) => ({ source: k, ...v })),
        completed_at: new Date().toISOString(),
      })
      .eq("run_date", today);

    console.log(`[NIGHTLY-DISCOVERY] Run complete for ${today}`, results);

    return new Response(JSON.stringify({ ok: true, run_date: today, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Nightly discovery error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
