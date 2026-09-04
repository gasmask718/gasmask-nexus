import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSuppressed } from "../_shared/dnc.ts";
import { recordAttrFor } from "../_shared/recordingConsent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // --- TwiML callback from Twilio (POST with form data) ---
    const actionParam = url.searchParams.get("action");
    if (actionParam === "twiml") {
      const leadPhoneParam = url.searchParams.get("leadPhone") || "";
      const callLogId = url.searchParams.get("callLogId") || "";
      const callerIdParam = url.searchParams.get("callerId") || "";

      // Same enforcement rule as brandaro-call-twiml: this branch emits <Dial>,
      // so it is a dialing gate and must check suppression itself. Fails closed.
      const twimlSuppression = await isSuppressed(supabaseAdmin, leadPhoneParam);
      if (twimlSuppression.blocked) {
        console.warn(`[va-power-dialer] BLOCKED twiml dial to ${leadPhoneParam} — ${twimlSuppression.reason}`);
        if (callLogId) {
          try {
            await supabaseAdmin
              .from("va_call_logs")
              .update({ call_status: "dnc_skipped", disposition: "dnc" })
              .eq("id", callLogId);
          } catch (_) { /* logging must not unblock the gate */ }
        }
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Say>This number is on the do not call list. The call cannot be placed.</Say><Hangup/></Response>`,
          { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } },
        );
      }

      // Recording consent gate: fail closed (no record attribute) unless the
      // callee's jurisdiction is known and one-party.
      const { attr: recAttr, decision: recDecision } = await recordAttrFor(supabaseAdmin, leadPhoneParam, {
        mode: "record-from-answer-dual",
      });
      const recCbAttrs = recAttr
        ? ` recordingStatusCallback="${SUPABASE_URL}/functions/v1/brandaro-call-status?callLogId=${callLogId}&event=recording" recordingStatusCallbackMethod="POST"`
        : "";
      console.log(
        `[va-power-dialer] recording=${recAttr ? "on" : "off"} (${recDecision.reason}${recDecision.state ? `/${recDecision.state}` : ""})`,
      );

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerIdParam}"${recAttr}${recCbAttrs} timeout="20"
    action="${SUPABASE_URL}/functions/v1/brandaro-call-status?callLogId=${callLogId}&event=dial-complete"
    method="POST">
    <Number statusCallback="${SUPABASE_URL}/functions/v1/brandaro-call-status?callLogId=${callLogId}&event=number-status"
      statusCallbackEvent="initiated ringing answered completed"
      statusCallbackMethod="POST">${leadPhoneParam}</Number>
  </Dial>
</Response>`;


      return new Response(twiml, {
        status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    // --- JSON body actions (dial, disposition) ---
    const body = await req.json();
    const { vaId, twilioNumber, leadId, leadPhone, leadName, action, callLogId, disposition, excitementLevel, notes, callbackAt } = body;

    if (!vaId || !action) {
      return new Response(JSON.stringify({ error: "vaId and action required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ======================== DIAL ========================
    // Creates call log + DNC check. Actual call is placed by the browser SDK.
    if (action === "dial") {
      if (!leadPhone || !twilioNumber) {
        return new Response(JSON.stringify({ error: "leadPhone and twilioNumber required for dial" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Caller-ID company gate ─────────────────────────────────────
      // The presented caller ID must belong to a VA company the caller may
      // represent: one of their va_company_memberships, or ANY company for a
      // Dynasty Connect member (the switchboard). Identity comes from the JWT,
      // never the body's vaId.
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: authData } = await supabaseAdmin.auth.getUser(token);
      const callerUserId = authData?.user?.id ?? null;
      if (!callerUserId) {
        return new Response(JSON.stringify({ error: "Authentication required to dial." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: numRow } = await supabaseAdmin
        .from("dc_phone_numbers")
        .select("id, va_company_id")
        .eq("phone_number", twilioNumber)
        .maybeSingle();

      if (!numRow?.va_company_id) {
        return new Response(JSON.stringify({
          error: `${twilioNumber} is not assigned to any VA company — assign it in the phone library before calling.`,
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: memberships } = await supabaseAdmin
        .from("va_company_memberships")
        .select("company_id, va_companies:company_id ( slug, name )")
        .eq("user_id", callerUserId)
        .eq("is_active", true);

      const membershipList = (memberships ?? []) as any[];
      const isSwitchboard = membershipList.some((m) => m.va_companies?.slug === "dynasty_connect");
      const allowed = isSwitchboard || membershipList.some((m) => m.company_id === numRow.va_company_id);

      if (!allowed) {
        const { data: ownerCompany } = await supabaseAdmin
          .from("va_companies").select("name").eq("id", numRow.va_company_id).maybeSingle();
        return new Response(JSON.stringify({
          error: `Caller ID ${twilioNumber} belongs to ${ownerCompany?.name ?? "another company"} — switch companies in the portal header.`,
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ── MASTER SWITCH: nothing dials while the engine is disarmed. ──
      // Owner's rule (2026-08-24): no call goes out — power session OR
      // one-off manual — unless a human pressed START CALLING on the Power
      // Dialer console and the armed window has not expired. An expired
      // window is lazily disarmed here so the stored state stays honest.
      const { data: armedRows } = await supabaseAdmin
        .from("dialer_settings")
        .select("id, auto_disarm_at")
        .eq("engine_armed", true);
      const nowTs = new Date();
      const expiredRows = (armedRows ?? []).filter(
        (r: any) => r.auto_disarm_at && new Date(r.auto_disarm_at) <= nowTs,
      );
      for (const row of expiredRows) {
        await supabaseAdmin.from("dialer_settings").update({
          engine_armed: false, armed_campaign_id: null, updated_at: nowTs.toISOString(),
        }).eq("id", row.id);
      }
      const stillArmed = (armedRows ?? []).some(
        (r: any) => !r.auto_disarm_at || new Date(r.auto_disarm_at) > nowTs,
      );
      if (!stillArmed) {
        return new Response(JSON.stringify({
          error: "engine_not_armed",
          detail: "The calling engine is not armed. An owner/admin must press START CALLING on the Power Dialer console before any call goes out.",
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // SUPPRESSION — FAST UX SKIP ONLY. THIS IS NOT THE ENFORCEMENT POINT.
      //
      // This function does not place the call: the browser does, via the Twilio
      // Voice SDK, and Twilio then fetches TwiML from `brandaro-call-twiml`.
      // Everything we return here is a JSON response the client is *trusted* to
      // honour, and a client cannot be trusted — a modified page, a stale tab, or
      // a replayed TwiML App request reaches <Dial> without ever calling us.
      // The gate that actually blocks the dial lives in `brandaro-call-twiml`,
      // immediately before <Dial>. Keep this check: it saves the VA a wasted dial
      // and produces the dnc_skipped log row. Do not treat it as compliance.
      //
      // Previously this did .eq("phone_number", leadPhone) against dnc_list.
      // dnc_list stores E.164 and lead tables store "(347) 201-6324", so that
      // comparison could never match — a check that reported "DNC checked" in
      // review and was incapable of firing. isSuppressed() normalizes both ends
      // (last-10 key) and also covers SMS opt-outs.
      const suppression = await isSuppressed(supabaseAdmin, leadPhone);

      if (suppression.blocked) {
        await supabaseAdmin.from("va_call_logs").insert({
          lead_id: leadId || null,
          va_id: vaId,
          twilio_number: twilioNumber,
          call_status: "dnc_skipped",
          disposition: "dnc",
        });

        try {
          await supabaseAdmin.rpc("upsert_leaderboard_stat", {
            p_va_id: vaId, p_field: "calls_dialed", p_increment: 1,
          });
        } catch (_) { /* leaderboard optional */ }

        return new Response(JSON.stringify({
          skipped: true,
          reason: suppression.reason || "dnc",
          source: suppression.source || "dnc_list",
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create call log
      const { data: callLog } = await supabaseAdmin
        .from("va_call_logs")
        .insert({
          lead_id: leadId || null,
          va_id: vaId,
          twilio_number: twilioNumber,
          call_status: "initiated",
        })
        .select("id")
        .single();

      try {
        await supabaseAdmin.rpc("upsert_leaderboard_stat", {
          p_va_id: vaId, p_field: "calls_dialed", p_increment: 1,
        });
      } catch (_) { /* leaderboard optional */ }

      return new Response(JSON.stringify({
        success: true, callLogId: callLog?.id,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ======================== DISPOSITION ========================
    if (action === "disposition") {
      if (!callLogId) {
        return new Response(JSON.stringify({ error: "callLogId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateData: Record<string, unknown> = {};
      if (disposition) updateData.disposition = disposition;
      if (excitementLevel) updateData.excitement_level = excitementLevel;
      if (notes) updateData.va_notes = notes;
      if (callbackAt) updateData.callback_scheduled_at = callbackAt;

      // ZERO SILENT FAILURES: this update was previously fire-and-forget, so a
      // rejected disposition (check constraint) still returned success:true and
      // the VA's wrap-up — disposition, notes, callback time — was lost with a
      // green toast. Surface the raw error instead.
      const { data: updatedRows, error: updErr } = await supabaseAdmin
        .from("va_call_logs")
        .update(updateData)
        .eq("id", callLogId)
        .select("id");

      if (updErr) {
        console.error(`[va-power-dialer] disposition save failed for ${callLogId}:`, updErr);
        return new Response(JSON.stringify({ error: `Wrap-up not saved: ${updErr.message}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!updatedRows || updatedRows.length === 0) {
        return new Response(JSON.stringify({ error: `Wrap-up not saved: call log ${callLogId} not found` }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (disposition === "closed") {
        try {
          await supabaseAdmin.rpc("upsert_leaderboard_stat", {
            p_va_id: vaId, p_field: "calls_closed", p_increment: 1,
          });
        } catch (_) { /* optional */ }
      }

      if (excitementLevel && leadId) {
        await supabaseAdmin.from("brandaro_qualified_leads")
          .update({ excitement_level: excitementLevel })
          .eq("id", leadId);
      }

      if (callbackAt && leadId) {
        await supabaseAdmin.from("brandaro_qualified_leads")
          .update({ callback_scheduled_at: callbackAt })
          .eq("id", leadId);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("va-power-dialer error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
