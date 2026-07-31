// Brandaro — transactional email sender.
// Thin, Brandaro-branded equivalent of dd-send-email. Requires RESEND_API_KEY.
// Templates: paid-conversion-alert (internal), client-welcome (client-facing).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FROM = Deno.env.get("BRANDARO_EMAIL_FROM") || "Brandaro <onboarding@resend.dev>";

type TemplateName = "paid-conversion-alert" | "client-welcome";

const wrap = (title: string, inner: string) => `<!doctype html>
<html><body style="margin:0;padding:0;background:#0b0f14;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#e6edf3">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <div style="font-size:14px;letter-spacing:.18em;color:#4fd1c5;text-transform:uppercase;margin-bottom:8px">Brandaro Digital</div>
    <h1 style="font-size:24px;color:#fff;margin:0 0 24px;font-weight:600">${title}</h1>
    <div style="background:#111820;border:1px solid #1f2933;border-radius:8px;padding:24px;color:#cbd5e1;line-height:1.6">${inner}</div>
    <p style="font-size:12px;color:#64748b;margin-top:32px;text-align:center">Brandaro Digital · Websites for local business</p>
  </div>
</body></html>`;

const money = (n: unknown) => `$${Number(n || 0).toFixed(2)}`;

const templates: Record<TemplateName, (d: any) => { subject: string; html: string }> = {
  "paid-conversion-alert": (d) => ({
    subject: `PAID · ${d.business_name || "Unknown"} · ${String(d.tier || "").toUpperCase()} · ${money(d.amount)}`,
    html: wrap("New paid conversion", `
      <p>A demo just converted to a paid build.</p>
      <p>
        <strong>Business:</strong> ${d.business_name || "—"}<br/>
        <strong>Tier:</strong> ${d.tier || "—"}<br/>
        <strong>Amount:</strong> ${money(d.amount)}<br/>
        <strong>Phone:</strong> ${d.phone || "—"}<br/>
        <strong>Email:</strong> ${d.customer_email || "—"}<br/>
        <strong>Demo ID:</strong> ${d.demo_id || "—"}<br/>
        <strong>Stripe session:</strong> ${d.stripe_session_id || "—"}<br/>
        <strong>Build job:</strong> ${d.build_job_id || "not created"}
      </p>
      ${d.demo_url ? `<p><a href="${d.demo_url}" style="display:inline-block;padding:12px 20px;background:#4fd1c5;color:#0b0f14;text-decoration:none;border-radius:6px;font-weight:600">View demo</a></p>` : ""}
    `),
  }),
  "client-welcome": (d) => ({
    subject: `Payment confirmed — we're building ${d.business_name || "your site"}`,
    html: wrap("Payment confirmed", `
      <p>Thanks — your payment went through and your build is queued.</p>
      <p><strong>Package:</strong> ${d.tier || "—"} · <strong>Paid:</strong> ${money(d.amount)}</p>
      <p>Next step is your intake form so we can load in your real content.</p>
      ${d.intake_url ? `<p><a href="${d.intake_url}" style="display:inline-block;padding:12px 20px;background:#4fd1c5;color:#0b0f14;text-decoration:none;border-radius:6px;font-weight:600">Complete intake</a></p>` : ""}
    `),
  }),
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured", key_ready: false }),
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
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(to) ? to : [to],
        subject: subject_override || subject,
        html,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message || `Resend ${res.status}`);

    return new Response(JSON.stringify({ ok: true, id: body?.id, template }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[brandaro-send-email]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
