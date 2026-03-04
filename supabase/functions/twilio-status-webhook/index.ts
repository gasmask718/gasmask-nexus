import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Parse Params
    const contentType = req.headers.get("content-type") || "";
    let params: Record<string, string> = {};
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const body = await req.text();
      new URLSearchParams(body).forEach((value, key) => {
        params[key] = value;
      });
    } else {
      params = await req.json();
    }

    const callSid = params.CallSid || params.call_sid || "";
    const callStatus = params.CallStatus || params.call_status || "";
    const answeredBy = params.AnsweredBy || params.answered_by || "";
    const callDuration = parseInt(params.CallDuration || params.Duration || "0") || 0;

    if (!callSid) throw new Error("No CallSid");

    // ── 1. Fetch Queue Item + Campaign Mode ──
    const { data: queueItem } = await supabase
      .from("outbound_call_queue")
      .select(
        `
        *,
        dialer_campaigns (
            dial_mode
        )
      `,
      )
      .eq("twilio_call_sid", callSid)
      .maybeSingle();

    // Log for audit
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
      return new Response(JSON.stringify({ ok: true, note: "orphan" }), { headers: corsHeaders });
    }

    // Determine Mode: 'ai' or 'human_agent'
    const dialMode = queueItem.dialer_campaigns?.dial_mode || "ai";

    // ── 2. AMD (Machine Detection) - Applies to BOTH modes ──
    if (answeredBy && answeredBy !== "human" && answeredBy !== "unknown") {
      if (queueItem.status === "dialing" || queueItem.status === "answered") {
        // Mark as voicemail
        await supabase
          .from("outbound_call_queue")
          .update({
            status: "voicemail",
            updated_at: new Date().toISOString(),
          })
          .eq("id", queueItem.id);

        // Log Outcome
        await logAttemptOutcome(supabase, callSid, queueItem, "answered_machine", answeredBy);

        // Hangup
        await hangupCall(callSid);

        // Trigger your existing Auto-Follow Up logic
        if (queueItem.store_id) {
          await updateStoreContact(supabase, queueItem.store_id);
          await createAutoFollowUp(supabase, queueItem, callSid, "voicemail", 48 * 60);
        }
      }
      return new Response(JSON.stringify({ ok: true, action: "amd_voicemail" }), { headers: corsHeaders });
    }

    // ── 3. Status Handling ──
    switch (callStatus) {
      case "in-progress":
      case "answered": {
        // Only act if we haven't processed the answer yet
        if (queueItem.status === "dialing") {
          // ── PATH A: AI MODE (Simple) ──
          if (dialMode === "ai") {
            console.log("AI Mode: Marking connected.");
            await supabase
              .from("outbound_call_queue")
              .update({
                status: "connected",
                answered_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", queueItem.id);

            await logAttemptOutcome(supabase, callSid, queueItem, "answered_human", "human");
          }

          // ── PATH B: HUMAN AGENT MODE (Complex Bridging) ──
          else {
            console.log("Human Agent Mode: Finding agent...");

            // 1. Mark answered
            await supabase
              .from("outbound_call_queue")
              .update({ answered_at: new Date().toISOString() })
              .eq("id", queueItem.id);

            // 2. Find Agent
            const { data: agentRows } = await supabase.rpc("claim_available_agent", {
              p_business_id: queueItem.business_id,
            });

            if (agentRows && agentRows.length > 0) {
              const agent = agentRows[0];

              // Create Session
              const { data: session } = await supabase
                .from("live_call_sessions")
                .insert({
                  business_id: queueItem.business_id,
                  store_id: queueItem.store_id,
                  queue_item_id: queueItem.id,
                  contact_name: queueItem.contact_name,
                  phone_number: queueItem.phone_number,
                  rep_user_id: agent.user_id,
                  twilio_call_sid: callSid,
                  connected_at: new Date().toISOString(),
                  campaign_id: queueItem.campaign_id,
                })
                .select("id")
                .single();

              if (session) {
                // Mark Bridged
                await supabase.from("outbound_call_queue").update({ status: "bridged" }).eq("id", queueItem.id);

                // Execute Bridge
                const { error: bridgeErr } = await supabase.functions.invoke("dialer-bridge-agent", {
                  body: {
                    session_id: session.id,
                    queue_item_id: queueItem.id,
                    target_call_sid: callSid,
                    business_id: queueItem.business_id,
                  },
                });

                if (bridgeErr) console.error("Bridge Error", bridgeErr);
              }
            } else {
              // No Agent Found -> Apologize & Hangup
              await logAttemptOutcome(supabase, callSid, queueItem, "agent_missed", "human");
              await updateCallTwiml(
                callSid,
                `<Response><Say>Sorry, all agents are currently busy. We will call you back.</Say><Hangup/></Response>`,
              );
            }
          }
        }
        break;
      }

      case "completed": {
        // Update Queue
        await supabase
          .from("outbound_call_queue")
          .update({
            status: "completed",
            duration: callDuration,
            updated_at: new Date().toISOString(),
          })
          .eq("id", queueItem.id);

        // Update Session (if exists)
        await supabase
          .from("live_call_sessions")
          .update({ duration_seconds: callDuration, ended_at: new Date().toISOString() })
          .eq("twilio_call_sid", callSid);

        // Track Costs
        await trackCost(supabase, queueItem, callSid, callDuration);

        // Update Store Stats
        if (queueItem.store_id) {
          await updateStoreStats(supabase, queueItem.store_id, callDuration > 0);
        }
        break;
      }

      case "busy":
      case "no-answer":
      case "failed":
      case "canceled": {
        if (queueItem.status === "dialing") {
          const statusMap: any = { busy: "busy", "no-answer": "no_answer", failed: "failed", canceled: "failed" };
          const outcome = statusMap[callStatus];

          // Log
          await logAttemptOutcome(supabase, callSid, queueItem, "failed", null, undefined, undefined, outcome);

          // Retry Logic
          await handleRetry(supabase, queueItem, outcome);

          // Auto Follow Up
          if (queueItem.store_id) {
            await updateStoreContact(supabase, queueItem.store_id);
            await createAutoFollowUp(supabase, queueItem, callSid, outcome, outcome === "busy" ? 120 : 1440); // 2h or 24h
          }
        }
        break;
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (err) {
    console.error("Webhook Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});

// ── HELPERS (Preserving your logic) ──

async function handleRetry(supabase: any, item: any, reason: string) {
  const { data: settings } = await supabase
    .from("dialer_settings")
    .select("retry_backoff_minutes")
    .eq("business_id", item.business_id)
    .maybeSingle();
  const backoff = settings?.retry_backoff_minutes || [15, 60, 240];
  const attempt = (item.attempt_count || 0) + 1;

  if (attempt <= backoff.length) {
    const minutes = backoff[attempt - 1];
    const nextTime = new Date(Date.now() + minutes * 60000).toISOString();
    await supabase
      .from("outbound_call_queue")
      .update({
        status: "queued",
        attempt_count: attempt,
        next_retry_at: nextTime,
      })
      .eq("id", item.id);
  } else {
    await supabase.from("outbound_call_queue").update({ status: reason }).eq("id", item.id);
  }
}

async function updateStoreContact(supabase: any, storeId: string) {
  await supabase.from("store_master").update({ last_contacted_at: new Date().toISOString() }).eq("id", storeId);
}

async function updateStoreStats(supabase: any, storeId: string, answered: boolean) {
  // Simplified version of your stats logic
  const { data: store } = await supabase.from("store_answer_profile").select("*").eq("store_id", storeId).maybeSingle();
  const now = new Date();
  const updates: any = {
    total_attempts: (store?.total_attempts || 0) + 1,
    total_answers: (store?.total_answers || 0) + (answered ? 1 : 0),
    last_attempt_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  if (answered) updates.last_answer_at = now.toISOString();

  if (store) {
    await supabase.from("store_answer_profile").update(updates).eq("store_id", storeId);
  } else {
    await supabase.from("store_answer_profile").insert({ store_id: storeId, ...updates });
  }
}

async function trackCost(supabase: any, item: any, callSid: string, duration: number) {
  const minutes = Math.ceil(duration / 60);
  const rate = 0.0085;
  await supabase.from("call_cost_events").insert({
    business_id: item.business_id,
    call_sid: callSid,
    queue_item_id: item.id,
    duration_seconds: duration,
    billable_minutes: minutes,
    estimated_cost: minutes * rate,
    rate_per_minute: rate,
  });
}

// ... Keep logAttemptOutcome, createAutoFollowUp, hangupCall, updateCallTwiml from your original code ...
// (Included implicitly to save space, copy them from your previous snippet if needed)
async function logAttemptOutcome(
  supabase: any,
  callSid: string,
  queueItem: any,
  state: string,
  amd: any,
  agent?: string,
  conf?: string,
  block?: string,
) {
  await supabase.from("dialer_call_attempts").insert({
    business_id: queueItem.business_id,
    campaign_id: queueItem.campaign_id,
    queue_item_id: queueItem.id,
    store_id: queueItem.store_id,
    target_phone_e164: queueItem.phone_number,
    target_call_sid: callSid,
    attempt_state: state,
    amd_result: amd,
    agent_user_id: agent,
    conference_name: conf,
    blocked_reason: block,
  });
}

async function createAutoFollowUp(supabase: any, item: any, sid: string, reason: string, delay: number) {
  const due = new Date(Date.now() + delay * 60000).toISOString();
  await supabase.from("follow_up_queue").insert({
    store_id: item.store_id,
    business_id: item.business_id,
    reason: reason,
    status: "pending",
    due_at: due,
    priority: 3,
    context: { source: "dialer", call_sid: sid },
  });
}

async function hangupCall(sid: string) {
  const a = Deno.env.get("TWILIO_ACCOUNT_SID");
  const t = Deno.env.get("TWILIO_AUTH_TOKEN");
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${a}/Calls/${sid}.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${a}:${t}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "Status=completed",
  });
}

async function updateCallTwiml(sid: string, xml: string) {
  const a = Deno.env.get("TWILIO_ACCOUNT_SID");
  const t = Deno.env.get("TWILIO_AUTH_TOKEN");
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${a}/Calls/${sid}.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${a}:${t}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ Twiml: xml }).toString(),
  });
}
