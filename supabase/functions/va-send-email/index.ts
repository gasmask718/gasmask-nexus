// VA Email Sender — sends real email via Gmail SMTP using app password
// Uses denomailer (Deno-native SMTP client). No verify_jwt required.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendEmailBody {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from_name?: string;
  reply_to?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userRaw = Deno.env.get("VA_GMAIL_USER") ?? "";
  const passRaw = Deno.env.get("VA_GMAIL_APP_PASSWORD") ?? "";
  // Strip whitespace; Gmail App Passwords are often shown with spaces
  const user = userRaw.trim();
  const pass = passRaw.replace(/\s+/g, "");

  if (!user || !pass) {
    console.error("[va-send-email] Missing VA_GMAIL_USER or VA_GMAIL_APP_PASSWORD");
    return new Response(
      JSON.stringify({
        error: "Email service not configured. Set VA_GMAIL_USER and VA_GMAIL_APP_PASSWORD.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: SendEmailBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const to = asArray(body.to).map((s) => s.trim()).filter(Boolean);
  const cc = asArray(body.cc).map((s) => s.trim()).filter(Boolean);
  const bcc = asArray(body.bcc).map((s) => s.trim()).filter(Boolean);

  if (to.length === 0 || !to.every(isEmail)) {
    return new Response(JSON.stringify({ error: "Invalid or missing 'to' address" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!body.subject || typeof body.subject !== "string") {
    return new Response(JSON.stringify({ error: "Missing 'subject'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!body.html && !body.text) {
    return new Response(JSON.stringify({ error: "Provide 'html' or 'text' body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isEmail(user)) {
    console.error(`[va-send-email] VA_GMAIL_USER is not a valid email: "${user}"`);
    return new Response(
      JSON.stringify({
        error: `VA_GMAIL_USER is not a valid email address (got "${user}"). Update the secret to your Gmail address only.`,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const fromName = (body.from_name || "VA Notifications").replace(/[<>"\r\n]/g, "").trim();
  const fromAddr = fromName ? `${fromName} <${user}>` : user;

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 587,
      tls: false, // STARTTLS upgrade
      auth: { username: user, password: pass },
    },
  });

  try {
    await client.send({
      from: fromAddr,
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      replyTo: body.reply_to && isEmail(body.reply_to) ? body.reply_to : undefined,
      subject: body.subject,
      content: body.text ?? "",
      html: body.html ?? undefined,
    });
    await client.close();

    console.log(`[va-send-email] sent to=${to.join(",")} subject="${body.subject}"`);
    return new Response(
      JSON.stringify({ success: true, to, subject: body.subject }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    try { await client.close(); } catch (_) { /* noop */ }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[va-send-email] SMTP send failed:", msg);

    const lower = msg.toLowerCase();
    const isAuth =
      lower.includes("auth") || lower.includes("credentials") ||
      lower.includes("username") || lower.includes("password") ||
      lower.includes("535");

    return new Response(
      JSON.stringify({
        success: false,
        error: isAuth
          ? "Gmail authentication failed. Verify VA_GMAIL_USER and that VA_GMAIL_APP_PASSWORD is a valid App Password."
          : `Email send failed: ${msg}`,
        code: isAuth ? "AUTH_FAILED" : "SEND_FAILED",
      }),
      { status: isAuth ? 401 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
