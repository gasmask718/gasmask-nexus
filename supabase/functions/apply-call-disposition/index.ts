import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // SEC-018: this endpoint is NOT a Twilio callback — it is invoked from the
    // dialer console in the browser (DialerConsolePage / LiveCallPanel). A
    // Twilio signature is therefore the wrong control; it requires a signed-in
    // user. Without this, anyone could write call outcomes for any session.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await authed.auth.getClaims(
      authHeader.replace(/^Bearer\s+/i, ""),
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      session_id,
      disposition_code_id,
      notes,
      revenue_amount,
      decision_maker_name,
      competitor_mentioned,
      best_call_time,
      custom_followup_at,
    } = await req.json();

    if (!session_id || !disposition_code_id) {
      return new Response(JSON.stringify({ error: "session_id and disposition_code_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch session
    const { data: session, error: sessErr } = await supabase
      .from("live_call_sessions")
      .select("*")
      .eq("id", session_id)
      .single();
    if (sessErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ownership: the rep who took the call owns its outcome. Admins/owners may
    // dispose any session; nobody else can write an outcome onto someone else's call.
    if (session.rep_user_id && session.rep_user_id !== callerId) {
      const { data: isStaff } = await supabase.rpc("has_role", {
        _user_id: callerId,
        _role: "admin",
      });
      const { data: isOwner } = await supabase.rpc("has_role", {
        _user_id: callerId,
        _role: "owner",
      });
      if (!isStaff && !isOwner) {
        return new Response(
          JSON.stringify({ error: "forbidden: this call session belongs to another rep" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }


    // Prevent double-disposition
    if (session.disposition_code_id) {
      return new Response(JSON.stringify({ error: "Session already disposed" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch disposition config
    const { data: dispConfig, error: dispErr } = await supabase
      .from("dialer_disposition_codes")
      .select("*")
      .eq("id", disposition_code_id)
      .single();
    if (dispErr || !dispConfig) {
      return new Response(JSON.stringify({ error: "Disposition code not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const connectedAt = new Date(session.connected_at).getTime();
    const durationSeconds = Math.floor((Date.now() - connectedAt) / 1000);

    // Compute follow-up time
    let nextFollowupAt: string | null = null;
    if (custom_followup_at) {
      nextFollowupAt = custom_followup_at;
    } else if (dispConfig.requires_followup && dispConfig.followup_delay_minutes) {
      nextFollowupAt = new Date(Date.now() + dispConfig.followup_delay_minutes * 60000).toISOString();
    }

    // 3. Update session
    const { error: updateErr } = await supabase
      .from("live_call_sessions")
      .update({
        disposition_code_id,
        disposition_notes: notes || null,
        next_followup_at: nextFollowupAt,
        revenue_amount: revenue_amount || null,
        revenue_currency: "USD",
        decision_maker_name: decision_maker_name || null,
        competitor_mentioned: competitor_mentioned || null,
        best_call_time: best_call_time || null,
        store_stage_after: dispConfig.updates_store_stage || null,
        outcome: dispConfig.code.toLowerCase(),
        ended_at: now,
        duration_seconds: durationSeconds,
        notes: notes || session.notes,
      })
      .eq("id", session_id);
    if (updateErr) throw updateErr;

    // 4. Complete queue item via state machine
    if (session.queue_item_id) {
      await supabase.functions.invoke("dialer-state-transition", {
        body: { queue_item_id: session.queue_item_id, new_status: "completed" },
      });
    }

    // 5. Agent wrap-up
    if (session.rep_user_id) {
      const { data: agentData } = await supabase
        .from("dialer_agent_availability")
        .select("active_calls_count")
        .eq("user_id", session.rep_user_id)
        .eq("business_id", session.business_id)
        .maybeSingle();

      await supabase
        .from("dialer_agent_availability")
        .update({
          status: "wrap_up",
          active_calls_count: Math.max((agentData?.active_calls_count || 1) - 1, 0),
          last_call_ended_at: now,
          updated_at: now,
        })
        .eq("user_id", session.rep_user_id)
        .eq("business_id", session.business_id);
    }

    // 6. Create follow-up if needed
    let followupId: string | null = null;
    if (nextFollowupAt && session.store_id) {
      const { data: followup } = await supabase
        .from("dialer_followups")
        .insert({
          business_id: session.business_id,
          store_id: session.store_id,
          session_id: session_id,
          rep_user_id: session.rep_user_id,
          scheduled_for: nextFollowupAt,
          reason: dispConfig.code,
          status: "pending",
        })
        .select("id")
        .single();
      followupId = followup?.id || null;

      // Update campaign followup count
      if (session.campaign_id) {
        const { error: rpcErr } = await supabase.rpc("increment_campaign_stat", {
          p_campaign_id: session.campaign_id,
          p_column: "total_followups",
        });
        if (rpcErr) {
          // RPC may not exist yet, update directly
          await supabase
            .from("dialer_campaigns")
            .update({ total_followups: (supabase as any).sql`total_followups + 1` })
            .eq("id", session.campaign_id);
        }
      }
    }

    // 7. Store intelligence update
    if (session.store_id) {
      const scoreAdjust =
        dispConfig.code === "INTERESTED" ? 5 :
        dispConfig.code === "ORDER_PLACED" ? 10 :
        dispConfig.code === "NOT_INTERESTED" ? -5 :
        dispConfig.code === "DO_NOT_CALL" ? -20 : 0;

      // Upsert store intelligence
      const { data: existing } = await supabase
        .from("store_call_intelligence")
        .select("*")
        .eq("store_id", session.store_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("store_call_intelligence")
          .update({
            total_calls: (existing.total_calls || 0) + 1,
            total_connects: (existing.total_connects || 0) + 1,
            interest_score: (existing.interest_score || 0) + scoreAdjust,
            lifetime_revenue: (existing.lifetime_revenue || 0) + (revenue_amount || 0),
            last_contacted_at: now,
            last_decision_maker_name: decision_maker_name || existing.last_decision_maker_name,
            last_best_call_time: best_call_time || existing.last_best_call_time,
            last_competitor_mentioned: competitor_mentioned || existing.last_competitor_mentioned,
            updated_at: now,
          })
          .eq("store_id", session.store_id);
      } else {
        await supabase
          .from("store_call_intelligence")
          .insert({
            store_id: session.store_id,
            total_calls: 1,
            total_connects: 1,
            interest_score: scoreAdjust,
            lifetime_revenue: revenue_amount || 0,
            last_contacted_at: now,
            last_decision_maker_name: decision_maker_name || null,
            last_best_call_time: best_call_time || null,
            last_competitor_mentioned: competitor_mentioned || null,
          });
      }
    }

    // 8. Revenue attribution
    if (revenue_amount && revenue_amount > 0) {
      await supabase.from("call_revenue_events").insert({
        business_id: session.business_id,
        session_id: session_id,
        campaign_id: session.campaign_id || null,
        rep_user_id: session.rep_user_id,
        store_id: session.store_id,
        amount: revenue_amount,
        currency: "USD",
      });

      // Update campaign revenue
      if (session.campaign_id) {
        const { data: camp } = await supabase
          .from("dialer_campaigns")
          .select("total_revenue")
          .eq("id", session.campaign_id)
          .single();
        if (camp) {
          await supabase
            .from("dialer_campaigns")
            .update({ total_revenue: (camp.total_revenue || 0) + revenue_amount })
            .eq("id", session.campaign_id);
        }
      }
    }

    // 9. Campaign outcome tracking
    if (session.campaign_id) {
      const col = dispConfig.category === "positive" ? "total_positive_outcomes" : 
                  dispConfig.category === "negative" ? "total_negative_outcomes" : null;
      if (col) {
        const { data: camp } = await supabase
          .from("dialer_campaigns")
          .select(col)
          .eq("id", session.campaign_id)
          .single();
        if (camp) {
          await supabase
            .from("dialer_campaigns")
            .update({ [col]: ((camp as any)[col] || 0) + 1 })
            .eq("id", session.campaign_id);
        }
      }
    }

    // 10. DO_NOT_CALL compliance
    if (dispConfig.marks_do_not_call && session.store_id) {
      await supabase
        .from("store_master")
        .update({ do_not_call: true })
        .eq("id", session.store_id);
    }

    // 11. Task 19b — Route-board bridge for visit-implying dispositions
    if (session.store_id && dispConfig?.code) {
      const code = String(dispConfig.code).toUpperCase();
      const visitCodes = ["NEEDS_VISIT", "VISIT_REQUESTED", "COLLECT", "COLLECT_PAYMENT", "SEND_REP", "IN_PERSON_FOLLOWUP", "DELIVERY_REQUESTED", "INTERESTED", "ORDER_PLACED"];
      if (visitCodes.includes(code)) {
        const { error: promoteErr } = await supabase.rpc("promote_store_to_route_board", {
          _store_id: session.store_id,
          _signal_source: "manual_disposition",
          _reason: notes ? `Disposition ${code}: ${String(notes).slice(0, 200)}` : `Disposition ${code} — needs in-person visit`,
          _source_ref: session_id,
          _business: null,
          _priority: code === "ORDER_PLACED" || code === "DELIVERY_REQUESTED" ? 5 : 4,
          _estimated_revenue: revenue_amount || null,
          _urgency: "this_week",
          _intent_summary: notes || `Manual disposition: ${code}`,
        });
        if (promoteErr) {
          console.warn("[apply-call-disposition] promote_store_to_route_board failed:", promoteErr.message);
        } else {
          console.log(`[apply-call-disposition] promoted store ${session.store_id} → route board (manual_disposition: ${code})`);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      disposition: dispConfig.code,
      followup_id: followupId,
      do_not_call_flagged: dispConfig.marks_do_not_call,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    console.error("apply-call-disposition error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
