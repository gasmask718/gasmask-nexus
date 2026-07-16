// Street View Static image proxy — keeps GOOGLE_PLACES_API_KEY server-side.
// GET /street-view-image?lat=..&lng=..&w=640&h=400&heading=&pitch=&fov=
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const w = url.searchParams.get("w") ?? "640";
  const h = url.searchParams.get("h") ?? "400";
  const heading = url.searchParams.get("heading");
  const pitch = url.searchParams.get("pitch") ?? "0";
  const fov = url.searchParams.get("fov") ?? "80";

  if (!lat || !lng) {
    return new Response(JSON.stringify({ error: "lat and lng required" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const key = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "GOOGLE_PLACES_API_KEY not configured" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const params = new URLSearchParams({
    size: `${w}x${h}`,
    location: `${lat},${lng}`,
    pitch,
    fov,
    key,
    source: "outdoor",
  });
  if (heading) params.set("heading", heading);

  const gUrl = `https://maps.googleapis.com/maps/api/streetview?${params}`;
  const resp = await fetch(gUrl);
  const buf = await resp.arrayBuffer();
  return new Response(buf, {
    status: resp.status,
    headers: {
      ...CORS,
      "Content-Type": resp.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
});
