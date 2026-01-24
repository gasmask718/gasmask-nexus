import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * OPENING CORRIDOR SERVICE
 * 
 * Enforces the IMMUTABLE opening sequence for all outbound AI calls:
 * 
 * Phase A: Identity & Disclosure (MANDATORY)
 * Phase B: Permission Gate (MANDATORY)
 * Phase C: Single-Sentence Value Proposition (LOCKED)
 * 
 * NO AI speech beyond disclosure is allowed until permission is granted.
 * This is infrastructure, not prompt tuning.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HARD LIMITS - Non-negotiable
const SPEECH_LIMITS = {
  MAX_WORDS_BEFORE_PERMISSION: 45,
  MAX_SENTENCES_BEFORE_PERMISSION: 2,
  MAX_DURATION_MS_BEFORE_PERMISSION: 15000,
  MAX_VALUE_PROP_SENTENCES: 1,
  MAX_VALUE_PROP_WORDS: 25,
  DISCLOSURE_MAX_SECONDS: 5,
};

interface CorridorRequest {
  action: 'initialize' | 'start_phase_a' | 'complete_phase_a' | 
          'start_phase_b' | 'complete_phase_b' | 
          'start_phase_c' | 'complete_phase_c' |
          'check_speech_limit' | 'report_violation' | 'get_state';
  session_id: string;
  campaign_id?: string;
  business_id: string;
  // Phase A data
  disclosure_text?: string;
  disclosure_interrupted?: boolean;
  // Phase B data
  permission_response?: 'permission_granted' | 'permission_denied' | 'uncertain' | 'no_response';
  permission_response_raw?: string;
  // Phase C data
  value_prop_sentence_id?: string;
  value_prop_text?: string;
  // Speech tracking
  words_spoken?: number;
  sentences_spoken?: number;
  duration_ms?: number;
  // Violation
  violation_type?: string;
  violation_details?: string;
}

