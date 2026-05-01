// VA Email Sender — uses Resend API (reliable in Deno edge runtime)
// Falls back to Gmail SMTP only if RESEND_API_KEY is missing.

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

const asArray = (v: string | string[] | undefined): string[] =>
  !v ? [] : Array.isArray(v) ? v : [v];

const isEmail = (s: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: SendEmailBody;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const to = asArray(body.to).map((s) => s.trim()).filter(Boolean);
  const cc = asArray(body.cc).map((s) => s.trim()).filter(Boolean);
  const bcc = asArray(body.bcc).map((s) => s.trim()).filter(Boolean);

  if (to.length === 0 || !to.every(isEmail)) {
    return new Response(JSON.stringify({ error: "Invalid or missing 'to' address" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!body.subject) {
    return new Response(JSON.stringify({ error: "Missing 'subject'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!body.html && !body.text) {
    return new Response(JSON.stringify({ error: "Provide 'html' or 'text' body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const fromName = (body.from_name || "VA Notifications").replace(/[<>"\r\n]/g, "").trim();

  // ---- Path A: Resend (preferred) ----
  if (RESEND_API_KEY) {
    // Use onboarding@resend.dev which works without domain verification.
    // For production, replace with verified domain address.
    const fromAddr = `${fromName} <onboarding@resend.dev>`;

    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddr,
          to,
          cc: cc.length ? cc : undefined,
          bcc: bcc.length ? bcc : undefined,
          reply_to: body.reply_to && isEmail(body.reply_to) ? body.reply_to : undefined,
          subject: body.subject,
          html: body.html,
          text: body.text,
        }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        console.error("[va-send-email] Resend error:", resp.status, data);
        return new Response(
          JSON.stringify({
            success: false,
            error: (data as any)?.message || `Resend API error (${resp.status})`,
            provider: "resend",
            details: data,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      console.log(`[va-send-email] sent via Resend to=${to.join(",")} id=${(data as any)?.id}`);
      return new Response(
        JSON.stringify({ success: true, provider: "resend", id: (data as any)?.id, to, subject: body.subject }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[va-send-email] Resend fetch failed:", msg);
      return new Response(
        JSON.stringify({ success: false, error: `Resend send failed: ${msg}`, provider: "resend" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  // ---- Path B: no provider configured ----
  console.error("[va-send-email] No email provider configured (RESEND_API_KEY missing)");
  return new Response(
    JSON.stringify({ error: "Email service not configured. Set RESEND_API_KEY." }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
