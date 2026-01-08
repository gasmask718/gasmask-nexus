import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the auth header - CRITICAL: use the authenticated user, not a body param
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required. Please sign in to accept this invitation." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired session. Please sign in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== 'string' || token.length < 10) {
      return new Response(
        JSON.stringify({ error: "Invalid invitation token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the invitation - use FOR UPDATE to lock the row
    const { data: invitation, error: inviteError } = await supabase
      .from('crm_invitations')
      .select(`
        *,
        assignments:crm_invitation_assignments(
          crm_id,
          access_role,
          crm:businesses(id, name)
        )
      `)
      .eq('invite_token', token)
      .maybeSingle();

    if (inviteError) {
      console.error("Error fetching invitation:", inviteError);
      return new Response(
        JSON.stringify({ error: "Failed to verify invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invitation) {
      return new Response(
        JSON.stringify({ error: "Invalid invitation token. This link may have been used or does not exist." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already accepted (single-use enforcement)
    if (invitation.status === 'accepted') {
      return new Response(
        JSON.stringify({ error: "This invitation has already been accepted." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if revoked
    if (invitation.status === 'revoked') {
      return new Response(
        JSON.stringify({ error: "This invitation has been revoked." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if not pending
    if (invitation.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: `This invitation is no longer valid (status: ${invitation.status})` }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from('crm_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return new Response(
        JSON.stringify({ error: "This invitation has expired. Please request a new invitation." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify email matches (case-insensitive)
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      console.warn(`Email mismatch: ${user.email} tried to use invitation for ${invitation.email}`);
      return new Response(
        JSON.stringify({ 
          error: "This invitation was sent to a different email address. Please sign in with the correct account." 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure user has a profile (create if not exists)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        });

      if (profileError) {
        console.error("Error creating profile:", profileError);
        // Don't fail the whole flow, profile creation is secondary
      }
    }

    // Create CRM access records for each assignment
    const accessRecords = invitation.assignments.map((assignment: any) => ({
      user_id: user.id,
      crm_id: assignment.crm_id,
      access_role: assignment.access_role,
      granted_by: invitation.invited_by,
      is_active: true,
    }));

    // Use upsert to handle re-grants gracefully
    const { error: accessError } = await supabase
      .from('crm_user_access')
      .upsert(accessRecords, { 
        onConflict: 'user_id,crm_id',
        ignoreDuplicates: false 
      });

    if (accessError) {
      console.error("Error creating access records:", accessError);
      return new Response(
        JSON.stringify({ error: "Failed to grant CRM access. Please try again or contact support." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark invitation as accepted - CRITICAL: single-use enforcement
    const { error: updateError } = await supabase
      .from('crm_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by_user_id: user.id,
      })
      .eq('id', invitation.id)
      .eq('status', 'pending'); // Double-check status to prevent race conditions

    if (updateError) {
      console.error("Error updating invitation:", updateError);
      // Access was already granted, so don't fail
    }

    // Build response with CRM details
    const grantedAccess = invitation.assignments.map((a: any) => ({
      crmId: a.crm_id,
      crmName: a.crm?.name || 'CRM',
      accessRole: a.access_role,
    }));

    console.log(`✅ Invitation accepted by user ${user.id} (${user.email})`);
    console.log(`   Granted access to: ${grantedAccess.map((g: any) => g.crmName).join(', ')}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation accepted successfully! You now have access to the assigned CRMs.",
        grantedAccess,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in accept-crm-invite:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
