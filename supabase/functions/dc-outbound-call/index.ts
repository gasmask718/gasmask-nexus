/**
 * Dynasty Connect outbound caller — Bland AI dispatcher.
 *
 * RESOLUTION ORDER (DB-first, env-var fallback, never breaks live businesses):
 *   AGENT:   agent_id_override → dc_agents (business, agent_type) → env-var map
 *   FROM #:  dc_phone_numbers (business, is_active) → env-var map → +18484004179
 *
 * Brandaro local-presence area-code routing is preserved as env-var driven (future
 * migration: dc_local_presence_numbers table).
 */

import { placeBlandCall } from "../_shared/bland.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getLocalNumber = (toNumber: string, defaultFrom: string): string => {
  const areaCode = toNumber.replace(/\D/g, "").substring(1, 4);
  if (["809", "829", "849"].includes(areaCode)) return Deno.env.get("BRANDARO_DR_NUMBER") || defaultFrom;
  if (["305", "754", "786", "407", "561", "321", "941", "727", "813", "904"].includes(areaCode)) return Deno.env.get("BRANDARO_FL_NUMBER") || defaultFrom;
  if (["214", "713", "832", "512", "281", "972", "469", "817", "210", "361"].includes(areaCode)) return Deno.env.get("BRANDARO_TX_NUMBER") || defaultFrom;
  if (["213", "310", "323", "415", "619", "818", "626", "949", "714", "562"].includes(areaCode)) return Deno.env.get("BRANDARO_CA_NUMBER") || defaultFrom;
  if (["848", "201", "732", "908", "973", "551", "609"].includes(areaCode)) return Deno.env.get("BRANDARO_NJ_NUMBER") || defaultFrom;
  if (["404", "470", "678", "770", "706", "762"].includes(areaCode)) return Deno.env.get("BRANDARO_GA_NUMBER") || defaultFrom;
  return defaultFrom;
};

// --- env-var fallback maps (legacy, used only when DB lookup misses) ---
const ENV_AGENT_FALLBACK: Record<string, Record<string, string>> = {
  unforgettable_times: { partner: "UT_PARTNER_BLAND_AGENT_ID", concierge: "UT_CONCIERGE_BLAND_AGENT_ID", ambassador: "UT_AMBASSADOR_BLAND_AGENT_ID", default: "UT_PARTNER_BLAND_AGENT_ID" },
  real_estate:         { qualifier: "RE_QUALIFIER_BLAND_AGENT_ID", specialist: "RE_SPECIALIST_BLAND_AGENT_ID", closer: "RE_CLOSER_BLAND_AGENT_ID", default: "RE_QUALIFIER_BLAND_AGENT_ID" },
  surplus_funds:       { client: "SF_CLIENT_BLAND_AGENT_ID", attorney: "SF_ATTORNEY_BLAND_AGENT_ID", default: "SF_CLIENT_BLAND_AGENT_ID" },
  top_tier:            { concierge: "TT_CONCIERGE_BLAND_AGENT_ID", ambassador: "TT_AMBASSADOR_BLAND_AGENT_ID", default: "TT_CONCIERGE_BLAND_AGENT_ID" },
  brandaro:            { sales: "BRANDARO_SALES_BLAND_AGENT_ID", closer: "BRANDARO_CLOSER_BLAND_AGENT_ID", relationship: "BRANDARO_REL_BLAND_AGENT_ID", sales_es: "BRANDARO_ES_CLOSER_BLAND_ID", relationship_es: "BRANDARO_ES_REL_BLAND_ID", default: "BRANDARO_SALES_BLAND_AGENT_ID" },
  playboxxx:           { manager: "PLAYBOXXX_MANAGER_BLAND_ID", affiliate: "PLAYBOXXX_AFFILIATE_BLAND_ID", production: "PLAYBOXXX_PRODUCTION_BLAND_ID", default: "PLAYBOXXX_MANAGER_BLAND_ID" },
  iclean:              { booking: "ICLEAN_BOOKING_BLAND_AGENT_ID", default: "ICLEAN_BOOKING_BLAND_AGENT_ID" },
  gasmask:             { sales: "DC_SALES_AGENT_ID", followup: "DC_FOLLOWUP_AGENT_ID", reactivation: "DC_REACTIVATION_AGENT_ID", inbound: "DC_INBOUND_AGENT_ID", default: "DC_SALES_AGENT_ID" },
};

