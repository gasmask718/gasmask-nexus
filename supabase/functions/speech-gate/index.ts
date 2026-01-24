import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * SPEECH GATE SERVICE
 * 
 * This is the HARD GATE that controls AI speech output.
 * Before ANY audio output, this gate MUST be checked.
 * 
 * If corridor_passed !== true AND phase ≠ expected → MUTE AI
 * 
 * This prevents:
 * - Race conditions
 * - Streaming speech leaks
 * - "One extra sentence" bugs
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SpeechGateRequest {
  action: 'initialize' | 'check_permission' | 'log_speech' | 'terminate';
  session_id: string;
  // For speech logging
  words_spoken?: number;
  sentences_spoken?: number;
  duration_ms?: number;
  utterance_text?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: SpeechGateRequest = await req.json();
    const { action, session_id } = body;

    switch (action) {
      case 'initialize': {
        // Create speech gate state for new call
        const { data: gate, error } = await supabase
          .from("speech_gate_state")
          .upsert({
            session_id,
            speech_allowed: false,
            current_phase: 'pre_disclosure',
            words_spoken: 0,
            sentences_spoken: 0,
            duration_ms: 0
          }, { onConflict: 'session_id' })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({
            success: true,
            gate_id: gate.id,
            speech_allowed: false,
            current_phase: 'pre_disclosure',
            message: "Speech gate initialized - AI muted until disclosure phase"
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'check_permission': {
        // THIS IS THE CRITICAL CHECK - called before EVERY utterance
        
        // Get corridor state
        const { data: corridor } = await supabase
          .from("opening_corridor_state")
          .select("*")
          .eq("session_id", session_id)
          .single();

        // Get speech gate state
        const { data: gate } = await supabase
          .from("speech_gate_state")
          .select("*")
          .eq("session_id", session_id)
          .single();

        // Get kill switch state
        const { data: killSwitch } = await supabase
          .from("kill_switch_state")
          .select("is_active")
          .eq("scope", "global")
          .single();

        // RULE 1: Kill switch ALWAYS wins
        if (killSwitch?.is_active) {
          return new Response(
            JSON.stringify({
              speech_allowed: false,
              reason: "kill_switch_active",
              action_required: "terminate_immediately"
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // RULE 2: No corridor = No speech
        if (!corridor) {
          return new Response(
            JSON.stringify({
              speech_allowed: false,
              reason: "corridor_not_initialized",
              action_required: "initialize_corridor"
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // RULE 3: Blocked corridor = No speech
        if (corridor.corridor_status?.startsWith('blocked') || corridor.corridor_status === 'terminated') {
          return new Response(
            JSON.stringify({
              speech_allowed: false,
              reason: "corridor_blocked",
              corridor_status: corridor.corridor_status,
              block_reason: corridor.corridor_blocked_reason,
              action_required: "terminate_call"
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // RULE 4: Check speech limits
        if (gate && !corridor.permission_response) {
          // Before permission, strict limits apply
          if (gate.words_spoken >= gate.max_words) {
            await supabase
              .from("speech_gate_state")
              .update({ 
                limit_exceeded: true, 
                exceeded_at: new Date().toISOString(),
                termination_reason: 'word_limit_exceeded'
              })
              .eq("session_id", session_id);

            return new Response(
              JSON.stringify({
                speech_allowed: false,
                reason: "word_limit_exceeded",
                words_spoken: gate.words_spoken,
                max_words: gate.max_words,
                action_required: "terminate_call"
              }),
              { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }

          if (gate.sentences_spoken >= gate.max_sentences) {
            return new Response(
              JSON.stringify({
                speech_allowed: false,
                reason: "sentence_limit_exceeded",
                sentences_spoken: gate.sentences_spoken,
                max_sentences: gate.max_sentences,
                action_required: "terminate_call"
              }),
              { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }

          if (gate.duration_ms >= gate.max_duration_ms) {
            return new Response(
              JSON.stringify({
                speech_allowed: false,
                reason: "duration_limit_exceeded",
                duration_ms: gate.duration_ms,
                max_duration_ms: gate.max_duration_ms,
                action_required: "terminate_call"
              }),
              { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }
        }

        // RULE 5: Determine allowed speech based on corridor phase
        let speechAllowed = false;
        let allowedContent = '';
        let currentPhase = 'unknown';

        switch (corridor.corridor_status) {
          case 'pending':
          case 'phase_a_active':
            speechAllowed = true;
            allowedContent = 'disclosure_only';
            currentPhase = 'disclosure';
            break;
          case 'phase_a_complete':
          case 'phase_b_active':
            speechAllowed = true;
            allowedContent = 'permission_question_only';
            currentPhase = 'permission';
            break;
          case 'phase_b_complete':
          case 'phase_c_active':
            speechAllowed = corridor.permission_response === 'permission_granted';
            allowedContent = speechAllowed ? 'value_prop_only' : 'polite_exit';
            currentPhase = 'value_prop';
            break;
          case 'phase_c_complete':
          case 'corridor_passed':
            speechAllowed = true;
            allowedContent = 'conversation';
            currentPhase = 'conversation';
            break;
          default:
            speechAllowed = false;
            allowedContent = 'none';
            currentPhase = 'blocked';
        }

        // Update gate state
        await supabase
          .from("speech_gate_state")
          .update({ 
            speech_allowed: speechAllowed,
            current_phase: currentPhase,
            updated_at: new Date().toISOString()
          })
          .eq("session_id", session_id);

        return new Response(
          JSON.stringify({
            speech_allowed: speechAllowed,
            current_phase: currentPhase,
            allowed_content: allowedContent,
            corridor_status: corridor.corridor_status,
            words_remaining: gate ? gate.max_words - gate.words_spoken : 45,
            sentences_remaining: gate ? gate.max_sentences - gate.sentences_spoken : 2,
            duration_remaining_ms: gate ? gate.max_duration_ms - gate.duration_ms : 15000
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'log_speech': {
        // Log speech metrics after utterance
        const { words_spoken, sentences_spoken, duration_ms, utterance_text } = body;

        const { data: gate } = await supabase
          .from("speech_gate_state")
          .select("*")
          .eq("session_id", session_id)
          .single();

        if (!gate) {
          return new Response(
            JSON.stringify({ success: false, error: "Gate not found" }),
            { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Increment counters
        const newWords = gate.words_spoken + (words_spoken || 0);
        const newSentences = gate.sentences_spoken + (sentences_spoken || 0);
        const newDuration = gate.duration_ms + (duration_ms || 0);

        // Check if limits exceeded
        const limitExceeded = newWords > gate.max_words || 
                              newSentences > gate.max_sentences || 
                              newDuration > gate.max_duration_ms;

        await supabase
          .from("speech_gate_state")
          .update({
            words_spoken: newWords,
            sentences_spoken: newSentences,
            duration_ms: newDuration,
            limit_exceeded: limitExceeded,
            exceeded_at: limitExceeded ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq("session_id", session_id);

        return new Response(
          JSON.stringify({
            success: true,
            words_spoken: newWords,
            sentences_spoken: newSentences,
            duration_ms: newDuration,
            limit_exceeded: limitExceeded,
            words_remaining: gate.max_words - newWords,
            sentences_remaining: gate.max_sentences - newSentences,
            duration_remaining_ms: gate.max_duration_ms - newDuration
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'terminate': {
        // Immediately block all speech
        await supabase
          .from("speech_gate_state")
          .update({
            speech_allowed: false,
            current_phase: 'terminated',
            updated_at: new Date().toISOString()
          })
          .eq("session_id", session_id);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Speech gate terminated - AI muted"
          }),
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
    console.error("❌ Error in speech-gate:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
