import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { sendTwilioSms } from "../_shared/twilioSend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_PHONE = "+19295007046";
const ADMIN_EMAIL = "david@dynastyconnect.com";

interface Body {
  product_id: string;
  question: string;
  email?: string;
  user_id?: string;
}

// Operator alert to a staff-owned handset → internal class via twilioSend
// (no send-sms hop; logged to admin_notifications_log by the helper).
async function sendSms(to: string, body: string): Promise<boolean> {
  const res = await sendTwilioSms({
    to,
    body,
    suppressionClass: "internal",
    source: "dd-notify-question",
  });
  if (!res.success) {
    console.warn(`[dd-notify-question] SMS not sent: ${res.status} ${res.errorMessage}`);
  }
  return res.success;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    console.warn("[dd-notify-question] Resend not configured, skipping email");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Dynasty Direct <orders@dynastydirect.com>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[dd-notify-question] Resend error", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[dd-notify-question] Email exception", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;
    if (!body.product_id || !body.question) {
      return new Response(
        JSON.stringify({ error: "product_id and question required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: product } = await supabase
      .from("products_all")
      .select("product_name")
      .eq("id", body.product_id)
      .maybeSingle();

    const productName = product?.product_name ?? "Unknown product";
    const asker = body.email || "Guest";
    const link = "https://dynastyos.com/dynasty-direct/qa";

    const smsBody =
      `❓ New product question on Dynasty Direct!\n\n` +
      `Product: ${productName}\n` +
      `Question: ${body.question}\n` +
      `From: ${asker}\n\n` +
      `Answer at:\n${link}`;

    const smsSent = await sendSms(ADMIN_PHONE, smsBody);

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#111;">New product question</h2>
        <p><strong>Product:</strong> ${productName}</p>
        <p><strong>From:</strong> ${asker}</p>
        <p style="background:#f6f6f6;padding:12px;border-radius:6px;">${body.question}</p>
        <p>
          <a href="${link}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">
            Answer in Dynasty OS
          </a>
        </p>
      </div>
    `;
    const emailSent = await sendEmail(
      ADMIN_EMAIL,
      `New Q&A Question — ${productName}`,
      emailHtml,
    );

    return new Response(
      JSON.stringify({ success: true, sms_sent: smsSent, email_sent: emailSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[dd-notify-question] fatal", e);
    return new Response(
      JSON.stringify({ success: false, error: String(e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
