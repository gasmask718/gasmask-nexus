// dd-source-shipping-specs
// Automatically sources missing PACKAGED shipping weight + dimensions for
// Dynasty Direct physical products from trusted online sources, verifies the
// match on strong identifiers, normalizes to oz/in and records provenance.
//
// POST { product_id } | { product_ids: [...] } | { mode: "sweep", limit }
// Optional: { force: true } to re-run a lookup, { triggered_by: "..." }.
// Always returns HTTP 200 with a per-product result array.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  sourceShippingSpecs,
  identifierKey,
  type ProductIdentifiers,
  type SpecCandidate,
} from "../_shared/ddSpecSourcing.ts";

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SELECT = `id, product_name, brand, upc, gtin, supplier_sku, size_or_count, package_text,
  flavor_or_variant, units_per_case, case_qty, item_type, category, status,
  weight_oz, length_in, width_in, height_in, shipping_spec_status,
  shipping_spec_checked_at, shipping_spec_locked`;

const RECHECK_HOURS = 24;
const CACHE_DAYS = 90;

function isPhysical(p: any): boolean {
  const t = `${p.item_type ?? ""} ${p.category ?? ""}`.toLowerCase();
  return !/digital|download|e-?book|gift ?card|service|subscription/.test(t);
}

function missingSpecs(p: any): boolean {
  return !(Number(p.weight_oz) > 0 && Number(p.length_in) > 0 &&
    Number(p.width_in) > 0 && Number(p.height_in) > 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  if (body?.healthcheck === true) return ok({ healthy: true });

  // ---- auth: signed-in admin only -------------------------------------
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return ok({ error: "unauthorized" }, 401);
  const { data: userRes } = await admin.auth.getUser(jwt);
  const user = userRes?.user;
  if (!user) return ok({ error: "unauthorized" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return ok({ error: "forbidden" }, 403);

  const force = body.force === true;
  const triggered_by = String(body.triggered_by ?? "manual");

  // ---- resolve target products ----------------------------------------
  let ids: string[] = [];
  if (typeof body.product_id === "string") ids = [body.product_id];
  else if (Array.isArray(body.product_ids)) ids = body.product_ids.filter((x: unknown) => typeof x === "string");

  let products: any[] = [];
  if (ids.length > 0) {
    const { data, error } = await admin.from("products_all").select(SELECT).in("id", ids.slice(0, 50));
    if (error) return ok({ error: error.message });
    products = data ?? [];
  } else if (body.mode === "sweep") {
    const limit = Math.min(Number(body.limit) || 10, 50);
    const { data, error } = await admin.from("products_all").select(SELECT)
      .or("weight_oz.is.null,length_in.is.null,width_in.is.null,height_in.is.null")
      .eq("shipping_spec_locked", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return ok({ error: error.message });
    products = data ?? [];
  } else {
    return ok({ error: "product_id, product_ids or mode:'sweep' required" });
  }

  const results: any[] = [];
  // The platform kills an idle request at 150s; leave headroom so a long
  // batch returns what it finished instead of failing wholesale.
  const deadline = Date.now() + 110_000;

  for (const p of products) {
    const base = { product_id: p.id, product_name: p.product_name };

    if (Date.now() > deadline) { results.push({ ...base, skipped: "deferred_time_budget" }); continue; }


    if (!isPhysical(p)) { results.push({ ...base, skipped: "non_physical" }); continue; }
    if (!missingSpecs(p) && !force) { results.push({ ...base, skipped: "specs_complete", status: p.shipping_spec_status ?? "manual" }); continue; }
    if (p.shipping_spec_locked && !force) { results.push({ ...base, skipped: "manually_locked", status: "manual" }); continue; }

    const checked = p.shipping_spec_checked_at ? new Date(p.shipping_spec_checked_at).getTime() : 0;
    const freshHours = (Date.now() - checked) / 3_600_000;
    if (!force && checked && freshHours < RECHECK_HOURS) {
      results.push({ ...base, skipped: "rate_limited", status: p.shipping_spec_status, retry_after_hours: Math.ceil(RECHECK_HOURS - freshHours) });
      continue;
    }

    const ident: ProductIdentifiers = {
      id: p.id,
      product_name: p.product_name ?? "",
      brand: p.brand ?? null,
      upc: p.upc ?? null,
      gtin: p.gtin ?? null,
      supplier_sku: p.supplier_sku ?? null,
      sku: null,
      size_or_count: p.size_or_count ?? null,
      package_text: p.package_text ?? null,
      flavor_or_variant: p.flavor_or_variant ?? null,
      units_per_case: p.units_per_case ?? null,
      case_qty: p.case_qty ?? null,
      item_type: p.item_type ?? null,
    };

    const key = identifierKey(ident);
    let status: string;
    let chosen: SpecCandidate | null = null;
    let candidates: SpecCandidate[] = [];
    let sources_tried: string[] = [];
    let reason = "";
    let cached = false;

    // ---- cache by strong identifier -----------------------------------
    if (key && key.startsWith("gtin:") && !force) {
      const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
      const { data: hit } = await admin.from("dd_spec_sourcing_log")
        .select("chosen, status, candidates")
        .eq("identifier_key", key).eq("applied", true)
        .gte("created_at", since)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (hit?.chosen) {
        chosen = hit.chosen as SpecCandidate;
        candidates = (hit.candidates ?? []) as SpecCandidate[];
        status = String(hit.status);
        reason = "cache_hit_same_identifier";
        cached = true;
      }
    }

    if (!cached) {
      try {
        const res = await sourceShippingSpecs(admin, ident);
        status = res.status; chosen = res.chosen; candidates = res.candidates;
        sources_tried = res.sources_tried; reason = res.reason;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await admin.from("dd_spec_sourcing_log").insert({
          product_id: p.id, identifier_key: key, identifiers: ident,
          status: "not_found", error: msg, triggered_by,
        });
        results.push({ ...base, status: "not_found", error: msg });
        continue;
      }
    }

    const applied = !!chosen && (status === "confirmed" || status === "high_confidence");

    const patch: Record<string, unknown> = {
      shipping_spec_status: status,
      shipping_spec_checked_at: new Date().toISOString(),
      shipping_spec_candidates: candidates.length ? candidates : null,
    };

    if (applied && chosen) {
      Object.assign(patch, {
        weight_oz: chosen.weight_oz,
        length_in: chosen.length_in,
        width_in: chosen.width_in,
        height_in: chosen.height_in,
        spec_source: cached ? "auto_web_cache" : "auto_web",
        spec_source_ref: {
          source_url: chosen.source_url,
          source_name: chosen.source_name,
          matched_on: chosen.matched_on,
          identifier_key: key,
          packaged_dimensions: chosen.packaged,
          retrieved_at: chosen.retrieved_at,
          confidence: status,
          reason,
          raw: chosen.raw,
        },
        shipping_data_source: chosen.source_name,
        shipping_verified: status === "confirmed",
        specs_verified_at: new Date().toISOString(),
      });
    }

    const { error: upErr } = await admin.from("products_all").update(patch).eq("id", p.id);

    await admin.from("dd_spec_sourcing_log").insert({
      product_id: p.id,
      identifier_key: key,
      identifiers: ident,
      status,
      applied: applied && !upErr,
      candidates,
      chosen,
      sources_tried,
      error: upErr?.message ?? (applied ? null : reason),
      triggered_by: cached ? `${triggered_by}:cache` : triggered_by,
    });

    results.push({
      ...base, status, applied: applied && !upErr, cached, reason,
      candidates: candidates.length,
      chosen: chosen
        ? {
          weight_oz: chosen.weight_oz, length_in: chosen.length_in,
          width_in: chosen.width_in, height_in: chosen.height_in,
          packaged: chosen.packaged, source_url: chosen.source_url,
        }
        : null,
      update_error: upErr?.message ?? null,
    });
  }

  return ok({ success: true, count: results.length, results });
});
