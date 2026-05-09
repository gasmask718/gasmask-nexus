// One-shot geocoder for Phase B: resolves staged extracted_address values
// via Google Geocoding API and writes results back to address_extraction_staging.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GKEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!GKEY) {
      return new Response(JSON.stringify({ error: "GOOGLE_PLACES_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const cap = 150;
    const { data: rows, error: fetchErr } = await supabase
      .from("address_extraction_staging")
      .select("store_id, extracted_address, confidence")
      .in("confidence", ["high", "medium"])
      .is("geocode_status", null)
      .limit(cap);
    if (fetchErr) throw fetchErr;

    let ok = 0, zero = 0, partial = 0, error = 0;
    const results: any[] = [];

    for (const r of rows ?? []) {
      const query = `${r.extracted_address}, New York`;
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GKEY}`;
      let status = "ERROR", errMsg: string | null = null;
      let updateRow: Record<string, unknown> = { geocoded_at: new Date().toISOString() };
      try {
        const resp = await fetch(url);
        const j = await resp.json();
        status = j.status;
        if (j.status === "OK" && j.results?.[0]) {
          const top = j.results[0];
          const comps = top.address_components ?? [];
          const get = (type: string) =>
            comps.find((c: any) => c.types.includes(type))?.long_name ?? null;
          const zip = get("postal_code");
          const sublocality =
            comps.find((c: any) => c.types.includes("neighborhood"))?.long_name ??
            comps.find((c: any) => c.types.includes("sublocality_level_1"))?.long_name ??
            comps.find((c: any) => c.types.includes("sublocality"))?.long_name ?? null;
          const adminL2 = get("administrative_area_level_2");
          updateRow = {
            ...updateRow,
            resolved_address: top.formatted_address,
            resolved_zip: zip,
            resolved_neighborhood: sublocality,
            resolved_boro: adminL2,
            resolved_lat: top.geometry?.location?.lat ?? null,
            resolved_lng: top.geometry?.location?.lng ?? null,
            google_place_id: top.place_id ?? null,
            geocode_status: top.partial_match ? "PARTIAL" : "OK",
          };
          if (top.partial_match) partial++; else ok++;
        } else if (j.status === "ZERO_RESULTS") {
          zero++;
          updateRow.geocode_status = "ZERO_RESULTS";
        } else {
          error++;
          updateRow.geocode_status = "ERROR";
          errMsg = j.error_message ?? j.status;
          updateRow.geocode_error = errMsg;
        }
      } catch (e) {
        error++;
        updateRow.geocode_status = "ERROR";
        updateRow.geocode_error = (e as Error).message;
      }

      const { error: upErr } = await supabase
        .from("address_extraction_staging")
        .update(updateRow)
        .eq("store_id", r.store_id);
      if (upErr) results.push({ store_id: r.store_id, update_error: upErr.message });
    }

    const calls = (rows ?? []).length;
    return new Response(
      JSON.stringify({
        calls,
        cost_usd: (calls * 0.005).toFixed(4),
        ok, partial, zero_results: zero, errors: error,
        sample_errors: results.slice(0, 5),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
