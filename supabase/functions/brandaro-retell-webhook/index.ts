// brandaro-retell-webhook
// Receives Retell AI call events (call_started, call_ended, call_analyzed)
// and writes them into brandaro_receptionist_calls + updates client stats.
// Also sends an SMS call summary to the business owner if enabled.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = await req.json();
    const event = payload?.event ?? payload?.type ?? "unknown";
    const call = payload?.call ?? payload;

    if (!call?.agent_id) {
      // Not a Retell event we recognize — accept and move on.
      return json({ received: true, ignored: "no_agent_id" });
    }

    // STEP 1 — Find client by Retell agent_id
    const { data: client } = await supabase
      .from("brandaro_receptionist_clients")
      .select("*")
      .eq("retell_agent_id", call.agent_id)
      .maybeSingle();
    if (!client) return json({ received: true, ignored: "unknown_agent" });

    if (event === "call_started") {
      // Nothing to persist yet — Retell will fire call_ended with the transcript.
      return json({ received: true, event });
    }

    if (event === "call_ended") {
      // Insert the row (upsert on retell_call_id to survive retries)
      const durationSec = call.duration_ms ? Math.round(call.duration_ms / 1000) : 0;
      const { error } = await supabase
        .from("brandaro_receptionist_calls")
        .upsert(
          {
            client_id: client.id,
            caller_phone: call.from_number ?? null,
            call_direction: call.direction ?? "inbound",
            call_duration_seconds: durationSec,
            call_status: call.disconnection_reason === "voicemail" ? "voicemail" : "completed",
            retell_call_id: call.call_id,
            recording_url: call.recording_url ?? null,
            transcript: call.transcript ?? null,
          },
          { onConflict: "retell_call_id" },
        );
      if (error) console.error("[retell-webhook] call insert failed", error);

      // Bump client stats
      await supabase
        .from("brandaro_receptionist_clients")
        .update({
          total_calls_handled: (client.total_calls_handled ?? 0) + 1,
          calls_this_month: (client.calls_this_month ?? 0) + 1,
          last_call_at: new Date().toISOString(),
        })
        .eq("id", client.id);

      return json({ received: true, event });
    }

    if (event === "call_analyzed") {
      const analysis = call.call_analysis ?? {};
      const custom = analysis.custom_analysis_data ?? {};
      const outcome = deriveOutcome(analysis, custom);

      const { data: updatedCall } = await supabase
        .from("brandaro_receptionist_calls")
        .update({
          summary: analysis.call_summary ?? null,
          caller_sentiment: normalizeSentiment(analysis.user_sentiment),
          caller_name: custom.caller_name ?? null,
          appointment_booked: !!custom.appointment_booked,
          appointment_datetime: custom.appointment_datetime ?? null,
          appointment_service: custom.appointment_service ?? null,
          callback_requested: !!custom.callback_requested,
          callback_datetime: custom.callback_datetime ?? null,
          key_info_extracted: custom.key_info ?? custom ?? null,
          call_outcome: outcome,
        })
        .eq("retell_call_id", call.call_id)
        .select("*")
        .maybeSingle();

      if (custom.appointment_booked) {
        await supabase
          .from("brandaro_receptionist_clients")
          .update({
            appointments_booked_total: (client.appointments_booked_total ?? 0) + 1,
            appointments_booked_this_month: (client.appointments_booked_this_month ?? 0) + 1,
          })
          .eq("id", client.id);
      }

      // SMS followup to business owner
      if (client.sms_followup_enabled && client.phone) {
        try {
          const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
          const twilioTok = Deno.env.get("TWILIO_AUTH_TOKEN");
          const twilioFrom =
            client.twilio_phone_number ??
            Deno.env.get("TWILIO_MESSAGING_FROM") ??
            Deno.env.get("TWILIO_PHONE_NUMBER");
          if (twilioSid && twilioTok && twilioFrom) {
            const parts = [
              `📞 Call — ${custom.caller_name ?? call.from_number ?? "Unknown"}`,
              analysis.call_summary ?? "(no summary)",
            ];
            if (custom.appointment_booked) parts.push(`✅ Appointment: ${custom.appointment_datetime ?? "(time TBD)"}`);
            if (custom.callback_requested) parts.push(`↩️ Callback requested`);
            const smsBody = parts.join("\n");

            const smsResp = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  Authorization: `Basic ${btoa(`${twilioSid}:${twilioTok}`)}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  To: client.phone,
                  From: twilioFrom,
                  Body: smsBody,
                }),
              },
            );

            if (updatedCall?.id) {
              await supabase
                .from("brandaro_receptionist_calls")
                .update({
                  sms_followup_sent: smsResp.ok,
                  sms_followup_sent_at: smsResp.ok ? new Date().toISOString() : null,
                  sms_followup_content: smsBody,
                })
                .eq("id", updatedCall.id);
            }
          }
        } catch (e) {
          console.warn("[retell-webhook] owner SMS failed", e);
        }
      }

      return json({ received: true, event });
    }

    return json({ received: true, ignored: event });
  } catch (err) {
    console.error("[brandaro-retell-webhook] error", err);
    // Always return 200 so Retell doesn't retry-storm us
    return json({ received: true, error: String((err as Error)?.message ?? err) });
  }
});

function deriveOutcome(analysis: any, custom: any): string {
  if (custom?.appointment_booked) return "appointment_booked";
  if (custom?.callback_requested) return "callback_requested";
  if (custom?.transferred_to_human) return "transferred_to_human";
  if (custom?.is_spam) return "spam";
  if (custom?.wrong_number) return "wrong_number";
  if (custom?.left_voicemail || analysis?.call_summary?.toLowerCase?.().includes("voicemail")) return "voicemail_left";
  return "info_provided";
}
function normalizeSentiment(s?: string): string | null {
  if (!s) return null;
  const v = s.toLowerCase();
  if (v.includes("urgent")) return "urgent";
  if (v.includes("pos")) return "positive";
  if (v.includes("neg")) return "negative";
  return "neutral";
}
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
