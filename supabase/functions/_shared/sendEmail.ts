// Shared email helper — uses nodemailer over Gmail SMTP.
// Reads credentials from VA_GMAIL_USER / VA_GMAIL_APP_PASSWORD secrets.
import nodemailer from "npm:nodemailer@6.9.14";

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

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
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
