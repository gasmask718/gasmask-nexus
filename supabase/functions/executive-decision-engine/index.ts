import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EngineRequest {
  action: 'start_run' | 'make_decision' | 'pause_run' | 'halt_run' | 'rollback_run' | 'get_status' | 'update_engine' | 'record_frame';
  campaign_id?: string;
  run_id?: string;
  business_id?: string;
  decision_data?: {
    decision_type: string;
    decision_reason: string;
    action_plan?: Record<string, unknown>;
    requires_approval?: boolean;
  };
  frame_data?: {
    frame_type: string;
    campaign_state: Record<string, unknown>;
  };
  engine_update?: {
    mode?: string;
    human_override_active?: boolean;
    override_reason?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
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

    const body: EngineRequest = await req.json();
    const { action, campaign_id, run_id, business_id, decision_data, frame_data, engine_update } = body;

    let result: unknown;

    switch (action) {
      case 'start_run': {
        if (!campaign_id) throw new Error("Campaign ID required");

        // Get campaign and verify it has an active policy
        const { data: campaign, error: campError } = await supabase
          .from("outbound_campaigns")
          .select("*, executive_policies!outbound_campaigns_policy_id_fkey(*)")
          .eq("id", campaign_id)
          .single();

        if (campError) {
          // Campaign exists but may not have policy FK - try direct query
          const { data: simpleCampaign, error: simpleError } = await supabase
            .from("outbound_campaigns")
            .select("*")
            .eq("id", campaign_id)
            .single();
          
          if (simpleError) throw simpleError;
          
          // Check for active policy for this business
          const { data: activePolicy, error: policyError } = await supabase
            .from("executive_policies")
            .select("*")
            .eq("business_id", simpleCampaign.business_id)
            .eq("status", "active")
            .limit(1)
            .single();

          if (policyError || !activePolicy) {
            throw new Error("No active executive policy found. AI cannot operate without a signed policy.");
          }

          // Check Sentinel status
          const { data: sentinel } = await supabase
            .from("sentinel_campaign_approvals")
            .select("approval_status")
            .eq("campaign_id", campaign_id)
            .single();

          if (sentinel && sentinel.approval_status === 'halted') {
            throw new Error("Sentinel status is HALTED. Cannot start campaign run.");
          }

          // Get current run count
          const { count: runCount } = await supabase
            .from("campaign_runs")
            .select("*", { count: 'exact', head: true })
            .eq("campaign_id", campaign_id);

          // Create new run
          const { data: run, error: runError } = await supabase
            .from("campaign_runs")
            .insert({
              campaign_id,
              policy_id: activePolicy.id,
              business_id: simpleCampaign.business_id,
              run_number: (runCount || 0) + 1,
              status: 'running',
              actual_start: new Date().toISOString(),
              initial_confidence: 0.85,
            })
            .select()
            .single();

          if (runError) throw runError;

          // Record initial audit frame
          await supabase.from("campaign_audit_frames").insert({
            run_id: run.id,
            frame_number: 1,
            frame_type: 'state_snapshot',
            campaign_state: { status: 'started', campaign_id, policy_id: activePolicy.id },
            policy_state: { policy_name: activePolicy.policy_name, scope: activePolicy.policy_scope },
            confidence_at_frame: 0.85,
          });

          result = { success: true, run, policy: activePolicy };
          break;
        }

        // Normal flow with FK relationship
        if (!campaign.executive_policies || campaign.executive_policies.status !== 'active') {
          throw new Error("Campaign policy is not active. AI cannot operate without an active policy.");
        }

        // Create run with existing policy
        const { count: existingRuns } = await supabase
          .from("campaign_runs")
          .select("*", { count: 'exact', head: true })
          .eq("campaign_id", campaign_id);

        const { data: newRun, error: newRunError } = await supabase
          .from("campaign_runs")
          .insert({
            campaign_id,
            policy_id: campaign.executive_policies.id,
            business_id: campaign.business_id,
            run_number: (existingRuns || 0) + 1,
            status: 'running',
            actual_start: new Date().toISOString(),
            initial_confidence: 0.85,
          })
          .select()
          .single();

        if (newRunError) throw newRunError;

        result = { success: true, run: newRun, policy: campaign.executive_policies };
        break;
      }

      case 'make_decision': {
        if (!run_id || !decision_data) throw new Error("Run ID and decision data required");

        // Get run with policy
        const { data: run, error: runError } = await supabase
          .from("campaign_runs")
          .select("*, executive_policies(*)")
          .eq("id", run_id)
          .single();

        if (runError) throw runError;
        if (run.status !== 'running') {
          throw new Error(`Run is not active. Current status: ${run.status}`);
        }

        // Check if decision type is forbidden
        const policy = run.executive_policies;
        if (policy && policy.forbidden_actions.includes(decision_data.decision_type)) {
          // Log violation
          await supabase.from("policy_violations").insert({
            policy_id: policy.id,
            business_id: run.business_id,
            campaign_id: run.campaign_id,
            violation_type: 'forbidden_action_attempted',
            severity: 'major',
            description: `AI attempted forbidden action: ${decision_data.decision_type}`,
            context_snapshot: decision_data,
          });

          throw new Error(`Action '${decision_data.decision_type}' is forbidden by policy`);
        }

        // Check if approval required
        const needsApproval = policy && policy.approval_required_for.includes(decision_data.decision_type);

        // Calculate confidence score (simplified - would be ML-based in production)
        const confidenceScore = 0.75 + (Math.random() * 0.2);
        const riskFlags: string[] = [];

        if (confidenceScore < 0.7) riskFlags.push('low_confidence');
        if (decision_data.decision_type === 'escalation') riskFlags.push('requires_human');

        // Record decision
        const { data: decision, error: decisionError } = await supabase
          .from("campaign_decisions")
          .insert({
            run_id,
            campaign_id: run.campaign_id,
            policy_id: policy?.id,
            decision_type: decision_data.decision_type,
            decision_reason: decision_data.decision_reason,
            action_plan: decision_data.action_plan || {},
            confidence_score: confidenceScore,
            risk_flags: riskFlags,
            requires_human_approval: needsApproval || decision_data.requires_approval,
            sentinel_status: 'compliant',
          })
          .select()
          .single();

        if (decisionError) throw decisionError;

        // Record audit frame
        const { count: frameCount } = await supabase
          .from("campaign_audit_frames")
          .select("*", { count: 'exact', head: true })
          .eq("run_id", run_id);

        await supabase.from("campaign_audit_frames").insert({
          run_id,
          frame_number: (frameCount || 0) + 1,
          frame_type: 'decision_point',
          campaign_state: { decision_type: decision_data.decision_type },
          decision_id: decision.id,
          confidence_at_frame: confidenceScore,
        });

        result = { 
          success: true, 
          decision, 
          requires_approval: needsApproval,
          confidence: confidenceScore,
          risk_flags: riskFlags 
        };
        break;
      }

      case 'pause_run': {
        if (!run_id) throw new Error("Run ID required");

        const { data: paused, error: pauseError } = await supabase
          .from("campaign_runs")
          .update({ status: 'paused' })
          .eq("id", run_id)
          .select()
          .single();

        if (pauseError) throw pauseError;

        result = { success: true, run: paused };
        break;
      }

      case 'halt_run': {
        if (!run_id) throw new Error("Run ID required");

        const { data: halted, error: haltError } = await supabase
          .from("campaign_runs")
          .update({ 
            status: 'halted',
            actual_end: new Date().toISOString(),
          })
          .eq("id", run_id)
          .select()
          .single();

        if (haltError) throw haltError;

        // Record halt frame
        const { count: fc } = await supabase
          .from("campaign_audit_frames")
          .select("*", { count: 'exact', head: true })
          .eq("run_id", run_id);

        await supabase.from("campaign_audit_frames").insert({
          run_id,
          frame_number: (fc || 0) + 1,
          frame_type: 'human_intervention',
          campaign_state: { action: 'halt', halted_by: user.id },
        });

        result = { success: true, run: halted };
        break;
      }

      case 'rollback_run': {
        if (!run_id) throw new Error("Run ID required");

        const { data: rolledBack, error: rollbackError } = await supabase
          .from("campaign_runs")
          .update({ 
            status: 'rolled_back',
            rollback_triggered: true,
            rollback_reason: 'Manual rollback by operator',
            rollback_at: new Date().toISOString(),
            actual_end: new Date().toISOString(),
          })
          .eq("id", run_id)
          .select()
          .single();

        if (rollbackError) throw rollbackError;

        result = { success: true, run: rolledBack };
        break;
      }

      case 'get_status': {
        if (!business_id) throw new Error("Business ID required");

        // Get or create engine state
        let { data: engine, error: engineError } = await supabase
          .from("executive_decision_engine")
          .select("*")
          .eq("business_id", business_id)
          .single();

        if (engineError) {
          // Create engine state
          const { data: newEngine, error: createError } = await supabase
            .from("executive_decision_engine")
            .insert({ business_id, status: 'idle' })
            .select()
            .single();

          if (createError) throw createError;
          engine = newEngine;
        }

        // Get active runs
        const { data: activeRuns } = await supabase
          .from("campaign_runs")
          .select("*, outbound_campaigns(*)")
          .eq("business_id", business_id)
          .eq("status", "running");

        // Get active policies
        const { data: activePolicies } = await supabase
          .from("executive_policies")
          .select("*")
          .eq("business_id", business_id)
          .eq("status", "active");

        // Get today's metrics
        const today = new Date().toISOString().split('T')[0];
        const { count: decisionsToday } = await supabase
          .from("campaign_decisions")
          .select("*", { count: 'exact', head: true })
          .gte("created_at", today);

        const { count: violationsToday } = await supabase
          .from("policy_violations")
          .select("*", { count: 'exact', head: true })
          .eq("business_id", business_id)
          .gte("created_at", today);

        result = {
          success: true,
          engine,
          active_runs: activeRuns || [],
          active_policies: activePolicies || [],
          metrics: {
            decisions_today: decisionsToday || 0,
            violations_today: violationsToday || 0,
          }
        };
        break;
      }

      case 'update_engine': {
        if (!business_id || !engine_update) throw new Error("Business ID and update data required");

        const updateData: Record<string, unknown> = {};
        
        if (engine_update.mode) updateData.mode = engine_update.mode;
        if (typeof engine_update.human_override_active === 'boolean') {
          updateData.human_override_active = engine_update.human_override_active;
          if (engine_update.human_override_active) {
            updateData.override_by = user.id;
            updateData.override_reason = engine_update.override_reason;
            updateData.override_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
          } else {
            updateData.override_by = null;
            updateData.override_reason = null;
            updateData.override_expires_at = null;
          }
        }

        const { data: updated, error: updateError } = await supabase
          .from("executive_decision_engine")
          .update(updateData)
          .eq("business_id", business_id)
          .select()
          .single();

        if (updateError) throw updateError;

        result = { success: true, engine: updated };
        break;
      }

      case 'record_frame': {
        if (!run_id || !frame_data) throw new Error("Run ID and frame data required");

        const { count: fc } = await supabase
          .from("campaign_audit_frames")
          .select("*", { count: 'exact', head: true })
          .eq("run_id", run_id);

        const { data: frame, error: frameError } = await supabase
          .from("campaign_audit_frames")
          .insert({
            run_id,
            frame_number: (fc || 0) + 1,
            frame_type: frame_data.frame_type,
            campaign_state: frame_data.campaign_state,
          })
          .select()
          .single();

        if (frameError) throw frameError;

        result = { success: true, frame };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Executive Decision Engine error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
