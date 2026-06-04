// Universal invite sender — creates invite + dispatches SMS/email
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const APP_URL = Deno.env.get("APP_PUBLIC_URL") || "https://gasmask-os-nexus.lovable.app";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY");

const ROLE_COPY: Record<string, { title: string; line: string }> = {
  wholesaler: { title: "Dynasty Direct — Wholesaler Invite", line: "You've been invited as a Wholesaler on Dynasty Direct." },
  ambassador: { title: "Dynasty Direct — Ambassador Invite", line: "You've been invited to join as a Dynasty Ambassador." },
  store: { title: "Dynasty Direct — Store Portal Invite", line: "Your store has been invited to the Dynasty Direct store portal." },
  customer: { title: "Dynasty Direct — Customer Portal Invite", line: "You've been invited to your Dynasty Direct customer portal." },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { role, target_link = {}, phone, email, name, channel = "sms" } = body;
    if (!role || !["wholesaler", "ambassador", "store", "customer"].includes(role)) {
      return json({ error: "invalid_role" }, 400);
    }
    if (!phone && !email) return json({ error: "phone_or_email_required" }, 400);

    // Use caller's JWT so create_invite sees auth.uid()
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: invite, error: createErr } = await userClient.rpc("create_invite", {
      p_role: role,
      p_target_link: target_link,
      p_phone: phone || null,
      p_email: email || null,
      p_name: name || null,
      p_channel: channel,
    });
    if (createErr || !invite) return json({ error: createErr?.message || "create_failed" }, 400);

    const link = `${APP_URL}/invite/${encodeURIComponent(invite.token)}`;
    const copy = ROLE_COPY[role];
    const msg = `${copy.line} Tap to set up your account: ${link}`;

    const sendLog: any[] = [];

    if ((channel === "sms" || channel === "both") && phone) {
      try {
        const { data: smsData, error: smsErr } = await admin.functions.invoke("send-sms", {
          body: { to: phone, message: msg },
        });
        sendLog.push({ channel: "sms", to: phone, ok: !smsErr, data: smsData, error: smsErr?.message });
      } catch (e) {
        sendLog.push({ channel: "sms", to: phone, ok: false, error: String(e) });
      }
    }

    if ((channel === "email" || channel === "both") && email) {
      if (!RESEND_KEY) {
        sendLog.push({ channel: "email", to: email, ok: false, error: "RESEND_API_KEY not configured" });
      } else {
        try {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
            body: JSON.stringify({
              from: "Dynasty Direct <onboarding@resend.dev>",
              to: [email],
              subject: copy.title,
              html: `<p>${copy.line}</p><p><a href="${link}">${link}</a></p>`,
            }),
          });
          sendLog.push({ channel: "email", to: email, ok: r.ok, status: r.status });
        } catch (e) {
          sendLog.push({ channel: "email", to: email, ok: false, error: String(e) });
        }
      }
    }

    await admin
      .from("invites")
      .update({ send_log: sendLog, message_preview: msg })
      .eq("id", invite.id);

    return json({ success: true, invite, link, send_log: sendLog });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
