import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildSmsTemplate } from "../_shared/smsTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERIFIED_FROM = "+18776818621"; // GasMask verified toll-free

function normalize(p: string): string {
  const digits = (p || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return p.startsWith("+") ? p : `+${digits}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Hard auth gate. This function must never promote an unauthenticated caller
  // to service role (previously: `authHeader || Bearer SERVICE_ROLE_KEY`).
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data, error } = await authClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    ).catch(() => ({ data: null, error: new Error("invalid token") } as any));
    if (error || !data?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }


  try {
    const { contact_id, business_label } = await req.json();
    if (!contact_id) {
      return new Response(JSON.stringify({ error: "contact_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: contact, error: cErr } = await supabase
      .from("store_contacts")
      .select("id, store_id, name, phone, can_receive_sms, opted_out")
      .eq("id", contact_id)
      .maybeSingle();

    if (cErr || !contact) {
      return new Response(JSON.stringify({ error: "Contact not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!contact.phone) {
      return new Response(JSON.stringify({ error: "Contact has no phone" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (contact.opted_out) {
      return new Response(JSON.stringify({ error: "Contact has opted out" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const label = (business_label || "GasMask").trim();
    const firstName = (contact.name || "").split(" ")[0] || "there";
    const message = buildSmsTemplate("verification_save_number", {
      first_name: firstName,
      label,
      from_number: VERIFIED_FROM,
    });

    const idem = `verify-contact-${contact_id}-${Date.now()}`;

    // Forward auth header to send-sms so it knows who triggered it
    const authHeader = req.headers.get("Authorization") || "";
    const sendRes = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader || `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          to_number: normalize(contact.phone),
          message_body: message,
          idempotency_key: idem,
          store_id: contact.store_id,
          skip_cooldown: true,
          explicit_provider: "twilio",
          metadata: {
            source: "contact_number_verification",
            contact_id,
            store_id: contact.store_id,
            verification: true,
          },
        }),
      },
    );

    const sendJson = await sendRes.json().catch(() => ({} as any));

    if (!sendRes.ok || sendJson?.success === false) {
      const errMsg =
        sendJson?.error_message ||
        sendJson?.error ||
        sendJson?.reason ||
        `send-sms ${sendRes.status}`;

      await supabase.from("store_contacts").update({
        number_verification_status: "failed",
        number_verification_failed_at: new Date().toISOString(),
        number_verification_error: errMsg,
      }).eq("id", contact_id);

      return new Response(JSON.stringify({ success: false, error: errMsg }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sid = sendJson?.provider_message_id || sendJson?.message_id || null;

    await supabase.from("store_contacts").update({
      number_verification_status: "sent",
      number_verification_sent_at: new Date().toISOString(),
      number_verification_delivered_at: null,
      number_verification_confirmed_at: null,
      number_verification_failed_at: null,
      number_verification_message_sid: sid,
      number_verification_error: null,
    }).eq("id", contact_id);

    // Mirror to communication_logs for the timeline
    await supabase.from("communication_logs").insert({
      store_id: contact.store_id,
      contact_id,
      channel: "sms",
      direction: "outbound",
      summary: `Number verification text sent to ${contact.name}`,
      message_content: message,
      recipient_phone: normalize(contact.phone),
      delivery_status: "sent",
      performed_by: "user",
      twilio_sid: sid,
      outcome: "verification_sent",
    });

    return new Response(JSON.stringify({ success: true, message_sid: sid, status: "sent" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("verify-contact-number error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
