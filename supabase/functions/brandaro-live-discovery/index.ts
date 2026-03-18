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

  try {
    const { query, location, limit, dry_run } = await req.json();

    if (dry_run) {
      return new Response(JSON.stringify({ status: "ok", engine: "brandaro-live-discovery" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!query) throw new Error("query is required (e.g. 'restaurants', 'plumber')");
    if (!location) throw new Error("location is required (e.g. 'Brooklyn, NY')");

    const outscrapeApiKey = Deno.env.get("OUTSCRAPER_API_KEY");
    if (!outscrapeApiKey) throw new Error("OUTSCRAPER_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const searchQuery = `${query} ${location}`;
    const outscrapeLimit = Math.min(limit || 50, 100);

    // Build webhook URL for async results
    const webhookUrl = `${supabaseUrl}/functions/v1/outscraper-webhook`;

    // Submit async job to Outscraper
    const url = `https://api.app.outscraper.com/maps/search-v3?query=${encodeURIComponent(searchQuery)}&limit=${outscrapeLimit}&async=true&webhook=${encodeURIComponent(webhookUrl)}`;

    console.log(`[LIVE-DISCOVERY] Submitting async job: ${searchQuery}, limit=${outscrapeLimit}, webhook=${webhookUrl}`);

    const response = await fetch(url, {
      headers: { "X-API-KEY": outscrapeApiKey },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Outscraper API error [${response.status}]: ${errText}`);
    }

    const result = await response.json();
    const requestId = result?.id || result?.request_id || null;

    console.log(`[LIVE-DISCOVERY] Async job submitted, request_id=${requestId}`);

    // Extract user from auth header if available
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id || null;
    }

    // Create job tracking row
    const { data: job, error: jobErr } = await supabase.from("brandaro_lead_jobs").insert({
      outscraper_request_id: requestId,
      search_query: query,
      location,
      lead_limit: outscrapeLimit,
      status: "pending",
      created_by: userId,
    }).select().single();

    if (jobErr) console.error("[LIVE-DISCOVERY] Job tracking insert error:", jobErr);

    return new Response(JSON.stringify({
      success: true,
      mode: "async",
      request_id: requestId,
      job_id: job?.id || null,
      message: "Job submitted. Results will arrive via webhook automatically.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[LIVE-DISCOVERY] Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
