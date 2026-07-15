// Read-only audit: geocode a sample of Feb-3 batch stores via Google Geocoding + Places.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const GOOGLE_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const body = await req.json().catch(() => ({}));
  const sampleSize = body.sampleSize ?? 100;

  // Deterministic-ish sample: mix templated + specific names
  const { data: stores, error } = await supabase.rpc("execute_sql" as any, {}).then(() => null as any, () => null);

  // Fallback: query directly
  const { data: sample, error: sErr } = await supabase
    .from("stores")
    .select("id,name,address_street,address_city,address_state,address_zip,phone,created_at")
    .gte("created_at", "2026-02-03T00:00:00Z")
    .lt("created_at", "2026-02-04T00:00:00Z")
    .limit(2000);
  if (sErr) return new Response(JSON.stringify({ error: sErr.message }), { status: 500, headers: corsHeaders });

  // Shuffle & take sampleSize
  const shuffled = (sample ?? []).sort(() => Math.random() - 0.5).slice(0, sampleSize);

  const results: any[] = [];
  for (const s of shuffled) {
    const addr = [s.address_street, s.address_city, s.address_state, s.address_zip].filter(Boolean).join(", ");
    let geo: any = { status: "SKIPPED" };
    let places: any = { name_match: false, nearby_names: [] };

    try {
      const gr = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${GOOGLE_KEY}`,
      );
      const gj = await gr.json();
      geo.status = gj.status;
      if (gj.status === "OK" && gj.results?.[0]) {
        const r = gj.results[0];
        geo.formatted_address = r.formatted_address;
        geo.location_type = r.geometry?.location_type;
        geo.lat = r.geometry?.location?.lat;
        geo.lng = r.geometry?.location?.lng;
        geo.partial_match = r.partial_match ?? false;

        // Places Nearby Search within 30m for commercial POIs
        if (geo.lat && geo.lng) {
          const pr = await fetch(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${geo.lat},${geo.lng}&radius=30&key=${GOOGLE_KEY}`,
          );
          const pj = await pr.json();
          if (pj.status === "OK") {
            const names = (pj.results ?? []).map((p: any) => p.name).slice(0, 5);
            places.nearby_names = names;
            const storeNameLc = (s.name ?? "").toLowerCase();
            const tokens = storeNameLc.split(/\s+/).filter((t: string) => t.length > 3);
            places.name_match = names.some((n: string) => {
              const nl = n.toLowerCase();
              return nl === storeNameLc || tokens.some((t: string) => nl.includes(t));
            });
            places.any_commercial = names.length > 0;
          } else {
            places.status = pj.status;
          }
        }
      }
    } catch (e) {
      geo.status = "FETCH_ERROR";
      geo.error = String(e);
    }

    results.push({
      id: s.id,
      name: s.name,
      address: addr,
      phone: s.phone,
      geo,
      places,
    });
  }

  // Summary
  const summary = {
    total: results.length,
    rooftop: results.filter(r => r.geo.location_type === "ROOFTOP").length,
    range_interpolated: results.filter(r => r.geo.location_type === "RANGE_INTERPOLATED").length,
    geometric_center: results.filter(r => r.geo.location_type === "GEOMETRIC_CENTER").length,
    approximate: results.filter(r => r.geo.location_type === "APPROXIMATE").length,
    zero_results: results.filter(r => r.geo.status === "ZERO_RESULTS").length,
    other_status: results.filter(r => !["OK","ZERO_RESULTS"].includes(r.geo.status)).length,
    partial_match: results.filter(r => r.geo.partial_match).length,
    name_match_at_location: results.filter(r => r.places.name_match).length,
    any_commercial_poi: results.filter(r => r.places.any_commercial).length,
    no_commercial_poi: results.filter(r => r.places.any_commercial === false).length,
  };

  return new Response(JSON.stringify({ summary, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
