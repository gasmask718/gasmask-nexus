// Direct Bland AI outbound call. Used by /communication/bland-dial and /brandaro/bland-dial.
// Logs the lead into bland_leads (creating if needed) and stores call_id on bland_call_logs
// so the existing bland-agent-webhook + sync-bland-call pipeline captures transcript,
// recording_url, and summary on completion.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildSmsTemplate } from "../_shared/smsTemplates.ts";
import { blandWebhookUrl } from "../_shared/dialer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BRANDARO_SITE = "https://www.brandarodigital.com";

const DEFAULT_TASK = `You are Aria, a friendly AI sales representative from Brandaro Digital — a premium digital marketing and web design agency that builds websites, runs Google/SEO domination, and manages ads for local businesses.

Goals on this call:
1. Greet the prospect by name if known. Confirm you're speaking with the right person.
2. Briefly explain that Brandaro builds high-converting websites and dominates Google search for businesses like theirs.
3. Ask 1–2 qualifying questions about their current website and online presence.
4. If they show any interest, tell them you'll text them a link RIGHT NOW so they can browse our portfolio of sample websites — the link is ${BRANDARO_SITE}. Confirm the best mobile number to receive it (use the number you're calling).
5. Offer to schedule a 15-minute discovery call with a senior strategist.
6. Keep it conversational, warm, no hard sell. Under 3 minutes.
7. End the call by thanking them and confirming they'll receive the SMS shortly.

Important:
- Never claim to be human. If asked, say you're Brandaro's AI assistant.
- Always pronounce the website as "brandaro digital dot com".
- Capture their name, business name, interest level (interested / callback / not_interested), and best callback time in the call summary.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const BLAND_API_KEY = Deno.env.get("BLAND_API_KEY");
    if (!BLAND_API_KEY) return json({ error: "BLAND_API_KEY is not configured" }, 500);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({} as any));
    const phone_number: string | undefined = body?.phone_number;
    const name: string | undefined = body?.name;
    const business_name: string | undefined = body?.business_name;
    const context: string | undefined = body?.context;
    const voice: string = body?.voice || "maya";
    // Only use the agent endpoint when an ID is explicitly passed in the request.
    // Falling back to BRANDARO_SALES_AGENT_ID env caused 404s when that ID was a
    // pathway/web-agent (not valid for POST /v1/agents/{id}/calls).
    const bland_agent_id: string | undefined = body?.bland_agent_id || undefined;
    const auto_sms: boolean = body?.auto_sms !== false; // default true

    if (!phone_number || !/^\+?[1-9]\d{6,14}$/.test(phone_number.replace(/\s/g, ""))) {
      return json({ error: "phone_number must be in E.164 format (e.g. +15551234567)" }, 400);
    }
    const to = phone_number.startsWith("+") ? phone_number : `+${phone_number}`;

    // Upsert the lead
    const { data: existing } = await supabase
      .from("bland_leads")
      .select("id, name")
      .eq("phone_number", to)
      .maybeSingle();

    let lead_id: string;
    if (existing?.id) {
      lead_id = existing.id;
      if (name && name !== existing.name) {
        await supabase.from("bland_leads").update({ name, updated_at: new Date().toISOString() }).eq("id", lead_id);
      }
    } else {
      const { data: created, error: insErr } = await supabase
        .from("bland_leads")
        .insert({ phone_number: to, name: name || null, status: "new" })
        .select("id")
        .single();
      if (insErr) throw insErr;
      lead_id = created.id;
    }

    // Build task with personalization
    let task = DEFAULT_TASK;
    if (name) task = `The prospect's name is ${name}. ` + task;
    if (business_name) task = `Their business is "${business_name}". ` + task;
    if (context) task = `Additional context from the operator: ${context}\n\n` + task;

    const webhook = blandWebhookUrl(`${SUPABASE_URL}/functions/v1/bland-agent-webhook?lead_id=${lead_id}&agent_type=brandaro_sales`);

    const blandUrl = bland_agent_id
      ? `https://api.bland.ai/v1/agents/${bland_agent_id}/calls`
      : "https://api.bland.ai/v1/calls";

    const payload: Record<string, unknown> = bland_agent_id
      ? {
          phone_number: to,
          webhook,
          metadata: { lead_id, source: "brandaro_dial_hub", business_name, name },
        }
      : {
          phone_number: to,
          task,
          voice,
          first_sentence: name
            ? `Hi ${name}, this is Aria calling from Brandaro Digital — do you have a quick minute?`
            : `Hi, this is Aria calling from Brandaro Digital — am I speaking with the owner?`,
          wait_for_greeting: true,
          record: true,
          model: "enhanced",
          temperature: 0.7,
          max_duration: 12,
          answered_by_enabled: true,
          webhook,
          metadata: { lead_id, source: "brandaro_dial_hub", business_name, name },
          summary_prompt:
            "Provide a concise sales-ops summary: prospect name, business, sentiment (positive/neutral/negative), interest level (interested/callback/not_interested), key objections, agreed next step, and whether the brandarodigital.com link was sent.",
        };

    const r = await fetch(blandUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: BLAND_API_KEY },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("Bland API error", r.status, j);
      return json({ error: "Bland API error", status: r.status, details: j }, r.status);
    }

    const call_id: string | null = (j as any).call_id || null;

    // Pre-create bland_call_logs row so the UI sees it immediately;
    // bland-agent-webhook will UPSERT transcript/recording on completion.
    if (call_id) {
      await supabase
        .from("bland_call_logs")
        .insert({
          lead_id,
          agent_type: "brandaro_sales",
          call_id,
          call_outcome: "in_progress",
          raw_payload: { initiated_via: "bland_dial_hub", payload: { ...payload, task: undefined } },
        });
    }

    // Fire-and-forget: send the brandarodigital.com link via SMS so the prospect always receives it.
    if (auto_sms) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/bland-send-sms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            phone_numbers: [to],
            message: buildSmsTemplate("bland_brandaro_followup", { name }),
            source: "post_call_followup",
            lead_id,
          }),
        });
      } catch (e) {
        console.error("auto_sms failed:", (e as Error).message);
      }
    }

    return json({ ok: true, call_id, lead_id });
  } catch (err) {
    console.error("bland-start-call error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
