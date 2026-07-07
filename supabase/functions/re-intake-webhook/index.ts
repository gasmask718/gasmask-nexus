// Real Estate lead intake webhook.
// Contract: Make.com (or any external source) POSTs a JSON lead payload with
// header `x-webhook-secret: <RE_REAL_ESTATE_WEBHOOK_SECRET>`.
// Flow: authenticate → validate envelope → normalize → dedupe → insert → log.
// This function is the canonical template for future *business* intake endpoints.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  intakeCorsHeaders,
  webhookSecretCheck,
  jsonResponse,
  getClientIp,
} from "../_shared/reIntakeSecurity.ts";

const FUNCTION_NAME = "re-intake-webhook";
const FUNCTION_VERSION = "v1";
const SECRET_ENV = "RE_REAL_ESTATE_WEBHOOK_SECRET";
const MAX_BODY_BYTES = 64 * 1024;

// Boot-time readability probe (logs presence + length + last-4 chars only — never the full value).
{
  const v = Deno.env.get(SECRET_ENV) ?? "";
  console.log(
    `[intake:boot] ${SECRET_ENV} present=${v.length > 0} length=${v.length} tail=${v ? v.slice(-4) : "n/a"}`,
  );
}

// ---------- helpers ----------

function trim(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function normalizePhone(raw: unknown): string | null {
  const s = trim(raw);
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

function normalizeEmail(raw: unknown): string | null {
  const s = trim(raw);
  if (!s) return null;
  const lowered = s.toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lowered) ? lowered : null;
}

function normalizeZip(raw: unknown): string | null {
  const s = trim(raw);
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 5) return digits.slice(0, 5);
  return null;
}

