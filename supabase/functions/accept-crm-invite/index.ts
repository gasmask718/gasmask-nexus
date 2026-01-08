import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptRequest {
  token: string;
  userId: string;
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

    const body: AcceptRequest = await req.json();
    const { token, userId } = body;

    if (!token || !userId) {
      return new Response(
        JSON.stringify({ error: "Token and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('crm_invitations')
      .select(`
        *,
        assignments:crm_invitation_assignments(
          crm_id,
          access_role
        )
      `)
      .eq('invite_token', token)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invitation) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired invitation" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        JSON.stringify({ error: "This invitation has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user exists and email matches
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check email matches (case-insensitive)
    if (user.user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "This invitation was sent to a different email address" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create CRM access records for each assignment
    const accessRecords = invitation.assignments.map((assignment: any) => ({
      user_id: userId,
      crm_id: assignment.crm_id,
      access_role: assignment.access_role,
      granted_by: invitation.invited_by,
    }));

    const { error: accessError } = await supabase
      .from('crm_user_access')
      .upsert(accessRecords, { onConflict: 'user_id,crm_id' });

    if (accessError) {
      console.error("Error creating access records:", accessError);
      return new Response(
        JSON.stringify({ error: "Failed to grant CRM access" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabase
      .from('crm_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by_user_id: userId,
      })
      .eq('id', invitation.id);

    if (updateError) {
      console.error("Error updating invitation:", updateError);
    }

    // Get CRM names for the response
    const crmIds = invitation.assignments.map((a: any) => a.crm_id);
    const { data: crms } = await supabase
      .from('businesses')
      .select('id, name')
      .in('id', crmIds);

    const grantedAccess = crms?.map((crm) => {
      const assignment = invitation.assignments.find((a: any) => a.crm_id === crm.id);
      return {
        crmId: crm.id,
        crmName: crm.name,
        accessRole: assignment?.access_role,
      };
    }) || [];

    console.log(`✅ Invitation accepted by user ${userId}`);
    console.log(`   Granted access to: ${crms?.map(c => c.name).join(', ')}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation accepted successfully",
        grantedAccess,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in accept-crm-invite:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
