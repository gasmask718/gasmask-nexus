import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * TWILIO STATUS WEBHOOK
 * 
 * Handles all Twilio status callbacks and AMD results.
 * Routes through dialer-state-transition — NEVER writes status directly.
 * 
 * Events: initiated, ringing, answered, completed, busy, no-answer, failed, canceled
 * AMD: machine_start, machine_end_beep, machine_end_silence, machine_end_other, human, fax, unknown
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Twilio sends form-encoded data
    const contentType = req.headers.get("content-type") || "";
    let params: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const body = await req.text();
      const urlParams = new URLSearchParams(body);
      urlParams.forEach((value, key) => { params[key] = value; });
    } else {
      params = await req.json();
    }

    const callSid = params.CallSid || params.call_sid || "";
    const callStatus = params.CallStatus || params.call_status || "";
    const answeredBy = params.AnsweredBy || params.answered_by || ""; // AMD result
    const callDuration = parseInt(params.CallDuration || params.Duration || "0") || 0;

    if (!callSid) {
      return new Response(
        JSON.stringify({ error: "No CallSid provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Find queue item by twilio_call_sid ──
    const { data: queueItem } = await supabase
      .from("outbound_call_queue")
      .select("id, status, business_id, store_id, contact_name, phone_number, campaign_id")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();

    // ── Always log the callback for audit ──
    await supabase.from("twilio_call_logs").insert({
      business_id: queueItem?.business_id || null,
      queue_item_id: queueItem?.id || null,
      call_sid: callSid,
      direction: "outbound",
      to_number: params.To || null,
      from_number: params.From || null,
      status: callStatus || answeredBy || "unknown",
      duration: callDuration || null,
      raw_payload: params,
    });

    if (!queueItem) {
      // Orphan callback — logged but no action
      return new Response(
        JSON.stringify({ ok: true, note: "no_matching_queue_item" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── AMD Result Handling ──
    // If AMD detected a machine, transition to voicemail
    if (answeredBy && answeredBy !== "human") {
      if (queueItem.status === "dialing" || queueItem.status === "answered") {
        await supabase.functions.invoke("dialer-state-transition", {
          body: { queue_item_id: queueItem.id, new_status: "voicemail" },
        });

        // Clear claim fields
        await supabase.from("outbound_call_queue").update({
          claimed_by_user_id: null, claimed_at: null,
          claim_expires_at: null, claim_token: null,
        }).eq("id", queueItem.id);

        // Hang up the call via Twilio API
        await hangupCall(callSid);
      }

      return new Response(
        JSON.stringify({ ok: true, action: "amd_voicemail", answered_by: answeredBy }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Status-based routing ──
    switch (callStatus) {
      case "answered": {
        // Human answered — transition via state machine
        if (queueItem.status === "dialing") {
          await supabase.functions.invoke("dialer-state-transition", {
            body: { queue_item_id: queueItem.id, new_status: "answered" },
          });

          // Set answered_at
          await supabase.from("outbound_call_queue").update({
            answered_at: new Date().toISOString(),
          }).eq("id", queueItem.id);

          // ── Claim agent atomically ──
          const { data: agentRows } = await supabase.rpc("claim_available_agent", {
            p_business_id: queueItem.business_id,
          });

          if (agentRows && agentRows.length > 0) {
            const agent = agentRows[0];

            // Create session BEFORE bridging (session integrity)
            const { data: session } = await supabase
              .from("live_call_sessions")
              .insert({
                business_id: queueItem.business_id,
                store_id: queueItem.store_id,
                queue_item_id: queueItem.id,
                contact_name: queueItem.contact_name,
                phone_number: queueItem.phone_number,
                rep_user_id: agent.user_id,
                provider: "twilio",
                twilio_call_sid: callSid,
                connected_at: new Date().toISOString(),
                outcome: null,
                campaign_id: queueItem.campaign_id,
              })
              .select("id")
              .single();

            if (session) {
              // Transition answered → bridged
              await supabase.functions.invoke("dialer-state-transition", {
                body: {
                  queue_item_id: queueItem.id,
                  new_status: "bridged",
                  agent_id: agent.user_id,
                },
              });

              // TODO: When Twilio Client SDK is wired for reps, 
              // update the call TwiML to <Dial> to the agent's client.
              // For now, the call stays connected and the rep uses the LiveCallPanel.
            }
          }
          // If no agent available, call stays in answered state — watchdog will handle
        }
        break;
      }

      case "completed": {
        // Call ended — update session duration if exists
        const { data: session } = await supabase
          .from("live_call_sessions")
          .select("id, ended_at, rep_user_id, campaign_id, store_id")
          .eq("twilio_call_sid", callSid)
          .is("ended_at", null)
          .maybeSingle();

        if (session) {
          await supabase.from("live_call_sessions").update({
            duration_seconds: callDuration,
            ended_at: new Date().toISOString(),
          }).eq("id", session.id);
        }

        // ── Cost tracking ──
        const billableMinutes = Math.ceil(callDuration / 60);
        const ratePerMinute = 0.0085; // Twilio US local baseline
        const estimatedCost = billableMinutes * ratePerMinute;

        await supabase.from("call_cost_events").insert({
          business_id: queueItem.business_id,
          call_sid: callSid,
          queue_item_id: queueItem.id,
          campaign_id: queueItem.campaign_id,
          rep_user_id: session?.rep_user_id || null,
          store_id: queueItem.store_id,
          duration_seconds: callDuration,
          billable_minutes: billableMinutes,
          estimated_cost: estimatedCost,
          rate_per_minute: ratePerMinute,
        });

        // ── Update store answer profile ──
        if (queueItem.store_id) {
          const nowDate = new Date();
          const hour = nowDate.getHours();
          const day = nowDate.getDay();

          const { data: profile } = await supabase
            .from("store_answer_profile")
            .select("*")
            .eq("store_id", queueItem.store_id)
            .maybeSingle();

          if (profile) {
            const hourDist = (profile.hour_distribution || {}) as Record<string, number>;
            const dayDist = (profile.day_distribution || {}) as Record<string, number>;
            hourDist[hour.toString()] = (hourDist[hour.toString()] || 0) + 1;
            dayDist[day.toString()] = (dayDist[day.toString()] || 0) + 1;

            const newAnswers = (profile.total_answers || 0) + (callDuration > 0 ? 1 : 0);
            const newAttempts = (profile.total_attempts || 0) + 1;

            await supabase.from("store_answer_profile").update({
              total_attempts: newAttempts,
              total_answers: newAnswers,
              answer_rate: newAttempts > 0 ? newAnswers / newAttempts : 0,
              hour_distribution: hourDist,
              day_distribution: dayDist,
              last_attempt_at: nowDate.toISOString(),
              ...(callDuration > 0 ? { last_answer_at: nowDate.toISOString() } : {}),
              updated_at: nowDate.toISOString(),
            }).eq("store_id", queueItem.store_id);
          } else {
            const hourDist: Record<string, number> = {};
            const dayDist: Record<string, number> = {};
            hourDist[hour.toString()] = 1;
            dayDist[day.toString()] = 1;

            await supabase.from("store_answer_profile").insert({
              store_id: queueItem.store_id,
              business_id: queueItem.business_id,
              total_attempts: 1,
              total_answers: callDuration > 0 ? 1 : 0,
              answer_rate: callDuration > 0 ? 1 : 0,
              hour_distribution: hourDist,
              day_distribution: dayDist,
              last_attempt_at: nowDate.toISOString(),
              ...(callDuration > 0 ? { last_answer_at: nowDate.toISOString() } : {}),
            });
          }
        }

        break;
      }

      case "busy":
      case "no-answer": {
        if (queueItem.status === "dialing") {
          const mappedStatus = callStatus === "busy" ? "no_answer" : "no_answer";
          await supabase.functions.invoke("dialer-state-transition", {
            body: { queue_item_id: queueItem.id, new_status: mappedStatus },
          });

          // Clear claim + apply retry backoff
          const { data: settings } = await supabase
            .from("dialer_settings")
            .select("retry_backoff_minutes")
            .eq("business_id", queueItem.business_id)
            .maybeSingle();

          const backoff: number[] = settings?.retry_backoff_minutes || [15, 60, 240];
          const { data: freshItem } = await supabase
            .from("outbound_call_queue")
            .select("attempt_count")
            .eq("id", queueItem.id)
            .single();

          const attempt = freshItem?.attempt_count || 1;
          const retryMin = backoff[Math.min(attempt - 1, backoff.length - 1)] || 30;

          await supabase.from("outbound_call_queue").update({
            claimed_by_user_id: null, claimed_at: null,
            claim_expires_at: null, claim_token: null,
            next_retry_at: new Date(Date.now() + retryMin * 60 * 1000).toISOString(),
          }).eq("id", queueItem.id);
        }
        break;
      }

      case "failed":
      case "canceled": {
        if (queueItem.status === "dialing") {
          await supabase.functions.invoke("dialer-state-transition", {
            body: { queue_item_id: queueItem.id, new_status: "failed" },
          });

          await supabase.from("outbound_call_queue").update({
            claimed_by_user_id: null, claimed_at: null,
            claim_expires_at: null, claim_token: null,
          }).eq("id", queueItem.id);
        }
        break;
      }

      default:
        // initiated, ringing — just logged, no state change needed
        break;
    }

    return new Response(
      JSON.stringify({ ok: true, call_sid: callSid, status: callStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function hangupCall(callSid: string) {
  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`,
      {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "Status=completed",
      }
    );
  } catch (e) {
    console.error("Failed to hangup call:", e);
  }
}
