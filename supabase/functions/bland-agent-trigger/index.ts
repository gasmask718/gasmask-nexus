// Bland AI outbound call trigger
// POST /functions/v1/bland-agent-trigger
// Body: { lead_id?, phone_number?, agent_type, prompt?, voice?, queue_item_id?, campaign_id? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const BLAND_API_KEY = Deno.env.get("BLAND_API_KEY");
    if (!BLAND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "BLAND_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    let { lead_id, phone_number, agent_type, prompt, voice, queue_item_id, campaign_id } = body ?? {};

    if (!agent_type) {
      return new Response(JSON.stringify({ error: "agent_type is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve phone & lead from lead_id
    if (lead_id && !phone_number) {
      const { data: lead, error } = await supabase
        .from("bland_leads")
        .select("id, phone_number, name")
        .eq("id", lead_id)
        .maybeSingle();
      if (error) throw error;
      if (!lead) {
        return new Response(JSON.stringify({ error: "Lead not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      phone_number = lead.phone_number;
    }

    if (!phone_number) {
      return new Response(JSON.stringify({ error: "phone_number or lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve agent record (bland_agent_id, prompt, voice)
    let blandAgentId: string | null = null;
    {
      const { data: agent } = await supabase
        .from("bland_agent_webhooks")
        .select("bland_agent_id, default_prompt, default_voice")
        .eq("agent_type", agent_type)
        .eq("is_active", true)
        .maybeSingle();
      if (agent) {
        blandAgentId = (agent as any).bland_agent_id ?? null;
        if (!prompt) prompt = agent.default_prompt || `You are an AI calling agent for the ${agent_type} workflow.`;
        voice = voice || agent.default_voice || "maya";
      }
    }

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/bland-agent-webhook`;

    // If a Bland agent ID is configured, use the agent endpoint (it owns the prompt/voice).
    // Otherwise fall back to the generic /v1/calls endpoint with task+voice.
    const useAgent = !!blandAgentId;
    const blandUrl = useAgent
      ? `https://api.bland.ai/v1/agents/${blandAgentId}/calls`
      : "https://api.bland.ai/v1/calls";

    const blandPayload: Record<string, unknown> = useAgent
      ? {
          phone_number,
          webhook: webhookUrl,
          metadata: { lead_id: lead_id ?? null, agent_type, queue_item_id: queue_item_id ?? null, campaign_id: campaign_id ?? null },
        }
      : {
          phone_number,
          task: prompt || "You are a friendly AI agent. Greet the lead and qualify their interest.",
          voice: voice || "maya",
          webhook: webhookUrl,
          metadata: { lead_id: lead_id ?? null, agent_type, queue_item_id: queue_item_id ?? null, campaign_id: campaign_id ?? null },
        };

    const blandRes = await fetch(blandUrl, {
      method: "POST",
      headers: {
        "authorization": BLAND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(blandPayload),
    });

    const blandJson = await blandRes.json().catch(() => ({}));
    if (!blandRes.ok) {
      console.error("Bland API error:", blandJson);
      return new Response(
        JSON.stringify({ error: "Bland AI call failed", details: blandJson }),
        { status: blandRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, call_id: blandJson.call_id, status: blandJson.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("bland-agent-trigger error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
