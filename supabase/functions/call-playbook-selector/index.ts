import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * PLAYBOOK SELECTOR
 * =================
 * Selects appropriate playbook + style for a call.
 * 
 * CRITICAL RULES:
 * 1. ONLY selects if Call State Authority permits speech
 * 2. Styles influence WORDING, not DECISIONS
 * 3. All selections are logged and auditable
 * 4. This is advisory - AI still needs state authority approval to speak
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SelectionRequest {
  session_id: string;
  business_id: string;
  detected_intent?: string;
  caller_keywords?: string[];
  caller_sentiment?: string;
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
    const body: SelectionRequest = await req.json();
    const { session_id, business_id, detected_intent, caller_keywords, caller_sentiment } = body;

    if (!session_id || !business_id) {
      return new Response(
        JSON.stringify({ success: false, error: "session_id and business_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // STEP 1: CHECK CALL STATE AUTHORITY
    // ============================================
    const { data: stateCheck } = await supabase.functions.invoke('call-state-orchestrator', {
      body: {
        action: 'check_speech_permission',
        session_id,
      },
    });

    const speechPermitted = stateCheck?.ai_speech_allowed === true;
    const currentState = stateCheck?.current_state;

    // ============================================
    // STEP 2: SELECT PLAYBOOK (based on intent)
    // ============================================
    let selectedPlaybook = null;

    if (detected_intent) {
      // Find playbook matching the intent
      const { data: matchingPlaybooks } = await supabase
        .from('sales_playbooks')
        .select('*')
        .eq('business_id', business_id)
        .eq('is_active', true)
        .contains('target_intents', [detected_intent])
        .order('avg_outcome_score', { ascending: false, nullsFirst: false })
        .limit(1);

      if (matchingPlaybooks && matchingPlaybooks.length > 0) {
        selectedPlaybook = matchingPlaybooks[0];
      }
    }

    // Fallback to default playbook if no match
    if (!selectedPlaybook) {
      const { data: defaultPlaybook } = await supabase
        .from('sales_playbooks')
        .select('*')
        .eq('business_id', business_id)
        .eq('is_active', true)
        .eq('is_default', true)
        .single();

      selectedPlaybook = defaultPlaybook;
    }

    // ============================================
    // STEP 3: SELECT STYLE PROFILE
    // ============================================
    let selectedStyle = null;

    // If caller sentiment is negative, prefer empathetic styles
    if (caller_sentiment === 'negative' || caller_sentiment === 'frustrated') {
      const { data: empatheticStyles } = await supabase
        .from('speaker_style_profiles')
        .select('*')
        .eq('business_id', business_id)
        .eq('is_active', true)
        .eq('tone', 'empathetic')
        .order('avg_caller_satisfaction', { ascending: false, nullsFirst: false })
        .limit(1);

      if (empatheticStyles && empatheticStyles.length > 0) {
        selectedStyle = empatheticStyles[0];
      }
    }

    // Otherwise, select best performing style
    if (!selectedStyle) {
      const { data: topStyles } = await supabase
        .from('speaker_style_profiles')
        .select('*')
        .eq('business_id', business_id)
        .eq('is_active', true)
        .order('avg_caller_satisfaction', { ascending: false, nullsFirst: false })
        .limit(1);

      if (topStyles && topStyles.length > 0) {
        selectedStyle = topStyles[0];
      }
    }

    // ============================================
    // STEP 4: LOG THE SELECTION (ALWAYS)
    // ============================================
    const selectionReason = [
      detected_intent ? `Intent: ${detected_intent}` : null,
      caller_sentiment ? `Sentiment: ${caller_sentiment}` : null,
      speechPermitted ? 'Speech permitted' : 'Speech NOT permitted',
    ].filter(Boolean).join('; ');

    const { data: usageLog } = await supabase
      .from('playbook_usage_log')
      .insert({
        session_id,
        business_id,
        playbook_id: selectedPlaybook?.id || null,
        style_profile_id: selectedStyle?.id || null,
        selection_reason: selectionReason,
        state_authority_approved: speechPermitted,
        state_at_selection: currentState || 'unknown',
        speech_was_permitted: speechPermitted,
      })
      .select()
      .single();

    // ============================================
    // STEP 5: UPDATE SESSION (if selections made)
    // ============================================
    if (selectedPlaybook || selectedStyle) {
      await supabase
        .from('ai_call_sessions')
        .update({
          playbook_id: selectedPlaybook?.id,
          style_profile_id: selectedStyle?.id,
        })
        .eq('id', session_id);
    }

    // ============================================
    // RESPONSE
    // ============================================
    return new Response(
      JSON.stringify({
        success: true,
        
        // State authority status
        speech_permitted: speechPermitted,
        current_state: currentState,
        
        // Selections (advisory only - AI still needs state approval to speak)
        playbook: selectedPlaybook ? {
          id: selectedPlaybook.id,
          name: selectedPlaybook.name,
          structure: selectedPlaybook.structure,
          allowed_tactics: selectedPlaybook.allowed_tactics,
          forbidden_tactics: selectedPlaybook.forbidden_tactics,
          max_duration_seconds: selectedPlaybook.max_duration_seconds,
          escalation_triggers: selectedPlaybook.escalation_triggers,
          confidence_floor: selectedPlaybook.confidence_floor,
        } : null,
        
        style: selectedStyle ? {
          id: selectedStyle.id,
          name: selectedStyle.name,
          tone: selectedStyle.tone,
          pacing: selectedStyle.pacing,
          energy_level: selectedStyle.energy_level,
          uses_humor: selectedStyle.uses_humor,
          uses_questions: selectedStyle.uses_questions,
          mirroring_enabled: selectedStyle.mirroring_enabled,
          formality_level: selectedStyle.formality_level,
          // Example phrases for AI to learn from (not templates)
          greeting_examples: selectedStyle.greeting_examples,
          empathy_expressions: selectedStyle.empathy_expressions,
        } : null,
        
        // Audit
        usage_log_id: usageLog?.id,
        selection_reason: selectionReason,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Playbook selector error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