const ENV_PHONE_FALLBACK: Record<string, string> = {
  unforgettable_times: "UT_PHONE_NUMBER",
  real_estate: "RE_PHONE_NUMBER",
  surplus_funds: "SF_PHONE_NUMBER",
  top_tier: "TT_PHONE_NUMBER",
  brandaro: "BRANDARO_PHONE_NUMBER",
  playboxxx: "PLAYBOXXX_PHONE_NUMBER",
  iclean: "ICLEAN_PHONE_NUMBER",
  gasmask: "GASMASK_PHONE_NUMBER",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function dbFetchAgent(biz: string, agentType?: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
    // try (business, agent_type) first
    if (agentType) {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/dc_agents?business=eq.${biz}&agent_type=eq.${agentType}&is_active=eq.true&select=agent_id&limit=1`,
        { headers },
      );
      const rows = await r.json();
      if (Array.isArray(rows) && rows[0]?.agent_id) return rows[0].agent_id;
    }
    // fallback to any active agent for this business
    const r2 = await fetch(
      `${SUPABASE_URL}/rest/v1/dc_agents?business=eq.${biz}&is_active=eq.true&select=agent_id&order=created_at.asc&limit=1`,
      { headers },
    );
    const rows2 = await r2.json();
    if (Array.isArray(rows2) && rows2[0]?.agent_id) return rows2[0].agent_id;
  } catch (e) { console.error("dbFetchAgent error:", e); }
  return null;
}

async function dbFetchPhone(biz: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/dc_phone_numbers?business=eq.${biz}&is_active=eq.true&select=phone_number&order=created_at.asc&limit=1`,
      { headers },
    );
    const rows = await r.json();
    if (Array.isArray(rows) && rows[0]?.phone_number) return rows[0].phone_number;
  } catch (e) { console.error("dbFetchPhone error:", e); }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      to_number, lead_name, lead_id, business, agent_type, campaign_id, agent_id_override,
      source_table: rawSourceTable, source_id: rawSourceId, source_business: rawSourceBusiness,
      store_id, // legacy from OutreachActions
    } = body;
    // Resolve source: explicit > store_id legacy mapping > none
    const source_table: string | null = rawSourceTable || (store_id ? "store_master" : null);
    const source_id: string | null = rawSourceId || store_id || lead_id || null;
    const source_business: string | null = rawSourceBusiness || (business || null);

    if (!to_number) {
      return new Response(JSON.stringify({ success: false, error: "to_number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const BLAND_API_KEY = Deno.env.get("BLAND_API_KEY") || "";
    if (!BLAND_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "BLAND_API_KEY is not configured.", credential_issue: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const biz = business || "gasmask";

    // --- AGENT RESOLUTION ---
    let agentId = agent_id_override || "";
    let agentSource: "override" | "db" | "env" | "none" = agent_id_override ? "override" : "none";

    if (!agentId) {
      const dbAgent = await dbFetchAgent(biz, agent_type);
      if (dbAgent) { agentId = dbAgent; agentSource = "db"; }
    }
    if (!agentId) {
      const envMap = ENV_AGENT_FALLBACK[biz] || ENV_AGENT_FALLBACK.gasmask;
      const envKey = envMap[agent_type as string] || envMap.default;
      const envVal = envKey ? Deno.env.get(envKey) : "";
      if (envVal) { agentId = envVal; agentSource = "env"; }
    }

    // --- FROM-NUMBER RESOLUTION ---
    let fromNumber = "+18484004179";
    let phoneSource: "db" | "env" | "default" = "default";

    const dbPhone = await dbFetchPhone(biz);
    if (dbPhone) { fromNumber = dbPhone; phoneSource = "db"; }
    else {
      const envKey = ENV_PHONE_FALLBACK[biz];
      const envVal = envKey ? Deno.env.get(envKey) : "";
      if (envVal) { fromNumber = envVal; phoneSource = "env"; }
    }

    // Brandaro local-presence overlay (env-driven for now)
    if (biz === "brandaro") fromNumber = getLocalNumber(to_number, fromNumber);

    console.log(`[dc-outbound-call] biz=${biz} agent_type=${agent_type || "—"} agent=${agentId || "MISSING"}(${agentSource}) from=${fromNumber}(${phoneSource})`);

    if (!agentId) {
      return new Response(JSON.stringify({ success: false, error: `No Bland agent configured for business=${biz}${agent_type ? ` agent_type=${agent_type}` : ""}. Add a row in dc_agents.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await placeBlandCall({
      to: to_number,
      from: fromNumber,
      agent_id: agentId,
      first_sentence: lead_name ? `Hi, is this ${lead_name}?` : undefined,
      webhook: `${SUPABASE_URL}/functions/v1/bland-agent-webhook`,
      metadata: {
        lead_id: lead_id || null,
        lead_name: lead_name || null,
        campaign_id: campaign_id || null,
        business: biz,
        agent_type: agent_type || null,
        source_table,
        source_id,
        source_business,
      },
      record: true,
    });

    if (!result.ok) {
      console.error("Bland AI call failed:", result.error);
      return new Response(JSON.stringify({ success: false, error: "Call failed", details: result.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (SUPABASE_URL && SUPABASE_KEY) {
      const restHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" };
      await fetch(`${SUPABASE_URL}/rest/v1/dc_call_logs`, {
        method: "POST", headers: restHeaders,
        body: JSON.stringify({
          call_sid: result.call_id, to_number, from_number: fromNumber,
          lead_name: lead_name || null, lead_id: lead_id || null,
          campaign_id: campaign_id || null, direction: "outbound",
          agent_id: agentId, business: biz, status: "initiated",
          source_table, source_id, source_business,
        }),
      }).catch((e) => console.error("dc_call_logs insert error:", e));

      await fetch(`${SUPABASE_URL}/rest/v1/dynasty_ai_calls`, {
        method: "POST", headers: { ...restHeaders, Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({
          call_id: result.call_id, business_unit: biz, agent_id: agentId,
          direction: "outbound", from_number: fromNumber, to_number,
          contact_name: lead_name || null, call_started_at: new Date().toISOString(),
          call_type: "ai_outbound",
          source_table, source_id, source_business,
          source_lead_id: source_id || null,
        }),
      }).catch((e) => console.error("dynasty_ai_calls seed error:", e));
    }

    return new Response(JSON.stringify({
      success: true, call_id: result.call_id, agent_id: agentId, from: fromNumber,
      provider: "bland_ai",
      resolution: { agent_source: agentSource, phone_source: phoneSource },
      source: { source_table, source_id, source_business },
    }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("dc-outbound-call error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
