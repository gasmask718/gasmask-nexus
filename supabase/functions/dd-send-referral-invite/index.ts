// dd-send-referral-invite — store-to-store referral invite.
// Creates dd_store_referrals row + emails the invitee via Resend.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

interface Body {
  referrer_user_id: string;
  referrer_store_id?: string | null;
  referrer_name?: string | null;
  referred_email: string;
}

function genCode(): string {
  // 8-char base36 — readable referral code
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => b.toString(36))
    .join("")
    .toUpperCase()
    .slice(0, 8);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    if (!body?.referrer_user_id || !body?.referred_email) {
      return new Response(JSON.stringify({ error: "referrer_user_id and referred_email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const code = genCode();

    const { data: row, error } = await admin
      .from("dd_store_referrals")
      .insert({
        referrer_user_id: body.referrer_user_id,
        referrer_store_id: body.referrer_store_id ?? null,
        referred_email: body.referred_email,
        referral_code: code,
        status: "pending",
      })
      .select("id, referral_code")
      .single();
    if (error) throw error;

    const link = `https://dynastydirect.com/join?ref=${code}`;
    const referrer = body.referrer_name || "A Dynasty Direct store";

    let emailSid: string | null = null;
    if (RESEND_API_KEY) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
          <h2 style="margin:0 0 16px">You've been invited to Dynasty Direct</h2>
          <p>${referrer} is inviting you to shop wholesale at Dynasty Direct.</p>
          <p>Use their referral link to get <strong>10% off your first order</strong>:</p>
          <p style="margin:24px 0">
            <a href="${link}" style="background:#10b981;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">Claim 10% Off</a>
          </p>
          <p style="font-size:12px;color:#555">Or paste this link: ${link}</p>
        </div>`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Dynasty Direct <noreply@dynastydirect.com>",
          to: [body.referred_email],
          subject: `${referrer} invited you to Dynasty Direct — 10% off your first order`,
          html,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) emailSid = (j as any)?.id ?? null;
      else console.error("[dd-send-referral-invite] resend failed", r.status, j);
    }

    return new Response(JSON.stringify({ success: true, referral_id: row.id, referral_code: row.referral_code, email_sid: emailSid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
