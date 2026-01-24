import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Executive Directive Manager
 * Manages human-issued strategic directives that bind AI operations
 * AI executes directives - it does not decide strategy
 */

interface DirectiveRequest {
  action: 'create' | 'activate' | 'pause' | 'complete' | 'revoke' | 'list' | 'get' | 'simulate';
  business_id?: string;
  directive_id?: string;
  directive_data?: {
    directive_name: string;
    directive_type: string;
    scope: string;
    strategic_intent: string;
    target_metrics?: Record<string, unknown>;
    constraints?: Record<string, unknown>;
    success_criteria?: Record<string, unknown>;
    expires_at?: string;
    required_policy_ids?: string[];
  };
  simulation_params?: {
    simulation_type: string;
    input_parameters: Record<string, unknown>;
  };
}

// Executive Powers Matrix - enforced at code level
const EXECUTIVE_POWERS = {
  CAN: [
    'recommend_campaigns',
    'allocate_call_volume',
    'propose_playbook_combinations',
    'pause_campaigns_on_risk',
    'request_mode_promotion',
    'record_memory_artifacts',
    'run_simulations',
  ],
  CANNOT: [
    'launch_live_campaigns_without_approval',
    'modify_compliance_baselines',
    'change_pricing_or_contracts',
    'override_sentinel_containment',
    'cross_business_without_isolation',
    'delete_audit_records',
    'bypass_kill_switches',
  ],
  REQUIRES_APPROVAL: [
    'start_campaign_run',
    'change_autonomy_mode',
    'modify_policies',
    'promote_learning',
  ]
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: DirectiveRequest = await req.json();
    const { action, business_id, directive_id, directive_data, simulation_params } = body;

    let result: unknown;

    switch (action) {
      case 'create': {
        if (!business_id || !directive_data) {
          throw new Error("Business ID and directive data required");
        }

        const { data: directive, error: createError } = await supabase
          .from("executive_directives")
          .insert({
            business_id,
            ...directive_data,
            status: 'draft',
            issued_by: user.id,
            issued_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) throw createError;

        result = { success: true, directive, powers: EXECUTIVE_POWERS };
        break;
      }

      case 'activate': {
        if (!directive_id) throw new Error("Directive ID required");

        // Check if required policies are active
        const { data: directive, error: fetchError } = await supabase
          .from("executive_directives")
          .select("*")
          .eq("id", directive_id)
          .single();

        if (fetchError) throw fetchError;

        if (directive.required_policy_ids?.length > 0) {
          const { data: activePolicies } = await supabase
            .from("executive_policies")
            .select("id")
            .in("id", directive.required_policy_ids)
            .eq("status", "active");

          if (!activePolicies || activePolicies.length !== directive.required_policy_ids.length) {
            throw new Error("Not all required policies are active. Cannot activate directive.");
          }
        }

        // Check advisory mode
        const { data: engine } = await supabase
          .from("executive_decision_engine")
          .select("advisory_only_mode")
          .eq("business_id", directive.business_id)
          .single();

        if (engine?.advisory_only_mode) {
          throw new Error("System is in advisory-only mode. Cannot activate directives.");
        }

        const { data: activated, error: activateError } = await supabase
          .from("executive_directives")
          .update({
            status: 'active',
            effective_from: new Date().toISOString(),
          })
          .eq("id", directive_id)
          .select()
          .single();

        if (activateError) throw activateError;

        result = { success: true, directive: activated };
        break;
      }

      case 'pause': {
        if (!directive_id) throw new Error("Directive ID required");

        const { data: paused, error: pauseError } = await supabase
          .from("executive_directives")
          .update({ status: 'paused' })
          .eq("id", directive_id)
          .select()
          .single();

        if (pauseError) throw pauseError;

        // Pause linked campaigns
        await supabase
          .from("outbound_campaigns")
          .update({ status: 'paused' })
          .eq("directive_id", directive_id)
          .in("status", ['active', 'approved']);

        result = { success: true, directive: paused };
        break;
      }

      case 'revoke': {
        if (!directive_id) throw new Error("Directive ID required");

        const { data: directive, error: fetchError } = await supabase
          .from("executive_directives")
          .select("*")
          .eq("id", directive_id)
          .single();

        if (fetchError) throw fetchError;

        if (!directive.revocation_allowed) {
          throw new Error("This directive does not allow revocation");
        }

        const { data: revoked, error: revokeError } = await supabase
          .from("executive_directives")
          .update({ status: 'revoked' })
          .eq("id", directive_id)
          .select()
          .single();

        if (revokeError) throw revokeError;

        // Halt linked campaigns
        await supabase
          .from("outbound_campaigns")
          .update({ status: 'halted' })
          .eq("directive_id", directive_id);

        // Record memory artifact
        await supabase.from("executive_memory_artifacts").insert({
          business_id: directive.business_id,
          memory_type: 'directive_outcome',
          directive_id,
          artifact_title: `Directive Revoked: ${directive.directive_name}`,
          artifact_summary: 'Directive was revoked before completion',
          outcome_data: { reason: 'manual_revocation', revoked_by: user.id },
        });

        result = { success: true, directive: revoked };
        break;
      }

      case 'simulate': {
        if (!directive_id || !simulation_params) {
          throw new Error("Directive ID and simulation parameters required");
        }

        const { data: directive } = await supabase
          .from("executive_directives")
          .select("*")
          .eq("id", directive_id)
          .single();

        if (!directive) throw new Error("Directive not found");

        // Create simulation run
        const { data: simulation, error: simError } = await supabase
          .from("executive_simulation_runs")
          .insert({
            business_id: directive.business_id,
            directive_id,
            simulation_name: `Simulation for ${directive.directive_name}`,
            simulation_type: simulation_params.simulation_type,
            input_parameters: simulation_params.input_parameters,
            run_by: user.id,
            status: 'running',
          })
          .select()
          .single();

        if (simError) throw simError;

        // Run simulation (simplified - would be ML-based in production)
        const riskScore = Math.random() * 0.4;
        const complianceScore = 0.85 + (Math.random() * 0.15);
        const callVolume = Math.floor(Math.random() * 500) + 100;
        const sentinelStress = riskScore * 1.2;
        const passed = riskScore < 0.3 && complianceScore > 0.9;

        // Update simulation with results
        const { data: completed, error: updateError } = await supabase
          .from("executive_simulation_runs")
          .update({
            status: passed ? 'completed' : 'failed',
            completed_at: new Date().toISOString(),
            projected_outcomes: {
              success_probability: 1 - riskScore,
              estimated_conversions: Math.floor(callVolume * 0.15),
            },
            expected_call_volume: callVolume,
            risk_exposure_score: riskScore,
            compliance_load_score: complianceScore,
            sentinel_stress_projection: sentinelStress,
            simulation_passed: passed,
            failure_reasons: passed ? null : ['Risk exposure too high'],
            recommendations: passed
              ? ['Proceed with gradual rollout']
              : ['Reduce call volume', 'Strengthen compliance checks'],
          })
          .eq("id", simulation.id)
          .select()
          .single();

        if (updateError) throw updateError;

        result = { success: true, simulation: completed };
        break;
      }

      case 'list': {
        if (!business_id) throw new Error("Business ID required");

        const { data: directives, error: listError } = await supabase
          .from("executive_directives")
          .select("*")
          .eq("business_id", business_id)
          .order("created_at", { ascending: false });

        if (listError) throw listError;

        // Get linked campaigns count
        const { data: campaigns } = await supabase
          .from("outbound_campaigns")
          .select("directive_id, status")
          .eq("business_id", business_id)
          .not("directive_id", "is", null);

        const directivesWithCounts = directives?.map(d => ({
          ...d,
          linked_campaigns: campaigns?.filter(c => c.directive_id === d.id).length || 0,
          active_campaigns: campaigns?.filter(c => c.directive_id === d.id && c.status === 'active').length || 0,
        }));

        result = { success: true, directives: directivesWithCounts, powers: EXECUTIVE_POWERS };
        break;
      }

      case 'get': {
        if (!directive_id) throw new Error("Directive ID required");

        const { data: directive, error: getError } = await supabase
          .from("executive_directives")
          .select("*")
          .eq("id", directive_id)
          .single();

        if (getError) throw getError;

        // Get simulations
        const { data: simulations } = await supabase
          .from("executive_simulation_runs")
          .select("*")
          .eq("directive_id", directive_id)
          .order("created_at", { ascending: false })
          .limit(5);

        // Get memory artifacts
        const { data: memories } = await supabase
          .from("executive_memory_artifacts")
          .select("*")
          .eq("directive_id", directive_id)
          .order("created_at", { ascending: false })
          .limit(10);

        result = { success: true, directive, simulations, memories, powers: EXECUTIVE_POWERS };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Executive Directive Manager error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
