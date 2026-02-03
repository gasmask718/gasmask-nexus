import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    const frontendBaseUrl = Deno.env.get("FRONTEND_BASE_URL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate SendGrid API key
    if (!sendgridApiKey) {
      console.error("❌ SENDGRID_API_KEY is not configured");
      return new Response(
        JSON.stringify({ 
          error: "Server configuration error: SendGrid API key is not configured." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate frontend base URL
    if (!frontendBaseUrl) {
      console.error("❌ FRONTEND_BASE_URL is not configured");
      return new Response(
        JSON.stringify({ 
          error: "Server configuration error: FRONTEND_BASE_URL is not configured." 
        }),
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

    // Check if user is admin or owner using direct queries
    const { data: adminRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    const { data: ownerRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'owner')
      .maybeSingle();

    if (!adminRole && !ownerRole) {
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

    // Build the accept invitation URL - matches route in AppRoutes.tsx
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

    // Build email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">You're Invited!</h1>
            <p style="color: #a0aec0; margin: 10px 0 0 0; font-size: 16px;">Join Dynasty OS as a ${roleDisplay}</p>
          </div>
          
          <!-- Body -->
          <div style="padding: 40px 30px;">
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              ${invitedByName ? `<strong>${invitedByName}</strong> has invited you` : "You have been invited"} to join Dynasty OS with the role of <strong>${roleDisplay}</strong>.
            </p>
            
            <!-- Role Badge -->
            <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #3b82f6;">
              <p style="color: #718096; font-size: 14px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">Assigned Role</p>
              <p style="color: #1a202c; font-size: 18px; font-weight: 600; margin: 0;">${roleDisplay}</p>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="${acceptUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                Accept Invitation
              </a>
            </div>
            
            <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
              Or copy and paste this link into your browser:
            </p>
            <p style="color: #3b82f6; font-size: 14px; word-break: break-all; margin: 10px 0 0 0;">
              ${acceptUrl}
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f7fafc; padding: 25px 30px; border-top: 1px solid #e2e8f0;">
            <p style="color: #a0aec0; font-size: 13px; margin: 0; text-align: center;">
              ⏰ This invitation expires on <strong>${expirationDisplay}</strong>
            </p>
            <p style="color: #a0aec0; font-size: 12px; margin: 15px 0 0 0; text-align: center;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email via SendGrid
    console.log(`📧 Sending invitation email to ${email}...`);
    
    const sendgridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: email.toLowerCase() }],
            subject: `You're Invited to Join Dynasty OS as a ${roleDisplay}`,
          }
        ],
        from: {
          email: "gasmaskapprovedllc@gmail.com",
          name: "Dynasty OS"
        },
        content: [
          {
            type: "text/html",
            value: emailHtml,
          }
        ],
      }),
    });

    if (!sendgridResponse.ok) {
      const errorText = await sendgridResponse.text();
      console.error(`❌ SendGrid API error [${sendgridResponse.status}]:`, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Failed to send email: ${sendgridResponse.status}`,
          details: errorText 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Invitation email sent successfully to ${email}`);
    console.log(`   Role: ${roleDisplay}`);
    console.log(`   Accept URL: ${acceptUrl}`);

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
