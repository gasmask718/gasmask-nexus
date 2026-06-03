// Bland AI shared call-history + context API.
//
// Bland calls this endpoint pre-call (request_data) or mid-call (custom tool)
// to fetch the contact's name + company + last 2-3 touches so the agent knows
// who they're talking to. Authenticated via BLAND_API_KEY.
//
// Supports two lookup modes:
//   1) ?phone=+1XXX                                  (back-compat: store-only)
//   2) ?source_table=<t>&source_id=<uuid>            (generic, all hubs)
//
// verify_jwt = false (Bland authenticates with its own API key)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/dialer.ts";

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Hardcoded source registry — same allow-list approach as sync-call-to-source.
// Maps a source_table to the columns we read for context.
const SOURCE_READERS: Record<string, {
  nameCols: string[];
  companyCol?: string;
  phoneCol: string;
  extra?: string[];
}> = {
  store_master: {
    nameCols: ["owner_name", "contact_name", "store_name"],
    companyCol: "store_name",
    phoneCol: "phone",
    extra: ["last_order_at", "last_visit_at", "notes", "relationship_status"],
  },
  brandaro_qualified_leads: {
    nameCols: ["full_name", "first_name", "last_name"],
    companyCol: "business_name",
    phoneCol: "phone_number",
    extra: ["industry", "city", "state", "lead_status", "excitement_level", "call_notes"],
  },
  ut_partner_leads: {
    nameCols: ["contact_name"],
    companyCol: "business_name",
    phoneCol: "phone",
    extra: ["category", "city", "state", "status", "last_outcome", "outreach_count"],
  },
  re_leads: {
    nameCols: ["first_name", "last_name"],
    companyCol: "property_address",
    phoneCol: "phone",
    extra: ["city", "state", "status", "estimated_value", "motivation", "timeline"],
  },
  dc_leads: {
    nameCols: ["first_name", "last_name"],
    companyCol: "lead_type",
    phoneCol: "phone",
    extra: ["business_name", "city", "state", "status", "outcome", "notes"],
  },
};

async function loadSourceContext(sb: ReturnType<typeof svc>, table: string, id: string) {
  const reader = SOURCE_READERS[table];
  if (!reader) return null;
  const cols = Array.from(new Set([
    "id", reader.phoneCol, ...(reader.nameCols), ...(reader.companyCol ? [reader.companyCol] : []),
    ...(reader.extra || []),
  ])).join(",");
  const { data: row } = await sb.from(table).select(cols).eq("id", id).maybeSingle();
  if (!row) return null;
  const nameParts = reader.nameCols.map((c) => (row as any)[c]).filter(Boolean);
  const display_name = nameParts.length ? nameParts.join(" ").trim() : null;
  const company = reader.companyCol ? (row as any)[reader.companyCol] || null : null;
  const phone = (row as any)[reader.phoneCol] || null;
  const meta: Record<string, unknown> = {};
  for (const c of reader.extra || []) meta[c] = (row as any)[c];
  return { display_name, company, phone, meta };
}

async function loadRecentCalls(sb: ReturnType<typeof svc>, table: string, id: string) {
  const { data } = await sb
    .from("dynasty_ai_calls")
    .select("call_started_at, outcome, lead_quality, contact_name, transcript")
    .eq("source_table", table)
    .eq("source_id", id)
    .order("call_started_at", { ascending: false })
    .limit(3);
  return (data || []).map((c: any) => ({
    at: c.call_started_at,
    outcome: c.outcome,
    quality: c.lead_quality,
    summary: c.transcript ? String(c.transcript).slice(0, 200) : null,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const phone = url.searchParams.get("phone") || "";
  const source_table = url.searchParams.get("source_table") || "";
  const source_id = url.searchParams.get("source_id") || "";
  const apiKey = url.searchParams.get("api_key") || req.headers.get("x-api-key") || "";

  const expected = Deno.env.get("BLAND_API_KEY");
  if (!expected) return json({ error: "BLAND_API_KEY not configured" }, 500);
  if (apiKey !== expected) return json({ error: "Unauthorized" }, 401);
  if (!phone && !(source_table && source_id)) {
    return json({ error: "phone or (source_table + source_id) required" }, 400);
  }

  const sb = svc();

  // ── Generic source lookup (preferred for cross-hub) ──
  if (source_table && source_id) {
    const ctx = await loadSourceContext(sb, source_table, source_id);
    if (!ctx) return json({ matched: false, message: "Source row not found" });
    const recent_calls = await loadRecentCalls(sb, source_table, source_id);
    return json({
      matched: true,
      source_table,
      source_id,
      display_name: ctx.display_name,
      company: ctx.company,
      phone: ctx.phone,
      details: ctx.meta,
      recent_calls,
    });
  }

  // ── Back-compat: phone-based store lookup ──
  const { data: contact } = await sb
    .from("store_contacts")
    .select("id, name, store_id, opted_out")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();

  if (!contact?.store_id) {
    return json({ matched: false, message: "Unknown caller" });
  }

  const { data: store } = await sb
    .from("stores")
    .select("id, name")
    .eq("id", contact.store_id)
    .maybeSingle();

  const { data: logs } = await sb
    .from("communication_logs")
    .select("channel, direction, message_content, summary, created_at, operator_id, bland_ai_handled")
    .eq("store_id", contact.store_id)
    .order("created_at", { ascending: false })
    .limit(20);

  const operatorIds = Array.from(new Set((logs || []).map((l: any) => l.operator_id).filter(Boolean)));
  let operatorMap: Record<string, string> = {};
  if (operatorIds.length) {
    const { data: profiles } = await sb
      .from("profiles").select("id, full_name").in("id", operatorIds);
    operatorMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name || ""]));
  }

  const recent_interactions = (logs || []).map((l: any) => ({
    channel: l.channel,
    direction: l.direction,
    operator_name: l.operator_id ? operatorMap[l.operator_id] || null : (l.bland_ai_handled ? "Sara (AI)" : null),
    message: l.message_content || l.summary || "",
    created_at: l.created_at,
  }));

  return json({
    matched: true,
    store_id: contact.store_id,
    store_name: store?.name || null,
    contact_id: contact.id,
    contact_name: contact.name || null,
    opted_out: !!contact.opted_out,
    recent_interactions,
  });
});
