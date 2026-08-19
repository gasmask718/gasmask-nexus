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
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { isHealthProbe, healthProbeResponse } from "../_shared/healthProbe.ts";

const BlandOutcomeSchema = z.object({
  delivery_requested: z.boolean(),
  preferred_window: z.enum(['morning', 'afternoon', 'evening']).nullable().optional(),
  preferred_day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']).nullable().optional(),
  urgency: z.enum(['today', 'this_week', 'next_week', 'no_rush']).nullable().optional(),
  intent_summary: z.string().max(500),
  is_reactivation_lead: z.boolean().optional().default(false),
});
type BlandOutcome = z.infer<typeof BlandOutcomeSchema>;

function extractBlandOutcome(payload: any): BlandOutcome | null {
  const candidates = [
    payload?.bland_outcome,
    payload?.analysis?.bland_outcome,
    payload?.metadata?.bland_outcome,
    payload?.extracted?.bland_outcome,
    payload?.summary?.bland_outcome,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    let obj: any = candidate;
    if (typeof candidate === 'string') {
      try { obj = JSON.parse(candidate); } catch { continue; }
    }
    if (obj && typeof obj === 'object') {
      const result = BlandOutcomeSchema.safeParse(obj);
      if (result.success) return result.data;
    }
  }
  return null;
}

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
    // Liveness probe from comms-health-monitor — answer, never persist.
    if (isHealthProbe(payload)) return healthProbeResponse("bland-agent-webhook", corsHeaders);
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
      source_table: (meta.source_table as string) || null,
      source_id: (meta.source_id as string) || null,
      source_business: (meta.source_business as string) || (meta.business as string) || null,
    });
    if (insertErr && !/duplicate/i.test(insertErr.message)) {
      console.error("bland_call_logs insert error:", insertErr);
      await logEvent({
        supabase, campaign_id, queue_item_id, call_session_id, call_sid: twilio_call_sid,
        event_type: "bland.persist_error", source: "bland", severity: "error",
        payload: { message: insertErr.message },
      });
    }

    // Step 5 — Structured outcome extraction from Bland AI persona
    const blandOutcome = extractBlandOutcome(payload);
    if (blandOutcome && call_id) {
      const { error: outcomeErr } = await supabase
        .from("bland_call_logs")
        .update({
          delivery_requested: blandOutcome.delivery_requested,
          preferred_day: blandOutcome.preferred_day ?? null,
          preferred_window: blandOutcome.preferred_window ?? null,
          urgency: blandOutcome.urgency ?? null,
          intent_summary: blandOutcome.intent_summary,
          is_reactivation_lead: blandOutcome.is_reactivation_lead ?? false,
          structured_outcome_received_at: new Date().toISOString(),
        })
        .eq("call_id", call_id);
      if (outcomeErr) {
        console.error("[bland-agent-webhook] structured outcome update failed:", outcomeErr);
      } else {
        console.log(
          `[bland-agent-webhook] structured outcome received: delivery_requested=${blandOutcome.delivery_requested}, urgency=${blandOutcome.urgency}`
        );
        if (blandOutcome.delivery_requested) {
          console.log(
            `[bland-agent-webhook] DELIVERY REQUESTED for call ${call_id} — queueing pending_route_stops`
          );
          // Step 6 — enqueue into pending_route_stops with AI enrichment
          try {
            const storeId =
              meta.store_id ||
              payload?.store_id ||
              payload?.variables?.store_id ||
              null;

            // Look up bland_call_logs.id for FK
            let blandLogId: string | null = null;
            const { data: logRow } = await supabase
              .from("bland_call_logs")
              .select("id")
              .eq("call_id", call_id)
              .maybeSingle();
            if ((logRow as any)?.id) blandLogId = (logRow as any).id;

            let storeName: string | null = null;
            let recommended_boxes: number | null = null;
            let recommended_brand: string | null = null;
            let estimated_revenue: number | null = null;
            let confidence_level: string | null = null;
            let aiPayload: any = null;

            if (storeId) {
              try {
                const { data: aiResp, error: aiErr } = await supabase.functions.invoke(
                  "tube-replenishment-ai",
                  { body: { storeId } }
                );
                if (!aiErr && aiResp) {
                  aiPayload = aiResp;
                  storeName = (aiResp as any)?.store_name ?? null;
                  const top = (aiResp as any)?.recommendations?.[0];
                  if (top) {
                    recommended_boxes = top.recommended_boxes ?? null;
                    recommended_brand = top.brand ?? null;
                    estimated_revenue = top.estimated_revenue ?? null;
                  }
                  confidence_level =
                    (aiResp as any)?.analysis?.price_verification
                      ?.verification_confidence ?? null;
                }
              } catch (aiE) {
                console.error("[bland-agent-webhook] tube-replenishment-ai failed:", aiE);
              }

              if (!storeName) {
                const { data: s } = await supabase
                  .from("stores")
                  .select("name")
                  .eq("id", storeId)
                  .maybeSingle();
                storeName = (s as any)?.name ?? null;
              }

              // Universal sink via promote_store_to_route_board (dedup-aware)
              const reasonText = blandOutcome.intent_summary || 'AI call: delivery requested';
              const { data: promoteId, error: queueErr } = await supabase.rpc(
                'promote_store_to_route_board',
                {
                  _store_id: storeId,
                  _signal_source: 'ai_call_outcome',
                  _reason: reasonText,
                  _source_ref: call_id,
                  _business: 'gasmask',
                  _priority: blandOutcome.urgency === 'today' ? 5 : blandOutcome.urgency === 'this_week' ? 4 : 3,
                  _estimated_revenue: estimated_revenue,
                  _urgency: blandOutcome.urgency ?? 'this_week',
                  _intent_summary: blandOutcome.intent_summary,
                }
              );
              if (queueErr) {
                console.error("[bland-agent-webhook] promote_store_to_route_board failed:", queueErr);
              } else {
                console.log(`[bland-agent-webhook] promoted store ${storeId} → pending_route_stops ${promoteId} (ai_call_outcome)`);
                // Also stamp the bland-side enrichment fields on the row (non-fatal)
                if (promoteId) {
                  await supabase.from('pending_route_stops').update({
                    bland_call_log_id: blandLogId,
                    requested_day: blandOutcome.preferred_day ?? null,
                    requested_window: blandOutcome.preferred_window ?? null,
                    recommended_boxes,
                    recommended_brand,
                    confidence_level,
                    ai_payload: aiPayload,
                  }).eq('id', promoteId);
                }
              }
            } else {
              console.warn(
                `[bland-agent-webhook] delivery_requested but no store_id available — cannot queue`
              );
            }
          } catch (qE) {
            console.error("[bland-agent-webhook] Step 6 enqueue error:", qE);
          }
        }
      }
    } else if (
      payload?.bland_outcome ||
      payload?.analysis?.bland_outcome ||
      payload?.metadata?.bland_outcome ||
      payload?.extracted?.bland_outcome ||
      payload?.summary?.bland_outcome
    ) {
      console.warn(
        "[bland-agent-webhook] bland_outcome present but failed schema validation"
      );
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

    // ===== Mirror into Dynasty Connect tables so the calling UI =====
    // (transcripts / analysis / call history) actually populates.
    if (call_id) {
      const business = (meta.business as string) || null;
      const duration =
        payload.call_length || payload.duration || payload.call_duration || payload.corrected_duration || null;

      // Bidirectional sync: source linkage from metadata
      const source_table = (meta.source_table as string) || null;
      const source_id = (meta.source_id as string) || null;
      const source_business = (meta.source_business as string) || business;

      // Upsert dynasty_ai_calls by call_id. UNIQUE(call_id) constraint already exists.
      const { error: dcErr } = await supabase
        .from("dynasty_ai_calls")
        .upsert(
          {
            call_id,
            business_unit: business || "gasmask",
            agent_id: (meta.agent_id as string) || agent_type || "unknown",
            direction: "outbound",
            from_number: payload.from || null,
            to_number: payload.to || phone_number || null,
            contact_name: (meta.lead_name as string) || null,
            transcript: transcript || null,
            recording_url: recording_url || null,
            duration_seconds: duration ? Math.round(Number(duration)) : null,
            outcome: call_outcome || (transcript ? "completed" : null),
            call_ended_at: new Date().toISOString(),
            source_table,
            source_id,
            source_business,
            source_lead_id: source_id || null,
          },
          { onConflict: "call_id" },
        );
      if (dcErr) console.error("dynasty_ai_calls upsert error:", dcErr.message);

      // ===== T7b.2 (2026-07-08): mirror terminal state into dc_call_logs =====
      // dc-outbound-call seeds a dc_call_logs row with call_sid=Bland call_id and
      // status='initiated'. Without this update the row stays 'initiated' forever
      // (dc-bland-webhook only updates rows dispatched via dc-bland-dispatch's
      // per-hub branches). Mirror dc-bland-webhook's shape: composite outcome,
      // duration_seconds, answered_by, recording, transcript.
      try {
        const rawDisposition =
          (payload?.analysis?.call_outcome
            || payload?.extracted?.call_outcome
            || payload?.metadata?.call_outcome
            || payload?.disposition
            || payload?.status
            || '').toString().toLowerCase();
        const outcome = rawDisposition || (transcript ? 'completed' : 'called');
        const durationSeconds: number | null =
          typeof payload.corrected_duration === 'number' ? payload.corrected_duration
          : typeof payload.call_length === 'number' ? Math.round(payload.call_length * 60)
          : typeof payload.duration === 'number' ? Math.round(payload.duration)
          : null;
        const { error: dclErr } = await supabase
          .from('dc_call_logs')
          .update({
            status: 'completed',
            outcome,
            answered_by: payload.answered_by || null,
            duration_seconds: durationSeconds,
            recording_url: recording_url || null,
            transcript: transcript || null,
            agent_type: 'bland',
          })
          .eq('call_sid', call_id);
        if (dclErr) console.error('[bland-agent-webhook dc_call_logs update failed]', call_id, dclErr.message);
      } catch (e) {
        console.error('[bland-agent-webhook dc_call_logs update threw]', call_id, (e as Error).message);
      }

      // ===== POST-CALL WRITE-BACK to the originating hub row =====
      // (allow-listed, business-checked — see sync-call-to-source)
      if (source_table && source_id) {
        supabase.functions.invoke("sync-call-to-source", {
          body: {
            source_table,
            source_id,
            source_business,
            outcome: call_outcome,
            call_summary: transcript ? transcript.slice(0, 1000) : null,
            call_completed_at: new Date().toISOString(),
          },
        }).then(({ error }: { error: any }) => {
          if (error) console.error("sync-call-to-source invoke error:", error);
        }).catch((e: unknown) => console.error("sync-call-to-source threw:", e));
      }

      // Per-utterance transcript rows for the live transcript pane.
      if (Array.isArray(payload.transcripts) && payload.transcripts.length) {
        const transcriptRows = payload.transcripts
          .map((t: any) => {
            const who = (t.user || t.speaker || "").toLowerCase();
            const text = (t.text || "").trim();
            if (!text) return null;
            return {
              call_id,
              timestamp: t.timestamp || Date.now(),
              speaker: who.includes("user") || who.includes("caller") || who === "human" ? "prospect" : "ai",
              text,
            };
          })
          .filter(Boolean);
        if (transcriptRows.length) {
          const { error: trErr } = await supabase
            .from("dynasty_call_transcripts")
            .insert(transcriptRows);
          if (trErr) console.error("dynasty_call_transcripts insert error:", trErr.message);
        }
      }

      // Kick Claude analysis (writes dynasty_call_analysis row + lead_quality).
      if (transcript) {
        supabase.functions
          .invoke("claude-call-analyzer", {
            body: {
              call_id,
              business_unit: business || "gasmask",
              transcript,
              duration_seconds: duration ? Math.round(Number(duration)) : null,
              contact_name: (meta.lead_name as string) || null,
              company_name: (meta.company_name as string) || null,
            },
          })
          .then(({ error }: { error: any }) => {
            if (error) console.error("claude-call-analyzer invoke error:", error);
          })
          .catch((e: unknown) => console.error("claude-call-analyzer threw:", e));
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
