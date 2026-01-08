import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
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

    if (!email || !crmAssignments || crmAssignments.length === 0) {
      return new Response(
        JSON.stringify({ error: "Email and at least one CRM assignment are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if there's already a pending invitation for this email
    const { data: existingInvite } = await supabase
      .from('crm_invitations')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: "An invitation is already pending for this email" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('crm_invitations')
      .insert({
        email: email.toLowerCase(),
        invited_by: user.id,
        notes,
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

    // Get CRM names for the email
    const crmIds = crmAssignments.map(a => a.crmId);
    const { data: crms } = await supabase
      .from('businesses')
      .select('id, name')
      .in('id', crmIds);

    const crmNames = crms?.map(c => c.name).join(', ') || 'CRM Access';

    // Generate the acceptance URL
    const acceptUrl = `${supabaseUrl.replace('.supabase.co', '')}/accept-invite?token=${invitation.invite_token}`;

    // TODO: Send email using a service like Resend
    // For now, we'll just log and return the invite token
    console.log(`📧 CRM Invite created for ${email}`);
    console.log(`   Token: ${invitation.invite_token}`);
    console.log(`   CRMs: ${crmNames}`);
    console.log(`   Accept URL: ${acceptUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          token: invitation.invite_token,
          expiresAt: invitation.expires_at,
          crmAssignments: crmAssignments,
        },
        message: `Invitation sent to ${email} for access to: ${crmNames}`,
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
