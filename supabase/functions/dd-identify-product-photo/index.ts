// dd-identify-product-photo
//
// Photo → product identity → (only when identified) the EXISTING automatic
// shipping-spec sourcing service. No second web-search implementation lives
// here: once identifiers are recovered from the picture we call
// dd-source-shipping-specs exactly as the rest of the app does.
//
// POST { product_id, image_urls?: string[], auto_source?: boolean,
//        confirm?: true, triggered_by?: string }
// `confirm: true` is the admin approving a LIKELY MATCH.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { identifyProductFromPhotos, type PhotoIdResult } from "../_shared/ddPhotoIdentify.ts";

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SELECT = `id, product_name, brand, upc, gtin, supplier_sku, size_or_count, package_text,
  flavor_or_variant, units_per_case, case_qty, item_type, category, status,
  primary_image_url, image_urls, weight_oz, length_in, width_in, height_in,
  shipping_spec_locked, photo_id_status, photo_identification, photo_id_checked_at`;

const RECHECK_HOURS = 24;

function isPhysical(p: any): boolean {
  const t = `${p.item_type ?? ""} ${p.category ?? ""}`.toLowerCase();
  return !/digital|download|e-?book|gift ?card|service|subscription/.test(t);
}

function missingSpecs(p: any): boolean {
  return !(Number(p.weight_oz) > 0 && Number(p.length_in) > 0 &&
    Number(p.width_in) > 0 && Number(p.height_in) > 0);
}

