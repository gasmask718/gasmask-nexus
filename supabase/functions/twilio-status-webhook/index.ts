import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * TWILIO STATUS WEBHOOK V2
 * 
 * Handles all Twilio status callbacks and AMD results.
 * Routes through dialer-state-transition — NEVER writes status directly.
 * Now bridges agent via dialer-bridge-agent when human detected.
 * 
 * Events: initiated, ringing, answered, completed, busy, no-answer, failed, canceled
 * AMD: machine_start, machine_end_beep, machine_end_silence, machine_end_other, human, fax, unknown
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    if (answeredBy && answeredBy !== "human") {
      if (queueItem.status === "dialing" || queueItem.status === "answered") {
        await supabase.functions.invoke("dialer-state-transition", {
          body: { queue_item_id: queueItem.id, new_status: "voicemail" },
        });

        // Log attempt
        await logAttemptOutcome(supabase, callSid, queueItem, "answered_machine", answeredBy as any);

        // Clear claim fields
        await supabase.from("outbound_call_queue").update({
          claimed_by_user_id: null, claimed_at: null,
          claim_expires_at: null, claim_token: null,
        }).eq("id", queueItem.id);

        // Hang up the call via Twilio API
        await hangupCall(callSid);

        // Update store contact memory for voicemail
        if (queueItem.store_id) {
          await supabase
            .from("store_master")
            .update({ last_contacted_at: new Date().toISOString() })
            .eq("id", queueItem.store_id);

          // Auto follow-up for voicemail (48h)
          await createAutoFollowUp(supabase, queueItem, callSid, "voicemail", 48 * 60);
        }
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

              // ── BRIDGE: Invoke dialer-bridge-agent to create conference + dial agent ──
              const { data: bridgeResult, error: bridgeErr } = await supabase.functions.invoke("dialer-bridge-agent", {
                body: {
                  session_id: session.id,
                  queue_item_id: queueItem.id,
                  target_call_sid: callSid,
                  business_id: queueItem.business_id,
                },
              });

              if (bridgeErr) {
                console.error("❌ Bridge agent failed:", bridgeErr);
                // Log attempt as agent_missed
                await logAttemptOutcome(supabase, callSid, queueItem, "agent_missed", "human", agent.user_id);
              } else {
                console.log("✅ Bridge initiated:", bridgeResult);
                // Log attempt as bridged
                await logAttemptOutcome(supabase, callSid, queueItem, "bridged", "human", agent.user_id, bridgeResult?.conference_name);
              }
            }
          } else {
            // No agent available — log as answered_human with no agent
            await logAttemptOutcome(supabase, callSid, queueItem, "agent_missed", "human");
            // Apologize and end
            await updateCallTwiml(callSid, `<Response><Say>We're sorry, no agent is available right now. We'll call you back shortly.</Say><Hangup/></Response>`);
          }
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

        // Update attempt as completed
        await supabase.from("dialer_call_attempts").update({
          attempt_state: "completed",
          ended_at: new Date().toISOString(),
          duration_seconds: callDuration,
        }).eq("target_call_sid", callSid);

        // ── Cost tracking ──
        const billableMinutes = Math.ceil(callDuration / 60);
        const ratePerMinute = 0.0085;
        const estimatedCost = billableMinutes * ratePerMinute;

        await supabase.from("call_cost_events").insert({
          business_id: queueItem.business_id,
          call_sid: callSid,
          queue_item_id: queueItem.id,
          session_id: session?.id || null,
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
          await supabase.functions.invoke("dialer-state-transition", {
            body: { queue_item_id: queueItem.id, new_status: "no_answer" },
          });

          // Log attempt
          await logAttemptOutcome(supabase, callSid, queueItem, "failed", null, undefined, undefined, callStatus === "busy" ? "busy" : "no_answer");

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

          // Log attempt
          await logAttemptOutcome(supabase, callSid, queueItem, "failed", null, undefined, undefined, callStatus);

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

    // ── PART 1: Update store contact memory ──
    const terminalForContact = ["completed", "busy", "no-answer", "failed", "canceled"];
    if (queueItem?.store_id && terminalForContact.includes(callStatus)) {
      const { error: storeErr } = await supabase
        .from("store_master")
        .update({ last_contacted_at: new Date().toISOString() })
        .eq("id", queueItem.store_id);
      if (storeErr) console.error("store_master update error:", storeErr);
    }

    // ── PART 2: Auto follow-up for retriable outcomes ──
    const followUpDelays: Record<string, number> = {
      busy: 2 * 60,        // 2 hours in minutes
      "no-answer": 24 * 60, // 24 hours
      voicemail: 48 * 60,   // 48 hours (handled in AMD section too)
    };
    const outcomeForFollowUp = callStatus === "no-answer" ? "no-answer" : callStatus;
    const delayMinutes = followUpDelays[outcomeForFollowUp];

    if (queueItem?.store_id && delayMinutes) {
      await createAutoFollowUp(supabase, queueItem, callSid, outcomeForFollowUp, delayMinutes);
    }

    const storeUpdated = !!(queueItem?.store_id && terminalForContact.includes(callStatus));
    const followUpCreated = !!(queueItem?.store_id && delayMinutes);
    console.log(JSON.stringify({
      event: "CALL_OUTCOME_PROCESSED",
      call_sid: callSid,
      outcome: callStatus,
      follow_up_created: followUpCreated,
      store_updated: storeUpdated,
    }));

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

// ── Helper: Create auto follow-up with dedup ──
async function createAutoFollowUp(
  supabase: any,
  queueItem: any,
  callSid: string,
  reason: string,
  delayMinutes: number,
) {
  try {
    const followUpAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
    const windowStart = new Date().toISOString();
    const windowEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Dedup: skip if a pending follow-up already exists for this store within 24h
    const { data: existing } = await supabase
      .from("follow_up_queue")
      .select("id")
      .eq("store_id", queueItem.store_id)
      .eq("status", "pending")
      .gte("due_at", windowStart)
      .lte("due_at", windowEnd)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(`⏭ Skipped duplicate follow-up for store ${queueItem.store_id}`);
      return;
    }

    const priorityMap: Record<string, number> = { busy: 2, "no-answer": 3, voicemail: 4 };

    const { error } = await supabase.from("follow_up_queue").insert({
      store_id: queueItem.store_id,
      business_id: queueItem.business_id,
      reason: reason.replace("-", "_"),
      status: "pending",
      due_at: followUpAt,
      priority: priorityMap[reason] || 3,
      recommended_action: "ai_call",
      context: {
        source: "call_outcome_engine",
        call_sid: callSid,
        original_outcome: reason,
        queue_item_id: queueItem.id,
      },
    });

    if (error) {
      console.error("follow_up_queue insert error:", error);
    } else {
      console.log(`✅ Auto follow-up created for store ${queueItem.store_id} (${reason}) at ${followUpAt}`);
    }
  } catch (e) {
    console.error("createAutoFollowUp error:", e);
  }
}

// ── Helper: Log attempt outcome ──
async function logAttemptOutcome(
  supabase: any,
  callSid: string,
  queueItem: any,
  state: string,
  amdResult: string | null,
  agentUserId?: string,
  conferenceName?: string,
  blockedReason?: string,
) {
  // Try to update existing attempt first (idempotent)
  const { data: existing } = await supabase
    .from("dialer_call_attempts")
    .select("id")
    .eq("target_call_sid", callSid)
    .maybeSingle();

  if (existing) {
    await supabase.from("dialer_call_attempts").update({
      attempt_state: state,
      amd_result: amdResult,
      ...(agentUserId ? { agent_user_id: agentUserId } : {}),
      ...(conferenceName ? { conference_name: conferenceName } : {}),
      ...(state === "failed" || state === "agent_missed" ? { ended_at: new Date().toISOString() } : {}),
      ...(blockedReason ? { blocked_reason: blockedReason } : {}),
    }).eq("id", existing.id);
  } else {
    await supabase.from("dialer_call_attempts").insert({
      business_id: queueItem.business_id,
      campaign_id: queueItem.campaign_id,
      queue_item_id: queueItem.id,
      store_id: queueItem.store_id,
      target_phone_e164: queueItem.phone_number,
      agent_user_id: agentUserId || null,
      attempt_state: state,
      amd_result: amdResult,
      target_call_sid: callSid,
      conference_name: conferenceName || null,
      ...(state === "answered_human" ? { target_answered_at: new Date().toISOString() } : {}),
      ...(state === "failed" || state === "agent_missed" ? { ended_at: new Date().toISOString() } : {}),
      ...(blockedReason ? { blocked_reason: blockedReason } : {}),
    });
  }
}

async function hangupCall(callSid: string) {
  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`,
      {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
        body: "Status=completed",
      }
    );
  } catch (e) {
    console.error("Failed to hangup call:", e);
  }
}

async function updateCallTwiml(callSid: string, twiml: string) {
  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`,
      {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ Twiml: twiml }).toString(),
      }
    );
  } catch (e) {
    console.error("Failed to update call TwiML:", e);
  }
}
