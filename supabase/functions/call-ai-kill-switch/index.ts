import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * call-ai-kill-switch
 * 
 * Multi-level emergency kill switch for AI Call Agent.
 * Instantly stops all AI answering at global, business, or route level.
 * Requires no redeploy. Overrides all modes.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      action, // 'activate' | 'deactivate'
      scope, // 'global' | 'business' | 'route'
      business_id,
      route_id,
      reason,
      activated_by,
      auto_deactivate_minutes,
    } = await req.json();

    if (!action || !scope) {
      return new Response(
        JSON.stringify({ error: "Missing required: action, scope" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();

    if (action === "activate") {
      // Calculate auto-deactivation time if specified
      let autoDeactivateAt = null;
      if (auto_deactivate_minutes) {
        autoDeactivateAt = new Date(Date.now() + auto_deactivate_minutes * 60 * 1000).toISOString();
      }

      // Upsert kill switch state
      const { data: killSwitch, error: killError } = await supabase
        .from("ai_kill_switch_state")
        .upsert(
          {
            scope,
            business_id: scope === "business" ? business_id : null,
            route_id: scope === "route" ? route_id : null,
            is_active: true,
            activated_at: now,
            activated_by,
            activation_reason: reason || "Emergency kill switch activated",
            auto_deactivate_at: autoDeactivateAt,
            deactivated_at: null,
            deactivated_by: null,
            updated_at: now,
          },
          {
            onConflict: scope === "global" ? "scope" : scope === "business" ? "business_id" : "route_id",
          }
        )
        .select()
        .single();

      if (killError) throw killError;

      // If global or business, downgrade all affected configs
      if (scope === "global") {
        // Downgrade ALL businesses
        await supabase
          .from("ai_call_agent_config")
          .update({
            mode: "assisted",
            live_mode_enabled: false,
            updated_at: now,
          })
          .neq("mode", "off");

        // Log for all businesses
        const { data: allConfigs } = await supabase
          .from("ai_call_agent_config")
          .select("business_id");

        for (const config of allConfigs || []) {
          await supabase.rpc("log_ai_audit_event", {
            p_business_id: config.business_id,
            p_event_type: "kill_switch_activated",
            p_event_severity: "emergency",
            p_event_payload: { scope: "global", reason },
            p_triggered_by: "human",
            p_actor_user_id: activated_by,
          });
        }
      } else if (scope === "business" && business_id) {
        // Downgrade specific business
        await supabase
          .from("ai_call_agent_config")
          .update({
            mode: "assisted",
            live_mode_enabled: false,
            updated_at: now,
          })
          .eq("business_id", business_id);

        // Suspend authorization
        await supabase
          .from("ai_live_authorizations")
          .update({
            status: "suspended",
            updated_at: now,
          })
          .eq("business_id", business_id)
          .eq("status", "approved");

        // Log audit event
        await supabase.rpc("log_ai_audit_event", {
          p_business_id: business_id,
          p_event_type: "kill_switch_activated",
          p_event_severity: "emergency",
          p_event_payload: { scope: "business", reason },
          p_triggered_by: "human",
          p_actor_user_id: activated_by,
        });

        // Log mode transition
        await supabase.from("mode_transition_logs").insert({
          business_id,
          from_mode: "live",
          to_mode: "assisted",
          trigger_reason: `KILL SWITCH: ${reason || "Emergency stop"}`,
          was_automatic: false,
        });
      }

      // Transfer all active AI calls to humans
      const { data: activeCalls } = await supabase
        .from("ai_call_sessions")
        .select("id, business_id")
        .eq("handoff_state", "ai_active")
        .eq("status", "active");

      let transferredCalls = 0;
      for (const call of activeCalls || []) {
        // Only transfer if scope matches
        if (scope === "global" || call.business_id === business_id) {
          await supabase
            .from("ai_call_sessions")
            .update({
              handoff_state: "human_active",
              status: "transferred",
              updated_at: now,
            })
            .eq("id", call.id);
          transferredCalls++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "activated",
          scope,
          transferred_calls: transferredCalls,
          auto_deactivate_at: autoDeactivateAt,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (action === "deactivate") {
      // Deactivate kill switch
      let query = supabase
        .from("ai_kill_switch_state")
        .update({
          is_active: false,
          deactivated_at: now,
          deactivated_by: activated_by,
          updated_at: now,
        });

      if (scope === "global") {
        query = query.eq("scope", "global");
      } else if (scope === "business") {
        query = query.eq("scope", "business").eq("business_id", business_id);
      } else if (scope === "route") {
        query = query.eq("scope", "route").eq("route_id", route_id);
      }

      const { error: deactivateError } = await query;
      if (deactivateError) throw deactivateError;

      // Log audit event
      if (business_id) {
        await supabase.rpc("log_ai_audit_event", {
          p_business_id: business_id,
          p_event_type: "kill_switch_deactivated",
          p_event_severity: "info",
          p_event_payload: { scope, reason: "Manual deactivation" },
          p_triggered_by: "human",
          p_actor_user_id: activated_by,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "deactivated",
          scope,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'activate' or 'deactivate'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Kill switch error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
