import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * REALTIME KILL SWITCH
 * 
 * Provides instant kill switch checking and triggering for outbound calls.
 * - Check: Returns current kill switch state (called on every call tick)
 * - Trigger: Activates kill switch and halts all affected calls
 * - Reset: Manually resets kill switch (requires auth)
 * 
 * Kill switch ALWAYS wins - no exceptions.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface KillSwitchRequest {
  action: 'check' | 'trigger' | 'reset' | 'get_state';
  scope: 'global' | 'business' | 'campaign';
  business_id?: string;
  campaign_id?: string;
  reason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Auth for trigger/reset
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const body: KillSwitchRequest = await req.json();
    const { action, scope, business_id, campaign_id, reason } = body;

    switch (action) {
      case 'check': {
        // Fast check - used on every call tick
        // Check in order of priority: global > business > campaign
        const checks = [];

        // Global check
        const { data: globalSwitch } = await supabase
          .from("kill_switch_state")
          .select("is_active, triggered_at, trigger_reason")
          .eq("scope", "global")
          .single();

        if (globalSwitch?.is_active) {
          return new Response(
            JSON.stringify({ 
              active: true, 
              scope: 'global', 
              reason: globalSwitch.trigger_reason,
              triggered_at: globalSwitch.triggered_at,
              action_required: 'halt_immediately'
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Business check
        if (business_id) {
          const { data: businessSwitch } = await supabase
            .from("kill_switch_state")
            .select("is_active, triggered_at, trigger_reason")
            .eq("scope", "business")
            .eq("business_id", business_id)
            .single();

          if (businessSwitch?.is_active) {
            return new Response(
              JSON.stringify({ 
                active: true, 
                scope: 'business', 
                business_id,
                reason: businessSwitch.trigger_reason,
                triggered_at: businessSwitch.triggered_at,
                action_required: 'halt_immediately'
              }),
              { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }
        }

        // Campaign check
        if (campaign_id) {
          const { data: campaignSwitch } = await supabase
            .from("kill_switch_state")
            .select("is_active, triggered_at, trigger_reason")
            .eq("scope", "campaign")
            .eq("campaign_id", campaign_id)
            .single();

          if (campaignSwitch?.is_active) {
            return new Response(
              JSON.stringify({ 
                active: true, 
                scope: 'campaign', 
                campaign_id,
                reason: campaignSwitch.trigger_reason,
                triggered_at: campaignSwitch.triggered_at,
                action_required: 'halt_immediately'
              }),
              { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }
        }

        // All clear
        return new Response(
          JSON.stringify({ 
            active: false, 
            action_required: 'none',
            checked_scopes: { global: true, business: !!business_id, campaign: !!campaign_id }
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'trigger': {
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Authentication required to trigger kill switch" }),
            { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        console.log(`🚨 KILL SWITCH TRIGGERED - Scope: ${scope}, By: ${userId}, Reason: ${reason}`);

        // Upsert kill switch state
        const { error: switchError } = await supabase
          .from("kill_switch_state")
          .upsert({
            scope,
            business_id: scope === 'business' ? business_id : null,
            campaign_id: scope === 'campaign' ? campaign_id : null,
            is_active: true,
            triggered_at: new Date().toISOString(),
            triggered_by: userId,
            trigger_reason: reason || 'Manual trigger',
            requires_manual_reset: true,
            updated_at: new Date().toISOString()
          }, { 
            onConflict: 'scope,business_id,campaign_id' 
          });

        if (switchError) {
          throw switchError;
        }

        // Halt affected campaigns
        let haltQuery = supabase
          .from("outbound_campaigns")
          .update({ 
            status: 'halted',
            kill_switch_triggered: true,
            sentinel_status: 'halted'
          });

        if (scope === 'global') {
          haltQuery = haltQuery.eq('status', 'active');
        } else if (scope === 'business' && business_id) {
          haltQuery = haltQuery.eq('business_id', business_id).eq('status', 'active');
        } else if (scope === 'campaign' && campaign_id) {
          haltQuery = haltQuery.eq('id', campaign_id);
        }

        await haltQuery;

        // Halt active runs
        let runHaltQuery = supabase
          .from("campaign_runs")
          .update({ 
            status: 'halted',
            halted_by: userId,
            halt_reason: reason || 'Kill switch triggered'
          });

        if (scope === 'campaign' && campaign_id) {
          runHaltQuery = runHaltQuery.eq('campaign_id', campaign_id).eq('status', 'active');
        } else if (scope === 'business' && business_id) {
          runHaltQuery = runHaltQuery.eq('business_id', business_id).eq('status', 'active');
        } else {
          runHaltQuery = runHaltQuery.eq('status', 'active');
        }

        await runHaltQuery;

        // Mark in-progress sessions for termination
        let sessionQuery = supabase
          .from("ai_call_sessions")
          .update({ 
            kill_switch_terminated: true,
            status: 'terminated',
            ai_notes: `Terminated by kill switch: ${reason || 'Manual trigger'}`
          });

        if (scope === 'campaign' && campaign_id) {
          sessionQuery = sessionQuery.eq('campaign_id', campaign_id).in('status', ['active', 'in_progress', 'pending']);
        } else if (scope === 'business' && business_id) {
          sessionQuery = sessionQuery.eq('business_id', business_id).in('status', ['active', 'in_progress', 'pending']);
        } else {
          sessionQuery = sessionQuery.in('status', ['active', 'in_progress', 'pending']);
        }

        const { data: terminatedSessions } = await sessionQuery.select('id');

        // Log to audit
        await supabase.from("ai_audit_events").insert({
          business_id: business_id || '00000000-0000-0000-0000-000000000000',
          event_type: 'kill_switch_triggered',
          event_severity: 'critical',
          event_payload: {
            scope,
            business_id,
            campaign_id,
            reason,
            triggered_by: userId,
            sessions_terminated: terminatedSessions?.length || 0
          },
          actor_user_id: userId,
          triggered_by: 'human'
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Kill switch activated at ${scope} level`,
            scope,
            sessions_terminated: terminatedSessions?.length || 0,
            requires_manual_reset: true
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'reset': {
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Authentication required to reset kill switch" }),
            { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Reset kill switch
        let resetQuery = supabase
          .from("kill_switch_state")
          .update({
            is_active: false,
            reset_at: new Date().toISOString(),
            reset_by: userId,
            updated_at: new Date().toISOString()
          });

        if (scope === 'global') {
          resetQuery = resetQuery.eq('scope', 'global');
        } else if (scope === 'business' && business_id) {
          resetQuery = resetQuery.eq('scope', 'business').eq('business_id', business_id);
        } else if (scope === 'campaign' && campaign_id) {
          resetQuery = resetQuery.eq('scope', 'campaign').eq('campaign_id', campaign_id);
        }

        await resetQuery;

        console.log(`✅ Kill switch reset - Scope: ${scope}, By: ${userId}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Kill switch reset at ${scope} level`,
            scope,
            reset_by: userId
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'get_state': {
        // Get full kill switch state
        const { data: states } = await supabase
          .from("kill_switch_state")
          .select("*")
          .order("scope");

        return new Response(
          JSON.stringify({ success: true, states }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Invalid action" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }

  } catch (error: any) {
    console.error("❌ Error in realtime-kill-switch:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);