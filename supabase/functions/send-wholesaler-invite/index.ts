// Dynasty Direct — Wholesaler portal invite.
// Generates a Supabase magic link for the wholesaler's email, emails it via
// Resend, and records the invite in wholesaler_invites.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

interface InvitePayload {
  wholesaler_id: string;
  email: string;
  name: string;
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function isEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: InvitePayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isUuid(body.wholesaler_id) || !isEmail(body.email) || typeof body.name !== "string" || !body.name.trim()) {
    return new Response(
      JSON.stringify({ error: "wholesaler_id (uuid), email, and name are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Caller must be an admin.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userRes.user.id,
    _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Generate magic link.
  let magicLink: string | null = null;
  try {
    const { data: linkRes, error: linkErr } = await (supabase.auth as any).admin.generateLink({
      type: "magiclink",
      email: body.email,
    });
    if (linkErr) throw linkErr;
    magicLink = linkRes?.properties?.action_link ?? null;
  } catch (e) {
    console.error("[send-wholesaler-invite] magic link failed", e);
    return new Response(JSON.stringify({ error: "Failed to generate invite link" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Send email via Resend connector if available.
  let emailSent = false;
  if (lovableKey && resendKey) {
    const html = `
      <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
        <h2>Hi ${escapeHtml(body.name)},</h2>
        <p>You've been invited to manage your products on <strong>Dynasty Direct</strong>.
           Click below to set up your portal account:</p>
        <p>
          <a href="${magicLink}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:8px;text-decoration:none">
            Accept Invitation →
          </a>
        </p>
        <p>Once logged in you can:</p>
        <ul>
          <li>View your products in our catalog</li>
          <li>Track orders for your items</li>
          <li>Update product information</li>
        </ul>
        <p style="color:#666;font-size:13px">This link expires in 7 days.</p>
        <p>— Dynasty Direct Team</p>
      </div>`;

    try {
      const res = await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": resendKey,
        },
        body: JSON.stringify({
          from: "Dynasty Direct <onboarding@resend.dev>",
          to: [body.email],
          subject: "Your Dynasty Direct Supplier Portal Invitation",
          html,
        }),
      });
      emailSent = res.ok;
      if (!res.ok) console.error("[send-wholesaler-invite] resend error", res.status, await res.text());
    } catch (e) {
      console.error("[send-wholesaler-invite] resend exception", e);
    }
  } else {
    console.warn("[send-wholesaler-invite] Resend connector not configured — link generated only");
  }

  // 3. Log the invite.
  const { error: insertErr } = await supabase.from("wholesaler_invites").insert({
    wholesaler_id: body.wholesaler_id,
    email: body.email,
    status: "sent",
    invited_by: userRes.user.id,
    magic_link_url: magicLink,
  });
  if (insertErr) console.error("[send-wholesaler-invite] log insert failed", insertErr);

  return new Response(
    JSON.stringify({
      success: true,
      email_sent: emailSent,
      magic_link: emailSent ? undefined : magicLink,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
