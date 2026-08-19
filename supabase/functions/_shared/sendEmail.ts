// Shared email helper.
//
// Resend is primary (RESEND_API_KEY). Gmail SMTP (VA_GMAIL_USER /
// VA_GMAIL_APP_PASSWORD) is the fallback only — Gmail app passwords get
// revoked silently (534-5.7.9 WebLoginRequired killed every ops email from
// 2026-07-03 onward), so it must not be the only leg.
import nodemailer from "npm:nodemailer@6.9.14";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("OPS_ALERT_FROM") ||
  "Dynasty OS <onboarding@resend.dev>";

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string; // optional display name override; defaults to "Brandaro <VA_GMAIL_USER>"
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{ filename: string; content: string | Uint8Array; contentType?: string }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const GMAIL_USER = Deno.env.get("VA_GMAIL_USER");
  const GMAIL_PASS = Deno.env.get("VA_GMAIL_APP_PASSWORD");
  if (!GMAIL_USER || !GMAIL_PASS) {
    throw new Error("Email is not configured (VA_GMAIL_USER / VA_GMAIL_APP_PASSWORD missing)");
  }
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });
  }
  return { transporter: cachedTransporter, GMAIL_USER };
}

async function sendViaResend(params: SendEmailParams): Promise<SendEmailResult> {
  const to = Array.isArray(params.to) ? params.to : [params.to];
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from || RESEND_FROM,
      to,
      cc: params.cc ? (Array.isArray(params.cc) ? params.cc : [params.cc]) : undefined,
      bcc: params.bcc ? (Array.isArray(params.bcc) ? params.bcc : [params.bcc]) : undefined,
      reply_to: params.replyTo,
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });
  const body = await r.text();
  if (!r.ok) {
    console.error(`[sendEmail] resend ${r.status}: ${body.slice(0, 300)}`);
    return { success: false, error: `resend ${r.status}: ${body.slice(0, 200)}` };
  }
  let messageId: string | undefined;
  try { messageId = JSON.parse(body)?.id; } catch { /* ignore */ }
  console.log("[sendEmail] sent via resend:", messageId, "to:", params.to);
  return { success: true, messageId };
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (RESEND_API_KEY && !params.attachments?.length) {
    const res = await sendViaResend(params).catch((e) => ({
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    }));
    if (res.success) return res;
    console.warn("[sendEmail] resend failed, falling back to Gmail SMTP:", res.error);
  }
  try {
    const { transporter, GMAIL_USER } = getTransporter();
    const fromAddr = params.from || `Brandaro <${GMAIL_USER}>`;
    const info = await transporter.sendMail({
      from: fromAddr,
      to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
      cc: params.cc ? (Array.isArray(params.cc) ? params.cc.join(", ") : params.cc) : undefined,
      bcc: params.bcc ? (Array.isArray(params.bcc) ? params.bcc.join(", ") : params.bcc) : undefined,
      replyTo: params.replyTo,
      subject: params.subject,
      html: params.html,
      text: params.text,
      attachments: params.attachments,
    });
    console.log("[sendEmail] sent:", info.messageId, "to:", params.to);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendEmail] error:", msg);
    return { success: false, error: msg };
  }
}
