import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSuppressed } from "../_shared/dnc.ts";

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

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerIdParam}" record="record-from-answer-dual" timeout="20"
    recordingStatusCallback="${SUPABASE_URL}/functions/v1/brandaro-call-status?callLogId=${callLogId}&event=recording"
    recordingStatusCallbackMethod="POST"
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

      await supabaseAdmin.from("va_call_logs").update(updateData).eq("id", callLogId);

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
