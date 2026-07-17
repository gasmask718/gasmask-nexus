// Returns the browser-safe Google Maps JavaScript API key.
// The key MUST be restricted by HTTP referrer in Google Cloud Console
// and enabled ONLY for "Maps JavaScript API" + "Street View" (client-side).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const key = Deno.env.get("GOOGLE_MAPS_BROWSER_KEY") ?? "";
  return new Response(JSON.stringify({ key }), {
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
  });
});
