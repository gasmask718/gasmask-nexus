import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildSmsTemplate } from "../_shared/smsTemplates.ts";
import { isSuppressed } from "../_shared/dnc.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { demo_id, lead_id, channel = "sms", destination, message_override, force = false } = await req.json();

    if (!demo_id || !destination) {
      return new Response(JSON.stringify({ error: "demo_id and destination required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- DOUBLE-SEND GUARD: demos are now auto-sent by brandaro-generate-demo.
    // If sent_at is already stamped, refuse unless explicitly forced.
    if (!force) {
      const { data: existing } = await supabase
        .from("brandaro_demo_sites").select("sent_at").eq("id", demo_id).single();
      if (existing?.sent_at) {
        console.warn(`[brandaro-send-demo] duplicate send blocked for demo ${demo_id} (sent_at=${existing.sent_at})`);
        return new Response(JSON.stringify({
          ok: false, already_sent: true, sent_at: existing.sent_at,
          error: "Demo link was already sent to this lead",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }


    // ---- COMPLIANCE GATE: unified suppression check (dnc_list + opt_out_events).
    // Fails CLOSED: a lookup error blocks the send.
    if (channel === "sms") {
      const suppression = await isSuppressed(supabase, destination);
      if (suppression.blocked) {
        console.warn(`[brandaro-send-demo] BLOCKED ${destination} — ${suppression.reason} (${suppression.source})`);
        await supabase.from("brandaro_message_log").insert({
          lead_id: lead_id || null,
          demo_id,
          channel,
          provider: "twilio",
          destination,
          message_body: null,
          send_status: "blocked",
          failure_reason: `suppressed:${suppression.reason}`,
          sent_at: null,
        });
        return new Response(JSON.stringify({
          ok: false,
          suppressed: true,
          reason: suppression.reason,
          source: suppression.source,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }


    // Get demo info
    const { data: demo } = await supabase
      .from("brandaro_demo_sites")
      .select("demo_url, business_name, slug, industry")
      .eq("id", demo_id)
      .single();

    if (!demo) throw new Error("Demo not found");

    const demoLink = demo.demo_url || `https://${(demo.slug || demo_id)}.${demo.industry || "general"}.demo.brandarodigital.com`;
    const message = message_override ||
      buildSmsTemplate("brandaro_demo_invite", {
        business_name: demo.business_name,
        demo_url: demoLink,
      });

    let sendResult: any = { success: false, error: "No send provider configured" };

    if (channel === "sms") {
      // Outbound via send-sms. Class: campaign — this is demo outreach to a
      // lead, and the same function serves BOTH the human-picked sends
      // (SendDemoModal / LeadDatabasePage) and the unattended ones
      // (brandaro-generate-demo auto-send, brandaro-retry-jobs), so it takes
      // full suppression + campaign cooldown. The isSuppressed pre-check above
      // stays for the brandaro-side blocked row; send-sms is the single gate
      // (legal STOP included) and writes the outbound_messages audit row.
      // Sender parity: BRANDARO_TWILIO_NUMBER || TWILIO_FROM_NUMBER.
      const smsResult = await sendSms({
        to: destination,
        from: Deno.env.get("BRANDARO_TWILIO_NUMBER") || Deno.env.get("TWILIO_FROM_NUMBER") || null,
        body: message,
        sendClass: "campaign",
        idempotencyKey: `send-demo-${demo_id}${force ? `-force-${new Date().toISOString().slice(0, 13)}` : ""}`,
        purpose: "brandaro_demo_invite",
        metadata: { demo_id, lead_id: lead_id || null, force: !!force },
      });

      if (smsResult.success && smsResult.providerMessageId) {
        sendResult = { success: true, provider_message_id: smsResult.providerMessageId };
      } else if (smsResult.blocked) {
        // Second-line defence: the pre-check above normally catches this; if
        // send-sms blocks (e.g. legal STOP), record it as blocked, not failed,
        // and do NOT queue a retry — retrying a suppression block is wrong.
        sendResult = { success: false, blocked: true, error: `suppressed:${smsResult.errorMessage}`, twilio_code: null };
      } else {
        sendResult = {
          success: false,
          error: smsResult.errorMessage || "send_failed",
          twilio_code: smsResult.errorCode ?? null,
        };
      }
    }

    // Log the message
    await supabase.from("brandaro_message_log").insert({
      lead_id: lead_id || null,
      demo_id,
      channel,
      provider: channel === "sms" ? "twilio" : "email",
      destination,
      message_body: message,
      send_status: sendResult.success ? "sent" : "failed",
      provider_message_id: sendResult.provider_message_id || null,
      failure_reason: sendResult.error || null,
      sent_at: sendResult.success ? new Date().toISOString() : null,
    });

    // Log failure for retry if needed
    if (!sendResult.success) {
      await supabase.from("brandaro_job_failures").insert({
        job_type: "send_demo",
        entity_type: "demo",
        entity_id: demo_id,
        last_error: sendResult.error,
        retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    }

    // Update demo delivery state.
    // sent_at / sms_sent_at are stamped ONLY on a genuine provider acceptance
    // (Twilio returned 2xx with a message SID). Failures record the attempt and
    // the real provider error so the UI can never show a false "Sent".
    {
      const nowIso = new Date().toISOString();
      const patch: Record<string, unknown> = {
        send_attempted_at: nowIso,
        last_send_status: sendResult.success ? "sent" : "failed",
        last_send_error: sendResult.success ? null : String(sendResult.error || "unknown_send_error").slice(0, 500),
      };
      if (sendResult.success && sendResult.provider_message_id) {
        patch.sent_at = nowIso;
        if (channel === "sms") patch.sms_sent_at = nowIso;
      }
      const { error: stampErr } = await supabase.from("brandaro_demo_sites")
        .update(patch).eq("id", demo_id);
      if (stampErr) console.warn("[send-demo] sent_at stamp failed:", stampErr.message);
    }

    return new Response(JSON.stringify({ ok: sendResult.success, ...sendResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Send demo error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
