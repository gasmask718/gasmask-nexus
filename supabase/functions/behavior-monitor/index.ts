import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * BEHAVIOR MONITOR
 * 
 * Real-time enforcement of forbidden AI behaviors.
 * Any violation results in immediate call termination.
 * 
 * Forbidden behaviors:
 * - Negotiate pricing
 * - Promise outcomes
 * - Create urgency
 * - Compare competitors
 * - Continue after opt-out
 * - Speak without disclosure
 * - Ignore kill switch
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BehaviorCheckRequest {
  action: 'check_text' | 'report_violation' | 'get_violations' | 'get_forbidden_list';
  session_id?: string;
  campaign_id?: string;
  corridor_id?: string;
  // Check data
  ai_text?: string;
  context?: 'pre_disclosure' | 'pre_permission' | 'post_permission' | 'dynamic';
  // Report data
  behavior_code?: string;
  detected_text?: string;
  confidence?: number;
}

// Pattern matching for forbidden behaviors
const BEHAVIOR_PATTERNS: Record<string, RegExp[]> = {
  'NEGOTIATE_PRICING': [
    /i can offer/i,
    /special price/i,
    /discount for you/i,
    /lower the price/i,
    /make a deal/i,
    /\$\d+/,
    /how about \d+/i,
    /we can do/i
  ],
  'PROMISE_OUTCOMES': [
    /guarantee/i,
    /promise you/i,
    /definitely will/i,
    /for sure/i,
    /100%/,
    /certain to/i,
    /assured/i,
    /without fail/i
  ],
  'CREATE_URGENCY': [
    /limited time/i,
    /act now/i,
    /today only/i,
    /expires/i,
    /running out/i,
    /last chance/i,
    /hurry/i,
    /before it's too late/i,
    /while supplies last/i,
    /don't miss/i
  ],
  'COMPARE_COMPETITORS': [
    /better than/i,
    /unlike them/i,
    /competitor/i,
    /other companies/i,
    /they don'?t/i,
    /we beat/i,
    /compared to others/i,
    /superior to/i
  ]
};

