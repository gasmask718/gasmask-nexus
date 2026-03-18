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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Call Outscraper Google Maps API
    const searchQuery = `${query} ${location}`;
    const outscrapeLimit = Math.min(limit || 50, 100);
    const url = `https://api.app.outscraper.com/maps/search-v3?query=${encodeURIComponent(searchQuery)}&limit=${outscrapeLimit}&async=false`;

    console.log(`[LIVE-DISCOVERY] Querying Outscraper: ${searchQuery}, limit=${outscrapeLimit}`);

    const response = await fetch(url, {
      headers: { "X-API-KEY": outscrapeApiKey },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Outscraper API error [${response.status}]: ${errText}`);
    }

    const result = await response.json();
    const businesses = result?.data?.[0] || result?.data || [];

    if (!Array.isArray(businesses) || businesses.length === 0) {
      return new Response(JSON.stringify({ success: true, inserted: 0, duplicates: 0, total_found: 0, message: "No results found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[LIVE-DISCOVERY] Got ${businesses.length} results from Outscraper`);

    // Normalize and prepare for insert
    const batchId = `live_${Date.now()}`;
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
      source: "outscraper_live",
      import_batch_id: batchId,
      raw_data: b,
    }));

    // Deduplicate by phone against existing leads
    const phones = leads.filter((l: any) => l.phone_number).map((l: any) => l.phone_number);
    const { data: existing } = await supabase
      .from("brandaro_raw_leads")
      .select("phone_number")
      .in("phone_number", phones.slice(0, 200));
    const existingPhones = new Set((existing || []).map((e: any) => e.phone_number));

    const unique = leads.filter((l: any) => !l.phone_number || !existingPhones.has(l.phone_number));
    const duplicates = leads.length - unique.length;

    if (unique.length > 0) {
      const { error } = await supabase.from("brandaro_raw_leads").insert(unique);
      if (error) throw error;
    }

    console.log(`[LIVE-DISCOVERY] Inserted ${unique.length}, skipped ${duplicates} duplicates`);

    return new Response(JSON.stringify({
      success: true,
      total_found: businesses.length,
      inserted: unique.length,
      duplicates,
      no_website: unique.filter((l: any) => l.website_status === "no_website").length,
      batch_id: batchId,
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