function normalizeState(raw: unknown): string | null {
  const s = trim(raw);
  return s ? s.toUpperCase().slice(0, 2) : null;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toInt(v: unknown): number | null {
  const n = toNumber(v);
  return n === null ? null : Math.round(n);
}

function splitName(full: string): { first: string | null; last: string | null } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

// Only whitelisted values are accepted; anything else is stored in raw_payload only.
const ALLOWED_CONDITION = ["excellent", "good", "fair", "poor", "uninhabitable"] as const;

// ---------- main ----------

Deno.serve(async (req) => {
  const startedAt = Date.now();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: intakeCorsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // 1) Auth
  const authFail = webhookSecretCheck(req, SECRET_ENV);
  if (authFail) return authFail;

  // 2) Parse & size-limit body
  const rawText = await req.text();
  if (rawText.length > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Payload too large", code: "PAYLOAD_TOO_LARGE" }, 413);
  }

  let body: any;
  try {
    body = JSON.parse(rawText);
  } catch {
    return jsonResponse({ error: "Invalid JSON body", code: "INVALID_JSON" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Body must be a JSON object", code: "INVALID_JSON" }, 400);
  }

  // 3) Extract & validate envelope
  const property_address = trim(body.property_address);
  if (!property_address) {
    return jsonResponse(
      { error: "Missing required field", code: "MISSING_REQUIRED", field: "property_address" },
      400,
    );
  }

  const phone_e164 = normalizePhone(body.phone);
  const email = normalizeEmail(body.email);
  if (!phone_e164 && !email) {
    return jsonResponse(
      {
        error: "At least one of phone or email is required (and must be valid)",
        code: "MISSING_CONTACT",
      },
      400,
    );
  }

  // Name normalization
  let first_name = trim(body.first_name);
  let last_name = trim(body.last_name);
  if (!first_name && !last_name && trim(body.full_name)) {
    const split = splitName(trim(body.full_name)!);
    first_name = split.first;
    last_name = split.last;
  }

  const state = normalizeState(body.state);
  const zip = normalizeZip(body.zip);
  const city = trim(body.city);
  const county = trim(body.county);
  const lead_type = trim(body.lead_type); // e.g. seller / buyer / wholesale
  const motivation = trim(body.motivation);
  const timeline = trim(body.timeline);
  const notes = trim(body.notes);
  const property_type = trim(body.property_type) ?? "SFR";

  const conditionRaw = trim(body.condition)?.toLowerCase() ?? null;
  const condition = conditionRaw && (ALLOWED_CONDITION as readonly string[]).includes(conditionRaw)
    ? conditionRaw
    : null;

  const arv = toNumber(body.arv);
  const asking_price = toNumber(body.asking_price);
  const estimated_value = toNumber(body.estimated_value);
  const estimated_repairs = toNumber(body.estimated_repairs);
  const equity_percentage = toNumber(body.equity_percentage);
  const bedrooms = toInt(body.bedrooms);
  const bathrooms = toNumber(body.bathrooms);
  const sqft = toInt(body.sqft);
  const year_built = toInt(body.year_built);
  const lot_size = trim(body.lot_size);

  const mailing_address = trim(body.mailing_address);
  const mailing_city = trim(body.mailing_city);
  const mailing_state = normalizeState(body.mailing_state);
  const mailing_zip = normalizeZip(body.mailing_zip);

  const phones_all = Array.isArray(body.phones_all)
    ? body.phones_all.map(normalizePhone).filter(Boolean) as string[]
    : phone_e164 ? [phone_e164] : null;
  const emails_all = Array.isArray(body.emails_all)
    ? body.emails_all.map(normalizeEmail).filter(Boolean) as string[]
    : email ? [email] : null;

  const lead_source = trim(body.source) ?? trim(body.lead_source) ?? "make_com";
  const realestateapi_property_id = trim(body.realestateapi_property_id);

  // 4) Build audit envelope
  const clientIp = getClientIp(req);
  const makeExecutionId = req.headers.get("x-make-execution-id") ?? null;
  const idempotencyKey = req.headers.get("x-idempotency-key") ?? null;

  const raw_payload = {
    body,
    _meta: {
      received_at: new Date().toISOString(),
      imported_via: `${FUNCTION_NAME}@${FUNCTION_VERSION}`,
      client_ip: clientIp,
      make_execution_id: makeExecutionId,
      idempotency_key: idempotencyKey,
    },
  };

  // 5) Supabase (service role for insert + dedupe read)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // 6) Dedupe — mirrors the DB unique index `(lower(property_address), zip)`.
  //    If a realestateapi_property_id is supplied, dedupe by that instead.
  let existingId: string | null = null;
  if (realestateapi_property_id) {
    const { data } = await supabase
      .from("re_leads")
      .select("id")
      .eq("realestateapi_property_id", realestateapi_property_id)
      .limit(1)
      .maybeSingle();
    existingId = data?.id ?? null;
  } else {
    const q = supabase
      .from("re_leads")
      .select("id")
      .ilike("property_address", property_address)
      .limit(1);
    const { data } = zip ? await q.eq("zip", zip).maybeSingle() : await q.maybeSingle();
    existingId = data?.id ?? null;
  }

  if (existingId) {
    // Log dedupe outcome
    await supabase.from("re_automation_log").insert({
      automation_type: FUNCTION_NAME,
      status: "completed",
      source: lead_source,
      leads_processed: 1,
      leads_imported: 0,
      leads_skipped: 1,
      completed_at: new Date().toISOString(),
      metadata: {
        outcome: "deduped",
        lead_id: existingId,
        make_execution_id: makeExecutionId,
        idempotency_key: idempotencyKey,
        latency_ms: Date.now() - startedAt,
      },
    });
    return jsonResponse(
      { success: true, status: "deduped", lead_id: existingId, message: "Lead already exists" },
      200,
    );
  }

  // 7) Insert
  const insertRow: Record<string, unknown> = {
    first_name,
    last_name,
    phone: phone_e164,
    email,
    property_address,
    city,
    state,
    zip,
    county,
    bedrooms,
    bathrooms,
    sqft,
    year_built,
    lot_size,
    property_type,
    condition,
    estimated_value,
    estimated_repairs: estimated_repairs ?? 0,
    arv,
    asking_price,
    equity_percentage,
    lead_type,
    motivation,
    timeline,
    notes,
    status: "new",
    lead_source,
    raw_payload,
    mailing_address,
    mailing_city,
    mailing_state,
    mailing_zip,
    phones_all,
    emails_all,
    realestateapi_property_id,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("re_leads")
    .insert(insertRow)
    .select("id")
    .single();

  if (insertError || !inserted) {
    // A race can still hit the DB unique index — recover gracefully.
    const isUniqueViolation = insertError?.code === "23505";
    await supabase.from("re_automation_log").insert({
      automation_type: FUNCTION_NAME,
      status: isUniqueViolation ? "completed" : "failed",
      source: lead_source,
      leads_processed: 1,
      leads_imported: 0,
      leads_skipped: isUniqueViolation ? 1 : 0,
      completed_at: new Date().toISOString(),
      error_message: insertError?.message ?? "unknown insert failure",
      metadata: {
        outcome: isUniqueViolation ? "deduped_race" : "insert_failed",
        pg_code: insertError?.code ?? null,
        make_execution_id: makeExecutionId,
        idempotency_key: idempotencyKey,
        latency_ms: Date.now() - startedAt,
      },
    });
    if (isUniqueViolation) {
      return jsonResponse(
        { success: true, status: "deduped", message: "Lead already exists (race)" },
        200,
      );
    }
    console.error("[re-intake-webhook] insert failed", insertError);
    return jsonResponse(
      { error: "Failed to store lead", code: "INSERT_FAILED", details: insertError?.message },
      500,
    );
  }

  // 8) Log success
  await supabase.from("re_automation_log").insert({
    automation_type: FUNCTION_NAME,
    status: "completed",
    source: lead_source,
    leads_processed: 1,
    leads_imported: 1,
    leads_skipped: 0,
    completed_at: new Date().toISOString(),
    metadata: {
      outcome: "accepted",
      lead_id: inserted.id,
      make_execution_id: makeExecutionId,
      idempotency_key: idempotencyKey,
      latency_ms: Date.now() - startedAt,
    },
  });

  return jsonResponse(
    {
      success: true,
      status: "accepted",
      lead_id: inserted.id,
      message: "Lead accepted and queued for Dynasty Connect.",
    },
    200,
  );
});
