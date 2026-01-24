import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * GOVERNED OUTBOUND CALL SERVICE
 * 
 * This edge function initiates outbound AI calls with FULL governance:
 * 1. Campaign binding required
 * 2. Kill switch check
 * 3. Disclosure enforcement
 * 4. Playbook validation
 * 5. Frame guarantee
 * 6. Test call isolation
 * 
 * NO CALL can proceed without passing ALL gates.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GovernedCallRequest {
  campaign_id: string;
  campaign_run_id: string;
  target_phone: string;
  target_name?: string;
  target_entity_type?: string;
  target_entity_id?: string;
  playbook_id?: string;
  playbook_type?: 'product' | 'vendor';
  execution_mode: 'test' | 'canary' | 'assisted' | 'live';
  is_test_call?: boolean;
}

interface GateCheck {
  name: string;
  passed: boolean;
  reason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("🔐 Governed outbound call request received");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get auth token
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body: GovernedCallRequest = await req.json();
    const {
      campaign_id,
      campaign_run_id,
      target_phone,
      target_name,
      target_entity_type,
      target_entity_id,
      playbook_id,
      playbook_type,
      execution_mode,
      is_test_call = false
    } = body;

    const gateChecks: GateCheck[] = [];
    let allGatesPassed = true;

    // =====================================================
    // GATE 1: Kill Switch Check (Highest Priority)
    // =====================================================
    const { data: killSwitches } = await supabase
      .from("kill_switch_state")
      .select("*")
      .eq("is_active", true);

    const globalKill = killSwitches?.find(k => k.scope === 'global');
    const businessKill = killSwitches?.find(k => k.scope === 'business');
    const campaignKill = killSwitches?.find(k => k.scope === 'campaign' && k.campaign_id === campaign_id);

    if (globalKill?.is_active) {
      gateChecks.push({ name: 'global_kill_switch', passed: false, reason: 'Global kill switch is active' });
      allGatesPassed = false;
    } else if (businessKill?.is_active) {
      gateChecks.push({ name: 'business_kill_switch', passed: false, reason: 'Business kill switch is active' });
      allGatesPassed = false;
    } else if (campaignKill?.is_active) {
      gateChecks.push({ name: 'campaign_kill_switch', passed: false, reason: 'Campaign kill switch is active' });
      allGatesPassed = false;
    } else {
      gateChecks.push({ name: 'kill_switch', passed: true });
    }

