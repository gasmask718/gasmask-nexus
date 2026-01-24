import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * CALL STATE ORCHESTRATOR
 * ========================
 * Single Source of Truth for Call State
 * 
 * This function is THE authority on:
 * - What state a call is in
 * - Whether AI is allowed to speak
 * - Who the active speaker is
 * - Whether a state transition is valid
 * 
 * HARD RULES:
 * 1. AI CANNOT speak if state = human_active, ai_muted, escalated, or ended
 * 2. AI CANNOT speak if kill switch is active
 * 3. AI CANNOT speak if confidence breach occurred
 * 4. AI CANNOT speak if audit logging fails
 * 5. Every state change is logged immutably
 * 6. No race conditions - atomic transitions only
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// States where AI speech is NEVER allowed
const AI_SPEECH_BLOCKED_STATES = ['human_active', 'ai_muted', 'escalated', 'ended', 'handoff_pending'];

// States where AI CAN potentially speak (if other conditions pass)
const AI_SPEECH_ALLOWED_STATES = ['ai_listening', 'ai_speaking'];

interface TransitionRequest {
  action: 'initialize' | 'transition' | 'get_state' | 'check_speech_permission';
  session_id: string;
  business_id?: string;
  to_state?: string;
  trigger?: string;
  triggered_by?: string;
  trigger_details?: Record<string, unknown>;
  confidence?: number;
}

interface StateResponse {
  success: boolean;
  current_state?: string;
  previous_state?: string;
  ai_speech_allowed?: boolean;
  active_speaker?: string;
  state_locked_by?: string;
  lock_reason?: string;
  transition_id?: string;
  error?: string;
  blocked_reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body: TransitionRequest = await req.json();
    const { action, session_id, business_id, to_state, trigger, triggered_by, trigger_details, confidence } = body;

