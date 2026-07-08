// Dynasty Clipper Nation — send approval email to a newly-activated clipper
// and notify David. Triggered by the `after_clipper_approved` DB trigger.
import { Resend } from "https://esm.sh/resend@3.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 🚨 TEMPORARY — TESTING ONLY 🚨
// FROM is swapped to Resend's onboarding sandbox address so we can verify
// delivery while dynastyclipper.io finishes DNS verification in Resend.
// LIMITATION: onboarding@resend.dev only delivers to the Resend account
// owner's own verified email — other recipients get 403.
// SWAP BACK to "Dynasty Clipper Nation <noreply@dynastyclipper.io>" before
// real clippers are approved. See: docs/architecture/known-issues.md
// TODO(email-domain): revert once dynastyclipper.io shows "verified" in Resend.
const FROM = "Dynasty Clipper Nation <onboarding@resend.dev>";
// 🚨 TEMPORARY — admin recipient overridden while onboarding@resend.dev is FROM;
// Resend sandbox only delivers to the account owner. Swap back to
// david@dynastyconnect.com when dynastyclipper.io is verified.
const ADMIN_EMAIL = "gasmaskapprovedllc@gmail.com";
const LOGIN_URL = "https://dynastyclipper.io/login";

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );

function clipperHtml(fullName: string): string {
  const name = escapeHtml(fullName || "there");
  return `
<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px;">
  <p>Hi ${name},</p>
  <p>Your <strong>Dynasty Clipper Nation</strong> application has been <strong>approved</strong>! 🎬</p>
  <p>You can now log in to your clipper portal and start earning:<br/>
    <a href="${LOGIN_URL}" style="color:#C9A84C;font-weight:600;">${LOGIN_URL}</a>
  </p>
  <p><strong>Your next steps:</strong></p>
  <ol>
    <li>Log in at <a href="${LOGIN_URL}" style="color:#C9A84C;">dynastyclipper.io/login</a></li>
    <li>Connect your social accounts</li>
    <li>View your campaign assignments</li>
    <li>Post content and submit URLs</li>
    <li>Get paid every Friday</li>
  </ol>
  <p>Questions? Email <a href="mailto:${ADMIN_EMAIL}" style="color:#C9A84C;">${ADMIN_EMAIL}</a></p>
  <p>Welcome to the network.<br/><em>Dynasty Clipper Nation Team</em></p>
</div>`.trim();
}

function adminHtml(fullName: string, email: string): string {
  return `
<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;">
  <p>A clipper was approved.</p>
  <ul>
    <li><strong>Name:</strong> ${escapeHtml(fullName || "—")}</li>
    <li><strong>Email:</strong> ${escapeHtml(email)}</li>
    <li><strong>Approved at:</strong> ${new Date().toISOString()}</li>
  </ul>
</div>`.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) throw new Error("RESEND_API_KEY not set");

    const { clipper_id, full_name, email } = await req.json();
    if (!email) throw new Error("email required");

    const resend = new Resend(key);

    const [clipperRes, adminRes] = await Promise.all([
      resend.emails.send({
        from: FROM,
        to: [email],
        subject: "You're approved — Dynasty Clipper Nation 🎬",
        html: clipperHtml(full_name),
      }),
      resend.emails.send({
        from: FROM,
        to: [ADMIN_EMAIL],
        subject: `Clipper Approved: ${full_name || email}`,
        html: adminHtml(full_name, email),
      }),
    ]);

    if ((clipperRes as any)?.error) console.error("clipper email error", clipperRes);
    if ((adminRes as any)?.error) console.error("admin email error", adminRes);

    return new Response(
      JSON.stringify({
        success: true,
        clipper_id,
        clipper_message_id: (clipperRes as any)?.data?.id ?? null,
        admin_message_id: (adminRes as any)?.data?.id ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[clipper-approved-email] error", e);
    return new Response(
      JSON.stringify({ error: String((e as Error).message) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