// Compute SHA-256 hash for disclosure verification
async function computeHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: CorridorRequest = await req.json();
    const { action, session_id, campaign_id, business_id } = body;

    switch (action) {
      case 'initialize': {
        // Create corridor state for new call
        // First, get approved disclosure for this business
        const { data: disclosure } = await supabase
          .from("approved_disclosures")
          .select("*")
          .eq("business_id", business_id)
          .eq("is_active", true)
          .order("version", { ascending: false })
          .limit(1)
          .single();

        if (!disclosure) {
          // Block call - no approved disclosure
          return new Response(
            JSON.stringify({
              success: false,
              error: "No approved disclosure found for business",
              action_required: "block_call"
            }),
            { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Get speech limits (business-specific or default)
        const { data: speechLimits } = await supabase
          .from("speech_limit_config")
          .select("*")
          .or(`business_id.eq.${business_id},business_id.is.null`)
          .order("business_id", { ascending: false, nullsFirst: false })
          .limit(1)
          .single();

        // Create corridor state
        const { data: corridor, error: corridorError } = await supabase
          .from("opening_corridor_state")
          .insert({
            session_id,
            campaign_id,
            business_id,
            disclosure_text_used: disclosure.disclosure_text,
            disclosure_hash_expected: disclosure.disclosure_hash,
            corridor_status: 'pending'
          })
          .select()
          .single();

        if (corridorError) throw corridorError;

        // Update session with corridor reference
        await supabase
          .from("ai_call_sessions")
          .update({ corridor_id: corridor.id })
          .eq("id", session_id);

        return new Response(
          JSON.stringify({
            success: true,
            corridor_id: corridor.id,
            disclosure_text: disclosure.disclosure_text,
            disclosure_hash: disclosure.disclosure_hash,
            speech_limits: speechLimits || SPEECH_LIMITS,
            next_action: "start_phase_a",
            instructions: [
              "1. Speak disclosure VERBATIM",
              "2. Complete within 5 seconds",
              "3. Do NOT add any other words",
              "4. If interrupted, repeat ONCE"
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'start_phase_a': {
        // Mark Phase A started
        await supabase
          .from("opening_corridor_state")
          .update({
            phase_a_started_at: new Date().toISOString(),
            corridor_status: 'phase_a_active',
            updated_at: new Date().toISOString()
          })
          .eq("session_id", session_id);

        return new Response(
          JSON.stringify({
            success: true,
            phase: 'A',
            status: 'active',
            constraints: {
              max_duration_seconds: SPEECH_LIMITS.DISCLOSURE_MAX_SECONDS,
              must_be_verbatim: true,
              max_retry_on_interrupt: 1
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'complete_phase_a': {
        // Verify disclosure was spoken correctly
        const { data: corridor } = await supabase
          .from("opening_corridor_state")
          .select("*")
          .eq("session_id", session_id)
          .single();

        if (!corridor) {
          return new Response(
            JSON.stringify({ success: false, error: "Corridor not found" }),
            { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Verify hash if disclosure text provided
        let hashVerified = false;
        let actualHash = '';
        
        if (body.disclosure_text) {
          actualHash = await computeHash(body.disclosure_text.trim());
          hashVerified = actualHash === corridor.disclosure_hash_expected;
        }

        // Check if interrupted too many times
        const retryCount = (corridor.disclosure_retry_count || 0) + (body.disclosure_interrupted ? 1 : 0);
        
        if (body.disclosure_interrupted && retryCount > 1) {
          // Too many interruptions - terminate
          await supabase
            .from("opening_corridor_state")
            .update({
              corridor_status: 'blocked_disclosure_failure',
              corridor_blocked_reason: 'Disclosure interrupted multiple times',
              disclosure_interrupted: true,
              disclosure_retry_count: retryCount,
              updated_at: new Date().toISOString()
            })
            .eq("session_id", session_id);

          // Log violation
          await supabase.from("behavior_violation_log").insert({
            session_id,
            campaign_id,
            corridor_id: corridor.id,
            behavior_code: 'DISCLOSURE_FAILURE',
            detected_text: 'Multiple interruptions during disclosure',
            action_taken: 'call_terminated',
            call_terminated: true
          });

          return new Response(
            JSON.stringify({
              success: false,
              error: "Disclosure failed - too many interruptions",
              action_required: "terminate_call",
              corridor_status: 'blocked_disclosure_failure'
            }),
            { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // If hash mismatch and not interrupted, this is a violation
        if (!hashVerified && !body.disclosure_interrupted && body.disclosure_text) {
          await supabase
            .from("opening_corridor_state")
            .update({
              corridor_status: 'blocked_hash_mismatch',
              corridor_blocked_reason: 'Disclosure text did not match approved version',
              disclosure_hash_actual: actualHash,
              disclosure_hash_verified: false,
              updated_at: new Date().toISOString()
            })
            .eq("session_id", session_id);

          return new Response(
            JSON.stringify({
              success: false,
              error: "Disclosure hash mismatch - verbatim text required",
              action_required: "terminate_call",
              corridor_status: 'blocked_hash_mismatch'
            }),
            { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Update corridor state
        await supabase
          .from("opening_corridor_state")
          .update({
            phase_a_completed_at: new Date().toISOString(),
            disclosure_hash_verified: hashVerified || body.disclosure_interrupted === false,
            disclosure_hash_actual: actualHash || null,
            disclosure_interrupted: body.disclosure_interrupted || false,
            disclosure_retry_count: retryCount,
            corridor_status: 'phase_a_complete',
            updated_at: new Date().toISOString()
          })
          .eq("session_id", session_id);

        // Log to disclosure log
        await supabase.from("call_disclosure_log").insert({
          session_id,
          campaign_id,
          disclosure_spoken: true,
          disclosure_text_used: body.disclosure_text || corridor.disclosure_text_used,
          disclosure_acknowledged: true,
          disclosure_failed: false
        });

        // Update session
        await supabase
          .from("ai_call_sessions")
          .update({ disclosure_completed: true })
          .eq("id", session_id);

        return new Response(
          JSON.stringify({
            success: true,
            phase: 'A',
            status: 'complete',
            hash_verified: hashVerified,
            next_action: 'start_phase_b',
            instructions: [
              "1. Ask ONE permission question",
              "2. No value proposition yet",
              "3. Classify response as: granted/denied/uncertain"
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'start_phase_b': {
        // Verify Phase A completed
        const { data: corridor } = await supabase
          .from("opening_corridor_state")
          .select("*")
          .eq("session_id", session_id)
          .single();

        if (!corridor || corridor.corridor_status !== 'phase_a_complete') {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Phase A not completed - cannot start Phase B",
              action_required: "complete_phase_a_first"
            }),
            { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        await supabase
          .from("opening_corridor_state")
          .update({
            phase_b_started_at: new Date().toISOString(),
            corridor_status: 'phase_b_active',
            updated_at: new Date().toISOString()
          })
          .eq("session_id", session_id);

        return new Response(
          JSON.stringify({
            success: true,
            phase: 'B',
            status: 'active',
            constraints: {
              question_count: 1,
              no_value_prop: true,
              accept_responses: ['permission_granted', 'permission_denied', 'uncertain', 'no_response']
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'complete_phase_b': {
        const { permission_response, permission_response_raw } = body;

        if (!permission_response) {
          return new Response(
            JSON.stringify({ success: false, error: "permission_response required" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const { data: corridor } = await supabase
          .from("opening_corridor_state")
          .select("*")
          .eq("session_id", session_id)
          .single();

        if (!corridor) {
          return new Response(
            JSON.stringify({ success: false, error: "Corridor not found" }),
            { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Handle different permission responses
        let nextAction = '';
        let corridorStatus = 'phase_b_complete';
        let corridorBlocked = false;
        let blockReason = null;

        switch (permission_response) {
          case 'permission_granted':
            nextAction = 'start_phase_c';
            break;
          case 'permission_denied':
            corridorStatus = 'blocked_permission_denied';
            corridorBlocked = true;
            blockReason = 'Customer declined permission';
            nextAction = 'polite_exit';
            break;
          case 'uncertain':
            nextAction = 'offer_callback_then_exit';
            corridorStatus = 'blocked_permission_denied';
            corridorBlocked = true;
            blockReason = 'Customer response uncertain';
            break;
          case 'no_response':
            corridorStatus = 'terminated_no_response';
            corridorBlocked = true;
            blockReason = 'No response to permission request';
            nextAction = 'terminate_call';
            break;
        }

        await supabase
          .from("opening_corridor_state")
          .update({
            phase_b_completed_at: new Date().toISOString(),
            permission_response,
            permission_response_raw,
            corridor_status: corridorStatus,
            corridor_blocked_reason: blockReason,
            updated_at: new Date().toISOString()
          })
          .eq("session_id", session_id);

        // Update session
        if (permission_response === 'permission_granted') {
          await supabase
            .from("ai_call_sessions")
            .update({
              permission_granted: true,
              permission_granted_at: new Date().toISOString()
            })
            .eq("id", session_id);
        }

        return new Response(
          JSON.stringify({
            success: true,
            phase: 'B',
            status: 'complete',
            permission_granted: permission_response === 'permission_granted',
            corridor_blocked: corridorBlocked,
            block_reason: blockReason,
            next_action: nextAction,
            instructions: permission_response === 'permission_granted' 
              ? ["1. Proceed to Phase C", "2. ONE sentence only", "3. From approved playbook"]
              : ["1. Thank customer for their time", "2. End call politely", "3. Log outcome"]
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'start_phase_c': {
        // Verify permission was granted
        const { data: corridor } = await supabase
          .from("opening_corridor_state")
          .select("*")
          .eq("session_id", session_id)
          .single();

        if (!corridor || corridor.permission_response !== 'permission_granted') {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Permission not granted - cannot start Phase C",
              action_required: "exit_call"
            }),
            { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        await supabase
          .from("opening_corridor_state")
          .update({
            phase_c_started_at: new Date().toISOString(),
            corridor_status: 'phase_c_active',
            updated_at: new Date().toISOString()
          })
          .eq("session_id", session_id);

        return new Response(
          JSON.stringify({
            success: true,
            phase: 'C',
            status: 'active',
            constraints: {
              max_sentences: SPEECH_LIMITS.MAX_VALUE_PROP_SENTENCES,
              max_words: SPEECH_LIMITS.MAX_VALUE_PROP_WORDS,
              no_pricing: true,
              no_urgency: true,
              no_guarantees: true,
              no_comparisons: true,
              must_be_from_playbook: true
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'complete_phase_c': {
        const { value_prop_sentence_id, value_prop_text } = body;

        // Validate value prop
        if (value_prop_text) {
          const wordCount = value_prop_text.trim().split(/\s+/).length;
          if (wordCount > SPEECH_LIMITS.MAX_VALUE_PROP_WORDS) {
            // Violation - too many words
            await supabase.from("behavior_violation_log").insert({
              session_id,
              campaign_id,
              behavior_code: 'EXCEED_SPEECH_LIMIT',
              detected_text: value_prop_text,
              action_taken: 'call_terminated',
              call_terminated: true
            });

            return new Response(
              JSON.stringify({
                success: false,
                error: `Value proposition exceeded word limit (${wordCount}/${SPEECH_LIMITS.MAX_VALUE_PROP_WORDS})`,
                action_required: "terminate_call"
              }),
              { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }
        }

        const { data: corridor } = await supabase
          .from("opening_corridor_state")
          .select("*")
          .eq("session_id", session_id)
          .single();

        // Calculate total corridor time
        const totalDuration = corridor?.phase_a_started_at 
          ? Date.now() - new Date(corridor.phase_a_started_at).getTime()
          : 0;

        await supabase
          .from("opening_corridor_state")
          .update({
            phase_c_completed_at: new Date().toISOString(),
            value_prop_sentence_id,
            value_prop_text,
            value_prop_word_count: value_prop_text?.trim().split(/\s+/).length || 0,
            corridor_status: 'corridor_passed',
            corridor_passed: true,
            total_corridor_duration_ms: totalDuration,
            updated_at: new Date().toISOString()
          })
          .eq("session_id", session_id);

        // Update session
        await supabase
          .from("ai_call_sessions")
          .update({ corridor_passed: true })
          .eq("id", session_id);

        return new Response(
          JSON.stringify({
            success: true,
            phase: 'C',
            status: 'complete',
            corridor_passed: true,
            total_duration_ms: totalDuration,
            message: "Opening corridor passed - dynamic conversation now allowed",
            next_action: "continue_with_playbook"
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'check_speech_limit': {
        const { words_spoken = 0, sentences_spoken = 0, duration_ms = 0 } = body;

        // Check if permission has been granted
        const { data: corridor } = await supabase
          .from("opening_corridor_state")
          .select("permission_response, corridor_status")
          .eq("session_id", session_id)
          .single();

        const permissionGranted = corridor?.permission_response === 'permission_granted';

        // Only enforce limits before permission
        if (!permissionGranted) {
          const violations = [];
          
          if (words_spoken > SPEECH_LIMITS.MAX_WORDS_BEFORE_PERMISSION) {
            violations.push(`words_exceeded: ${words_spoken}/${SPEECH_LIMITS.MAX_WORDS_BEFORE_PERMISSION}`);
          }
          if (sentences_spoken > SPEECH_LIMITS.MAX_SENTENCES_BEFORE_PERMISSION) {
            violations.push(`sentences_exceeded: ${sentences_spoken}/${SPEECH_LIMITS.MAX_SENTENCES_BEFORE_PERMISSION}`);
          }
          if (duration_ms > SPEECH_LIMITS.MAX_DURATION_MS_BEFORE_PERMISSION) {
            violations.push(`duration_exceeded: ${duration_ms}/${SPEECH_LIMITS.MAX_DURATION_MS_BEFORE_PERMISSION}ms`);
          }

          if (violations.length > 0) {
            // Update corridor state
            await supabase
              .from("opening_corridor_state")
              .update({
                pre_permission_words: words_spoken,
                pre_permission_sentences: sentences_spoken,
                pre_permission_duration_ms: duration_ms,
                speech_limit_exceeded: true,
                speech_limit_violation_type: violations.join(', '),
                corridor_status: 'blocked_speech_limit',
                corridor_blocked_reason: 'Pre-permission speech limit exceeded',
                updated_at: new Date().toISOString()
              })
              .eq("session_id", session_id);

            // Log violation
            await supabase.from("behavior_violation_log").insert({
              session_id,
              campaign_id,
              behavior_code: 'EXCEED_SPEECH_LIMIT',
              detected_text: violations.join(', '),
              action_taken: 'call_terminated',
              call_terminated: true
            });

            return new Response(
              JSON.stringify({
                success: false,
                limit_exceeded: true,
                violations,
                action_required: "terminate_call",
                message: "Pre-permission speech limit exceeded - call must terminate"
              }),
              { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }
        }

        // Update tracking
        await supabase
          .from("opening_corridor_state")
          .update({
            pre_permission_words: words_spoken,
            pre_permission_sentences: sentences_spoken,
            pre_permission_duration_ms: duration_ms,
            updated_at: new Date().toISOString()
          })
          .eq("session_id", session_id);

        return new Response(
          JSON.stringify({
            success: true,
            within_limits: true,
            current: { words_spoken, sentences_spoken, duration_ms },
            limits: {
              max_words: SPEECH_LIMITS.MAX_WORDS_BEFORE_PERMISSION,
              max_sentences: SPEECH_LIMITS.MAX_SENTENCES_BEFORE_PERMISSION,
              max_duration_ms: SPEECH_LIMITS.MAX_DURATION_MS_BEFORE_PERMISSION
            },
            remaining: {
              words: SPEECH_LIMITS.MAX_WORDS_BEFORE_PERMISSION - words_spoken,
              sentences: SPEECH_LIMITS.MAX_SENTENCES_BEFORE_PERMISSION - sentences_spoken,
              duration_ms: SPEECH_LIMITS.MAX_DURATION_MS_BEFORE_PERMISSION - duration_ms
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'report_violation': {
        const { violation_type, violation_details } = body;

        // Log violation
        await supabase.from("behavior_violation_log").insert({
          session_id,
          campaign_id,
          behavior_code: violation_type,
          detected_text: violation_details,
          action_taken: 'call_terminated',
          call_terminated: true
        });

        // Update corridor
        await supabase
          .from("opening_corridor_state")
          .update({
            corridor_status: 'terminated_violation',
            corridor_blocked_reason: `${violation_type}: ${violation_details}`,
            updated_at: new Date().toISOString()
          })
          .eq("session_id", session_id);

        return new Response(
          JSON.stringify({
            success: true,
            violation_logged: true,
            action_required: "terminate_call"
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'get_state': {
        const { data: corridor } = await supabase
          .from("opening_corridor_state")
          .select("*")
          .eq("session_id", session_id)
          .single();

        return new Response(
          JSON.stringify({ success: true, corridor }),
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
    console.error("❌ Error in opening-corridor:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
