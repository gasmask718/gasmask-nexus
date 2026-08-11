// Dynasty Clipper Nation — Phase 2 approval bridge.
// Admin approves an application  ->  auth user + clipper_accounts (active) are
// created and linked back to the application  ->  approval email with a real
// login link is sent through Resend.
// Rejection path: status only, no account, optional rejection email.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@3.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// 🚨 TEMPORARY — Resend sandbox sender until dynastyclipper.io finishes DNS
// verification. onboarding@resend.dev only delivers to the Resend account owner.
const FROM = "Dynasty Clipper Nation <onboarding@resend.dev>";
const ADMIN_EMAIL = "gasmaskapprovedllc@gmail.com";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function approvedHtml(name: string, loginLink: string, portalUrl: string) {
  return `
<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px;">
  <p>Hi ${esc(name || "there")},</p>
  <p>Your <strong>Dynasty Clipper Nation</strong> application has been <strong>approved</strong>! 🎬</p>
  <p>
    <a href="${esc(loginLink)}" style="display:inline-block;background:#C9A84C;color:#111;padding:12px 22px;border-radius:6px;font-weight:700;text-decoration:none;">
      Log in to your clipper portal
    </a>
  </p>
  <p style="font-size:13px;color:#555;">This one-click link signs you straight in. You can return any time at
    <a href="${esc(portalUrl)}" style="color:#C9A84C;">${esc(portalUrl)}</a>.</p>
  <p><strong>Next steps:</strong></p>
  <ol>
    <li>Log in to the portal</li>
    <li>Connect your social accounts</li>
    <li>Pick up your campaign assignments</li>
    <li>Post content and submit URLs</li>
    <li>Get paid every Friday</li>
  </ol>
  <p>Questions? Email <a href="mailto:${ADMIN_EMAIL}" style="color:#C9A84C;">${ADMIN_EMAIL}</a></p>
  <p>Welcome to the network.<br/><em>Dynasty Clipper Nation Team</em></p>
</div>`.trim();
}