/** Fill only blanks — a value an admin already typed always wins. */
function fillBlanks(p: any, r: PhotoIdResult): Record<string, unknown> {
  const id = r.identifiers;
  const patch: Record<string, unknown> = {};
  const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
  if (r.gtin_valid && id.barcode_digits) {
    if (blank(p.upc)) patch.upc = id.barcode_digits;
    if (blank(p.gtin)) patch.gtin = id.barcode_digits;
  }
  if (blank(p.brand) && id.brand) patch.brand = id.brand;
  if (blank(p.size_or_count) && id.size_or_count) patch.size_or_count = id.size_or_count;
  if (blank(p.flavor_or_variant) && id.flavor_or_variant) patch.flavor_or_variant = id.flavor_or_variant;
  if (blank(p.package_text) && (id.package_text || id.model_mpn)) {
    patch.package_text = [id.model_mpn, id.package_text].filter(Boolean).join(" · ");
  }
  if (blank(p.supplier_sku) && (id.model_mpn || id.sku)) patch.supplier_sku = id.model_mpn ?? id.sku;
  const placeholder = blank(p.product_name) || /pending photo read|untitled|new product/i.test(String(p.product_name));
  if (placeholder && id.product_name) {
    patch.product_name = [id.brand, id.product_name].filter(Boolean).join(" ").slice(0, 200);
  }
  return patch;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const aiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";

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

  const product_id = String(body.product_id ?? "");
  if (!product_id) return ok({ error: "product_id_required" });
  const triggered_by = String(body.triggered_by ?? "photo");
  const force = body.force === true;
  const autoSource = body.auto_source !== false;

  const { data: p, error: pErr } = await admin.from("products_all").select(SELECT).eq("id", product_id).maybeSingle();
  if (pErr) return ok({ error: pErr.message });
  if (!p) return ok({ error: "product_not_found" });
  if (!isPhysical(p)) return ok({ product_id, skipped: "non_physical" });

  // ---- admin confirming a previously returned LIKELY MATCH -------------
  if (body.confirm === true) {
    const prev = (p as any).photo_identification as PhotoIdResult | null;
    if (!prev?.identifiers) return ok({ error: "no_pending_identification" });
    const patch = fillBlanks(p, prev);
    patch.photo_id_status = "confirmed_by_admin";
    patch.photo_id_checked_at = new Date().toISOString();
    patch.photo_identification = {
      ...prev,
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
      confirmation: "admin_confirmed_likely_match",
    };
    const { error: upErr } = await admin.from("products_all").update(patch).eq("id", product_id);
    if (upErr) return ok({ error: upErr.message });
    await admin.from("dd_spec_sourcing_log").insert({
      product_id, identifier_key: prev.identifiers.barcode_digits ? `gtin:${prev.identifiers.barcode_digits}` : null,
      identifiers: prev.identifiers, status: "confirmed_by_admin", applied: true,
      chosen: prev as unknown as Record<string, unknown>,
      triggered_by: `photo_identify:confirm:${triggered_by}`,
    });
    const sourcing = autoSource && missingSpecs(p) && !p.shipping_spec_locked
      ? await runSourcing(url, jwt, product_id, triggered_by)
      : null;
    return ok({ product_id, status: "confirmed_by_admin", applied_fields: Object.keys(patch), sourcing });
  }

  // ---- rate limit: identification is an AI call, not a page-load action -
  const checked = p.photo_id_checked_at ? new Date(p.photo_id_checked_at).getTime() : 0;
  const freshHours = (Date.now() - checked) / 3_600_000;
  if (!force && checked && freshHours < RECHECK_HOURS &&
      ["identified", "confirmed_by_admin"].includes(String(p.photo_id_status))) {
    return ok({
      product_id, status: p.photo_id_status, skipped: "rate_limited",
      identification: p.photo_identification,
      retry_after_hours: Math.ceil(RECHECK_HOURS - freshHours),
    });
  }

  const photos: string[] = Array.isArray(body.image_urls) && body.image_urls.length
    ? body.image_urls.filter((u: unknown) => typeof u === "string")
    : [p.primary_image_url, ...(Array.isArray(p.image_urls) ? p.image_urls : [])].filter(Boolean) as string[];

  if (!aiKey) return ok({ error: "ai_not_configured", status: "not_identified" });

  let result: PhotoIdResult;
  try {
    result = await identifyProductFromPhotos(photos, aiKey);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from("dd_spec_sourcing_log").insert({
      product_id, identifiers: {}, status: "not_identified", error: msg,
      triggered_by: `photo_identify:${triggered_by}`,
    });
    // The photo itself is untouched by an identification failure.
    return ok({ product_id, status: "not_identified", error: msg, photo_preserved: true });
  }

  const patch: Record<string, unknown> = {
    photo_id_status: result.status,
    photo_id_checked_at: new Date().toISOString(),
    photo_identification: result as unknown as Record<string, unknown>,
  };
  // ONLY an IDENTIFIED read may write identifiers automatically.
  if (result.status === "identified") Object.assign(patch, fillBlanks(p, result));

  const { error: upErr } = await admin.from("products_all").update(patch).eq("id", product_id);

  await admin.from("dd_spec_sourcing_log").insert({
    product_id,
    identifier_key: result.gtin_valid && result.identifiers.barcode_digits
      ? `gtin:${result.identifiers.barcode_digits}` : null,
    identifiers: result.identifiers,
    status: result.status,
    applied: result.status === "identified" && !upErr,
    chosen: result as unknown as Record<string, unknown>,
    error: upErr?.message ?? result.reason,
    triggered_by: `photo_identify:${triggered_by}`,
  });

  // ---- hand identified products to the EXISTING sourcing service -------
  let sourcing: unknown = null;
  if (result.status === "identified" && autoSource && !upErr &&
      missingSpecs(p) && !p.shipping_spec_locked) {
    sourcing = await runSourcing(url, jwt, product_id, triggered_by);
  }

  return ok({
    product_id,
    status: result.status,
    reason: result.reason,
    next_photo_hint: result.next_photo_hint,
    identifiers: result.identifiers,
    gtin_valid: result.gtin_valid,
    method: result.method,
    applied_fields: result.status === "identified" ? Object.keys(fillBlanks(p, result)) : [],
    update_error: upErr?.message ?? null,
    photo_preserved: true,
    sourcing,
  });
});

async function runSourcing(baseUrl: string, jwt: string, product_id: string, triggered_by: string) {
  try {
    const r = await fetch(`${baseUrl}/functions/v1/dd-source-shipping-specs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ product_id, triggered_by: `photo_identify:${triggered_by}` }),
    });
    const j = await r.json().catch(() => ({}));
    return j?.results?.[0] ?? j;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
