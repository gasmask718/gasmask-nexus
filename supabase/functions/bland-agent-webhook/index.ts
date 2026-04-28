// Bland AI post-call webhook receiver — public endpoint
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OUTCOME_TO_STATUS: Record<string, string> = {
  interested: "interested",
  callback: "callback",
  call_back: "callback",
  not_interested: "not-interested",
  "not-interested": "not-interested",
  uninterested: "not-interested",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = await req.json().catch(() => ({}));
    console.log("Bland webhook payload:", JSON.stringify(payload).slice(0, 1000));

    const call_id = payload.call_id || payload.c_id || null;
    const phone_number =
      payload?.variables?.phone_number ||
      payload?.to ||
      payload?.phone_number ||
      null;
    const transcript =
      payload.concatenated_transcript ||
      payload.transcript ||
      (Array.isArray(payload.transcripts)
        ? payload.transcripts.map((t: any) => `${t.user || t.speaker}: ${t.text}`).join("\n")
        : null);
    const recording_url = payload.recording_url || payload.audio_url || null;
    const call_outcome =
      payload?.analysis?.call_outcome ||
      payload?.extracted?.call_outcome ||
      payload?.metadata?.call_outcome ||
      payload?.summary?.outcome ||
      null;

    const meta = payload.metadata || {};
    let lead_id: string | null = meta.lead_id || null;
    const agent_type: string | null = meta.agent_type || null;

    // Try to resolve lead by phone if no lead_id
    if (!lead_id && phone_number) {
      const { data: lead } = await supabase
        .from("bland_leads")
        .select("id")
        .eq("phone_number", phone_number)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lead) lead_id = lead.id;
    }

    // Update lead status from outcome
    if (lead_id && call_outcome) {
      const newStatus = OUTCOME_TO_STATUS[String(call_outcome).toLowerCase()];
      if (newStatus) {
        await supabase
          .from("bland_leads")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", lead_id);
      }
    }

    // Insert call log
    const { error: insertErr } = await supabase.from("bland_call_logs").insert({
      lead_id,
      agent_type,
      call_id,
      transcript,
      recording_url,
      call_outcome,
      raw_payload: payload,
    });
    if (insertErr) console.error("bland_call_logs insert error:", insertErr);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("bland-agent-webhook error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
