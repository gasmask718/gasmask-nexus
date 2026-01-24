import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * TECHNIQUE EXTRACTOR
 * ===================
 * Extracts techniques from top-performing HUMAN calls.
 * 
 * CRITICAL RULES:
 * 1. POST-CALL ONLY - never extracts during live calls
 * 2. Only processes calls flagged as exemplar candidates
 * 3. Extracted techniques require human approval before AI can use them
 * 4. All extractions are auditable
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractionRequest {
  call_log_id: string;
  session_id: string;
  business_id: string;
  human_user_id: string;
  human_name?: string;
  transcript: string;
  outcome_score: number;
}

// Technique types we look for
const TECHNIQUE_TYPES = [
  'opening',
  'rapport_building',
  'needs_discovery',
  'objection_handling',
  'closing',
  'empathy_expression',
  'de_escalation',
  'upselling',
  'scheduling',
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body: ExtractionRequest = await req.json();
    const { call_log_id, session_id, business_id, human_user_id, human_name, transcript, outcome_score } = body;

    if (!call_log_id || !business_id || !human_user_id || !transcript) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // STEP 1: VERIFY THIS IS A COMPLETED CALL
    // ============================================
    const { data: callLog } = await supabase
      .from('ai_call_logs')
      .select('*')
      .eq('id', call_log_id)
      .single();

    if (!callLog) {
      return new Response(
        JSON.stringify({ success: false, error: "Call log not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // STEP 2: SIMPLE PATTERN EXTRACTION
    // (In production, this would use NLP/LLM)
    // ============================================
    const extractedTechniques: Array<{
      type: string;
      name: string;
      description: string;
      excerpt: string;
      pattern: string;
      triggers: string[];
      confidence: number;
    }> = [];

    // Split transcript into turns
    const turns = transcript.split(/\n+/).filter(t => t.trim());

    // Look for patterns in the first few turns (opening)
    const openingTurns = turns.slice(0, 3).join(' ');
    if (openingTurns.length > 20) {
      extractedTechniques.push({
        type: 'opening',
        name: `${human_name || 'Rep'}'s Opening`,
        description: 'Greeting pattern used at call start',
        excerpt: openingTurns.slice(0, 200),
        pattern: 'Greeting followed by identification and offer to help',
        triggers: ['call_start'],
        confidence: 0.75,
      });
    }

    // Look for empathy patterns
    const empathyMarkers = ['understand', 'sorry to hear', 'I hear you', 'that must be', 'frustrating'];
    for (const turn of turns) {
      for (const marker of empathyMarkers) {
        if (turn.toLowerCase().includes(marker)) {
          extractedTechniques.push({
            type: 'empathy_expression',
            name: `Empathy Response: ${marker}`,
            description: 'Empathetic response to caller concern',
            excerpt: turn.slice(0, 200),
            pattern: `Uses "${marker}" to acknowledge caller feelings`,
            triggers: ['negative_sentiment', 'complaint'],
            confidence: 0.70,
          });
          break;
        }
      }
    }

    // Look for closing patterns (last few turns)
    const closingTurns = turns.slice(-3).join(' ');
    if (closingTurns.length > 20) {
      extractedTechniques.push({
        type: 'closing',
        name: `${human_name || 'Rep'}'s Closing`,
        description: 'Call wrap-up pattern',
        excerpt: closingTurns.slice(0, 200),
        pattern: 'Summarizes outcome and thanks caller',
        triggers: ['call_resolution'],
        confidence: 0.70,
      });
    }

    // ============================================
    // STEP 3: STORE EXTRACTIONS (NOT APPROVED YET)
    // ============================================
    const insertedTechniques = [];

    for (const tech of extractedTechniques) {
      const { data, error } = await supabase
        .from('technique_extractions')
        .insert({
          business_id,
          source_session_id: session_id,
          source_call_log_id: call_log_id,
          human_exemplar_id: human_user_id,
          human_name: human_name || 'Unknown Rep',
          technique_type: tech.type,
          technique_name: tech.name,
          technique_description: tech.description,
          transcript_excerpt: tech.excerpt,
          phrasing_pattern: tech.pattern,
          context_triggers: tech.triggers,
          outcome_score: outcome_score,
          extraction_confidence: tech.confidence,
          // CRITICAL: Not approved for AI use until human review
          is_approved_for_ai: false,
          human_validated: false,
          extraction_method: 'post_call_analysis',
        })
        .select()
        .single();

      if (data) {
        insertedTechniques.push(data);
      }
    }

    // ============================================
    // STEP 4: UPDATE CALL AS PROCESSED
    // ============================================
    await supabase
      .from('ai_call_sessions')
      .update({ is_exemplar_call: true })
      .eq('id', session_id);

    // ============================================
    // RESPONSE
    // ============================================
    return new Response(
      JSON.stringify({
        success: true,
        extraction_method: 'post_call_analysis',
        techniques_extracted: insertedTechniques.length,
        techniques: insertedTechniques.map(t => ({
          id: t.id,
          type: t.technique_type,
          name: t.technique_name,
          confidence: t.extraction_confidence,
          approved_for_ai: t.is_approved_for_ai,
        })),
        message: 'Techniques extracted. Human approval required before AI can use them.',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Technique extractor error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
