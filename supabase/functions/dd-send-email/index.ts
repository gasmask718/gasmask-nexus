// Dynasty Direct — transactional email sender.
// Key-ready: requires RESEND_API_KEY. Two templates: order-confirmation, shipped-with-tracking.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FROM = Deno.env.get("DD_EMAIL_FROM") || "Dynasty Direct <orders@dynastydirect.com>";

type TemplateName = "order-confirmation" | "shipped-with-tracking" | "wholesaler-portal-access";

const wrap = (title: string, inner: string) => `<!doctype html>
<html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#e5e5e5">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <div style="font-size:14px;letter-spacing:.18em;color:#c9a84c;text-transform:uppercase;margin-bottom:8px">Dynasty Direct</div>
    <h1 style="font-size:24px;color:#fff;margin:0 0 24px;font-weight:600">${title}</h1>
    <div style="background:#141414;border:1px solid #262626;border-radius:8px;padding:24px;color:#d4d4d4;line-height:1.6">${inner}</div>
    <p style="font-size:12px;color:#737373;margin-top:32px;text-align:center">Dynasty Direct · Wholesale & Retail Marketplace</p>
  </div>
</body></html>`;

const templates: Record<TemplateName, (data: any) => { subject: string; html: string }> = {
  "order-confirmation": (d) => ({
    subject: `Order confirmed · #${String(d.order_id || "").slice(0, 8).toUpperCase()}`,
    html: wrap("Order confirmed", `
      <p>Thanks — your payment was received.</p>
      <p><strong>Order:</strong> ${String(d.order_id || "").slice(0, 8).toUpperCase()}<br/>
      <strong>Total:</strong> $${Number(d.amount_total || 0).toFixed(2)}</p>
      <p>We're prepping your shipment. You'll get a tracking link the moment it leaves the warehouse.</p>
      ${d.order_url ? `<p><a href="${d.order_url}" style="display:inline-block;padding:12px 20px;background:#c9a84c;color:#0a0a0a;text-decoration:none;border-radius:6px;font-weight:600">View order</a></p>` : ""}
    `),
  }),
  "shipped-with-tracking": (d) => ({
    subject: `Shipped · #${String(d.order_id || "").slice(0, 8).toUpperCase()}${d.tracking_number ? ` · ${d.tracking_number}` : ""}`,
    html: wrap("Your order shipped", `
      <p>Your Dynasty Direct order is on the way.</p>
      <p><strong>Carrier:</strong> ${d.carrier || "—"}<br/>
      <strong>Tracking:</strong> ${d.tracking_number || "—"}<br/>
      ${d.estimated_delivery ? `<strong>Estimated delivery:</strong> ${d.estimated_delivery}<br/>` : ""}</p>
      ${d.tracking_url ? `<p><a href="${d.tracking_url}" style="display:inline-block;padding:12px 20px;background:#c9a84c;color:#0a0a0a;text-decoration:none;border-radius:6px;font-weight:600">Track package</a></p>` : ""}
    `),
  }),
  "wholesaler-portal-access": (d) => ({
    subject: "Your Dynasty Direct Wholesaler Portal access",
    html: wrap("Wholesaler Portal access", `
      <p>Your existing account now has Dynasty Direct wholesaler access.</p>
      <p><strong>Sign in with the email you already use</strong> — no new account was created, and your existing access is unchanged.</p>
      ${d.company_name ? `<p><strong>Supplier account:</strong> ${d.company_name}</p>` : ""}
      <p><a href="${d.portal_url}" style="display:inline-block;padding:12px 20px;background:#c9a84c;color:#0a0a0a;text-decoration:none;border-radius:6px;font-weight:600">Open Wholesaler Portal</a></p>
      <p style="font-size:13px;color:#a3a3a3">If the button does not work, paste this link into your browser:<br/>${d.portal_url}</p>
    `),
  }),
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured yet", key_ready: false }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { template, to, data, subject_override } = await req.json();
    if (!template || !to) throw new Error("template + to required");
    const tpl = templates[template as TemplateName];
    if (!tpl) throw new Error(`Unknown template: ${template}`);

    const { subject, html } = tpl(data || {});

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject: subject_override || subject, html }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || `Resend ${res.status}`);

    return new Response(JSON.stringify({ ok: true, id: json?.id, template }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[dd-send-email]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
