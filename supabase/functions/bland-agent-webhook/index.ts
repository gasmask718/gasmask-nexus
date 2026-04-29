// Bland AI post-call webhook receiver — public endpoint.
// Persists transcript + recording to bland_call_logs and (when linked to a campaign)
// the outbound_call_queue row, plus per-utterance lines into live_call_transcripts
// and a timeline event into dialer_call_events for the dashboard.
//
// Hardened (2026-04-29):
//  - Optional shared-secret validation via X-Bland-Secret (BLAND_WEBHOOK_SECRET).
//  - Webhook idempotency via dialer_webhook_events (provider+call_id+event).
//  - Severity-tagged events on insert errors.

import {
  corsHeaders,
  svc,
  verifyBland,
  logEvent,
  recordWebhookDelivery,
} from "../_shared/dialer.ts";

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
    const supabase = svc();

    const auth = verifyBland(req);
    if (!auth.ok) {
      await logEvent({
        supabase,
        event_type: "bland.webhook_unauthorized",
        source: "bland", severity: "warning",
        payload: { reason: auth.reason },
      });
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json().catch(() => ({}));
    console.log("Bland webhook payload:", JSON.stringify(payload).slice(0, 1500));

    const call_id = payload.call_id || payload.c_id || null;
    const phone_number = payload?.variables?.phone_number || payload?.to || payload?.phone_number || null;
    const transcript: string | null =
      payload.concatenated_transcript ||
      payload.transcript ||
      (Array.isArray(payload.transcripts)
        ? payload.transcripts.map((t: any) => `${t.user || t.speaker}: ${t.text}`).join("\n")
        : null);
    const recording_url: string | null = payload.recording_url || payload.audio_url || null;
    const call_outcome: string | null =
      payload?.analysis?.call_outcome ||
      payload?.extracted?.call_outcome ||
      payload?.metadata?.call_outcome ||
      payload?.summary?.outcome ||
      null;

    const meta = payload.metadata || {};
    let lead_id: string | null = meta.lead_id || null;
    const agent_type: string | null = meta.agent_type || null;
    const queue_item_id: string | null = meta.queue_item_id || null;
    const campaign_id: string | null = meta.campaign_id || null;
    const twilio_call_sid: string | null = meta.twilio_call_sid || null;
    const call_session_id: string | null = meta.call_session_id || null;

    // Idempotency — prefer call_id, fall back to twilio sid.
    const externalId = call_id || twilio_call_sid || `bland-${Date.now()}`;
    // Determine event bucket so transcript_ready vs call_completed don't collide.
    const evtBucket = transcript ? "transcript_ready" : "call_completed";
    const firstDelivery = await recordWebhookDelivery({
      supabase,
      provider: "bland",
      external_id: externalId,
      event_type: evtBucket,
      call_session_id,
      call_sid: twilio_call_sid,
      bland_call_id: call_id,
      payload,
    });
    if (!firstDelivery) {
      return new Response(JSON.stringify({ ok: true, deduped: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lead_id && phone_number) {
      const { data: lead } = await supabase
        .from("bland_leads").select("id").eq("phone_number", phone_number)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (lead) lead_id = lead.id;
    }

    if (lead_id && call_outcome) {
      const newStatus = OUTCOME_TO_STATUS[String(call_outcome).toLowerCase()];
      if (newStatus) {
        await supabase.from("bland_leads").update({
          status: newStatus, updated_at: new Date().toISOString(),
        }).eq("id", lead_id);
      }
    }

    // Use upsert by (call_id) where possible to dedupe.
    const { error: insertErr } = await supabase.from("bland_call_logs").insert({
      lead_id, agent_type, call_id, transcript, recording_url, call_outcome, raw_payload: payload,
    });
    if (insertErr && !/duplicate/i.test(insertErr.message)) {
      console.error("bland_call_logs insert error:", insertErr);
      await logEvent({
        supabase, campaign_id, queue_item_id, call_session_id, call_sid: twilio_call_sid,
        event_type: "bland.persist_error", source: "bland", severity: "error",
        payload: { message: insertErr.message },
      });
    }

    if (queue_item_id) {
      const { error: qErr } = await supabase.from("outbound_call_queue").update({
        bland_call_id: call_id,
        bland_recording_url: recording_url,
        bland_transcript: transcript,
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", queue_item_id);
      if (qErr) {
        console.error("queue update failed:", qErr);
        await logEvent({
          supabase, campaign_id, queue_item_id, call_session_id, call_sid: twilio_call_sid,
          event_type: "bland.queue_update_error", source: "bland", severity: "error",
          payload: { message: qErr.message, call_id },
        });
      }
    } else if (twilio_call_sid && call_id) {
      // Fallback: webhook arrived without metadata.queue_item_id — try to backfill via twilio sid.
      const { data: q } = await supabase
        .from("outbound_call_queue")
        .select("id")
        .eq("twilio_call_sid", twilio_call_sid)
        .maybeSingle();
      if ((q as any)?.id) {
        await supabase.from("outbound_call_queue").update({
          bland_call_id: call_id,
          bland_recording_url: recording_url,
          bland_transcript: transcript,
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", (q as any).id);
      } else {
        await logEvent({
          supabase, call_session_id, call_sid: twilio_call_sid,
          event_type: "bland.queue_link_missing", source: "bland", severity: "warning",
          payload: { call_id, reason: "no queue_item_id in metadata, no twilio sid match" },
        });
      }
    }

    // Close the live_calls row so the Live Monitor stops showing it as active.
    if (twilio_call_sid) {
      try {
        await supabase
          .from("live_calls")
          .update({
            state: "completed",
            ended_at: new Date().toISOString(),
            recording_url: recording_url || undefined,
            updated_at: new Date().toISOString(),
            metadata: { bland_call_id: call_id, has_transcript: !!transcript },
          })
          .eq("call_sid", twilio_call_sid);
      } catch (e) {
        console.error("live_calls close failed:", e);
      }
    }

    await logEvent({
      supabase, campaign_id, queue_item_id, call_session_id, call_sid: twilio_call_sid,
      event_type: transcript ? "bland.transcript_ready" : "bland.call_completed",
      source: "bland", severity: "info",
      payload: { call_id, call_outcome, recording_url, has_transcript: !!transcript },
      dedupe_bucket: evtBucket,
    });

    if (twilio_call_sid && Array.isArray(payload.transcripts)) {
      const rows = payload.transcripts.map((t: any) => {
        const who = (t.user || t.speaker || "").toLowerCase();
        const text = (t.text || "").trim();
        if (!text) return null;
        return {
          call_sid: twilio_call_sid,
          speaker: who.includes("user") || who.includes("caller") ? "caller" : "ai",
          text,
        };
      }).filter(Boolean);
      if (rows.length) {
        const { error: ttErr } = await supabase.from("live_call_transcripts").insert(rows);
        if (ttErr) console.error("live_call_transcripts insert error:", ttErr);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("bland-agent-webhook error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
