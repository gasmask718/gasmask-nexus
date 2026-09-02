// Ambassador invite dispatcher — creates (or resends) an ambassador invite and
// delivers the signup link over SMS (Twilio via send-sms) and/or email (Resend).
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      invite_id,
      name = "",
      email = "",
      phone = "",
      channel = "sms",
      target_ambassador_id = null,
    } = body as Record<string, any>;

    if (!invite_id && !email && !phone) {
      return json({ error: "email_or_phone_required" }, 400);
    }
    if (!["sms", "email", "both"].includes(channel)) {
      return json({ error: "invalid_channel" }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    let invite: any = null;

    if (invite_id) {
      // RESEND path — reuse the existing pending invite
      const { data, error } = await admin
        .from("ambassador_invites")
        .select("*")
        .eq("id", invite_id)
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "invite_not_found" }, 404);
      if (data.status !== "pending") return json({ error: `invite_${data.status}` }, 400);
      if (new Date(data.expires_at) < new Date()) return json({ error: "invite_expired" }, 400);
      // Request-originated invites must be owner-approved before anything
      // (re)sends. Direct staff invites carry no invite_request_id and are exempt.
      if (data.invite_request_id && !data.owner_approved_at) {
        console.warn("Blocked resend of unapproved request invite:", data.id);
        return json({ error: "invite_pending_owner_approval" }, 403);
      }
      invite = { ...data, token: data.invite_token };

      // Correction path: an admin may supply a corrected recipient email on
      // resend. Persist it onto the SAME invite (no duplicate invite, token,
      // approval metadata and attribution untouched). Invalid input is never
      // persisted and never "repaired".
      const corrected = normalizeRecipientEmail(email);
      if (corrected && isValidRecipientEmail(corrected) && corrected !== normalizeRecipientEmail(data.email)) {
        const { error: updErr } = await admin
          .from("ambassador_invites")
          .update({ email: corrected })
          .eq("id", data.id);
        if (updErr) return json({ error: `email_update_failed: ${updErr.message}` }, 400);
        invite.email = corrected;
        await admin.from("ambassador_invite_events").insert({
          invite_id: data.id,
          event_type: "sent",
          actor_user_id: userData.user.id,
          metadata: { action: "email_corrected", previous_email: data.email, new_email: corrected },
        });
      }
    } else {
      const { data, error } = await userClient.rpc("create_ambassador_invite", {
        p_email: email || null,
        p_phone: phone || null,
        p_region_id: null,
        p_target_ambassador_id: target_ambassador_id,
      } as any);
      if (error) return json({ error: error.message }, 400);
      const result = data as any;
      if (!result?.success) return json({ error: result?.error || "create_failed" }, 400);
      invite = { ...result, id: result.invite_id ?? result.id, token: result.token ?? result.invite_token };
    }

    const token = invite.token;
    if (!token) return json({ error: "no_invite_token" }, 500);

    const link = `${APP_URL}/invite/ambassador/${encodeURIComponent(token)}`;
    const greeting = name ? `${name}, ` : "";
    const msg = `${greeting}you've been invited to join GasMask as an Ambassador. Set up your account: ${link}`;

    const toPhone = phone || invite.phone;
    const rawEmail = email || invite.email || "";
    const toEmail = normalizeRecipientEmail(rawEmail);
    const emailInvalid = !!rawEmail && !isValidRecipientEmail(rawEmail);
    const sendLog: any[] = [];


    if ((channel === "sms" || channel === "both") && toPhone) {
      try {
        const { data: smsData, error: smsErr } = await admin.functions.invoke("send-sms", {
          body: {
            to_number: toPhone,
            message_body: msg,
            idempotency_key: `amb-invite-${invite.id}-${Date.now()}`,
            purpose: "ambassador_invite",
            metadata: { invite_id: invite.id, resend: !!invite_id },
          },
        });
        let smsDetail: string | undefined = smsErr?.message;
        const ctx = (smsErr as any)?.context;
        if (ctx && typeof ctx.text === "function") {
          try { smsDetail = (await ctx.text())?.slice(0, 300) || smsDetail; } catch { /* ignore */ }
        }
        sendLog.push({ channel: "sms", to: toPhone, ok: !smsErr, error: smsDetail, data: smsData });
      } catch (e) {
        sendLog.push({ channel: "sms", to: toPhone, ok: false, error: String(e) });
      }
    }

    if ((channel === "email" || channel === "both") && (toEmail || emailInvalid)) {
      if (emailInvalid) {
        // Never hand a malformed address to the provider — the 422 it returns
        // is noise. Mark delivery as not-sent and leave the invite intact for
        // correction + resend.
        sendLog.push({
          channel: "email",
          to: rawEmail,
          ok: false,
          code: "invalid_email",
          error: "invalid_email_format",
        });
      } else if (!RESEND_KEY) {
        sendLog.push({ channel: "email", to: toEmail, ok: false, error: "RESEND_API_KEY not configured" });
      } else {
        try {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
            body: JSON.stringify({
              from: "GasMask <onboarding@resend.dev>",
              to: [toEmail],
              subject: "GasMask — Ambassador Invite",
              html: `<p>${greeting}you've been invited to join <strong>GasMask</strong> as an Ambassador.</p>
                     <p><a href="${link}">Set up your account</a></p>
                     <p style="font-size:12px;color:#666">${link}<br/>This link is single-use and expires soon.</p>`,
            }),
          });
          const text = await r.text();
          sendLog.push({ channel: "email", to: toEmail, ok: r.ok, status: r.status, response: text.slice(0, 300) });
        } catch (e) {
          sendLog.push({ channel: "email", to: toEmail, ok: false, error: String(e) });
        }
      }
    }

    if (sendLog.length === 0) {
      sendLog.push({ channel, ok: false, error: "no_destination_for_channel" });
    }

    // Forensic event log (best-effort)
    if (invite.id) {
      await admin.from("ambassador_invite_events").insert({
        invite_id: invite.id,
        event_type: "sent",
        actor_user_id: userData.user.id,
        metadata: { channel, send_log: sendLog, name, resend: !!invite_id, email_invalid: emailInvalid },
      });
    }

    const delivered = sendLog.some((s) => s.ok);
    // An invalid recipient email is an expected, recoverable outcome — report
    // it as a 200 with success:false so callers can show a clear message
    // instead of a transport-level failure.
    const httpStatus = delivered || emailInvalid ? 200 : 502;
    return json({
      success: delivered,
      resent: !!invite_id,
      invite_id: invite.id,
      token,
      link,
      send_log: sendLog,
      email_invalid: emailInvalid,
      invalid_email: emailInvalid ? rawEmail : undefined,
      error: delivered ? undefined : sendLog.map((s) => s.error || `status ${s.status}`).join("; "),
    }, httpStatus);

  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
