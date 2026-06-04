// coverage-scan: Find every smoke / tobacco / convenience store that EXISTS
// in a given neighborhood (or city) via Google Places, fuzzy-match against
// our `stores` table, write findings into `territory_addresses`, and log the
// scan in `territory_coverage_scans`. Cached: re-uses the most recent scan
// within COVERAGE_TTL_DAYS unless `force: true`.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COVERAGE_TTL_DAYS = 7;
const QUERIES = ["smoke shop", "tobacco shop", "convenience store"];

// ---------- helpers ----------
function norm(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(inc|llc|corp|co|the|shop|store|smoke|tobacco|convenience|deli|grocery|mini|mart|market|gas|station)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(norm(s).split(" ").filter((t) => t.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// Haversine in meters
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function streetNumber(addr: string | null | undefined): string {
  if (!addr) return "";
  const m = addr.trim().match(/^(\d+)/);
  return m ? m[1] : "";
}

function streetName(addr: string | null | undefined): string {
  if (!addr) return "";
  return norm(addr.replace(/^\d+\s*/, "").split(",")[0] || "");
}

async function textSearch(query: string, apiKey: string, pageToken?: string) {
  const body: Record<string, unknown> = { textQuery: query, maxResultCount: 20, languageCode: "en" };
  if (pageToken) body.pageToken = pageToken;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.businessStatus,places.nationalPhoneNumber,places.websiteUri,nextPageToken",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Places search failed [${res.status}]: ${await res.text()}`);
  return res.json();
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GOOGLE_PLACES_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { city, state, neighborhood = null, force = false } = await req.json();
    if (!city || !state) throw new Error("city and state are required");

    const scope = neighborhood ? "neighborhood" : "city";

    // 1. Cache check ---------------------------------------------------
    if (!force) {
      const { data: recent } = await sb
        .from("territory_coverage_scans")
        .select("*")
        .eq("scope", scope)
        .eq("city", city)
        .eq("state", state)
        .eq("neighborhood", neighborhood)
        .gt(
          "scanned_at",
          new Date(Date.now() - COVERAGE_TTL_DAYS * 86400000).toISOString(),
        )
        .order("scanned_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recent) {
        return new Response(JSON.stringify({ cached: true, scan: recent }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Pull all existing stores in this area (for fuzzy matching) ----
    const storeQ = sb
      .from("stores")
      .select("id,name,address_street,address_city,address_state,phone,lat,lng,neighborhood,status")
      .is("deleted_at", null)
      .ilike("address_city", `%${city}%`)
      .ilike("address_state", `%${state}%`);
    const { data: stores = [], error: sErr } = await storeQ;
    if (sErr) throw sErr;

    const storeIndex = (stores ?? []).map((s) => ({
      id: s.id,
      nameTokens: tokens(s.name || ""),
      streetNum: streetNumber(s.address_street),
      streetName: streetName(s.address_street),
      lat: s.lat ? Number(s.lat) : null,
      lng: s.lng ? Number(s.lng) : null,
      phone: (s.phone || "").replace(/\D/g, ""),
      raw: s,
    }));

    // 3. Run Places text search for each query --------------------------
    const area = neighborhood ? `${neighborhood}, ${city}, ${state}` : `${city}, ${state}`;
    const placesById = new Map<string, any>();
    for (const q of QUERIES) {
      let pageToken: string | undefined;
      for (let page = 0; page < 3; page++) {
        const res = await textSearch(`${q} in ${area}`, apiKey, pageToken);
        for (const p of res.places || []) {
          if (p?.id && !placesById.has(p.id)) placesById.set(p.id, p);
        }
        pageToken = res.nextPageToken;
        if (!pageToken) break;
        await delay(2200); // Google requires brief wait between paginated calls
      }
    }

    const places = Array.from(placesById.values());

    // 4. Match each place to a store ------------------------------------
    let have = 0;
    let donthave = 0;
    const upserts: any[] = [];

    for (const p of places) {
      const pName = p.displayName?.text || "";
      const pAddr = p.formattedAddress || "";
      const pLat = p.location?.latitude ?? null;
      const pLng = p.location?.longitude ?? null;
      const pPhone = (p.nationalPhoneNumber || "").replace(/\D/g, "");
      const pTokens = tokens(pName);
      const pStreetNum = streetNumber(pAddr);
      const pStreetName = streetName(pAddr);

      let best: { id: string; score: number; method: string } | null = null;

      for (const s of storeIndex) {
        // Phone exact = strongest signal
        if (pPhone && s.phone && pPhone.slice(-10) === s.phone.slice(-10)) {
          best = { id: s.id, score: 1.0, method: "phone" };
          break;
        }

        // Address + name proximity
        const sameStreet = pStreetNum && s.streetNum && pStreetNum === s.streetNum && pStreetName && s.streetName && pStreetName === s.streetName;
        const nameSim = jaccard(pTokens, s.nameTokens);
        const dist = pLat != null && pLng != null && s.lat != null && s.lng != null
          ? haversine(pLat, pLng, s.lat, s.lng)
          : Infinity;

        let score = 0;
        let method = "";
        if (sameStreet && nameSim >= 0.3) {
          score = 0.9 + nameSim * 0.1;
          method = "address+name";
        } else if (sameStreet) {
          score = 0.85;
          method = "address";
        } else if (dist < 60 && nameSim >= 0.5) {
          score = 0.8 + nameSim * 0.1;
          method = "geo+name";
        } else if (nameSim >= 0.75 && dist < 400) {
          score = nameSim;
          method = "name";
        }

        if (score > (best?.score ?? 0)) best = { id: s.id, score, method };
      }

      const matched = best && best.score >= 0.75;
      if (matched) have++;
      else donthave++;

      upserts.push({
        full_address: pAddr,
        city,
        state,
        store_name: pName,
        phone: p.nationalPhoneNumber || null,
        website: p.websiteUri || null,
        place_id: p.id,
        latitude: pLat,
        longitude: pLng,
        address_type: "commercial",
        discovery_status: matched ? "verified_store" : "scouted",
        discovered_by: "google_places",
        matched_store_id: matched ? best!.id : null,
        match_score: matched ? Number(best!.score.toFixed(3)) : null,
        match_method: matched ? best!.method : null,
        scan_source: scope,
        last_scan_at: new Date().toISOString(),
      });
    }

    // 5. Upsert into territory_addresses (dedupe on place_id) -----------
    if (upserts.length) {
      // chunked upsert
      for (let i = 0; i < upserts.length; i += 100) {
        const chunk = upserts.slice(i, i + 100);
        const { error } = await sb
          .from("territory_addresses")
          .upsert(chunk, { onConflict: "place_id" });
        if (error) console.error("upsert error", error);
      }
    }

    // 6. Log the scan ---------------------------------------------------
    const { data: scan } = await sb
      .from("territory_coverage_scans")
      .insert({
        scope,
        city,
        state,
        neighborhood,
        total_found: places.length,
        have_count: have,
        donthave_count: donthave,
        raw_summary: { queries: QUERIES, ttl_days: COVERAGE_TTL_DAYS },
      })
      .select()
      .single();

    return new Response(JSON.stringify({ cached: false, scan, total_found: places.length, have, donthave }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
