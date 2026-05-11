import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/sendEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  crmAssignments: Array<{
    crmId: string;
    accessRole: 'view' | 'edit' | 'admin';
  }>;
  notes?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const frontendBaseUrl = Deno.env.get("FRONTEND_BASE_URL");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate FRONTEND_BASE_URL is configured before proceeding
    if (!frontendBaseUrl) {
      console.error("❌ FRONTEND_BASE_URL environment variable is not configured");
      return new Response(
        JSON.stringify({ 
          error: "Server configuration error: FRONTEND_BASE_URL is not configured. Please contact your administrator." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user from the auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin or owner
    const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: user.id });
    const { data: isOwner } = await supabase.rpc('is_owner', { _user_id: user.id });

    if (!isAdmin && !isOwner) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions. Only admins can send invites." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: InviteRequest = await req.json();
    const { email, crmAssignments, notes } = body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!crmAssignments || crmAssignments.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one CRM assignment is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate access roles
    const validRoles = ['view', 'edit', 'admin'];
    for (const assignment of crmAssignments) {
      if (!validRoles.includes(assignment.accessRole)) {
        return new Response(
          JSON.stringify({ error: `Invalid access role: ${assignment.accessRole}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if there's already a pending invitation for this email
    const { data: existingInvite } = await supabase
      .from('crm_invitations')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: "An invitation is already pending for this email" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate that all CRM IDs exist
    const crmIds = crmAssignments.map(a => a.crmId);
    const { data: validCrms, error: crmValidationError } = await supabase
      .from('businesses')
      .select('id, name')
      .in('id', crmIds);

    if (crmValidationError || !validCrms || validCrms.length !== crmIds.length) {
      return new Response(
        JSON.stringify({ error: "One or more CRM IDs are invalid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the invitation with 7-day expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invitation, error: inviteError } = await supabase
      .from('crm_invitations')
      .insert({
        email: email.toLowerCase(),
        invited_by: user.id,
        notes,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invitation:", inviteError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create CRM assignments for the invitation
    const assignmentRecords = crmAssignments.map((assignment) => ({
      invitation_id: invitation.id,
      crm_id: assignment.crmId,
      access_role: assignment.accessRole,
    }));

    const { error: assignmentError } = await supabase
      .from('crm_invitation_assignments')
      .insert(assignmentRecords);

    if (assignmentError) {
      console.error("Error creating assignments:", assignmentError);
      // Rollback the invitation
      await supabase.from('crm_invitations').delete().eq('id', invitation.id);
      return new Response(
        JSON.stringify({ error: "Failed to create CRM assignments" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build CRM names for email
    const crmNames = validCrms.map(c => c.name).join(', ');

    // Generate the acceptance URL using the configured frontend base URL
    const normalizedBaseUrl = frontendBaseUrl.replace(/\/$/, ''); // Remove trailing slash if present
    const acceptUrl = `${normalizedBaseUrl}/crm/accept-invite?token=${invitation.invite_token}`;

    // Send email via Gmail SMTP (nodemailer)
    let emailSent = false;
    try {
      const result = await sendEmail({
        from: "Brandaro <Sales@brandarodigital.com>",
        to: [email.toLowerCase()],
        subject: "You've been invited to access CRM",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1a1a2e; font-size: 24px; margin-bottom: 20px;">You're Invited!</h1>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
              You have been invited to access the following CRM systems:
            </p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <strong style="color: #1a1a2e;">${crmNames}</strong>
            </div>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
              Click the button below to accept your invitation and get started:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptUrl}"
                 style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 500;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #888; font-size: 14px; margin-top: 30px;">
              This invitation will expire in 7 days.
            </p>
            <p style="color: #888; font-size: 12px;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        `,
      });
      if (result.success) {
        emailSent = true;
        console.log(`📧 Email sent successfully to ${email}`);
      } else {
        console.error("Email sending error:", result.error);
      }
    } catch (emailErr) {
      console.error("Failed to send email:", emailErr);
    }

    console.log(`✅ CRM Invite created for ${email}`);
    console.log(`   Token: ${invitation.invite_token}`);
    console.log(`   CRMs: ${crmNames}`);
    console.log(`   Accept URL: ${acceptUrl}`);
    console.log(`   Email sent: ${emailSent}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          token: invitation.invite_token,
          expiresAt: invitation.expires_at,
          crmAssignments: crmAssignments,
        },
        acceptUrl,
        message: emailSent 
          ? `Invitation email sent to ${email} for access to: ${crmNames}`
          : `Invitation created for ${email}. Email failed to send. Share the link manually.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-crm-invite:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