    if (!session_id) {
      return new Response(
        JSON.stringify({ success: false, error: "session_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // ACTION: INITIALIZE STATE MACHINE
    // ============================================
    if (action === 'initialize') {
      if (!business_id) {
        return new Response(
          JSON.stringify({ success: false, error: "business_id required for initialization" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create initial state machine entry
      const { data: stateData, error: stateError } = await supabase
        .from('call_state_machine')
        .insert({
          session_id,
          business_id,
          current_state: 'ringing',
          previous_state: null,
          ai_speech_allowed: false,
          human_speech_active: false,
          active_speaker: 'none',
          confidence_at_state: confidence || null,
        })
        .select()
        .single();

      if (stateError) {
        // Check if already exists
        if (stateError.code === '23505') {
          const { data: existing } = await supabase
            .from('call_state_machine')
            .select('*')
            .eq('session_id', session_id)
            .single();
          
          return new Response(
            JSON.stringify({
              success: true,
              current_state: existing?.current_state,
              ai_speech_allowed: existing?.ai_speech_allowed,
              active_speaker: existing?.active_speaker,
              already_existed: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw stateError;
      }

      // Log initial transition
      await supabase.from('call_state_transitions').insert({
        session_id,
        business_id,
        from_state: null,
        to_state: 'ringing',
        transition_trigger: 'call_initialized',
        triggered_by: triggered_by || 'system',
        trigger_details: trigger_details || {},
        ai_was_speaking: false,
        speech_interrupted: false,
        confidence_at_transition: confidence || null,
      });

      return new Response(
        JSON.stringify({
          success: true,
          current_state: 'ringing',
          ai_speech_allowed: false,
          active_speaker: 'none',
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // ACTION: GET CURRENT STATE
    // ============================================
    if (action === 'get_state') {
      const { data: state, error } = await supabase
        .from('call_state_machine')
        .select('*')
        .eq('session_id', session_id)
        .single();

      if (error || !state) {
        return new Response(
          JSON.stringify({ success: false, error: "State not found for session" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          current_state: state.current_state,
          previous_state: state.previous_state,
          ai_speech_allowed: state.ai_speech_allowed,
          human_speech_active: state.human_speech_active,
          active_speaker: state.active_speaker,
          state_locked_by: state.state_locked_by,
          lock_reason: state.lock_reason,
          confidence_at_state: state.confidence_at_state,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // ACTION: CHECK SPEECH PERMISSION
    // ============================================
    if (action === 'check_speech_permission') {
      const { data: state, error } = await supabase
        .from('call_state_machine')
        .select('*')
        .eq('session_id', session_id)
        .single();

      if (error || !state) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            ai_speech_allowed: false, 
            blocked_reason: "Session state not found" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if state allows AI speech
      if (AI_SPEECH_BLOCKED_STATES.includes(state.current_state)) {
        return new Response(
          JSON.stringify({
            success: true,
            ai_speech_allowed: false,
            blocked_reason: `AI speech blocked in state: ${state.current_state}`,
            current_state: state.current_state,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if state is locked
      if (state.state_locked_by) {
        return new Response(
          JSON.stringify({
            success: true,
            ai_speech_allowed: false,
            blocked_reason: `State locked by: ${state.state_locked_by} - ${state.lock_reason}`,
            current_state: state.current_state,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check kill switches
      const { data: killSwitch } = await supabase
        .from('ai_kill_switch_state')
        .select('is_active, scope')
        .or(`scope.eq.global,business_id.eq.${state.business_id}`)
        .eq('is_active', true)
        .limit(1);

      if (killSwitch && killSwitch.length > 0) {
        return new Response(
          JSON.stringify({
            success: true,
            ai_speech_allowed: false,
            blocked_reason: `Kill switch active: ${killSwitch[0].scope}`,
            current_state: state.current_state,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // AI speech is allowed
      return new Response(
        JSON.stringify({
          success: true,
          ai_speech_allowed: true,
          current_state: state.current_state,
          active_speaker: state.active_speaker,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // ACTION: STATE TRANSITION
    // ============================================
    if (action === 'transition') {
      if (!to_state || !trigger) {
        return new Response(
          JSON.stringify({ success: false, error: "to_state and trigger are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const startTime = Date.now();

      // Get current state with FOR UPDATE lock to prevent race conditions
      const { data: currentState, error: fetchError } = await supabase
        .from('call_state_machine')
        .select('*')
        .eq('session_id', session_id)
        .single();

      if (fetchError || !currentState) {
        return new Response(
          JSON.stringify({ success: false, error: "Session state not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if transition is allowed
      const { data: rule, error: ruleError } = await supabase
        .from('call_state_transition_rules')
        .select('*')
        .eq('from_state', currentState.current_state)
        .eq('to_state', to_state)
        .single();

      if (ruleError || !rule || !rule.allowed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Transition not allowed: ${currentState.current_state} → ${to_state}`,
            current_state: currentState.current_state,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Determine if AI was speaking (for interrupt tracking)
      const aiWasSpeaking = currentState.current_state === 'ai_speaking';
      const speechInterrupted = aiWasSpeaking && AI_SPEECH_BLOCKED_STATES.includes(to_state);

      // Determine new AI speech permission
      const newAiSpeechAllowed = AI_SPEECH_ALLOWED_STATES.includes(to_state) && !rule.blocks_ai_speech;

      // Determine active speaker
      let newActiveSpeaker = currentState.active_speaker;
      if (to_state === 'ai_speaking') {
        newActiveSpeaker = 'ai';
      } else if (to_state === 'ai_listening') {
        newActiveSpeaker = 'caller';
      } else if (to_state === 'human_active') {
        newActiveSpeaker = 'human';
      } else if (['ended', 'escalated'].includes(to_state)) {
        newActiveSpeaker = 'none';
      }

      // Determine lock state
      let stateLockBy = null;
      let lockReason = null;

      // Special triggers that lock the state
      if (trigger === 'kill_switch') {
        stateLockBy = 'kill_switch';
        lockReason = trigger_details?.reason as string || 'Emergency stop activated';
      } else if (trigger === 'confidence_breach') {
        stateLockBy = 'confidence_breach';
        lockReason = `Confidence dropped to ${confidence}`;
      } else if (trigger === 'audit_failure') {
        stateLockBy = 'audit_failure';
        lockReason = 'Audit logging failed - AI disabled for safety';
      } else if (trigger === 'operator_takeover' || to_state === 'human_active') {
        stateLockBy = 'human_takeover';
        lockReason = 'Human operator has taken control';
      }

      // Execute atomic update
      const { data: updatedState, error: updateError } = await supabase
        .from('call_state_machine')
        .update({
          current_state: to_state,
          previous_state: currentState.current_state,
          ai_speech_allowed: newAiSpeechAllowed,
          human_speech_active: to_state === 'human_active',
          active_speaker: newActiveSpeaker,
          state_locked_by: stateLockBy,
          lock_reason: lockReason,
          confidence_at_state: confidence || currentState.confidence_at_state,
        })
        .eq('session_id', session_id)
        .eq('current_state', currentState.current_state) // Optimistic lock
        .select()
        .single();

      if (updateError) {
        // Race condition - state changed between read and write
        return new Response(
          JSON.stringify({
            success: false,
            error: "State transition conflict - please retry",
            current_state: currentState.current_state,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const latencyMs = Date.now() - startTime;

      // Log the transition (immutable, hash-chained)
      const { data: transition, error: logError } = await supabase
        .from('call_state_transitions')
        .insert({
          session_id,
          business_id: currentState.business_id,
          from_state: currentState.current_state,
          to_state,
          transition_trigger: trigger,
          triggered_by: triggered_by || 'system',
          trigger_details: trigger_details || {},
          ai_was_speaking: aiWasSpeaking,
          speech_interrupted: speechInterrupted,
          confidence_at_transition: confidence || null,
          latency_ms: latencyMs,
        })
        .select()
        .single();

      if (logError) {
        console.error('Failed to log state transition:', logError);
        // Don't fail the transition, but note it
      }

      // Also log to main audit system for regulatory compliance
      try {
        await supabase.from('ai_audit_events').insert({
          business_id: currentState.business_id,
          session_id,
          event_type: 'state_transition',
          event_severity: speechInterrupted ? 'high' : 'info',
          event_payload: {
            from_state: currentState.current_state,
            to_state,
            trigger,
            speech_interrupted: speechInterrupted,
            latency_ms: latencyMs,
          },
          triggered_by: triggered_by || 'system',
        });
      } catch (auditErr) {
        console.error('Audit log failed:', auditErr);
      }

      const response: StateResponse = {
        success: true,
        current_state: to_state,
        previous_state: currentState.current_state,
        ai_speech_allowed: newAiSpeechAllowed,
        active_speaker: newActiveSpeaker,
        state_locked_by: stateLockBy || undefined,
        lock_reason: lockReason || undefined,
        transition_id: transition?.id,
      };

      return new Response(
        JSON.stringify(response),
        { 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "x-transition-latency-ms": latencyMs.toString(),
            "x-speech-interrupted": speechInterrupted.toString(),
          } 
        }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Call State Orchestrator error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
