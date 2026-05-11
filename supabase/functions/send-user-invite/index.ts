import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InviteEmailRequest {
  email: string;
  role: string;
  inviteToken: string;
  expiresAt: string;
  invitedByName?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GMAIL_USER = Deno.env.get("VA_GMAIL_USER");
    const GMAIL_PASS = Deno.env.get("VA_GMAIL_APP_PASSWORD");
    const frontendBaseUrl = Deno.env.get("FRONTEND_BASE_URL") || "https://gasmask-os-nexus.lovable.app";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!GMAIL_USER || !GMAIL_PASS) {
      console.error("❌ VA_GMAIL_USER or VA_GMAIL_APP_PASSWORD not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured. Missing VA_GMAIL_USER or VA_GMAIL_APP_PASSWORD." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service role client to verify user and check permissions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Verify the JWT token
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !userData?.user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // Check if user is admin, owner, or ceo (server-side role verification)
    const { data: userRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'owner', 'va']);

    if (roleError) {
      console.error("Role lookup error:", roleError);
      return new Response(
        JSON.stringify({ error: "Failed to verify permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userRoles || userRoles.length === 0) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions. Only admins can send invites." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: InviteEmailRequest = await req.json();
    const { email, role, inviteToken, expiresAt, invitedByName } = body;

    // Validate required fields
    if (!email || !role || !inviteToken) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, role, inviteToken" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the accept invitation URL
    const normalizedBaseUrl = frontendBaseUrl.replace(/\/$/, "");
    const acceptUrl = `${normalizedBaseUrl}/signup?token=${inviteToken}`;

    // Format role for display
    const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");

    // Format expiration date
    const expirationDate = new Date(expiresAt);
    const expirationDisplay = expirationDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Build email HTML with styled button
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Dynasty OS</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #000; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                ⚡ Dynasty OS
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 50px 40px;">
              <h2 style="margin: 0 0 20px 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                You're Invited!
              </h2>
              
              <p style="margin: 0 0 25px 0; color: #a0aec0; font-size: 16px; line-height: 1.6;">
                ${invitedByName ? `<strong style="color: #ffffff;">${invitedByName}</strong> has invited you` : "You have been invited"} to join <strong style="color: #f59e0b;">Dynasty OS</strong> as a <strong style="color: #ffffff;">${roleDisplay}</strong>.
              </p>
              
              <p style="margin: 0 0 35px 0; color: #a0aec0; font-size: 16px; line-height: 1.6;">
                Click the button below to accept your invitation and create your account.
              </p>
              
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto 35px auto;">
                <tr>
                  <td align="center" style="background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%); border-radius: 8px;">
                    <a href="${acceptUrl}" target="_blank" style="display: inline-block; padding: 16px 40px; color: #000000; text-decoration: none; font-size: 16px; font-weight: 700; letter-spacing: 0.5px;">
                      Accept Invite
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Expiration Notice -->
              <div style="background-color: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 15px 20px; border-radius: 0 8px 8px 0; margin-bottom: 30px;">
                <p style="margin: 0; color: #f59e0b; font-size: 14px;">
                  ⏰ This invitation expires on <strong>${expirationDisplay}</strong>
                </p>
              </div>
              
              <!-- Fallback Link -->
              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0 0; word-break: break-all;">
                <a href="${acceptUrl}" style="color: #f59e0b; text-decoration: none; font-size: 13px;">${acceptUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: rgba(0,0,0,0.3); padding: 25px 40px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
              <p style="margin: 10px 0 0 0; color: #475569; font-size: 11px;">
                © 2025 Dynasty OS. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Plain text fallback
    const plainText = `You're Invited to Join Dynasty OS!

${invitedByName ? `${invitedByName} has invited you` : "You have been invited"} to join Dynasty OS as a ${roleDisplay}.

Please click the link below to accept your invitation and create your account:

${acceptUrl}

This invitation expires on ${expirationDisplay}.

If you didn't expect this invitation, you can safely ignore this email.

© 2025 Dynasty OS. All rights reserved.`;

    // Send email via Gmail SMTP (nodemailer)
    console.log(`📧 Sending invitation email via nodemailer to ${email}...`);
    console.log(`   From: ${GMAIL_USER}`);
    console.log(`   Role: ${roleDisplay}`);
    console.log(`   Accept URL: ${acceptUrl}`);

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });

    try {
      const info = await transporter.sendMail({
        from: `"Dynasty OS" <${GMAIL_USER}>`,
        to: email.toLowerCase(),
        subject: `You're Invited to Join Dynasty OS as a ${roleDisplay}`,
        text: plainText,
        html: emailHtml,
      });
      console.log(`✅ Invitation email sent to ${email} (id: ${info.messageId})`);
    } catch (sendErr) {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      console.error("❌ nodemailer error:", msg);
      return new Response(
        JSON.stringify({ error: `Failed to send email: ${msg}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Invitation email sent successfully to ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation email sent to ${email}`,
        acceptUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-user-invite:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