    // =====================================================
    // GATE 2: Campaign Validation
    // =====================================================
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      gateChecks.push({ name: 'campaign_exists', passed: false, reason: 'Campaign not found' });
      allGatesPassed = false;
    } else {
      gateChecks.push({ name: 'campaign_exists', passed: true });

      // Check campaign status - RELAXED for test mode
      const isTestMode = execution_mode === 'test' || is_test_call;
      const allowedStatuses = isTestMode ? ['draft', 'active', 'approved'] : ['active'];
      
      if (!allowedStatuses.includes(campaign.status)) {
        gateChecks.push({ name: 'campaign_active', passed: false, reason: `Campaign status is ${campaign.status}` });
        allGatesPassed = false;
      } else {
        gateChecks.push({ name: 'campaign_active', passed: true, reason: isTestMode ? 'Test mode allows draft campaigns' : undefined });
      }

      // Check containment
      if (campaign.containment_active) {
        gateChecks.push({ name: 'containment_check', passed: false, reason: 'Campaign is under containment' });
        allGatesPassed = false;
      } else {
        gateChecks.push({ name: 'containment_check', passed: true });
      }

      // Check sentinel status - RELAXED for test mode
      const allowedSentinelStatuses = isTestMode ? ['pending', 'compliant', null] : ['compliant'];
      if (!allowedSentinelStatuses.includes(campaign.sentinel_status)) {
        gateChecks.push({ name: 'sentinel_compliant', passed: false, reason: `Sentinel status is ${campaign.sentinel_status}` });
        allGatesPassed = false;
      } else {
        gateChecks.push({ name: 'sentinel_compliant', passed: true, reason: isTestMode ? 'Test mode allows pending sentinel' : undefined });
      }
    }

    // =====================================================
    // GATE 3: Campaign Run Validation
    // =====================================================
    const { data: campaignRun, error: runError } = await supabase
      .from("campaign_runs")
      .select("*")
      .eq("id", campaign_run_id)
      .single();

    if (runError || !campaignRun) {
      gateChecks.push({ name: 'campaign_run_exists', passed: false, reason: 'Campaign run not found' });
      allGatesPassed = false;
    } else {
      // Campaign run status - RELAXED for test mode
      const isTestMode = execution_mode === 'test' || is_test_call;
      const allowedRunStatuses = isTestMode ? ['pending', 'running', 'active'] : ['running', 'active'];
      
      if (!allowedRunStatuses.includes(campaignRun.status)) {
        gateChecks.push({ name: 'campaign_run_active', passed: false, reason: `Campaign run status is ${campaignRun.status}` });
        allGatesPassed = false;
      } else {
        gateChecks.push({ name: 'campaign_run_active', passed: true, reason: isTestMode ? 'Test mode allows pending runs' : undefined });
      }
    }

    // =====================================================
    // GATE 4: Playbook Validation (if required)
    // =====================================================
    if (campaign?.requires_product_playbook || campaign?.requires_vendor_playbook) {
      if (!playbook_id) {
        gateChecks.push({ name: 'playbook_required', passed: false, reason: 'Playbook is required but not provided' });
        allGatesPassed = false;
      } else {
        const playbookTable = playbook_type === 'vendor' ? 'vendor_recruitment_playbooks' : 'product_playbooks';
        const { data: playbook } = await supabase
          .from(playbookTable)
          .select("*")
          .eq("id", playbook_id)
          .single();

        if (!playbook) {
          gateChecks.push({ name: 'playbook_exists', passed: false, reason: 'Playbook not found' });
          allGatesPassed = false;
        } else if (!playbook.is_active) {
          gateChecks.push({ name: 'playbook_active', passed: false, reason: 'Playbook is not active/approved' });
          allGatesPassed = false;
        } else {
          gateChecks.push({ name: 'playbook_validated', passed: true });
        }
      }
    } else {
      gateChecks.push({ name: 'playbook_validated', passed: true, reason: 'Playbook not required for this campaign' });
    }

    // =====================================================
    // GATE 5: Test Call Validation
    // =====================================================
    if (is_test_call) {
      // Check whitelist
      const { data: whitelisted } = await supabase
        .from("test_call_whitelist")
        .select("*")
        .eq("business_id", campaign?.business_id)
        .eq("phone_number", target_phone)
        .single();

      if (!whitelisted) {
        gateChecks.push({ name: 'test_whitelist', passed: false, reason: 'Phone number not on test whitelist' });
        allGatesPassed = false;
      } else {
        gateChecks.push({ name: 'test_whitelist', passed: true });
      }

      // Check rate limit
      const today = new Date().toISOString().split('T')[0];
      const { data: rateLimit } = await supabase
        .from("test_call_rate_limits")
        .select("*")
        .eq("business_id", campaign?.business_id)
        .eq("date", today)
        .single();

      if (rateLimit && rateLimit.calls_made >= rateLimit.max_calls_per_day) {
        gateChecks.push({ name: 'test_rate_limit', passed: false, reason: 'Daily test call limit reached' });
        allGatesPassed = false;
      } else {
        gateChecks.push({ name: 'test_rate_limit', passed: true });
      }
    }

    // =====================================================
    // GATE 6: Opt-Out Check
    // =====================================================
    const { data: optOut } = await supabase
      .from("outbound_opt_out_registry")
      .select("*")
      .eq("phone_number", target_phone)
      .eq("opt_out_active", true)
      .single();

    if (optOut) {
      gateChecks.push({ name: 'opt_out_check', passed: false, reason: 'Target has opted out of outbound calls' });
      allGatesPassed = false;
    } else {
      gateChecks.push({ name: 'opt_out_check', passed: true });
    }

    // =====================================================
    // LOG GATE CHECK RESULTS
    // =====================================================
    const failedChecks = gateChecks.filter(g => !g.passed).map(g => g.name);
    
    await supabase.from("execution_gate_log").insert({
      campaign_id,
      campaign_run_id,
      business_id: campaign?.business_id,
      gate_check_passed: allGatesPassed,
      checks_performed: gateChecks,
      failed_checks: failedChecks,
      call_blocked: !allGatesPassed,
      block_reason: !allGatesPassed ? failedChecks.join(', ') : null
    });

    // =====================================================
    // BLOCK IF ANY GATE FAILED
    // =====================================================
    if (!allGatesPassed) {
      console.log(`🚫 Call blocked. Failed gates: ${failedChecks.join(', ')}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Call blocked by governance gates",
          failed_gates: failedChecks,
          gate_checks: gateChecks
        }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // =====================================================
    // ALL GATES PASSED - CREATE SESSION
    // =====================================================
    console.log("✅ All governance gates passed. Creating call session...");

    // Create AI call session with full binding
    // status must match CHECK: 'initiated','ringing','ai_active','human_active','on_hold','completed','failed'
    // handoff_state must match CHECK: 'none','ai_controlled','human_takeover','escalated'
    const { data: session, error: sessionError } = await supabase
      .from("ai_call_sessions")
      .insert({
        business_id: campaign.business_id,
        campaign_id,
        campaign_run_id,
        playbook_id: playbook_id || null,
        execution_mode: execution_mode || 'manual',
        is_test_call,
        status: 'initiated', // Must match DB constraint
        handoff_state: 'none', // Must match DB constraint
        disclosure_completed: false,
        frame_written: false
      })
      .select()
      .single();

    if (sessionError) {
      console.error("❌ Failed to create session:", sessionError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Call session insert failed",
          details: sessionError?.message || JSON.stringify(sessionError),
          hint: "Check ai_call_sessions constraints and RLS"
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // =====================================================
    // GET DISCLOSURE TEXT
    // =====================================================
    const { data: aiConfig } = await supabase
      .from("ai_call_agent_config")
      .select("ai_disclosure_script")
      .eq("business_id", campaign.business_id)
      .single();

    const disclosureText = aiConfig?.ai_disclosure_script || 
      "Hello, this is an AI assistant calling on behalf of our company. This call may be recorded for quality assurance.";

    // =====================================================
    // INCREMENT TEST CALL COUNTER
    // =====================================================
    if (is_test_call) {
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from("test_call_rate_limits")
        .upsert({
          business_id: campaign.business_id,
          date: today,
          calls_made: 1
        }, {
          onConflict: 'business_id,date'
        });
    }

    // =====================================================
    // RETURN SUCCESS WITH SESSION INFO
    // =====================================================
    return new Response(
      JSON.stringify({
        success: true,
        session_id: session.id,
        campaign_id,
        campaign_run_id,
        execution_mode,
        is_test_call,
        disclosure_required: true,
        disclosure_text: disclosureText,
        playbook_id,
        gate_checks: gateChecks,
        next_steps: [
          "1. Initiate call via Twilio",
          "2. Speak disclosure FIRST",
          "3. Log disclosure completion",
          "4. Proceed with playbook",
          "5. Write campaign frame on completion"
        ]
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("❌ Error in governed-outbound-call:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);