function checkForViolations(text: string): Array<{ code: string; match: string; confidence: number }> {
  const violations: Array<{ code: string; match: string; confidence: number }> = [];
  
  for (const [code, patterns] of Object.entries(BEHAVIOR_PATTERNS)) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        violations.push({
          code,
          match: match[0],
          confidence: 0.9 // High confidence for pattern match
        });
        break; // One violation per code is enough
      }
    }
  }
  
  return violations;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: BehaviorCheckRequest = await req.json();
    const { action, session_id, campaign_id, corridor_id } = body;

    switch (action) {
      case 'check_text': {
        const { ai_text, context } = body;

        if (!ai_text) {
          return new Response(
            JSON.stringify({ success: false, error: "ai_text required" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Check for pattern violations
        const patternViolations = checkForViolations(ai_text);

        // Context-specific checks
        const contextViolations: Array<{ code: string; reason: string }> = [];

        if (context === 'pre_disclosure') {
          // ANY speech before disclosure is a violation (except disclosure itself)
          // This would be checked by the corridor service
          contextViolations.push({
            code: 'SPEAK_WITHOUT_DISCLOSURE',
            reason: 'AI spoke before disclosure was completed'
          });
        }

        if (context === 'pre_permission') {
          // Check for value proposition elements before permission
          const valuePropIndicators = [
            /we offer/i,
            /our product/i,
            /benefits include/i,
            /you can get/i,
            /special opportunity/i
          ];
          
          for (const pattern of valuePropIndicators) {
            if (pattern.test(ai_text)) {
              contextViolations.push({
                code: 'VALUE_PROP_BEFORE_PERMISSION',
                reason: 'Value proposition detected before permission granted'
              });
              break;
            }
          }
        }

        const allViolations = [
          ...patternViolations.map(v => ({
            code: v.code,
            detected_text: v.match,
            confidence: v.confidence,
            source: 'pattern_match'
          })),
          ...contextViolations.map(v => ({
            code: v.code,
            detected_text: v.reason,
            confidence: 1.0,
            source: 'context_check'
          }))
        ];

        if (allViolations.length > 0) {
          // Get behavior severity
          const { data: behaviors } = await supabase
            .from("forbidden_ai_behaviors")
            .select("behavior_code, severity, auto_terminate, trigger_kill_switch")
            .in("behavior_code", allViolations.map(v => v.code));

          const behaviorMap = new Map(behaviors?.map(b => [b.behavior_code, b]) || []);
          
          // Check if any require termination
          const mustTerminate = allViolations.some(v => {
            const behavior = behaviorMap.get(v.code);
            return behavior?.auto_terminate;
          });

          const mustTriggerKillSwitch = allViolations.some(v => {
            const behavior = behaviorMap.get(v.code);
            return behavior?.trigger_kill_switch;
          });

          // Log violations
          if (session_id) {
            for (const violation of allViolations) {
              await supabase.from("behavior_violation_log").insert({
                session_id,
                campaign_id,
                corridor_id,
                behavior_code: violation.code,
                detected_text: violation.detected_text,
                detection_confidence: violation.confidence,
                action_taken: mustTerminate ? 'call_terminated' : 'warning',
                call_terminated: mustTerminate,
                kill_switch_triggered: mustTriggerKillSwitch
              });
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              violations_found: true,
              violations: allViolations,
              must_terminate: mustTerminate,
              trigger_kill_switch: mustTriggerKillSwitch,
              action_required: mustTerminate ? "terminate_call" : "warning"
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            violations_found: false,
            text_compliant: true
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'report_violation': {
        const { behavior_code, detected_text, confidence } = body;

        if (!session_id || !behavior_code) {
          return new Response(
            JSON.stringify({ success: false, error: "session_id and behavior_code required" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Get behavior config
        const { data: behavior } = await supabase
          .from("forbidden_ai_behaviors")
          .select("*")
          .eq("behavior_code", behavior_code)
          .single();

        const mustTerminate = behavior?.auto_terminate ?? true;
        const mustTriggerKillSwitch = behavior?.trigger_kill_switch ?? false;

        // Log violation
        const { data: violation, error } = await supabase
          .from("behavior_violation_log")
          .insert({
            session_id,
            campaign_id,
            corridor_id,
            behavior_code,
            detected_text,
            detection_confidence: confidence || 1.0,
            action_taken: mustTerminate ? 'call_terminated' : 'warning',
            call_terminated: mustTerminate,
            kill_switch_triggered: mustTriggerKillSwitch
          })
          .select()
          .single();

        if (error) throw error;

        // Update session if terminating
        if (mustTerminate) {
          await supabase
            .from("ai_call_sessions")
            .update({
              status: 'terminated',
              ai_notes: `Terminated for violation: ${behavior_code}`
            })
            .eq("id", session_id);
        }

        return new Response(
          JSON.stringify({
            success: true,
            violation_id: violation.id,
            call_terminated: mustTerminate,
            kill_switch_triggered: mustTriggerKillSwitch
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'get_violations': {
        // Get violations for a session
        const { data: violations } = await supabase
          .from("behavior_violation_log")
          .select("*")
          .eq("session_id", session_id)
          .order("created_at", { ascending: false });

        return new Response(
          JSON.stringify({ success: true, violations: violations || [] }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'get_forbidden_list': {
        // Get all forbidden behaviors
        const { data: behaviors } = await supabase
          .from("forbidden_ai_behaviors")
          .select("*")
          .eq("is_active", true)
          .order("severity", { ascending: false });

        return new Response(
          JSON.stringify({ success: true, forbidden_behaviors: behaviors || [] }),
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
    console.error("❌ Error in behavior-monitor:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
