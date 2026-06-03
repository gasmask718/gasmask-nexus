/**
 * Dynasty Connect outbound caller — Bland AI dispatcher.
 *
 * Replaces the legacy ElevenLabs <Stream> bridge. Now places calls
 * directly through Bland AI's REST API. Each business + agent type
 * maps to a Bland AI agent ID via env var.
 *
 * Local presence (Brandaro) routing is preserved via the `from` hint
 * passed to Bland AI so the recipient sees a localized caller ID.
 */

import { placeBlandCall } from "../_shared/bland.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Smart local-presence routing for Brandaro
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      to_number,
      lead_name,
      lead_id,
      business,
      agent_type,
      campaign_id,
      agent_id_override,
    } = await req.json();

    if (!to_number) {
      return new Response(JSON.stringify({ success: false, error: "to_number is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const BLAND_API_KEY = Deno.env.get("BLAND_API_KEY") || "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!BLAND_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "BLAND_API_KEY is not configured.",
          credential_issue: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Bland AI agent routing per business + type.
    // Set these env vars in Lovable Cloud → Connectors → secrets.
    const agentRouting: Record<string, Record<string, string>> = {
      unforgettable_times: {
        partner: Deno.env.get("UT_PARTNER_BLAND_AGENT_ID") || "",
        concierge: Deno.env.get("UT_CONCIERGE_BLAND_AGENT_ID") || "",
        ambassador: Deno.env.get("UT_AMBASSADOR_BLAND_AGENT_ID") || "",
        default: Deno.env.get("UT_PARTNER_BLAND_AGENT_ID") || "",
      },
      real_estate: {
        qualifier: Deno.env.get("RE_QUALIFIER_BLAND_AGENT_ID") || "",
        specialist: Deno.env.get("RE_SPECIALIST_BLAND_AGENT_ID") || "",
        closer: Deno.env.get("RE_CLOSER_BLAND_AGENT_ID") || "",
        default: Deno.env.get("RE_QUALIFIER_BLAND_AGENT_ID") || "",
      },
      surplus_funds: {
        client: Deno.env.get("SF_CLIENT_BLAND_AGENT_ID") || "",
        attorney: Deno.env.get("SF_ATTORNEY_BLAND_AGENT_ID") || "",
        default: Deno.env.get("SF_CLIENT_BLAND_AGENT_ID") || "",
      },
      top_tier: {
        concierge: Deno.env.get("TT_CONCIERGE_BLAND_AGENT_ID") || "",
        ambassador: Deno.env.get("TT_AMBASSADOR_BLAND_AGENT_ID") || "",
        default: Deno.env.get("TT_CONCIERGE_BLAND_AGENT_ID") || "",
      },
      brandaro: {
        sales: Deno.env.get("BRANDARO_SALES_BLAND_AGENT_ID") || "",
        closer: Deno.env.get("BRANDARO_CLOSER_BLAND_AGENT_ID") || "",
        relationship: Deno.env.get("BRANDARO_REL_BLAND_AGENT_ID") || "",
        sales_es: Deno.env.get("BRANDARO_ES_CLOSER_BLAND_ID") || "",
        relationship_es: Deno.env.get("BRANDARO_ES_REL_BLAND_ID") || "",
        default: Deno.env.get("BRANDARO_SALES_BLAND_AGENT_ID") || "",
      },
      playboxxx: {
        manager: Deno.env.get("PLAYBOXXX_MANAGER_BLAND_ID") || "",
        affiliate: Deno.env.get("PLAYBOXXX_AFFILIATE_BLAND_ID") || "",
        production: Deno.env.get("PLAYBOXXX_PRODUCTION_BLAND_ID") || "",
        default: Deno.env.get("PLAYBOXXX_MANAGER_BLAND_ID") || "",
      },
      iclean: {
        booking: Deno.env.get("ICLEAN_BOOKING_BLAND_AGENT_ID") || "",
        default: Deno.env.get("ICLEAN_BOOKING_BLAND_AGENT_ID") || "",
      },
      gasmask: {
        sales: Deno.env.get("DC_SALES_AGENT_ID") || "",
        followup: Deno.env.get("DC_FOLLOWUP_AGENT_ID") || "",
        reactivation: Deno.env.get("DC_REACTIVATION_AGENT_ID") || "",
        inbound: Deno.env.get("DC_INBOUND_AGENT_ID") || "",
        default: Deno.env.get("DC_SALES_AGENT_ID") || "",
      },
    };

    const phoneMap: Record<string, string> = {
      unforgettable_times: Deno.env.get("UT_PHONE_NUMBER") || "+18484004179",
      real_estate: Deno.env.get("RE_PHONE_NUMBER") || "+18484004179",
      surplus_funds: Deno.env.get("SF_PHONE_NUMBER") || "+18484004179",
      top_tier: Deno.env.get("TT_PHONE_NUMBER") || "+18484004179",
      brandaro: Deno.env.get("BRANDARO_PHONE_NUMBER") || "+18484004179",
      playboxxx: Deno.env.get("PLAYBOXXX_PHONE_NUMBER") || "+18484004179",
      iclean: Deno.env.get("ICLEAN_PHONE_NUMBER") || "+18484004179",
      gasmask: Deno.env.get("GASMASK_PHONE_NUMBER") || "+18484004179",
    };

    const biz = business || "gasmask";
    const businessAgents = agentRouting[biz] || agentRouting.gasmask;
    const agentId = agent_id_override || businessAgents[agent_type] || businessAgents.default;
    const defaultFrom = phoneMap[biz] || "+18484004179";

    const fromNumber = biz === "brandaro" ? getLocalNumber(to_number, defaultFrom) : defaultFrom;

    const result = await placeBlandCall({
      to: to_number,
      from: fromNumber,
      agent_id: agentId || undefined,
      first_sentence: lead_name ? `Hi, is this ${lead_name}?` : undefined,
      webhook: `${SUPABASE_URL}/functions/v1/bland-agent-webhook`,
      metadata: {
        lead_id: lead_id || null,
        lead_name: lead_name || null,
        campaign_id: campaign_id || null,
        business: biz,
        agent_type: agent_type || null,
      },
      record: true,
    });

    if (!result.ok) {
      console.error("Bland AI call failed:", result.error);
      return new Response(
        JSON.stringify({ success: false, error: "Call failed", details: result.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (SUPABASE_URL && SUPABASE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/dc_call_logs`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          call_sid: result.call_id, // Bland call_id stored where Twilio SID used to be
          to_number,
          from_number: fromNumber,
          lead_name: lead_name || null,
          lead_id: lead_id || null,
          campaign_id: campaign_id || null,
          direction: "outbound",
          agent_id: agentId,
          business: biz,
          status: "initiated",
        }),
      }).catch((e) => console.error("dc_call_logs insert error:", e));
    }

    return new Response(
      JSON.stringify({
        success: true,
        call_id: result.call_id,
        agent_id: agentId,
        from: fromNumber,
        provider: "bland_ai",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("dc-outbound-call error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
