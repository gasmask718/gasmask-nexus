// Admin-only Twilio test console backend.
// Actions:
//   - "health"        → check Twilio credentials and account status
//   - "send_sms"      → send a plain test SMS to a given phone number
//   - "signup_link"   → generate a tokenized store signup URL and SMS it
//   - "receipt"       → send a mock receipt SMS (fake invoice # + total)
//
// Auth: requires caller to be admin or owner (checked via user_roles).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildSmsTemplate } from "../_shared/smsTemplates.ts";
import { sendTwilioSms as sendTwilioSmsShared } from "../_shared/twilioSend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VERIFIED_TOLL_FREE = "+18776818621";

function normalizePhone(raw: string): string {
  const cleaned = raw.trim();
  if (cleaned.startsWith("+")) return cleaned;
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function randomToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Group B (test). The From-selection logic below is the point of this console
// — it proves which sender identity the account actually uses — so it stays
// here; only the HTTP call moves to the shared module, which gives every test
// send the same audit row as production traffic.
async function sendTwilioSms(to: string, body: string) {
  const envFrom = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
  const messagingService = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || "";

  // Prefer toll-free for US destinations to bypass A2P 10DLC.
  const tollFreeRe = /^\+1(800|833|844|855|866|877|888)\d{7}$/;
  const fromIsTollFree = tollFreeRe.test(envFrom);
  const from = fromIsTollFree ? envFrom : VERIFIED_TOLL_FREE;

  const res = await sendTwilioSmsShared({
    to,
    body,
    suppressionClass: "test",
    source: "admin-twilio-test",
    from: messagingService ? null : from,
    messagingServiceSid: messagingService || null,
  });

  if (!res.success) {
    return {
      success: false,
      error_code: res.errorCode || "SEND_FAILED",
      error_message: res.errorMessage || "Twilio send failed",
    };
  }
  return {
    success: true,
    message_sid: res.sid,
    from,
    via: messagingService ? "messaging_service" : "from_number",
  };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate caller
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowed = (roles || []).some((r: any) =>
      ["admin", "owner"].includes(r.role)
    );
    if (!allowed) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    // ── HEALTH ─────────────────────────────────────────────────────────
    if (action === "health") {
      const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const token = Deno.env.get("TWILIO_AUTH_TOKEN");
      const phone = Deno.env.get("TWILIO_PHONE_NUMBER");
      const missing = [
        !sid && "TWILIO_ACCOUNT_SID",
        !token && "TWILIO_AUTH_TOKEN",
        !phone && "TWILIO_PHONE_NUMBER",
      ].filter(Boolean);
      if (missing.length || !sid || !token) {
        return new Response(
          JSON.stringify({
            status: "not_configured",
            missing,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const r = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,
        { headers: { Authorization: "Basic " + btoa(`${sid}:${token}`) } },
      );
      const acct = await r.json();
      if (!r.ok) {
        return new Response(
          JSON.stringify({
            status: "invalid_credentials",
            error: acct?.message,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // Balance
      let balance = null;
      try {
        const br = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`,
          { headers: { Authorization: "Basic " + btoa(`${sid}:${token}`) } },
        );
        if (br.ok) balance = await br.json();
      } catch (_) { /* noop */ }
      return new Response(
        JSON.stringify({
          status: "active",
          account_name: acct.friendly_name,
          account_status: acct.status,
          phone_number: phone,
          balance,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── SEND SMS ───────────────────────────────────────────────────────
    if (action === "send_sms") {
      const to = normalizePhone(String(body?.to || ""));
      const msg = String(
        body?.message ||
          buildSmsTemplate("twilio_admin_test", { timestamp: new Date().toISOString() }),
      );
      if (!/^\+\d{8,15}$/.test(to)) {
        return new Response(
          JSON.stringify({ error: "invalid_to", to }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const result = await sendTwilioSms(to, msg);
      return new Response(JSON.stringify({ ...result, to, message: msg }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SIGNUP LINK ────────────────────────────────────────────────────
    if (action === "signup_link") {
      const to = normalizePhone(String(body?.to || ""));
      const storeName = String(body?.store_name || "Test Store");
      const storeId = String(
        body?.store_id || "00000000-0000-0000-0000-000000000000",
      );
      if (!/^\+\d{8,15}$/.test(to)) {
        return new Response(JSON.stringify({ error: "invalid_to", to }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const token = randomToken();
      const { error: insertErr } = await admin
        .from("store_signup_tokens")
        .insert({
          token,
          store_id: storeId,
          store_name: storeName,
          phone: to,
        });
      if (insertErr) {
        return new Response(
          JSON.stringify({ error: "token_insert_failed", detail: insertErr.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const origin = Deno.env.get("PUBLIC_APP_ORIGIN") ||
        "https://gasmask-os-nexus.lovable.app";
      const url = `${origin}/store-signup?token=${token}`;
      const msg = buildSmsTemplate("gasmask_signup_invite", {
        store_name: storeName,
        signup_url: url,
      });
      const result = await sendTwilioSms(to, msg);
      return new Response(
        JSON.stringify({ ...result, to, signup_url: url, token }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── RECEIPT ────────────────────────────────────────────────────────
    if (action === "receipt") {
      const to = normalizePhone(String(body?.to || ""));
      const invoiceNumber = String(body?.invoice_number || `TEST-${Date.now()}`);
      const amount = Number(body?.amount ?? 42.5).toFixed(2);
      const storeName = String(body?.store_name || "Test Store");
      if (!/^\+\d{8,15}$/.test(to)) {
        return new Response(JSON.stringify({ error: "invalid_to", to }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const msg = buildSmsTemplate("gasmask_receipt_test", {
        store_name: storeName,
        invoice_number: invoiceNumber,
        amount,
      });
      const result = await sendTwilioSms(to, msg);
      return new Response(
        JSON.stringify({
          ...result,
          to,
          invoice_number: invoiceNumber,
          amount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "unknown_action", action }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: "internal", message: e?.message || String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
