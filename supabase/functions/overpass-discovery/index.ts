// Overpass Staff Discovery — server-side proxy for the Playboxxx Recruiting Engine.
// The browser cannot set Origin/Referer/User-Agent headers, so the exact
// Overpass request (matching the overpass-turbo.eu reference) is sent from here.
// Discovery only: this function persists NOTHING — it forwards the query and
// returns the raw Overpass JSON to the caller.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let query: string;
  try {
    const body = await req.json();
    query = typeof body?.query === "string" ? body.query : "";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!query || query.length > 10_000) {
    return new Response(JSON.stringify({ error: "Missing or oversized query" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // `{{geocodeArea:...}}` is overpass-turbo shorthand, NOT valid Overpass QL.
  // Expand it here the same way overpass-turbo does: geocode via Nominatim and
  // substitute the resulting area id.
  const geocodeMatches = [...query.matchAll(/\{\{geocodeArea:([^}]+)\}\}/g)];
  for (const match of geocodeMatches) {
    const place = match[1].trim();
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`;
      const nomRes = await fetch(nomUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "PlayboxxxRecruitingEngine/1.0 (staff discovery)",
        },
      });
      const hits = await nomRes.json();
      const hit = Array.isArray(hits) ? hits[0] : null;
      if (!hit) {
        return new Response(
          JSON.stringify({ error: `Could not geocode location "${place}"` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const osmId = Number(hit.osm_id);
      const offset = hit.osm_type === "relation" ? 3600000000 : hit.osm_type === "way" ? 2400000000 : null;
      if (!offset) {
        return new Response(
          JSON.stringify({ error: `Location "${place}" has no usable OSM area (type: ${hit.osm_type})` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      query = query.replace(match[0], `area(id:${offset + osmId})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: `Geocoding failed for "${place}": ${msg}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Exact request shape from the overpass-turbo.eu reference.
  const payload = `data=${encodeURIComponent(query)}`;

  const headers = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Origin: "https://overpass-turbo.eu",
    Referer: "https://overpass-turbo.eu/",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
  };

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers,
      body: payload,
    });

    const text = await res.text();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Overpass API error ${res.status}`, details: text.slice(0, 1000) }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pass the Overpass JSON straight through — no storage, no side effects.
    return new Response(text, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("overpass-discovery upstream failure:", msg);
    return new Response(JSON.stringify({ error: `Upstream request failed: ${msg}` }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