function rejectedHtml(name: string, notes?: string | null) {
  return `
<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px;">
  <p>Hi ${esc(name || "there")},</p>
  <p>Thanks for applying to <strong>Dynasty Clipper Nation</strong>. After review, we're not moving forward
     with your application at this time.</p>
  ${notes ? `<p><strong>Notes:</strong> ${esc(notes)}</p>` : ""}
  <p>You're welcome to apply again once your accounts have grown.</p>
  <p><em>Dynasty Clipper Nation Team</em></p>
</div>`.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.healthcheck === true) return json({ ok: true, function: "clipper-approve-application" });

    const { application_id, decision, review_notes, send_email = true, login_base } = body ?? {};
    if (!application_id) return json({ success: false, error: "application_id required" }, 400);
    if (decision !== "approved" && decision !== "rejected") {
      return json({ success: false, error: "decision must be 'approved' or 'rejected'" }, 400);
    }

    // --- caller must be a signed-in admin/owner -----------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ success: false, error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) return json({ success: false, error: "unauthorized" }, 401);
    const actorId = authData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: roleRows } = await admin
      .from("user_roles").select("role").eq("user_id", actorId);
    const roles = (roleRows ?? []).map((r: any) => String(r.role).toLowerCase());
    if (!roles.some((r) => r === "admin" || r === "owner")) {
      return json({ success: false, error: "forbidden: admin or owner role required" }, 403);
    }

    // --- load application ---------------------------------------------------
    const { data: app, error: appErr } = await admin
      .from("clipper_applications").select("*").eq("id", application_id).maybeSingle();
    if (appErr) throw appErr;
    if (!app) return json({ success: false, error: "application not found" }, 404);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const resend = resendKey ? new Resend(resendKey) : null;
    const baseUrl = String(login_base || Deno.env.get("FRONTEND_BASE_URL") || "https://gasmask-os-nexus.lovable.app")
      .replace(/\/+$/, "");
    const portalUrl = `${baseUrl}/clipper/portal`;

    // ======================= REJECTION =====================================
    if (decision === "rejected") {
      const { error: updErr } = await admin.from("clipper_applications").update({
        status: "rejected",
        review_notes: review_notes ?? app.review_notes ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: actorId,
      }).eq("id", application_id);
      if (updErr) throw updErr;

      let email_sent = false, email_error: unknown = null;
      if (send_email && resend) {
        const res = await resend.emails.send({
          from: FROM, to: [app.email],
          subject: "Your Dynasty Clipper Nation application",
          html: rejectedHtml(app.full_name, review_notes ?? null),
        });
        email_error = (res as any)?.error ?? null;
        email_sent = !email_error && !!(res as any)?.data?.id;
      }
      return json({ success: true, decision: "rejected", account_created: false, email_sent, email_error });
    }

    // ======================= APPROVAL ======================================
    if (app.clipper_account_id) {
      // idempotent — already approved
      return json({ success: true, decision: "approved", already_approved: true,
        clipper_account_id: app.clipper_account_id, email_sent: false });
    }

    const email = String(app.email).trim().toLowerCase();

    // 1. auth user (reuse if it already exists)
    let userId: string | null = null;
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: app.full_name, clipper: true },
    });
    if (created.error) {
      // already registered -> resolve the existing auth user by email
      const { data: existingId, error: lookupErr } = await admin.rpc("auth_user_id_by_email", {
        _email: email,
      });
      if (lookupErr || !existingId) throw created.error;
      userId = existingId as string;
    } else {
      userId = created.data.user?.id ?? null;
    }
    if (!userId) throw new Error("could not resolve auth user id");

    // 2. clipper account (active) — reuse a row already bound to this user
    const { data: existingAcct } = await admin
      .from("clipper_accounts").select("id").eq("user_id", userId).maybeSingle();

    let clipperId: string;
    if (existingAcct?.id) {
      clipperId = existingAcct.id;
      await admin.from("clipper_accounts").update({
        status: "active", full_name: app.full_name, phone: app.phone ?? null,
        application_id: app.id,
      }).eq("id", clipperId);
    } else {
      const { data: acct, error: acctErr } = await admin.from("clipper_accounts").insert({
        user_id: userId,
        full_name: app.full_name,
        email,
        phone: app.phone ?? null,
        status: "active",
        application_id: app.id,
      }).select("id").single();
      if (acctErr) throw acctErr;
      clipperId = acct.id;
    }

    // 3. link back + mark approved
    const { error: linkErr } = await admin.from("clipper_applications").update({
      status: "approved",
      review_notes: review_notes ?? app.review_notes ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: actorId,
      clipper_account_id: clipperId,
    }).eq("id", application_id);
    if (linkErr) throw linkErr;

    // 4. one-click login link
    let loginLink = `${baseUrl}/clipper/login`;
    const { data: linkData, error: linkGenErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${baseUrl}/auth/callback?next=/clipper/portal` },
    });
    if (!linkGenErr && linkData?.properties?.action_link) {
      loginLink = linkData.properties.action_link;
    } else if (linkGenErr) {
      console.error("[clipper-approve-application] generateLink failed", linkGenErr);
    }

    // 5. emails
    let email_sent = false, email_error: unknown = null, message_id: string | null = null;
    if (send_email && resend) {
      const [clipperRes] = await Promise.all([
        resend.emails.send({
          from: FROM, to: [email],
          subject: "You're approved — Dynasty Clipper Nation 🎬",
          html: approvedHtml(app.full_name, loginLink, portalUrl),
        }),
        resend.emails.send({
          from: FROM, to: [ADMIN_EMAIL],
          subject: `Clipper Approved: ${app.full_name || email}`,
          html: `<p>Approved clipper <strong>${esc(app.full_name)}</strong> (${esc(email)}) — account ${esc(clipperId)}.</p>`,
        }).catch((e) => ({ error: e })),
      ]);
      email_error = (clipperRes as any)?.error ?? null;
      message_id = (clipperRes as any)?.data?.id ?? null;
      email_sent = !email_error && !!message_id;
      if (email_error) console.error("[clipper-approve-application] resend error", email_error);
    } else if (send_email && !resend) {
      email_error = "RESEND_API_KEY not configured";
    }

    return json({
      success: true, decision: "approved", account_created: true,
      clipper_account_id: clipperId, user_id: userId,
      portal_url: portalUrl, email_sent, message_id, email_error,
    });
  } catch (e) {
    console.error("[clipper-approve-application] error", e);
    return json({ success: false, error: String((e as Error).message) }, 500);
  }
});
