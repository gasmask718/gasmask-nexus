// VA Send Email — uses nodemailer (Gmail SMTP) with credentials in secrets
import nodemailer from "npm:nodemailer@6.9.14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EmailBody {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  fromName?: string;
  replyTo?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GMAIL_USER = Deno.env.get("VA_GMAIL_USER");
    const GMAIL_PASS = Deno.env.get("VA_GMAIL_APP_PASSWORD");

    if (!GMAIL_USER || !GMAIL_PASS) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Missing VA_GMAIL_USER or VA_GMAIL_APP_PASSWORD in environment.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = (await req.json()) as EmailBody;
    if (!body?.to || !body?.subject || (!body.html && !body.text)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: to, subject, html|text",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const to = Array.isArray(body.to) ? body.to.join(", ") : body.to;
    const fromName = body.fromName || "Dynasty VA Team";

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${GMAIL_USER}>`,
      to,
      subject: body.subject,
      html: body.html,
      text: body.text,
      replyTo: body.replyTo,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message_id: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[va-send-email] error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
