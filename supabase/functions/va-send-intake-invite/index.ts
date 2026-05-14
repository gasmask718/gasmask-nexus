import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INTAKE_BASE_URL = "https://www.brandarodigital.com/intake";

interface Body {
  business_name?: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  channels?: ("sms" | "email")[];
}

function buildSmsBody(name: string, link: string) {
  const greeting = name ? `Hi ${name}, ` : "Hi, ";
  return `${greeting}thanks for connecting with Brandaro Digital. Please complete your quick intake here so we can prep your project: ${link}`;
}

function buildEmailHtml(name: string, business: string, link: string) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f8fb;padding:24px;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e2e8f0">
    <h2 style="margin:0 0 12px;color:#0ea5e9">Brandaro Digital — Project Intake</h2>
    <p>Hi ${name || "there"},</p>
    <p>Thanks for connecting with us${business ? ` regarding <strong>${business}</strong>` : ""}. To kick off your project, please complete the quick intake form linked below.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${link}" style="background:#0ea5e9;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;display:inline-block">Open Intake Form</a>
    </p>
    <p style="font-size:12px;color:#475569">Or paste this link into your browser:<br><a href="${link}">${link}</a></p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="font-size:12px;color:#64748b">— Brandaro Digital</p>
  </div></body></html>`;
}

function buildEmailText(name: string, business: string, link: string) {
  return `Hi ${name || "there"},\n\nThanks for connecting with Brandaro Digital${business ? ` regarding ${business}` : ""}. To kick off your project, please complete the quick intake form here:\n\n${link}\n\n— Brandaro Digital`;
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const gmailUser = Deno.env.get("VA_GMAIL_USER");
  const gmailPass = Deno.env.get("VA_GMAIL_APP_PASSWORD");
  const replyTo = Deno.env.get("BRANDARO_EMAIL_REPLY_TO") || "hello@brandaro.com";
  const fromOverride = Deno.env.get("BRANDARO_EMAIL_FROM");
  if (!gmailUser || !gmailPass) {
    return { ok: false, error: "Email not configured (VA_GMAIL_USER / VA_GMAIL_APP_PASSWORD missing)" };
  }
  try {
    const { default: nodemailer } = await import("npm:nodemailer@6.9.14");
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPass },
    });
    const fromHeader = fromOverride && !/@resend\.dev>?\s*$/i.test(fromOverride)
      ? fromOverride
      : `"Brandaro Digital" <${gmailUser}>`;
    const info = await transporter.sendMail({ from: fromHeader, to, replyTo, subject, html, text });
    console.log("nodemailer sent intake invite:", info.messageId);
    return { ok: true };
  } catch (e: any) {
    console.error("Nodemailer intake invite failed:", e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uerr } = await userClient.auth.getUser();
    if (uerr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Body = await req.json();
    const channels = (body.channels && body.channels.length ? body.channels : ["sms", "email"]).filter(
      (c) => c === "sms" || c === "email"
    ) as ("sms" | "email")[];

    if (!body.business_name?.trim()) {
      return new Response(JSON.stringify({ error: "business_name is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (channels.includes("sms") && !body.phone?.trim()) {
      return new Response(JSON.stringify({ error: "phone required for SMS" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (channels.includes("email") && !body.email?.trim()) {
      return new Response(JSON.stringify({ error: "email required for email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const token = crypto.randomUUID().replace(/-/g, "");
    const link = `${INTAKE_BASE_URL}?ref=${token}`;

    // Create invite row first
    const { data: invite, error: insErr } = await admin
      .from("va_intake_invites")
      .insert({
        token,
        va_id: user.id,
        business_name: body.business_name?.trim() || null,
        owner_name: body.owner_name?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        sent_via: channels,
        destination_url: link,
        status: "sending",
      })
      .select()
      .single();
    if (insErr) throw insErr;

    const results: Record<string, { ok: boolean; error?: string }> = {};

    if (channels.includes("sms")) {
      try {
        const { data: smsData, error: smsErr } = await admin.functions.invoke("send-sms", {
          body: {
            to_number: body.phone,
            message_body: buildSmsBody(body.owner_name || "", link),
            idempotency_key: `intake-invite-${invite.id}`,
          },
        });
        if (smsErr) throw smsErr;
        if (smsData && smsData.success === false) throw new Error(smsData.error_message || "SMS failed");
        results.sms = { ok: true };
      } catch (e: any) {
        results.sms = { ok: false, error: e?.message || String(e) };
      }
    }

    if (channels.includes("email")) {
      const r = await sendEmail(
        body.email!,
        "Your Brandaro Digital intake form",
        buildEmailHtml(body.owner_name || "", body.business_name || "", link),
        buildEmailText(body.owner_name || "", body.business_name || "", link)
      );
      results.email = r;
    }

    const allOk = Object.values(results).every((r) => r.ok);
    await admin.from("va_intake_invites").update({
      status: allOk ? "sent" : "partial",
      sms_status: results.sms ? (results.sms.ok ? "sent" : "failed") : null,
      sms_error: results.sms?.error || null,
      email_status: results.email ? (results.email.ok ? "sent" : "failed") : null,
      email_error: results.email?.error || null,
    }).eq("id", invite.id);

    return new Response(JSON.stringify({
      success: allOk,
      invite_id: invite.id,
      link,
      results,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("va-send-intake-invite error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
