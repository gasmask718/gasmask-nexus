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
// resend.dev only delivers to the Resend account owner. Set INVITE_FROM_EMAIL
// to an address on a verified domain once one is configured.
const FROM_EMAIL = Deno.env.get("INVITE_FROM_EMAIL") || "Dynasty Direct <onboarding@resend.dev>";

const ROLE_COPY: Record<string, { title: string; line: string }> = {
  wholesaler: { title: "Dynasty Direct — Wholesaler Invite", line: "You've been invited as a Wholesaler on Dynasty Direct." },
  ambassador: { title: "Dynasty Direct — Ambassador Invite", line: "You've been invited to join as a Dynasty Ambassador." },
  store: { title: "Dynasty Direct — Store Portal Invite", line: "Your store has been invited to the Dynasty Direct store portal." },
  customer: { title: "Dynasty Direct — Customer Portal Invite", line: "You've been invited to your Dynasty Direct customer portal." },
  va: { title: "GasMask — VA Invite", line: "You've been invited to join GasMask as a Virtual Assistant." },
  driver: { title: "GasMask — Driver Invite", line: "You've been invited to join GasMask as a Driver." },
  biker: { title: "GasMask — Biker Invite", line: "You've been invited to join GasMask as a Biker." },
  production: { title: "GasMask — Production Office Invite", line: "You've been invited to run a GasMask production office." },
};

const INVITABLE_ROLES = Object.keys(ROLE_COPY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { role, target_link = {}, phone, email, name, channel = "sms" } = body;
    if (!role || !INVITABLE_ROLES.includes(role)) {
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
    const attempted: string[] = [];

    const normalizedPhone = phone ? toE164(phone) : null;
    const isInternational = !!normalizedPhone && !normalizedPhone.startsWith("+1");
    const shouldTrySms = (channel === "sms" || channel === "both") && !!phone;

    if (shouldTrySms) {
      attempted.push("sms");
      const to = normalizedPhone;
      if (!to) {
        sendLog.push({
          channel: "sms",
          to: phone,
          ok: false,
          error: `invalid_phone: "${phone}" could not be normalized to E.164`,
        });
      } else {
        try {
          // send-sms requires { to_number, message_body, idempotency_key } —
          // passing { to, message } fails validation with a 400 and the invite
          // silently never goes out.
          // skip_cooldown: an invite is a one-off, human-triggered send; the
          // 60-minute per-number cooldown is for campaign traffic and would
          // otherwise 429 any invite/resend to a recently-contacted number.
          const { data: smsData, error: smsErr } = await admin.functions.invoke("send-sms", {
            body: {
              to_number: to,
              message_body: msg,
              idempotency_key: `invite-${invite.id}-${Date.now()}`,
              skip_cooldown: true,
              send_class: "conversational",
              purpose: `${role}_invite`,
            },
          });
          // functions.invoke collapses any non-2xx into a generic message —
          // read the response body so the real reason is recorded.
          let detail: string | null = smsErr?.message ?? smsData?.error_message ?? null;
          if (smsErr && (smsErr as any).context?.text) {
            detail = (await (smsErr as any).context.text().catch(() => null)) || detail;
          }
          const ok = !smsErr && smsData?.success !== false;
          sendLog.push({
            channel: "sms",
            to,
            ok,
            provider_message_id: smsData?.provider_message_id ?? null,
            data: smsData,
            error: ok ? null : detail,
          });
        } catch (e) {
          sendLog.push({ channel: "sms", to, ok: false, error: String(e) });
        }
      }
    }

    const smsFailed = sendLog.some((s) => s.channel === "sms" && !s.ok);
    const shouldTryEmail = !!email && (
      channel === "email" ||
      channel === "both" ||
      (isInternational && channel === "sms") ||
      (smsFailed && channel === "sms")
    );

    if (shouldTryEmail) {
      attempted.push("email");
      if (!RESEND_KEY) {
        sendLog.push({ channel: "email", to: email, ok: false, error: "RESEND_API_KEY not configured" });
      } else {
        try {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: [email],
              subject: copy.title,
              html: `<p>${copy.line}</p><p><a href="${link}">${link}</a></p>`,
            }),
          });
          const payload = await r.json().catch(() => null);
          sendLog.push({
            channel: "email",
            to: email,
            ok: r.ok,
            status: r.status,
            provider_message_id: payload?.id ?? null,
            // Surface the provider's real reason (e.g. unverified sender domain)
            // instead of a bare status code.
            error: r.ok ? null : payload?.message || payload?.error || `resend_http_${r.status}`,
          });
        } catch (e) {
          sendLog.push({ channel: "email", to: email, ok: false, error: String(e) });
        }
      }
    }

    await admin
      .from("invites")
      .update({ send_log: sendLog, message_preview: msg })
      .eq("id", invite.id);

    const delivered = sendLog.some((s) => s.ok);
    const failures = sendLog.filter((s) => !s.ok);

    // The invite row is always usable via `link`, but never report success when
    // nothing actually reached the recipient — that is a silent failure.
    if (attempted.length > 0 && !delivered) {
      return json(
        {
          success: false,
          delivered: false,
          error: "delivery_failed",
          error_detail: failures.map((f) => `${f.channel}: ${f.error ?? "unknown error"}`).join("; "),
          invite,
          link,
          send_log: sendLog,
        },
        502,
      );
    }

    return json({ success: true, delivered, invite, link, send_log: sendLog, failures });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

// Normalize loose user input ("718-427-8155", "(718) 427 8155", "+63 936 356 7216")
// to E.164. Handles Philippine mobile formats (0936..., +63 0936...),
// international numbers, and a stray US "1" typed before +63 (1639...).
function toE164(raw: string): string | null {
  const trimmed = String(raw).trim();
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("163") && digits.length >= 13) digits = digits.slice(1);
  if (digits.startsWith("630") && digits.length === 13) digits = `63${digits.slice(3)}`;
  if (digits.startsWith("09") && digits.length === 11) digits = `63${digits.slice(1)}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Longer than NANP: a leading "1" here is a stray country code typed in front
  // of a foreign number (NANP numbers are never > 11 digits).
  if (digits.length > 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length >= 8 && digits.length <= 15 && !digits.startsWith("0")) {
    return `+${digits}`;
  }
  return null;
}


function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
