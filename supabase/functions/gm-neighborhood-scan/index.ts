// gm-neighborhood-scan — operator-triggered Google Places scan for ONE neighborhood.
// Pulls smoke shop/convenience/deli/bodega POIs → diffs vs store_master (fuzzy name+addr)
// → writes deltas to sales_prospects (source='gm_gap_scan'). Cached in gm_discovered_pois.
// 30-day re-scan guard unless force=true.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DEFAULT_QUERIES = ["smoke shop", "convenience store", "deli", "bodega"];

function norm(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(inc|llc|corp|co|the|and|&)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function placesTextSearch(query: string, apiKey: string) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.nationalPhoneNumber",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 20, languageCode: "en" }),
  });
  if (!res.ok) throw new Error(`Places ${res.status}: ${await res.text()}`);
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GOOGLE_PLACES_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: any = {};
  try { body = await req.json(); } catch { /* GET path */ }
  const neighborhoodId: string | undefined = body.neighborhood_id;
  const force: boolean = !!body.force;
  const queries: string[] = Array.isArray(body.queries) && body.queries.length ? body.queries : DEFAULT_QUERIES;

  if (!neighborhoodId) {
    return new Response(JSON.stringify({ error: "neighborhood_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load neighborhood
  const { data: nb, error: nbErr } = await sb
    .from("neighborhoods")
    .select("id, name, city, state")
    .eq("id", neighborhoodId)
    .single();
  if (nbErr || !nb) {
    return new Response(JSON.stringify({ error: "neighborhood not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 30-day re-scan guard
  if (!force) {
    const { data: lastScan } = await sb
      .from("gm_neighborhood_scans")
      .select("id, started_at, status, new_prospects, pois_found")
      .eq("neighborhood_id", neighborhoodId)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastScan) {
      const ageDays = (Date.now() - new Date(lastScan.started_at).getTime()) / 86400000;
      if (ageDays < 30) {
        return new Response(JSON.stringify({
          ok: false,
          guarded: true,
          message: `Last scan ${Math.round(ageDays)} days ago. Pass force:true to override.`,
          last_scan: lastScan,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
  }

  // Open scan record
  const { data: scan, error: scanErr } = await sb
    .from("gm_neighborhood_scans")
    .insert({ neighborhood_id: neighborhoodId, status: "running", query_terms: queries })
    .select()
    .single();
  if (scanErr || !scan) {
    return new Response(JSON.stringify({ error: scanErr?.message || "scan insert failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Run all queries
    const places: any[] = [];
    for (const q of queries) {
      try {
        const r = await placesTextSearch(`${q} in ${nb.name}, ${nb.city || ""} ${nb.state || ""}`, apiKey);
        places.push(...(r.places || []).map((p: any) => ({ ...p, _query: q })));
        await delay(250);
      } catch (e) {
        console.error("places search err", q, e);
      }
    }

    // Dedupe by place_id
    const byId = new Map<string, any>();
    for (const p of places) if (p.id && !byId.has(p.id)) byId.set(p.id, p);
    const unique = Array.from(byId.values());

    // 2. Load store_master for fuzzy match (name + address)
    const { data: stores } = await sb
      .from("store_master")
      .select("id, store_name, address")
      .is("deleted_at", null);
    const storeIndex = (stores || []).map((s: any) => ({
      id: s.id,
      name_norm: norm(s.store_name),
      addr_norm: norm(s.address),
    }));

    // 3. Build POI rows
    const pois = unique.map((p) => {
      const name = p.displayName?.text || "Unknown";
      const addr = p.formattedAddress || "";
      const name_n = norm(name);
      const addr_n = norm(addr);

      // Match if name_norm equal, OR both name token-overlap >=2 AND address starts with same street #
      let match: { id: string; reason: string } | null = null;
      const streetNum = (addr_n.match(/^(\d+)/) || [])[1];
      for (const s of storeIndex) {
        if (s.name_norm && s.name_norm === name_n) { match = { id: s.id, reason: "exact_name" }; break; }
        if (streetNum && s.addr_norm.startsWith(streetNum + " ")) {
          // share a name token?
          const overlap = name_n.split(" ").filter((t) => t.length > 2 && s.name_norm.includes(t)).length;
          if (overlap >= 1) { match = { id: s.id, reason: "addr+name_overlap" }; break; }
        }
      }

      return {
        scan_id: scan.id,
        neighborhood_id: neighborhoodId,
        place_id: p.id,
        name,
        address: addr,
        phone: p.nationalPhoneNumber || null,
        category: (p.types || [])[0] || p._query,
        lat: p.location?.latitude || null,
        lng: p.location?.longitude || null,
        matched_store_id: match?.id || null,
        match_reason: match?.reason || null,
      };
    });

    // 4. Upsert into gm_discovered_pois
    let cachedCount = 0;
    if (pois.length) {
      const { error: upErr, count } = await sb
        .from("gm_discovered_pois")
        .upsert(pois, { onConflict: "neighborhood_id,place_id", count: "exact" });
      if (upErr) console.error("poi upsert err", upErr.message);
      cachedCount = count || pois.length;
    }

    // 5. Promote unmatched as sales_prospects (source='gm_gap_scan'), skip dup place_ids already promoted
    const unmatched = pois.filter((p) => !p.matched_store_id);
    const { data: alreadyPromoted } = await sb
      .from("gm_discovered_pois")
      .select("place_id, promoted_prospect_id")
      .eq("neighborhood_id", neighborhoodId)
      .not("promoted_prospect_id", "is", null);
    const promotedSet = new Set((alreadyPromoted || []).map((r: any) => r.place_id));
    const toPromote = unmatched.filter((p) => !promotedSet.has(p.place_id));

    let newProspects = 0;
    for (const p of toPromote) {
      const { data: sp, error: spErr } = await sb
        .from("sales_prospects")
        .insert({
          store_name: p.name,
          address: p.address,
          city: nb.city,
          state: nb.state,
          phone: p.phone,
          lead_type: "store",
          source: "gm_gap_scan",
          pipeline_stage: "identified",
          priority: 3,
          notes: `Discovered via Google Places scan of "${nb.name}" on ${new Date().toISOString().slice(0, 10)}. Place ID: ${p.place_id}`,
        })
        .select("id")
        .single();
      if (spErr) { console.error("prospect insert err", spErr.message); continue; }
      newProspects++;
      await sb
        .from("gm_discovered_pois")
        .update({ promoted_prospect_id: sp.id })
        .eq("neighborhood_id", neighborhoodId)
        .eq("place_id", p.place_id);
    }

    // 6. Close scan
    await sb
      .from("gm_neighborhood_scans")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        pois_found: pois.length,
        pois_matched: pois.length - unmatched.length,
        new_prospects: newProspects,
      })
      .eq("id", scan.id);

    return new Response(JSON.stringify({
      ok: true,
      scan_id: scan.id,
      neighborhood: nb.name,
      pois_found: pois.length,
      pois_matched: pois.length - unmatched.length,
      pois_unmatched: unmatched.length,
      new_prospects: newProspects,
      cached: cachedCount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    await sb.from("gm_neighborhood_scans").update({
      status: "failed", finished_at: new Date().toISOString(), error: err.message,
    }).eq("id", scan.id);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
