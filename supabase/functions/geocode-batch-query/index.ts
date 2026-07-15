// Read-only: geocode arbitrary queries via Google Geocoding + Places nearby.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const GOOGLE_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY")!;
  const body = await req.json();
  const items: Array<{ id: string; name?: string; query: string }> = body.items ?? [];

  const results: any[] = [];
  for (const it of items) {
    const out: any = { id: it.id, name: it.name, query: it.query };
    try {
      const gr = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(it.query)}&key=${GOOGLE_KEY}`,
      );
      const gj = await gr.json();
      out.status = gj.status;
      const r = gj.results?.[0];
      if (gj.status === "OK" && r) {
        out.formatted_address = r.formatted_address;
        out.location_type = r.geometry?.location_type;
        out.partial_match = r.partial_match ?? false;
        out.lat = r.geometry?.location?.lat;
        out.lng = r.geometry?.location?.lng;
        const comp = (t: string) => r.address_components?.find((c: any) => c.types.includes(t))?.long_name;
        out.street_number = comp("street_number");
        out.route = comp("route");
        out.zip = comp("postal_code");
        out.city = comp("locality") ?? comp("sublocality");
        out.neighborhood = comp("neighborhood") ?? comp("sublocality_level_1");
        if (out.lat && out.lng) {
          const pr = await fetch(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${out.lat},${out.lng}&radius=30&key=${GOOGLE_KEY}`,
          );
          const pj = await pr.json();
          out.nearby_names = (pj.results ?? []).map((p: any) => p.name).slice(0, 6);
          const nm = (it.name ?? "").toLowerCase();
          const toks = nm.split(/\s+/).filter((t) => t.length > 3);
          out.name_match = out.nearby_names.some((n: string) => {
            const nl = n.toLowerCase();
            return nl === nm || toks.some((t: string) => nl.includes(t));
          });
        }
      }
    } catch (e) {
      out.status = "FETCH_ERROR";
      out.error = String(e);
    }
    results.push(out);
  }
  return new Response(JSON.stringify({ count: results.length, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
